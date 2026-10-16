import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, logFirestoreError, OperationType } from '../firebase';
import { Shop, ShopCategory, Shopkeeper } from '../types/models';
import { hashPinSync, hashSecurityAnswerSync, verifyPinSync, verifySecurityAnswerSync } from '../utils/crypto';
import { storage } from '../utils/storage';

export function sanitizeShopkeeperForFirestore(sk: Shopkeeper): Shopkeeper {
  const clean: Shopkeeper = {
    shopkeeperId: sk.shopkeeperId,
    name: (sk.name || '').slice(0, 120),
    mobile: sk.mobile.slice(0, 15),
    pin: (sk.pin || '').slice(0, 128),
    shopId: (sk.shopId || '').slice(0, 128),
    registrationStatus: sk.registrationStatus || 'PRE_REGISTERED',
    verificationStatus: sk.verificationStatus || 'UNVERIFIED',
    approvalStatus: sk.approvalStatus || 'NONE',
    pinCreated: Boolean(sk.pinCreated),
    profileStatus: sk.profileStatus || 'INCOMPLETE',
    createdAt: sk.createdAt,
  };
  if (sk.verifiedAt) {
    clean.verifiedAt = sk.verifiedAt;
  }
  if (sk.approvedAt) {
    clean.approvedAt = sk.approvedAt;
  }
  if (sk.securityQuestion) {
    clean.securityQuestion = sk.securityQuestion.slice(0, 200);
  }
  if (sk.securityAnswerHash) {
    clean.securityAnswerHash = sk.securityAnswerHash.slice(0, 128);
  }
  if (typeof sk.failedPinAttempts === 'number') {
    clean.failedPinAttempts = Math.max(0, Math.floor(sk.failedPinAttempts));
  }
  if (sk.pinLockedUntil) {
    clean.pinLockedUntil = sk.pinLockedUntil.slice(0, 64);
  }
  if (sk.upiId) {
    clean.upiId = sk.upiId.slice(0, 100);
  }
  return clean;
}

export async function persistShopkeeperToFirestore(
  sk: Shopkeeper,
  op: OperationType
): Promise<void> {
  const path = `shopkeepers/${sk.shopkeeperId}`;
  try {
    const clean = sanitizeShopkeeperForFirestore(sk);
    await setDoc(doc(db, 'shopkeepers', sk.shopkeeperId), clean);
  } catch (error) {
    handleFirestoreError(error, op, path);
  }
}

export const shopkeeperService = {
  getAllShopkeepers: (): Shopkeeper[] => {
    return storage.getShopkeepers();
  },

  getShopkeeperById: (shopkeeperId: string): Shopkeeper | undefined => {
    return storage.getShopkeepers().find((sk) => sk.shopkeeperId === shopkeeperId);
  },

  getShopkeeperByMobile: (mobile: string): Shopkeeper | undefined => {
    const cleanMobile = mobile.replace(/\D/g, '');
    return storage.getShopkeepers().find((sk) => sk.mobile === cleanMobile);
  },

  subscribeToShopkeepers: (onUpdate: (shopkeepers: Shopkeeper[]) => void): (() => void) => {
    const skQuery = query(
      collection(db, 'shopkeepers'),
      where('registrationStatus', 'in', ['PRE_REGISTERED', 'COMPLETED'])
    );
    return onSnapshot(
      skQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const remoteList: Shopkeeper[] = [];
        const remoteIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          const raw = docSnap.data() as Partial<Shopkeeper>;
          if (raw && raw.mobile) {
            const skId = raw.shopkeeperId || docSnap.id;
            const hasLegacyShop = Boolean(raw.shopId && raw.pin);
            const normalized: Shopkeeper = {
              shopkeeperId: skId,
              name: raw.name || '',
              mobile: raw.mobile,
              pin: raw.pin || '',
              shopId: raw.shopId || '',
              registrationStatus:
                raw.registrationStatus || (hasLegacyShop ? 'COMPLETED' : 'PRE_REGISTERED'),
              verificationStatus:
                raw.verificationStatus || (hasLegacyShop ? 'VERIFIED' : 'UNVERIFIED'),
              approvalStatus: raw.approvalStatus || (hasLegacyShop ? 'APPROVED' : 'NONE'),
              pinCreated:
                typeof raw.pinCreated === 'boolean' ? raw.pinCreated : Boolean(raw.pin),
              profileStatus:
                raw.profileStatus || (hasLegacyShop ? 'COMPLETED' : 'INCOMPLETE'),
              securityQuestion: raw.securityQuestion,
              securityAnswerHash: raw.securityAnswerHash,
              failedPinAttempts: raw.failedPinAttempts,
              pinLockedUntil: raw.pinLockedUntil,
              upiId: raw.upiId,
              createdAt: raw.createdAt || new Date().toISOString(),
              verifiedAt: raw.verifiedAt,
              approvedAt: raw.approvedAt,
            };
            remoteList.push(normalized);
            remoteIds.add(normalized.shopkeeperId);
          }
        });

        storage.saveShopkeepers(remoteList);
        const activeSkId = storage.getActiveShopkeeperId();
        if (activeSkId && !remoteIds.has(activeSkId) && !snapshot.metadata.fromCache) {
          storage.setActiveShopkeeperId(null);
        }
        onUpdate(remoteList);
      },
      (error) => {
        logFirestoreError(error, OperationType.GET, 'shopkeepers');
      }
    );
  },

  /**
   * SECTION 18 — SHOPKEEPER PRE-REGISTRATION BY ADMIN
   * Admin enters ONLY Mobile Number and clicks REGISTER.
   * Creates only a minimal Firestore pre-registration record:
   * mobile, registrationStatus = PRE_REGISTERED, createdAt
   */
  preRegisterShopkeeperMobileByAdmin: async (rawMobile: string): Promise<Shopkeeper> => {
    const cleanMobile = rawMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }

    const existing = shopkeeperService.getShopkeeperByMobile(cleanMobile);
    if (existing) {
      throw new Error('This mobile number is already registered.');
    }

    const now = new Date().toISOString();
    const shopkeeperId = `sk-${cleanMobile}`;

    const preRegistered: Shopkeeper = {
      shopkeeperId,
      name: '',
      mobile: cleanMobile,
      pin: '',
      shopId: '',
      registrationStatus: 'PRE_REGISTERED',
      verificationStatus: 'UNVERIFIED',
      approvalStatus: 'NONE',
      pinCreated: false,
      profileStatus: 'INCOMPLETE',
      createdAt: now,
    };

    const currentList = storage.getShopkeepers();
    storage.saveShopkeepers([preRegistered, ...currentList]);
    await persistShopkeeperToFirestore(preRegistered, OperationType.CREATE);
    return preRegistered;
  },

  /**
   * SECTION 19 — SHOPKEEPER VERIFICATION
   * When a pre-registered shopkeeper clicks VERIFY & LOGIN:
   * - If not registered by Admin: throws "This mobile number has not been registered by Desi Wardrobe Admin yet."
   * - If pre-registered and unverified: sets verificationStatus = VERIFIED, approvalStatus = PENDING
   */
  verifyPreRegisteredMobile: async (rawMobile: string): Promise<Shopkeeper> => {
    const cleanMobile = rawMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const list = storage.getShopkeepers();
    const idx = list.findIndex((sk) => sk.mobile === cleanMobile);
    if (idx === -1) {
      throw new Error('This mobile number has not been registered by Desi Wardrobe Admin yet.');
    }

    const current = list[idx];
    if (current.verificationStatus !== 'VERIFIED' || current.approvalStatus === 'NONE') {
      const now = new Date().toISOString();
      const updated: Shopkeeper = {
        ...current,
        verificationStatus: 'VERIFIED',
        approvalStatus: current.approvalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
        verifiedAt: now,
      };
      list[idx] = updated;
      storage.saveShopkeepers(list);
      await persistShopkeeperToFirestore(updated, OperationType.UPDATE);
      return updated;
    }

    return current;
  },

  /**
   * SECTION 20 — ADMIN APPROVAL / REJECTION OF SHOPKEEPER VERIFICATION REQUEST
   */
  updateShopkeeperApprovalByAdmin: async (
    shopkeeperId: string,
    decision: 'APPROVED' | 'REJECTED'
  ): Promise<Shopkeeper> => {
    const list = storage.getShopkeepers();
    const idx = list.findIndex((sk) => sk.shopkeeperId === shopkeeperId);
    if (idx === -1) {
      throw new Error('Shopkeeper record not found.');
    }

    const now = new Date().toISOString();
    const updated: Shopkeeper = {
      ...list[idx],
      approvalStatus: decision,
      approvedAt: decision === 'APPROVED' ? now : list[idx].approvedAt,
    };

    list[idx] = updated;
    storage.saveShopkeepers(list);
    await persistShopkeeperToFirestore(updated, OperationType.UPDATE);

    // If associated shop exists, update its shopStatus accordingly
    if (updated.shopId) {
      const shops = storage.getShops();
      const sIdx = shops.findIndex(
        (s) => s.shopId === updated.shopId || s.shopkeeperId === updated.shopkeeperId
      );
      if (sIdx !== -1) {
        const currentShop = shops[sIdx];
        const nextShopStatus = decision === 'APPROVED' ? 'ACTIVE' : 'REMOVED';
        const nextStatus = decision === 'APPROVED' ? 'OPEN' : 'CLOSED';
        const updatedShop: Shop = {
          ...currentShop,
          shopStatus: nextShopStatus,
          status: nextStatus,
          isOnline: decision === 'APPROVED',
          onlineStatus: decision === 'APPROVED' ? 'ONLINE' : 'OFFLINE',
          updatedAt: now,
        };
        shops[sIdx] = updatedShop;
        storage.saveShops(shops);
        try {
          await setDoc(doc(db, 'shops', updatedShop.shopId), updatedShop, { merge: true });
        } catch (err) {
          logFirestoreError(err, OperationType.UPDATE, `shops/${updatedShop.shopId}`);
        }
      }
    }

    return updated;
  },

  /**
   * SECTION 22 — SHOPKEEPER CREATES OWN PIN AFTER ADMIN APPROVAL
   */
  createShopkeeperPin: async (
    rawMobile: string,
    pin: string,
    confirmPin: string
  ): Promise<Shopkeeper> => {
    const cleanMobile = rawMobile.replace(/\D/g, '');
    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN must be a 4-digit number.');
    }
    if (cleanPin !== cleanConfirm) {
      throw new Error('New PIN and Confirm PIN do not match.');
    }

    const list = storage.getShopkeepers();
    const idx = list.findIndex((sk) => sk.mobile === cleanMobile);
    if (idx === -1) {
      throw new Error('This mobile number has not been registered by Desi Wardrobe Admin yet.');
    }

    const current = list[idx];
    if (current.approvalStatus !== 'APPROVED') {
      throw new Error('Your mobile number is awaiting Admin approval.');
    }

    const hashedPin = hashPinSync(cleanPin, cleanMobile);
    const updated: Shopkeeper = {
      ...current,
      pin: hashedPin,
      pinCreated: true,
    };

    list[idx] = updated;
    storage.saveShopkeepers(list);
    await persistShopkeeperToFirestore(updated, OperationType.UPDATE);
    return updated;
  },

  verifyShopkeeperPin: (sk: Shopkeeper, enteredPin: string): boolean => {
    return verifyPinSync(enteredPin, sk.pin, sk.mobile);
  },

  /**
   * Verified rate-limited PIN check with 5-attempt threshold and 15-minute lock.
   */
  verifyShopkeeperPinWithRateLimit: async (
    sk: Shopkeeper,
    enteredPin: string
  ): Promise<Shopkeeper> => {
    const nowMs = Date.now();
    if (sk.pinLockedUntil) {
      const lockExpiryMs = new Date(sk.pinLockedUntil).getTime();
      if (!Number.isNaN(lockExpiryMs) && lockExpiryMs > nowMs) {
        const remainingMinutes = Math.max(1, Math.ceil((lockExpiryMs - nowMs) / 60000));
        throw new Error(
          `Account is temporarily locked due to repeated incorrect PIN entries. Please try again in ${remainingMinutes} minute(s) or use Forgot PIN to reset.`
        );
      }
    }

    const cleanPin = enteredPin.trim();
    const isValid = verifyPinSync(cleanPin, sk.pin, sk.mobile);

    const list = storage.getShopkeepers();
    const idx = list.findIndex((s) => s.shopkeeperId === sk.shopkeeperId);

    if (isValid) {
      if ((sk.failedPinAttempts && sk.failedPinAttempts > 0) || sk.pinLockedUntil) {
        const resetSk: Shopkeeper = {
          ...sk,
          failedPinAttempts: 0,
          pinLockedUntil: undefined,
        };
        if (idx !== -1) {
          list[idx] = resetSk;
          storage.saveShopkeepers(list);
          void persistShopkeeperToFirestore(resetSk, OperationType.UPDATE);
        }
        return resetSk;
      }
      return sk;
    }

    // Failed attempt
    const newFailures = (sk.failedPinAttempts || 0) + 1;
    const isNowLocked = newFailures >= 5;
    const lockExpiryIso = isNowLocked ? new Date(nowMs + 15 * 60 * 1000).toISOString() : undefined;

    const updatedSk: Shopkeeper = {
      ...sk,
      failedPinAttempts: newFailures,
      ...(isNowLocked ? { pinLockedUntil: lockExpiryIso } : {}),
    };

    if (idx !== -1) {
      list[idx] = updatedSk;
      storage.saveShopkeepers(list);
      void persistShopkeeperToFirestore(updatedSk, OperationType.UPDATE);
    }

    if (isNowLocked) {
      throw new Error(
        'Account is now locked for 15 minutes due to 5 consecutive incorrect PIN entries. Please use Forgot PIN to reset.'
      );
    }

    const remainingAttempts = 5 - newFailures;
    throw new Error(
      `Incorrect 4-digit PIN. You have ${remainingAttempts} attempt(s) remaining before your account is temporarily locked.`
    );
  },

  /**
   * SECTION 2 — SHOPKEEPER SELF-REGISTRATION
   * Creates new Shopkeeper + Shop with required information:
   * - Shopkeeper's full name
   * - Mobile number (10-digit Indian)
   * - Shop name
   * - Shop profile / storefront photo
   * - Shop address and location (coordinates + location name + state)
   * - Shop categories (MEN, WOMEN, KIDS, BOTH, ALL)
   * - Registered permanent Shopkeeper account ID (SK-YYYYMMDD-XXXXXX)
   * - UPI ID
   * - Security question and hashed answer for PIN recovery
   * - 4-digit PIN (hashed, NEVER plain text)
   *
   * Invariant: New Shopkeepers remain PENDING until Admin approval!
   */
  registerShopkeeperDirect: async (params: {
    fullName: string;
    mobile: string;
    shopName: string;
    photo: string;
    category: ShopCategory;
    pricePolicy: 'FIXED_PRICE' | 'BARGAINING_AVAILABLE';
    latitude: number;
    longitude: number;
    locationName: string;
    state?: string;
    upiId: string;
    pin: string;
    confirmPin: string;
    securityQuestion: string;
    securityAnswer: string;
  }): Promise<{ shopkeeper: Shopkeeper; shop: Shop }> => {
    const cleanName = params.fullName.trim();
    const cleanMobile = params.mobile.replace(/\D/g, '');
    const cleanShopName = params.shopName.trim();
    const cleanUpiId = params.upiId.trim();
    const cleanPin = params.pin.trim();
    const cleanConfirm = params.confirmPin.trim();
    const cleanQuestion = params.securityQuestion.trim();
    const cleanAnswer = params.securityAnswer.trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please enter Shopkeeper’s full name (at least 2 characters).');
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }
    if (!cleanShopName || cleanShopName.length < 2) {
      throw new Error('Please enter your Shop Name (at least 2 characters).');
    }
    if (!params.photo) {
      throw new Error('Please take or upload a storefront photo of your shop.');
    }
    if (isNaN(params.latitude) || isNaN(params.longitude) || !params.locationName.trim()) {
      throw new Error('Please set a valid shop location with GPS/map and location name.');
    }
    if (!cleanUpiId || !/^[\w.-]+@[\w.-]+$/.test(cleanUpiId)) {
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
    const existing = shopkeeperService.getShopkeeperByMobile(cleanMobile);
    if (existing && existing.registrationStatus === 'COMPLETED' && existing.pinCreated) {
      throw new Error(
        'An account with this mobile number already exists. Please log in or use Forgot PIN.'
      );
    }

    const now = new Date().toISOString();
    const nowCompact = now.replace(/\D/g, '').slice(0, 8); // YYYYMMDD
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const permanentShopkeeperId = existing?.shopkeeperId || `SK-${nowCompact}-${randomSuffix}`;
    const shopId = existing?.shopId || `shop-${nowCompact}-${randomSuffix}`;

    const hashedPin = hashPinSync(cleanPin, cleanMobile);
    const hashedSecurityAnswer = hashSecurityAnswerSync(cleanAnswer, cleanMobile);

    const newShopkeeper: Shopkeeper = {
      shopkeeperId: permanentShopkeeperId,
      name: cleanName.slice(0, 120),
      mobile: cleanMobile,
      pin: hashedPin,
      shopId,
      registrationStatus: 'COMPLETED',
      verificationStatus: 'VERIFIED',
      approvalStatus: 'PENDING', // PENDING until Admin approval
      pinCreated: true,
      profileStatus: 'COMPLETED',
      securityQuestion: cleanQuestion.slice(0, 200),
      securityAnswerHash: hashedSecurityAnswer,
      failedPinAttempts: 0,
      upiId: cleanUpiId.slice(0, 100),
      createdAt: now,
      verifiedAt: now,
    };

    const newShop: Shop = {
      shopId,
      shopkeeperId: permanentShopkeeperId,
      shopName: cleanShopName.slice(0, 120),
      shopkeeperName: cleanName.slice(0, 120),
      mobile: cleanMobile,
      photo: params.photo,
      category: params.category,
      pricePolicy: params.pricePolicy,
      latitude: Number(params.latitude.toFixed(6)),
      longitude: Number(params.longitude.toFixed(6)),
      locationName: params.locationName.trim().slice(0, 300),
      state: params.state?.slice(0, 80),
      shopStatus: 'PENDING', // Pending Admin approval
      profileStatus: 'COMPLETED',
      openingTime: '10:00 AM',
      closingTime: '09:00 PM',
      status: 'CLOSED', // Closed until active & approved
      isOnline: false,
      onlineStatus: 'OFFLINE',
      shopkeeperUpiId: cleanUpiId.slice(0, 100),
      updatedAt: now,
      createdAt: now,
    };

    // Save shopkeeper
    const allShopkeepers = storage.getShopkeepers().filter((s) => s.mobile !== cleanMobile);
    storage.saveShopkeepers([newShopkeeper, ...allShopkeepers]);
    await persistShopkeeperToFirestore(newShopkeeper, OperationType.WRITE);

    // Save shop
    const allShops = storage.getShops().filter((s) => s.shopId !== shopId);
    storage.saveShops([newShop, ...allShops]);
    const shopDocPath = `shops/${shopId}`;
    try {
      await setDoc(doc(db, 'shops', shopId), {
        ...newShop,
        updatedAt: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, shopDocPath);
    }

    return { shopkeeper: newShopkeeper, shop: newShop };
  },

  /**
   * Resets PIN using the registered Security Question & Answer.
   */
  resetShopkeeperPinWithSecurityAnswer: async (params: {
    mobile: string;
    securityAnswer: string;
    newPin: string;
    confirmPin: string;
  }): Promise<Shopkeeper> => {
    const cleanMobile = params.mobile.replace(/\D/g, '');
    const cleanPin = params.newPin.trim();
    const cleanConfirm = params.confirmPin.trim();
    const cleanAnswer = params.securityAnswer.trim();

    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    const sk = shopkeeperService.getShopkeeperByMobile(cleanMobile);
    if (!sk) {
      throw new Error('No Shopkeeper account found with this mobile number.');
    }
    if (!sk.securityAnswerHash) {
      throw new Error(
        'No security question was configured for this account. Please contact Desi Wardrobe Admin for assistance.'
      );
    }
    if (!cleanAnswer) {
      throw new Error('Please enter your security answer.');
    }

    const answerMatches = verifySecurityAnswerSync(cleanAnswer, sk.securityAnswerHash, cleanMobile);
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
    const updated: Shopkeeper = {
      ...sk,
      pin: hashedPin,
      pinCreated: true,
      failedPinAttempts: 0,
      pinLockedUntil: undefined,
    };

    const list = storage.getShopkeepers();
    const idx = list.findIndex((s) => s.shopkeeperId === sk.shopkeeperId);
    if (idx !== -1) {
      list[idx] = updated;
      storage.saveShopkeepers(list);
      await persistShopkeeperToFirestore(updated, OperationType.UPDATE);
    }

    return updated;
  },
};
