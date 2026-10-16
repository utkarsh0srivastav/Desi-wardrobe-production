import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, logFirestoreError, OperationType } from '../firebase';
import {
  Booking,
  DeliveryAssignment,
  DeliveryPartner,
  DeliveryPartnerApprovalStatus,
  DeliveryPartnerStatus,
  ForcefulCancellationRequest,
  VehicleType,
} from '../types/models';
import { storage } from '../utils/storage';
import { inventoryService } from './inventoryService';
import { persistBookingToFirestore } from './bookingService';
import {
  hashPinSync,
  hashSecurityAnswerSync,
  verifyPinSync,
  verifySecurityAnswerSync,
} from '../utils/crypto';
import { uploadDeliveryPartnerFile } from './supabaseStorage';

export const MAX_TAKEAWAY_RADIUS_KM = 100;
export const MAX_DELIVERY_RADIUS_KM = 15;

/**
 * Checks whether current server/device time is within normal Delivery hours
 * (10:00 AM to 10:00 PM India Standard Time, UTC+5:30).
 */
export function isDeliveryOperatingHoursIST(date: Date = new Date()): boolean {
  try {
    const istString = date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    });
    const parts = istString.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1] || '0', 10);
    const totalMinutes = hour * 60 + minute;
    // Available from 10:00 AM (600 mins) to 10:00 PM (1320 mins)
    return totalMinutes >= 600 && totalMinutes < 1320;
  } catch {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60 * 1000;
    const istDate = new Date(istMs);
    const hour = istDate.getHours();
    return hour >= 10 && hour < 22;
  }
}

export function getDeliveryHoursNotice(): string {
  return 'Normal Delivery is available between 10:00 AM and 10:00 PM IST. Delivery is currently closed.';
}

/**
 * Configurable delivery fee calculation:
 * - Base delivery charge: ₹40 for up to 5 KM
 * - Additional ₹10 per KM beyond 5 KM up to 15 KM max radius
 */
export function calculateDeliveryCharge(distanceKm: number = 0): number {
  if (distanceKm <= 0) return 40;
  const effectiveDistance = Math.min(MAX_DELIVERY_RADIUS_KM, Math.max(0, distanceKm));
  if (effectiveDistance <= 5) {
    return 40;
  }
  const extraKm = Math.ceil(effectiveDistance - 5);
  return 40 + extraKm * 10;
}

export function sanitizeDeliveryPartnerForFirestore(dp: DeliveryPartner): DeliveryPartner {
  const clean: DeliveryPartner = {
    partnerId: dp.partnerId,
    name: (dp.name || '').slice(0, 120),
    contactNumber: dp.contactNumber.slice(0, 15),
    upiId: (dp.upiId || '').slice(0, 100),
    status: dp.status || 'OFFLINE',
    approvalStatus: dp.approvalStatus || 'PENDING',
    verificationStatus: dp.verificationStatus || 'UNVERIFIED',
    createdAt: dp.createdAt,
    updatedAt: dp.updatedAt || new Date().toISOString(),
  };

  if (typeof dp.serialNumber === 'number') clean.serialNumber = dp.serialNumber;
  if (dp.email) clean.email = dp.email.slice(0, 120);
  if (dp.residentialAddress) clean.residentialAddress = dp.residentialAddress.slice(0, 300);
  if (dp.serviceArea) clean.serviceArea = dp.serviceArea.slice(0, 150);
  if (dp.vehicleType) clean.vehicleType = dp.vehicleType;
  if (dp.vehicleNumber) clean.vehicleNumber = dp.vehicleNumber.slice(0, 30);
  if (dp.pin) clean.pin = dp.pin.slice(0, 128);
  if (dp.securityQuestion) clean.securityQuestion = dp.securityQuestion.slice(0, 200);
  if (dp.securityAnswerHash) clean.securityAnswerHash = dp.securityAnswerHash.slice(0, 128);
  if (typeof dp.failedPinAttempts === 'number') clean.failedPinAttempts = dp.failedPinAttempts;
  if (dp.pinLockedUntil) clean.pinLockedUntil = dp.pinLockedUntil;

  if (dp.profilePhoto) clean.profilePhoto = dp.profilePhoto;
  if (dp.profilePhotoUploadedAt) clean.profilePhotoUploadedAt = dp.profilePhotoUploadedAt;
  if (typeof dp.profilePhotoLocked === 'boolean') clean.profilePhotoLocked = dp.profilePhotoLocked;

  if (dp.aadhaarFrontDoc) clean.aadhaarFrontDoc = dp.aadhaarFrontDoc;
  if (dp.aadhaarBackDoc) clean.aadhaarBackDoc = dp.aadhaarBackDoc;
  if (dp.drivingLicenceFrontDoc) clean.drivingLicenceFrontDoc = dp.drivingLicenceFrontDoc;
  if (dp.drivingLicenceBackDoc) clean.drivingLicenceBackDoc = dp.drivingLicenceBackDoc;

  if (dp.rejectionReason) clean.rejectionReason = dp.rejectionReason.slice(0, 300);
  if (dp.currentActiveOrderId) clean.currentActiveOrderId = dp.currentActiveOrderId;
  if (dp.pendingAssignedOrderId) clean.pendingAssignedOrderId = dp.pendingAssignedOrderId;
  if (typeof dp.completedDeliveries === 'number') clean.completedDeliveries = dp.completedDeliveries;
  if (typeof dp.totalEarnings === 'number') clean.totalEarnings = dp.totalEarnings;
  if (dp.approvedAt) clean.approvedAt = dp.approvedAt;

  return clean;
}

export async function persistDeliveryPartnerToFirestore(
  dp: DeliveryPartner,
  op: OperationType
): Promise<void> {
  const path = `deliveryPartners/${dp.partnerId}`;
  try {
    const clean = sanitizeDeliveryPartnerForFirestore(dp);
    await setDoc(doc(db, 'deliveryPartners', dp.partnerId), clean, { merge: true });
  } catch (error) {
    logFirestoreError(error, op, path);
  }
}

export const deliveryService = {
  getDeliveryPartners: (): DeliveryPartner[] => {
    return storage.getDeliveryPartners();
  },

  isDeliveryHoursOpen: (): boolean => {
    return isDeliveryOperatingHoursIST();
  },

  getDeliveryCharge: (distanceKm: number): number => {
    return calculateDeliveryCharge(distanceKm);
  },

  getPartnerById: (partnerId: string): DeliveryPartner | undefined => {
    return deliveryService.getDeliveryPartners().find((p) => p.partnerId === partnerId);
  },

  getPartnerByMobile: (mobile: string): DeliveryPartner | undefined => {
    const clean = mobile.replace(/\D/g, '');
    return deliveryService.getDeliveryPartners().find((p) => p.contactNumber === clean);
  },

  getCurrentDeliveryPartner: (): DeliveryPartner | null => {
    const activeId = storage.getActiveDeliveryPartnerId();
    if (!activeId) return null;
    return deliveryService.getPartnerById(activeId) || null;
  },

  logout: (): void => {
    storage.setActiveDeliveryPartnerId(null);
  },

  subscribeToDeliveryPartners: (
    onUpdate: (partners: DeliveryPartner[]) => void
  ): (() => void) => {
    const partnersQuery = query(collection(db, 'deliveryPartners'));
    return onSnapshot(
      partnersQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const remoteList: DeliveryPartner[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DeliveryPartner;
          if (data && (data.partnerId || docSnap.id)) {
            remoteList.push({
              ...data,
              partnerId: data.partnerId || docSnap.id,
            });
          }
        });

        if (remoteList.length > 0) {
          // Merge with local storage
          const localMap = new Map(storage.getDeliveryPartners().map((p) => [p.partnerId, p]));
          for (const remote of remoteList) {
            localMap.set(remote.partnerId, { ...localMap.get(remote.partnerId), ...remote });
          }
          const merged = Array.from(localMap.values());
          storage.saveDeliveryPartners(merged);
          onUpdate(merged);
        } else {
          onUpdate(storage.getDeliveryPartners());
        }
      },
      (error) => {
        logFirestoreError(error, OperationType.GET, 'deliveryPartners');
      }
    );
  },

  /**
   * SECTION 3 — DELIVERY PARTNER REGISTRATION
   * Generates a permanent unique Partner ID (e.g. DP-1001, DP-1002).
   * Validates legal name, 10-digit Indian mobile, vehicle, UPI ID, PIN, security question/answer,
   * camera-captured profile photo, and identity documents (Aadhaar, Driving Licence).
   * Account status starts as PENDING until Admin review.
   */
  registerDeliveryPartnerDirect: async (params: {
    name: string;
    contactNumber: string;
    email?: string;
    residentialAddress: string;
    serviceArea: string;
    vehicleType: VehicleType;
    vehicleNumber: string;
    upiId: string;
    pin: string;
    confirmPin: string;
    securityQuestion: string;
    securityAnswer: string;
    profilePhotoFileOrDataUrl: File | string;
    aadhaarFrontFileOrDataUrl: File | string;
    aadhaarBackFileOrDataUrl: File | string;
    drivingLicenceFrontFileOrDataUrl: File | string;
    drivingLicenceBackFileOrDataUrl: File | string;
  }): Promise<DeliveryPartner> => {
    const cleanName = params.name.trim();
    const cleanMobile = params.contactNumber.replace(/\D/g, '');
    const cleanUpi = params.upiId.trim();
    const cleanPin = params.pin.trim();
    const cleanConfirm = params.confirmPin.trim();
    const cleanQuestion = params.securityQuestion.trim();
    const cleanAnswer = params.securityAnswer.trim();
    const cleanAddress = params.residentialAddress.trim();
    const cleanArea = params.serviceArea.trim();
    const cleanVehNumber = params.vehicleNumber.trim().toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please enter Delivery Partner’s full legal name (at least 2 characters).');
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }
    if (!cleanAddress || cleanAddress.length < 5) {
      throw new Error('Please enter your full residential address.');
    }
    if (!cleanArea) {
      throw new Error('Please specify your operational service area / city.');
    }
    if (!cleanVehNumber) {
      throw new Error('Please enter your vehicle registration number.');
    }
    if (!cleanUpi || !cleanUpi.includes('@')) {
      throw new Error('Please enter a valid UPI ID (e.g., yourname@bank or 9876543210@paytm).');
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('Security PIN must be exactly 4 digits.');
    }
    if (cleanPin !== cleanConfirm) {
      throw new Error('PIN and Confirm PIN do not match.');
    }
    if (!cleanQuestion) {
      throw new Error('Please select or specify a security question for PIN recovery.');
    }
    if (!cleanAnswer || cleanAnswer.length < 2) {
      throw new Error('Please provide an answer to your security question.');
    }

    // Check duplicate account
    const existing = deliveryService.getPartnerByMobile(cleanMobile);
    if (existing && existing.approvalStatus !== 'REJECTED') {
      throw new Error(
        `An account with mobile +91 ${cleanMobile} already exists (${existing.partnerId}). Please log in.`
      );
    }

    const currentList = deliveryService.getDeliveryPartners();
    const nextSerial =
      currentList.length > 0
        ? Math.max(...currentList.map((p) => p.serialNumber || 1000)) + 1
        : 1001;
    const partnerId = existing?.partnerId || `DP-${nextSerial}`;

    // Upload Profile Photo via Supabase Storage
    const photoUpload = await uploadDeliveryPartnerFile({
      fileOrDataUrl: params.profilePhotoFileOrDataUrl,
      partnerId,
      documentType: 'profile_photo',
    });

    // Upload Documents via Supabase Storage
    const aadhaarFrontUpload = await uploadDeliveryPartnerFile({
      fileOrDataUrl: params.aadhaarFrontFileOrDataUrl,
      partnerId,
      documentType: 'aadhaar_front',
    });
    const aadhaarBackUpload = await uploadDeliveryPartnerFile({
      fileOrDataUrl: params.aadhaarBackFileOrDataUrl,
      partnerId,
      documentType: 'aadhaar_back',
    });
    const dlFrontUpload = await uploadDeliveryPartnerFile({
      fileOrDataUrl: params.drivingLicenceFrontFileOrDataUrl,
      partnerId,
      documentType: 'driving_licence_front',
    });
    const dlBackUpload = await uploadDeliveryPartnerFile({
      fileOrDataUrl: params.drivingLicenceBackFileOrDataUrl,
      partnerId,
      documentType: 'driving_licence_back',
    });

    const nowIso = new Date().toISOString();
    const hashedPin = hashPinSync(cleanPin, cleanMobile);
    const hashedAnswer = hashSecurityAnswerSync(cleanAnswer, cleanMobile);

    const newPartner: DeliveryPartner = {
      partnerId,
      serialNumber: nextSerial,
      name: cleanName,
      contactNumber: cleanMobile,
      email: params.email?.trim().toLowerCase() || undefined,
      residentialAddress: cleanAddress,
      serviceArea: cleanArea,
      vehicleType: params.vehicleType,
      vehicleNumber: cleanVehNumber,
      upiId: cleanUpi,
      pin: hashedPin,
      securityQuestion: cleanQuestion,
      securityAnswerHash: hashedAnswer,
      failedPinAttempts: 0,
      profilePhoto: photoUpload.url,
      profilePhotoUploadedAt: nowIso,
      profilePhotoLocked: true, // Photo locked upon verification
      aadhaarFrontDoc: aadhaarFrontUpload.url,
      aadhaarBackDoc: aadhaarBackUpload.url,
      drivingLicenceFrontDoc: dlFrontUpload.url,
      drivingLicenceBackDoc: dlBackUpload.url,
      status: 'OFFLINE',
      approvalStatus: 'PENDING', // Remains PENDING until Admin approval
      verificationStatus: 'UNVERIFIED',
      completedDeliveries: 0,
      totalEarnings: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedList = [newPartner, ...currentList.filter((p) => p.partnerId !== partnerId)];
    storage.saveDeliveryPartners(updatedList);
    void persistDeliveryPartnerToFirestore(newPartner, OperationType.CREATE);

    return newPartner;
  },

  /**
   * Admin Direct Registration helper
   */
  registerDeliveryPartner: (params: {
    name: string;
    contactNumber: string;
    upiId: string;
    status: DeliveryPartnerStatus;
  }): DeliveryPartner => {
    const cleanName = params.name.trim();
    const cleanMobile = params.contactNumber.replace(/\D/g, '');
    const cleanUpi = params.upiId.trim();

    if (!cleanName) throw new Error('Please enter partner name.');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    if (!cleanUpi) throw new Error('Please enter partner UPI ID.');

    const currentList = deliveryService.getDeliveryPartners();
    const nextSerial =
      currentList.length > 0
        ? Math.max(...currentList.map((p) => p.serialNumber || 1000)) + 1
        : 1001;
    const partnerId = `DP-${nextSerial}`;
    const nowIso = new Date().toISOString();

    const newPartner: DeliveryPartner = {
      partnerId,
      serialNumber: nextSerial,
      name: cleanName,
      contactNumber: cleanMobile,
      upiId: cleanUpi,
      pin: hashPinSync('1234', cleanMobile), // Default PIN
      status: params.status,
      approvalStatus: 'APPROVED',
      verificationStatus: 'VERIFIED',
      completedDeliveries: 0,
      totalEarnings: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      approvedAt: nowIso,
    };

    const updatedList = [newPartner, ...currentList.filter((p) => p.partnerId !== partnerId)];
    storage.saveDeliveryPartners(updatedList);
    void persistDeliveryPartnerToFirestore(newPartner, OperationType.CREATE);
    return newPartner;
  },

  /**
   * SECTION 5 — DELIVERY PARTNER LOGIN WITH RATE LIMITING
   */
  loginDeliveryPartnerWithPin: async (
    rawMobile: string,
    enteredPin: string
  ): Promise<DeliveryPartner> => {
    const cleanMobile = rawMobile.replace(/\D/g, '');
    const partner = deliveryService.getPartnerByMobile(cleanMobile);

    if (!partner) {
      throw new Error(
        'No registered Delivery Partner account found with this mobile number. Please register first.'
      );
    }

    if (partner.approvalStatus === 'REJECTED') {
      throw new Error(
        `Your Delivery Partner application was rejected by Admin.${
          partner.rejectionReason ? ` Reason: ${partner.rejectionReason}` : ''
        }`
      );
    }

    if (partner.approvalStatus === 'SUSPENDED') {
      throw new Error(
        'Your Delivery Partner account has been temporarily suspended by Admin. Please contact support.'
      );
    }

    // Rate limiting check: 5 attempts -> 15 min lock
    const nowMs = Date.now();
    if (partner.pinLockedUntil) {
      const lockExpiryMs = new Date(partner.pinLockedUntil).getTime();
      if (!Number.isNaN(lockExpiryMs) && lockExpiryMs > nowMs) {
        const remainingMinutes = Math.max(1, Math.ceil((lockExpiryMs - nowMs) / 60000));
        throw new Error(
          `Account is temporarily locked due to repeated incorrect PIN entries. Please try again in ${remainingMinutes} minute(s) or use Forgot PIN.`
        );
      }
    }

    const cleanPin = enteredPin.trim();
    const isValid = partner.pin
      ? verifyPinSync(cleanPin, partner.pin, cleanMobile)
      : false;

    const list = storage.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === partner.partnerId);

    if (!isValid) {
      const newFailures = (partner.failedPinAttempts || 0) + 1;
      const isNowLocked = newFailures >= 5;
      const lockExpiryIso = isNowLocked ? new Date(nowMs + 15 * 60 * 1000).toISOString() : undefined;

      const updatedPartner: DeliveryPartner = {
        ...partner,
        failedPinAttempts: newFailures,
        ...(isNowLocked ? { pinLockedUntil: lockExpiryIso } : {}),
      };

      if (idx !== -1) {
        list[idx] = updatedPartner;
        storage.saveDeliveryPartners(list);
        void persistDeliveryPartnerToFirestore(updatedPartner, OperationType.UPDATE);
      }

      if (isNowLocked) {
        throw new Error(
          'Account is locked for 15 minutes due to 5 consecutive incorrect PIN entries. Use Forgot PIN to reset.'
        );
      }

      const remaining = 5 - newFailures;
      throw new Error(`Incorrect PIN. ${remaining} attempt(s) remaining before temporary lockout.`);
    }

    // Successful login: reset attempts
    const resetPartner: DeliveryPartner = {
      ...partner,
      failedPinAttempts: 0,
      pinLockedUntil: undefined,
    };
    if (idx !== -1) {
      list[idx] = resetPartner;
      storage.saveDeliveryPartners(list);
      void persistDeliveryPartnerToFirestore(resetPartner, OperationType.UPDATE);
    }

    storage.setActiveDeliveryPartnerId(resetPartner.partnerId);
    return resetPartner;
  },

  /**
   * Reset PIN using registered Security Question & Answer
   */
  resetDeliveryPartnerPinWithSecurityAnswer: async (params: {
    mobile: string;
    securityAnswer: string;
    newPin: string;
    confirmPin: string;
  }): Promise<DeliveryPartner> => {
    const cleanMobile = params.mobile.replace(/\D/g, '');
    const cleanPin = params.newPin.trim();
    const cleanConfirm = params.confirmPin.trim();
    const cleanAnswer = params.securityAnswer.trim();

    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    const partner = deliveryService.getPartnerByMobile(cleanMobile);
    if (!partner) {
      throw new Error('No registered Delivery Partner account found with this mobile number.');
    }
    if (!partner.securityAnswerHash) {
      throw new Error(
        'No security question was configured for this account. Please contact Desi Wardrobe Admin.'
      );
    }
    if (!cleanAnswer) {
      throw new Error('Please enter your security answer.');
    }

    const answerMatches = verifySecurityAnswerSync(
      cleanAnswer,
      partner.securityAnswerHash,
      cleanMobile
    );
    if (!answerMatches) {
      throw new Error('The security answer you entered is incorrect.');
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('New PIN must be a 4-digit number.');
    }
    if (cleanPin !== cleanConfirm) {
      throw new Error('New PIN and Confirm PIN do not match.');
    }

    const hashedPin = hashPinSync(cleanPin, cleanMobile);
    const updated: DeliveryPartner = {
      ...partner,
      pin: hashedPin,
      failedPinAttempts: 0,
      pinLockedUntil: undefined,
      updatedAt: new Date().toISOString(),
    };

    const list = storage.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === partner.partnerId);
    if (idx !== -1) {
      list[idx] = updated;
      storage.saveDeliveryPartners(list);
      void persistDeliveryPartnerToFirestore(updated, OperationType.UPDATE);
    }

    return updated;
  },

  /**
   * SECTION 7 — ONLINE AND OFFLINE STATUS
   * A Partner can become ONLINE only if:
   * - Account is approved (approvalStatus === 'APPROVED')
   * - Account is not suspended
   */
  togglePartnerOnlineStatus: (partnerId: string): DeliveryPartner => {
    const list = deliveryService.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === partnerId);
    if (idx === -1) throw new Error('Delivery partner not found.');

    const current = list[idx];

    if (current.approvalStatus !== 'APPROVED') {
      throw new Error(
        `Cannot go Online. Your account status is currently ${current.approvalStatus}. Only Admin-approved partners can go Online.`
      );
    }

    if (current.status === 'CURRENTLY_DELIVERING') {
      throw new Error(
        'Cannot go Offline while actively fulfilling a delivery order. Please complete or report the active delivery first.'
      );
    }

    const nextStatus: DeliveryPartnerStatus = current.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const updated: DeliveryPartner = {
      ...current,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    storage.saveDeliveryPartners(list);
    void persistDeliveryPartnerToFirestore(updated, OperationType.UPDATE);
    return updated;
  },

  /**
   * SECTION 4 — ANNUAL PROFILE PHOTO REPLACEMENT RESTRICTION
   * The first profile photo is camera-only and locked.
   * Can be updated only 365 days after the previous upload.
   */
  updateProfilePhotoWithAnnualRestriction: async (
    partnerId: string,
    fileOrDataUrl: File | string
  ): Promise<DeliveryPartner> => {
    const partner = deliveryService.getPartnerById(partnerId);
    if (!partner) throw new Error('Delivery partner not found.');

    const now = Date.now();
    if (partner.profilePhotoUploadedAt && partner.profilePhotoLocked) {
      const uploadDateMs = new Date(partner.profilePhotoUploadedAt).getTime();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const elapsedMs = now - uploadDateMs;

      if (elapsedMs < oneYearMs) {
        const remainingDays = Math.ceil((oneYearMs - elapsedMs) / (24 * 60 * 60 * 1000));
        throw new Error(
          `Profile photo is locked under the annual restriction policy. You can update your profile photo in ${remainingDays} day(s).`
        );
      }
    }

    const result = await uploadDeliveryPartnerFile({
      fileOrDataUrl,
      partnerId,
      documentType: 'profile_photo',
    });

    const nowIso = new Date().toISOString();
    const updated: DeliveryPartner = {
      ...partner,
      profilePhoto: result.url,
      profilePhotoUploadedAt: nowIso,
      profilePhotoLocked: true,
      updatedAt: nowIso,
    };

    const list = storage.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === partnerId);
    if (idx !== -1) {
      list[idx] = updated;
      storage.saveDeliveryPartners(list);
      void persistDeliveryPartnerToFirestore(updated, OperationType.UPDATE);
    }

    return updated;
  },

  /**
   * Admin approves, rejects, or suspends a Delivery Partner application.
   */
  updatePartnerApprovalStatus: (params: {
    partnerId: string;
    decision: DeliveryPartnerApprovalStatus;
    rejectionReason?: string;
  }): DeliveryPartner => {
    const list = storage.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === params.partnerId);
    if (idx === -1) throw new Error('Delivery partner not found.');

    const current = list[idx];
    const nowIso = new Date().toISOString();

    const updated: DeliveryPartner = {
      ...current,
      approvalStatus: params.decision,
      verificationStatus: params.decision === 'APPROVED' ? 'VERIFIED' : current.verificationStatus,
      status: params.decision === 'APPROVED' ? current.status : 'OFFLINE',
      rejectionReason: params.decision === 'REJECTED' ? params.rejectionReason : undefined,
      approvedAt: params.decision === 'APPROVED' ? nowIso : current.approvedAt,
      updatedAt: nowIso,
    };

    list[idx] = updated;
    storage.saveDeliveryPartners(list);
    void persistDeliveryPartnerToFirestore(updated, OperationType.UPDATE);
    return updated;
  },

  /**
   * SECTION 8 & 9 — ORDER ASSIGNMENT & ONE ACTIVE DELIVERY RULE
   * A Delivery Partner can have at most ONE active delivery at a time.
   */
  claimOrAssignDeliveryOrder: (params: {
    bookingId: string;
    partnerId: string;
    adminUid?: string;
  }): { booking: Booking; partner: DeliveryPartner } => {
    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b: Booking) =>
        b.bookingId === params.bookingId ||
        b.bookingReference === params.bookingId ||
        b.documentId === params.bookingId
    );
    if (bIndex === -1) {
      throw new Error('Order not found.');
    }

    const partner = deliveryService.getPartnerById(params.partnerId);
    if (!partner) {
      throw new Error('Delivery partner not found.');
    }

    if (partner.approvalStatus !== 'APPROVED') {
      throw new Error('Only Admin-approved Delivery Partners can accept or be assigned delivery orders.');
    }

    // ONE ACTIVE DELIVERY RULE
    if (
      partner.currentActiveOrderId &&
      partner.currentActiveOrderId !== bookings[bIndex].bookingId
    ) {
      throw new Error(
        `Partner ${partner.name} already has an active delivery (${partner.currentActiveOrderId}). A partner can handle only one active delivery at a time.`
      );
    }

    const targetBooking = bookings[bIndex];
    if (
      targetBooking.assignedPartnerId &&
      targetBooking.assignedPartnerId !== partner.partnerId &&
      !params.adminUid
    ) {
      throw new Error('This order has already been assigned to another Delivery Partner.');
    }

    // Generate secure 6-digit numeric pickup code
    const sixDigitPickupCode =
      targetBooking.pickupCode && /^\d{6}$/.test(targetBooking.pickupCode)
        ? targetBooking.pickupCode
        : Math.floor(100000 + Math.random() * 900000).toString();

    const now = new Date();
    const pickupExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const updatedBooking: Booking = {
      ...targetBooking,
      assignedPartnerId: partner.partnerId,
      assignedPartnerName: partner.name,
      deliveryMode: 'DELIVERY',
      pickupCode: sixDigitPickupCode,
      pickupCodeExpiresAt: pickupExpiry,
      pickupCodeAttempts: 0,
    };

    bookings[bIndex] = updatedBooking;
    storage.saveBookings(bookings);
    void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

    // Update partner to CURRENTLY_DELIVERING
    const partners = deliveryService.getDeliveryPartners();
    const pIndex = partners.findIndex((p) => p.partnerId === partner.partnerId);
    if (pIndex !== -1) {
      partners[pIndex] = {
        ...partners[pIndex],
        status: 'CURRENTLY_DELIVERING',
        currentActiveOrderId: targetBooking.bookingId,
        updatedAt: now.toISOString(),
      };
      storage.saveDeliveryPartners(partners);
      void persistDeliveryPartnerToFirestore(partners[pIndex], OperationType.UPDATE);
    }

    // Record assignment log
    const assignments = storage.getDeliveryAssignments();
    const newAssignment: DeliveryAssignment = {
      assignmentId: `ASGN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      orderId: targetBooking.bookingId,
      bookingReference: targetBooking.bookingReference || targetBooking.bookingId,
      partnerId: partner.partnerId,
      partnerName: partner.name,
      assignedByAdminUid: params.adminUid || 'PARTNER_CLAIM',
      assignedAt: now.toISOString(),
      status: 'ASSIGNED',
    };
    storage.saveDeliveryAssignments([newAssignment, ...assignments]);

    return { booking: updatedBooking, partner: partners[pIndex] || partner };
  },

  /**
   * SECTION 10 — GET OR GENERATE 6-DIGIT PICKUP CODE
   * Retrieved securely only by the authenticated assigned Delivery Partner.
   */
  getOrGeneratePickupCode: (bookingId: string, partnerId: string): string => {
    const booking = storage.getBookings().find(
      (b) =>
        b.bookingId === bookingId ||
        b.bookingReference === bookingId ||
        b.documentId === bookingId
    );
    if (!booking) throw new Error('Order not found.');
    if (booking.assignedPartnerId !== partnerId) {
      throw new Error('You are not authorized to view the pickup code for this order.');
    }

    if (booking.pickupCode && /^\d{6}$/.test(booking.pickupCode)) {
      return booking.pickupCode;
    }

    // Generate fresh 6-digit code
    const freshCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updated: Booking = {
      ...booking,
      pickupCode: freshCode,
      pickupCodeExpiresAt: expiry,
      pickupCodeAttempts: 0,
    };

    const bookings = storage.getBookings();
    const idx = bookings.findIndex((b) => b.bookingId === booking.bookingId);
    if (idx !== -1) {
      bookings[idx] = updated;
      storage.saveBookings(bookings);
      void persistBookingToFirestore(updated, OperationType.UPDATE);
    }

    return freshCode;
  },

  /**
   * SECTION 10 & 11 — STEP 1: VERIFY PICKUP CODE PRE-HANDOVER
   * Shopkeeper enters the 6-digit code.
   * Backend verifies code and returns the assigned partner's identity (photo, name, ID, phone).
   * A valid code alone NEVER completes handover; the Shopkeeper must visually confirm partner identity!
   */
  verifyPickupCodePreHandover: (params: {
    bookingId: string;
    enteredCode: string;
  }): { partner: DeliveryPartner; booking: Booking } => {
    const cleanCode = params.enteredCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error('Please enter the valid 6-digit numeric pickup code.');
    }

    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b) =>
        b.bookingId === params.bookingId ||
        b.bookingReference === params.bookingId ||
        b.documentId === params.bookingId
    );
    if (bIndex === -1) throw new Error('Order not found.');

    const order = bookings[bIndex];
    if (!order.assignedPartnerId) {
      throw new Error('No Delivery Partner is assigned to this order.');
    }

    // Check rate limit on pickup code attempts
    const attempts = order.pickupCodeAttempts || 0;
    if (attempts >= 5) {
      throw new Error(
        'Pickup verification locked due to repeated incorrect code attempts. Please contact Admin.'
      );
    }

    if (order.pickupCode !== cleanCode) {
      const updatedOrder = {
        ...order,
        pickupCodeAttempts: attempts + 1,
      };
      bookings[bIndex] = updatedOrder;
      storage.saveBookings(bookings);
      throw new Error(
        `Incorrect 6-digit pickup code. ${4 - attempts} attempt(s) remaining before lockout.`
      );
    }

    // Check expiry
    if (order.pickupCodeExpiresAt && new Date(order.pickupCodeExpiresAt).getTime() < Date.now()) {
      throw new Error('This pickup code has expired. The Delivery Partner must regenerate a code.');
    }

    const partner = deliveryService.getPartnerById(order.assignedPartnerId);
    if (!partner) {
      throw new Error('Assigned Delivery Partner profile not found.');
    }

    return { partner, booking: order };
  },

  /**
   * SECTION 10 & 11 — STEP 2: SHOPKEEPER CONFIRMS IDENTITY & AUTHORIZES HANDOVER
   * Shopkeeper explicitly confirms: "I have verified the Delivery Partner in person."
   * Transitions order to OUT_FOR_DELIVERY, invalidates pickup code, and records timestamps.
   */
  confirmShopkeeperHandover: (params: {
    bookingId: string;
    shopkeeperId: string;
    acknowledgedPartnerId: string;
  }): Booking => {
    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b) =>
        b.bookingId === params.bookingId ||
        b.bookingReference === params.bookingId ||
        b.documentId === params.bookingId
    );
    if (bIndex === -1) throw new Error('Order not found.');

    const order = bookings[bIndex];
    if (order.assignedPartnerId !== params.acknowledgedPartnerId) {
      throw new Error('Acknowledged partner does not match the assigned Delivery Partner for this order.');
    }

    const nowIso = new Date().toISOString();
    const updatedBooking: Booking = {
      ...order,
      bookingStatus: 'OUT_FOR_DELIVERY',
      status: 'OUT_FOR_DELIVERY',
      pickupCode: undefined, // Code permanently invalidated after successful handover
      handoverVerifiedAt: nowIso,
      handoverShopkeeperId: params.shopkeeperId,
      handoverPartnerId: params.acknowledgedPartnerId,
    };

    bookings[bIndex] = updatedBooking;
    storage.saveBookings(bookings);
    void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

    return updatedBooking;
  },

  /**
   * SECTION 14 — DELIVERY COMPLETION AT CUSTOMER DESTINATION
   * Partner arrives at customer location, verifies delivery, and marks order DELIVERED / SOLD.
   * Frees partner back to ONLINE and increments delivery count and earnings.
   */
  completeCustomerDelivery: (params: {
    bookingId: string;
    partnerId: string;
    completionCode?: string;
  }): Booking => {
    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b) =>
        b.bookingId === params.bookingId ||
        b.bookingReference === params.bookingId ||
        b.documentId === params.bookingId
    );
    if (bIndex === -1) throw new Error('Order not found.');

    const order = bookings[bIndex];
    if (order.assignedPartnerId !== params.partnerId) {
      throw new Error('You are not authorized to complete delivery for this order.');
    }

    const currentStatus = order.bookingStatus || order.status;
    if (currentStatus === 'SOLD' || currentStatus === 'DELIVERED') {
      return order; // Already completed
    }

    if (!order.handoverVerifiedAt && currentStatus !== 'OUT_FOR_DELIVERY') {
      throw new Error('Cannot complete delivery before package has been picked up from the shop.');
    }

    // Optional customer code verification (e.g. last 4 digits of customer mobile or Booking ID suffix)
    if (params.completionCode) {
      const cleanInput = params.completionCode.trim().toUpperCase();
      const mobileSuffix = order.customerMobile.slice(-4);
      const bookingSuffix = order.bookingId.slice(-4).toUpperCase();
      if (cleanInput !== mobileSuffix && cleanInput !== bookingSuffix) {
        throw new Error(
          `Invalid completion code. Please enter the last 4 digits of Customer’s mobile (+91 ...${mobileSuffix}) or Booking ID.`
        );
      }
    }

    const nowIso = new Date().toISOString();

    // Confirm sold in inventory
    inventoryService.confirmSold(order.productId, order.quantity, false);

    const updatedBooking: Booking = {
      ...order,
      bookingStatus: 'SOLD',
      status: 'SOLD',
      deliveryCompletedAt: nowIso,
    };

    bookings[bIndex] = updatedBooking;
    storage.saveBookings(bookings);
    void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

    // Free partner and update stats
    const partners = storage.getDeliveryPartners();
    const pIndex = partners.findIndex((p) => p.partnerId === params.partnerId);
    if (pIndex !== -1) {
      const partner = partners[pIndex];
      const deliveryFee = order.deliveryCharge || calculateDeliveryCharge(5);
      const updatedPartner: DeliveryPartner = {
        ...partner,
        status: 'ONLINE',
        currentActiveOrderId: undefined,
        completedDeliveries: (partner.completedDeliveries || 0) + 1,
        totalEarnings: (partner.totalEarnings || 0) + deliveryFee,
        updatedAt: nowIso,
      };
      partners[pIndex] = updatedPartner;
      storage.saveDeliveryPartners(partners);
      void persistDeliveryPartnerToFirestore(updatedPartner, OperationType.UPDATE);
    }

    return updatedBooking;
  },

  /**
   * SECTION 15 — DELIVERY FAILURE REPORTING
   */
  reportDeliveryFailure: (params: {
    bookingId: string;
    partnerId: string;
    reason: string;
    notes?: string;
  }): Booking => {
    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b) =>
        b.bookingId === params.bookingId ||
        b.bookingReference === params.bookingId ||
        b.documentId === params.bookingId
    );
    if (bIndex === -1) throw new Error('Order not found.');

    const order = bookings[bIndex];
    if (order.assignedPartnerId !== params.partnerId) {
      throw new Error('You are not authorized to report failure for this order.');
    }

    const nowIso = new Date().toISOString();
    const updatedBooking: Booking = {
      ...order,
      bookingStatus: 'NOT_SOLD',
      status: 'NOT_SOLD',
      deliveryFailureReason: `${params.reason}${params.notes ? ` — ${params.notes}` : ''}`,
    };

    bookings[bIndex] = updatedBooking;
    storage.saveBookings(bookings);
    void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

    // Free partner back to ONLINE
    const partners = storage.getDeliveryPartners();
    const pIndex = partners.findIndex((p) => p.partnerId === params.partnerId);
    if (pIndex !== -1) {
      partners[pIndex] = {
        ...partners[pIndex],
        status: 'ONLINE',
        currentActiveOrderId: undefined,
        updatedAt: nowIso,
      };
      storage.saveDeliveryPartners(partners);
      void persistDeliveryPartnerToFirestore(partners[pIndex], OperationType.UPDATE);
    }

    return updatedBooking;
  },

  /**
   * SECTION 16 — DELIVERY HISTORY FOR SPECIFIC PARTNER
   */
  getPartnerDeliveryHistory: (partnerId: string): Booking[] => {
    const all = storage.getBookings();
    return all.filter((b) => b.assignedPartnerId === partnerId);
  },

  /**
   * SECTION 8 — GET ORDERS AVAILABLE FOR DELIVERY ASSIGNMENT
   */
  getAvailableDeliveryOrders: (): Booking[] => {
    const bookings = storage.getBookings();
    return bookings.filter(
      (b) =>
        b.deliveryMode === 'DELIVERY' &&
        (b.bookingStatus === 'CONFIRMED' || b.status === 'CONFIRMED' || b.status === 'BOOKED') &&
        !b.assignedPartnerId
    );
  },

  /**
   * Retrieves all Forceful Cancellation Requests.
   */
  getForcefulCancellations: (): ForcefulCancellationRequest[] => {
    return storage.getForcefulCancellations();
  },

  /**
   * Customer submits a forceful/emergency cancellation request.
   */
  submitForcefulCancellation: (params: {
    orderId: string;
    bookingReference: string;
    shopId: string;
    shopName: string;
    partnerId?: string;
    partnerName?: string;
    reason: string;
    customReason?: string;
  }): ForcefulCancellationRequest => {
    const list = storage.getForcefulCancellations();
    const existing = list.find(
      (r: ForcefulCancellationRequest) => r.orderId === params.orderId && r.status === 'PENDING'
    );
    if (existing) {
      throw new Error('A cancellation request for this order is already pending admin review.');
    }

    const newRequest: ForcefulCancellationRequest = {
      requestId: `CAN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      orderId: params.orderId,
      bookingReference: params.bookingReference,
      shopId: params.shopId,
      shopName: params.shopName,
      partnerId: params.partnerId || '',
      partnerName: params.partnerName || 'Unassigned',
      requestTime: new Date().toISOString(),
      reason: params.reason,
      customReason: params.customReason,
      status: 'PENDING',
    };

    const updated = [newRequest, ...list];
    storage.saveForcefulCancellations(updated);
    return newRequest;
  },

  /**
   * Admin reviews a forceful cancellation request.
   */
  reviewForcefulCancellation: (params: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    adminUid: string;
    adminNotes?: string;
  }): ForcefulCancellationRequest => {
    const list = storage.getForcefulCancellations();
    const idx = list.findIndex((r: ForcefulCancellationRequest) => r.requestId === params.requestId);
    if (idx === -1) {
      throw new Error('Cancellation request not found.');
    }

    const current = list[idx];
    const updatedRequest: ForcefulCancellationRequest = {
      ...current,
      status: params.decision,
      reviewedByAdminUid: params.adminUid,
      reviewedAt: new Date().toISOString(),
      adminNotes: params.adminNotes,
    };
    list[idx] = updatedRequest;
    storage.saveForcefulCancellations(list);

    if (params.decision === 'APPROVED') {
      const bookings = storage.getBookings();
      const bIndex = bookings.findIndex(
        (b: Booking) =>
          b.bookingId === current.orderId ||
          b.bookingReference === current.bookingReference ||
          b.documentId === current.orderId
      );
      if (bIndex !== -1) {
        const order = bookings[bIndex];
        const updatedBooking: Booking = {
          ...order,
          bookingStatus: 'CANCELLED',
          status: 'CANCELLED',
        };
        bookings[bIndex] = updatedBooking;
        storage.saveBookings(bookings);
        void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

        // Restore reserved inventory stock
        inventoryService.releaseStockOnNotSold(order.productId, order.quantity, false);

        // Free assigned partner if any
        if (order.assignedPartnerId) {
          const partners = deliveryService.getDeliveryPartners();
          const pIndex = partners.findIndex((p) => p.partnerId === order.assignedPartnerId);
          if (pIndex !== -1) {
            partners[pIndex] = {
              ...partners[pIndex],
              status: 'ONLINE',
              currentActiveOrderId: undefined,
              updatedAt: new Date().toISOString(),
            };
            storage.saveDeliveryPartners(partners);
          }
        }
      }
    }

    return updatedRequest;
  },

  /**
   * Manually assigns a delivery partner to an order (Admin workflow).
   */
  assignPartnerToOrder: (params: {
    bookingId: string;
    partnerId: string;
    adminUid: string;
  }): { booking: Booking; partner: DeliveryPartner } => {
    return deliveryService.claimOrAssignDeliveryOrder(params);
  },

  /**
   * Removes assigned delivery partner from an order.
   */
  unassignPartnerFromOrder: (bookingId: string): Booking => {
    const bookings = storage.getBookings();
    const bIndex = bookings.findIndex(
      (b: Booking) =>
        b.bookingId === bookingId ||
        b.bookingReference === bookingId ||
        b.documentId === bookingId
    );
    if (bIndex === -1) {
      throw new Error('Order not found.');
    }

    const targetBooking = bookings[bIndex];
    const prevPartnerId = targetBooking.assignedPartnerId;

    const updatedBooking: Booking = {
      ...targetBooking,
      assignedPartnerId: undefined,
      assignedPartnerName: undefined,
      pickupCode: undefined,
    };
    bookings[bIndex] = updatedBooking;
    storage.saveBookings(bookings);
    void persistBookingToFirestore(updatedBooking, OperationType.UPDATE);

    if (prevPartnerId) {
      const partners = deliveryService.getDeliveryPartners();
      const pIndex = partners.findIndex((p: DeliveryPartner) => p.partnerId === prevPartnerId);
      if (pIndex !== -1) {
        partners[pIndex] = {
          ...partners[pIndex],
          status: 'ONLINE',
          currentActiveOrderId: undefined,
          updatedAt: new Date().toISOString(),
        };
        storage.saveDeliveryPartners(partners);
      }
    }

    return updatedBooking;
  },

  /**
   * Deletes a delivery partner from the directory.
   */
  deleteDeliveryPartner: (partnerId: string): void => {
    const list = deliveryService.getDeliveryPartners();
    const filtered = list.filter((p) => p.partnerId !== partnerId);
    storage.saveDeliveryPartners(filtered);
    deleteDoc(doc(db, 'deliveryPartners', partnerId)).catch(() => {});
  },

  /**
   * Updates partner status.
   */
  updatePartnerStatus: (
    partnerId: string,
    status: DeliveryPartnerStatus
  ): DeliveryPartner => {
    const list = deliveryService.getDeliveryPartners();
    const idx = list.findIndex((p) => p.partnerId === partnerId);
    if (idx === -1) {
      throw new Error('Delivery partner not found.');
    }

    const updated: DeliveryPartner = {
      ...list[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    storage.saveDeliveryPartners(list);
    void persistDeliveryPartnerToFirestore(updated, OperationType.UPDATE);
    return updated;
  },
};
