/**
 * Data Models for DESI WARDROBE — "Your Local Fashion, All in One Place."
 *
 * Includes all three roles in a single unified application:
 * 1. CUSTOMER
 * 2. SHOPKEEPER
 * 3. ADMIN
 */

export type ShopCategory =
  | 'MEN'
  | 'WOMEN'
  | 'BOTH'
  | "Men's Wear"
  | "Women's Wear"
  | 'Both'
  | 'Men'
  | 'Women'
  | 'Kids'
  | "Kids' Wear"
  | 'All';

export type PricePolicy =
  | 'FIXED'
  | 'FIXED_PRICE'
  | 'NEGOTIABLE'
  | 'BARGAINING_AVAILABLE';

export type ShopStatus =
  | 'ACTIVE'
  | 'PRE_REGISTERED'
  | 'PENDING'
  | 'REJECTED'
  | 'REMOVED'
  | 'INCOMPLETE';

export type ProfileStatus =
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'PRE_REGISTERED'
  | 'PENDING';

export type CustomerStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'ACTIVE';

export type ShopkeeperRegistrationStatus = 'PRE_REGISTERED' | 'COMPLETED';
export type ShopkeeperVerificationStatus = 'UNVERIFIED' | 'VERIFIED';
export type ShopkeeperApprovalStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type PaymentVerificationStatus =
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'VERIFIED';

export type PaymentUploadStage =
  | 'SELECTING_FILE'
  | 'COMPRESSING'
  | 'READY_TO_UPLOAD'
  | 'UPLOADING'
  | 'SAVING_PAYMENT_RECORD'
  | 'SUBMITTED'
  | 'UPLOAD_ERROR'
  | 'SUBMISSION_ERROR';

export type BookingStatus =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_REJECTED'
  | 'CONFIRMED'
  | 'BOOKED'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SOLD'
  | 'NOT_SOLD'
  | 'EXPIRED'
  | 'CANCELLED';

export type ProductStatus = 'AVAILABLE' | 'OUT_OF_STOCK';

export type ThemeMode = 'light' | 'dark';

export type AppEntryMode = 'CUSTOMER' | 'SHOPKEEPER' | 'ADMIN' | 'DELIVERY_PARTNER';

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export type SponsorStatus = 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'CANCELLED';

export type SponsorDurationValue =
  | '7_DAYS'
  | '15_DAYS'
  | '30_DAYS'
  | '3_MONTHS'
  | '6_MONTHS'
  | '1_YEAR';

export const SPONSOR_DURATION_OPTIONS: {
  value: SponsorDurationValue;
  label: string;
  days: number;
}[] = [
  { value: '7_DAYS', label: '7 Days', days: 7 },
  { value: '15_DAYS', label: '15 Days', days: 15 },
  { value: '30_DAYS', label: '1 Month (30 Days)', days: 30 },
  { value: '3_MONTHS', label: '3 Months (90 Days)', days: 90 },
  { value: '6_MONTHS', label: '6 Months (180 Days)', days: 180 },
  { value: '1_YEAR', label: '1 Year (365 Days)', days: 365 },
];

export interface ShopSponsor {
  sponsorId: string;
  shopId: string;
  shopName: string;
  shopkeeperId?: string;
  isSponsored: boolean;
  sponsorStatus: SponsorStatus;
  sponsorPlan?: string;
  sponsorStartDate: string;
  sponsorEndDate: string;
  sponsoredByAdminUid?: string;
  updatedAt: string;
  createdAt: string;
}

export interface Shop {
  shopId: string;
  shopkeeperId: string;
  shopName: string;
  shopkeeperName: string;
  mobile: string;
  photo: string;
  category: ShopCategory;
  pricePolicy: PricePolicy;
  latitude: number;
  longitude: number;
  locationName: string;
  state?: string;
  shopStatus?: ShopStatus;
  profileStatus?: ProfileStatus;
  openingTime?: string;
  closingTime?: string;
  status?: 'OPEN' | 'CLOSED';
  isOnline?: boolean;
  onlineStatus?: 'ONLINE' | 'OFFLINE';
  categories?: string[];
  shopkeeperUpiId?: string; // Shopkeeper's UPI for final product payment
  supportedDeliveryModes?: DeliveryMode[];
  isSponsored?: boolean;
  sponsorStatus?: SponsorStatus;
  sponsorPlan?: string;
  sponsorStartDate?: string;
  sponsorEndDate?: string;
  updatedAt?: string;
  createdAt: string;
}

/**
 * Extracts or resolves one of the 28 Indian States from a shop's explicit `state` field
 * or from its `locationName` string if `state` was not explicitly set.
 */
export function resolveShopState(shop: Partial<Shop> | null | undefined): string {
  if (!shop) return '';
  if (typeof shop.state === 'string' && shop.state.trim()) {
    const trimmed = shop.state.trim();
    const matched = INDIAN_STATES.find(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    return matched || trimmed;
  }
  if (typeof shop.locationName === 'string' && shop.locationName.trim()) {
    const lowerLoc = shop.locationName.toLowerCase();
    for (const state of INDIAN_STATES) {
      if (lowerLoc.includes(state.toLowerCase())) {
        return state;
      }
    }
  }
  return '';
}

/**
 * Checks whether a shop is currently actively sponsored and not expired.
 */
export function isShopCurrentlySponsored(
  shop: Partial<Shop> | null | undefined,
  sponsorRecord?: ShopSponsor | null
): boolean {
  const now = Date.now();

  if (sponsorRecord) {
    if (!sponsorRecord.isSponsored || sponsorRecord.sponsorStatus !== 'ACTIVE') {
      return false;
    }
    const startMs = new Date(sponsorRecord.sponsorStartDate).getTime();
    const endMs = new Date(sponsorRecord.sponsorEndDate).getTime();
    if (Number.isNaN(endMs)) return false;
    if (!Number.isNaN(startMs) && now < startMs) return false;
    return now <= endMs;
  }

  if (!shop || !shop.isSponsored) return false;
  if (shop.sponsorStatus && shop.sponsorStatus !== 'ACTIVE') return false;
  if (!shop.sponsorEndDate) return false;

  const startMs = shop.sponsorStartDate ? new Date(shop.sponsorStartDate).getTime() : 0;
  const endMs = new Date(shop.sponsorEndDate).getTime();
  if (Number.isNaN(endMs)) return false;
  if (startMs > 0 && !Number.isNaN(startMs) && now < startMs) return false;
  return now <= endMs;
}

export function getShopSponsorRemainingDays(endDateStr?: string): number {
  if (!endDateStr) return 0;
  const endMs = new Date(endDateStr).getTime();
  if (Number.isNaN(endMs)) return 0;
  const diffMs = endMs - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export interface Shopkeeper {
  shopkeeperId: string;
  name: string;
  mobile: string;
  pin: string; // Hashed PIN
  shopId: string;
  registrationStatus: ShopkeeperRegistrationStatus;
  verificationStatus: ShopkeeperVerificationStatus;
  approvalStatus: ShopkeeperApprovalStatus;
  pinCreated: boolean;
  profileStatus: ProfileStatus;
  securityQuestion?: string;
  securityAnswerHash?: string;
  failedPinAttempts?: number;
  pinLockedUntil?: string;
  upiId?: string;
  createdAt: string;
  verifiedAt?: string;
  approvedAt?: string;
}

export type ProductGender = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';

export type ProductMainCategory = 'CLOTHING' | 'FOOTWEAR' | 'ACCESSORIES' | string;

export interface Product {
  productId: string;
  shopId: string;
  name: string;
  description: string;
  price: number; // Offer Price
  mrp?: number; // Maximum Retail Price (optional, defaults to price)
  offerPrice?: number; // Alias for price
  discountPercent?: number;
  gender?: ProductGender;
  productCategory?: ProductMainCategory;
  quantity: number;
  soldCount?: number;
  sizes: string[];
  colors: string[];
  images: string[];
  thumbnails?: string[];
  pricePolicy: PricePolicy;
  status?: ProductStatus;
  createdAt: string;
}

export const SECURITY_QUESTION_OPTIONS = [
  'What is the name of your first school?',
  'What is your favorite traditional Indian dish?',
  'What city or town were you born in?',
  'What is your mother’s maiden name?',
  'What was your first pet’s name?',
] as const;

export interface CustomerSecurityQuestion {
  question: string;
  answerHash: string;
}

export interface CustomerAddress {
  addressId: string;
  street: string;
  village?: string;
  post?: string;
  city: string;
  district: string;
  state: string;
  landmark?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  isCurrentLocationUsed?: boolean;
  savedAt: string;
}

export interface Customer {
  customerId: string;
  name: string;
  mobile: string;
  email?: string;
  pin: string; // Hashed PIN
  securityQuestion?: string;
  securityAnswerHash?: string;
  savedAddress?: CustomerAddress;
  approvalStatus: CustomerStatus;
  accountStatus: CustomerStatus;
  createdAt: string;
}

export type DeliveryMode = 'DELIVERY' | 'TAKEAWAY';

export type DeliveryPartnerStatus = 'ONLINE' | 'OFFLINE' | 'CURRENTLY_DELIVERING';

export type DeliveryPartnerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DeliveryPartnerVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export type VehicleType = 'BIKE' | 'SCOOTER' | 'BICYCLE' | 'CAR' | 'OTHER';

export interface DeliveryPartner {
  partnerId: string; // Unique permanent ID (e.g., DP-1001)
  serialNumber?: number;
  name: string;
  contactNumber: string;
  email?: string;
  residentialAddress?: string;
  serviceArea?: string;
  vehicleType?: VehicleType;
  vehicleNumber?: string;
  upiId: string;
  pin?: string; // Hashed PIN
  securityQuestion?: string;
  securityAnswerHash?: string;
  failedPinAttempts?: number;
  pinLockedUntil?: string;
  profilePhoto?: string;
  profilePhotoUploadedAt?: string;
  profilePhotoLocked?: boolean;
  aadhaarFrontDoc?: string;
  aadhaarBackDoc?: string;
  drivingLicenceFrontDoc?: string;
  drivingLicenceBackDoc?: string;
  status: DeliveryPartnerStatus;
  approvalStatus: DeliveryPartnerApprovalStatus;
  verificationStatus: DeliveryPartnerVerificationStatus;
  rejectionReason?: string;
  currentActiveOrderId?: string;
  pendingAssignedOrderId?: string;
  completedDeliveries?: number;
  totalEarnings?: number;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
}

export interface DeliveryAssignment {
  assignmentId: string;
  orderId: string;
  bookingReference: string;
  partnerId: string;
  partnerName: string;
  assignedByAdminUid: string;
  assignedAt: string;
  status: 'PENDING_PARTNER_ACCEPTANCE' | 'ASSIGNED' | 'QUEUED' | 'COMPLETED' | 'CANCELLED';
  isEmergencyOverride?: boolean;
}

export type ForcefulCancellationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ForcefulCancellationRequest {
  requestId: string;
  orderId: string;
  bookingReference: string;
  shopId: string;
  shopName: string;
  partnerId: string;
  partnerName: string;
  requestTime: string;
  reason: string;
  customReason?: string;
  status: ForcefulCancellationStatus;
  reviewedByAdminUid?: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export interface TemporaryCoordinateRecord {
  coordinateId: string;
  customerId?: string;
  latitude: number;
  longitude: number;
  createdAtMs: number;
  activeOrderIds?: string[]; // If non-empty, retained until order completion/cancellation
}

export interface CartItem {
  cartItemId: string;
  customerId?: string;
  productId: string;
  shopId: string;
  size: string;
  color: string;
  quantity: number;
  addedAt: string;
}

export interface Booking {
  documentId?: string; // Firestore document ID (bookingReference)
  bookingId: string; // Temporary reference until Admin approves payment; DW-YYYYMMDD-XXXXXX after approval
  bookingReference?: string;
  paymentId?: string;
  customerId: string;
  shopId: string;
  shopkeeperId: string;
  productId: string;
  productName: string;
  productImage: string;
  shopName: string;
  shopLocationName?: string;
  customerName: string;
  customerMobile: string;
  size: string;
  color: string;
  quantity: number;
  price: number; // Offer price per unit or total product price
  advanceAmount?: number; // Advance paid (₹75 per unit)
  remainingAmount?: number; // Total price - advance paid (paid to Shopkeeper UPI at delivery)
  deliveryCharge?: number; // Delivery fee paid to Admin (if delivery mode)
  deliveryMode?: DeliveryMode; // 'DELIVERY' | 'TAKEAWAY'
  deliveryAddress?: CustomerAddress;
  shopkeeperUpiId?: string; // Shopkeeper's UPI for final product payment
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  paymentAmount?: number;
  paymentStatus?: PaymentVerificationStatus;
  bookingStatus?: BookingStatus;
  status: BookingStatus;
  createdAt: string;
  confirmedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  pickupDeadline: string;
  pickupCode?: string;
  pickupCodeExpiresAt?: string;
  pickupCodeAttempts?: number;
  pickupCodeLockedUntil?: string;
  handoverVerifiedAt?: string;
  handoverShopkeeperId?: string;
  handoverPartnerId?: string;
  deliveryCompletedAt?: string;
  deliveryFailureReason?: string;
}

export interface ShopkeeperNotification {
  notificationId: string;
  shopkeeperId: string;
  shopId: string;
  orderId?: string;
  title: string;
  message: string;
  type: 'NEW_ORDER' | 'ORDER_STATUS' | 'PICKUP_REQUEST' | 'HANDOVER_COMPLETED' | 'GENERAL';
  read: boolean;
  createdAt: string;
}

export interface PaymentRecord {
  paymentId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  bookingReference: string;
  bookingIds: string[];
  finalBookingIds?: string[];
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  expectedAmount: number; // Total advance (₹75/unit) + applicable deliveryCharge
  advanceAmount?: number; // Product advance breakdown
  deliveryCharge?: number; // Delivery charge breakdown
  deliveryMode?: DeliveryMode;
  deliveryAddress?: CustomerAddress;
  upiId: string; // Admin's UPI ID for advance + delivery fee
  screenshotStoragePath: string;
  screenshotURL: string;
  screenshotFileName?: string;
  originalSizeKB?: number;
  compressedSizeKB?: number;
  status: PaymentVerificationStatus;
  submittedAt: string;
  createdAt?: string;
  verifiedAt?: string;
  approvedAt?: string;
  approvedByAdminUid?: string;
  rejectedAt?: string;
  rejectedByAdminUid?: string;
  deletedAt?: string;
  screenshotDeleted?: boolean;
  screenshotDeletedAt?: string;
}

export interface AdminAccount {
  adminUid: string;
  authorizedEmail: string;
  pinConfigured: boolean;
  pinHash?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AdminDeviceStatus = 'TRUSTED' | 'PENDING_APPROVAL' | 'REVOKED';

export interface AdminDevice {
  deviceId: string;
  adminUid: string;
  deviceLabel: string;
  credentialHash: string;
  status: AdminDeviceStatus;
  createdAt: string;
  lastUsedAt: string;
}

export interface PendingCheckoutItem {
  productId: string;
  shopId: string;
  shopkeeperId: string;
  shopName: string;
  shopLocationName: string;
  productName: string;
  productImage: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  fromCartItemId?: string;
}

export interface PendingCheckoutDraft {
  bookingReference: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  items: PendingCheckoutItem[];
  totalQuantity: number;
  expectedBookingAmount: number;
  advanceAmount: number; // ₹75 * totalQuantity
  deliveryCharge: number; // ₹0 for takeaway, calculated for delivery
  deliveryMode: DeliveryMode;
  deliveryAddress?: CustomerAddress;
  totalPayableNow: number; // advanceAmount + deliveryCharge
  remainingProductAmount: number; // Total Offer Price - advanceAmount (payable to Shopkeeper later)
  upiId: string;
  upiUri: string;
  retryForBookingId?: string;
}

export interface CustomerCoordinates {
  latitude: number;
  longitude: number;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  language: 'English' | 'Hindi';
}

export const STANDARD_SIZES = [
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '28',
  '30',
  '32',
  '34',
  '36',
  '38',
  '40',
  '42',
  '44',
];

export const STANDARD_COLORS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Maroon',
  'Brown',
  'Pink',
  'Grey',
  'Navy',
  'Beige',
];
