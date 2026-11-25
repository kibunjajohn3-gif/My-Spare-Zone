export type PrimaryCategory =
  | 'Body parts'
  | 'Electricals'
  | 'Mechanical Parts'
  | 'Gearbox Oil'
  | 'Dashboard & Interior Parts';

export type BodySubcategory =
  | 'Doors'
  | 'Headlights'
  | 'Rearlights'
  | 'Side Mirrors'
  | 'Other Mirrors'
  | 'Front Bumpers'
  | 'Rear Bumpers'
  | 'Bonnet'
  | 'Boot'
  | 'Wings';

export type BodyPartConditionGrade = 'A' | 'B' | 'C';

export type MechanicalSubcategory =
  | 'Engines'
  | 'Gearboxes'
  | 'Suspension parts'
  | 'Steering Racks';

export type GearboxOilSubcategory =
  | 'CVT TC'
  | 'CVT FE'
  | 'ATF / Automatic'
  | 'Manual (75W-90)';

export type DashboardInteriorSubcategory =
  | 'Dashboards'
  | 'Instrument Clusters'
  | 'Center Consoles'
  | 'Seats & Upholstery'
  | 'Door Trims & Panels'
  | 'Steering Wheels & Airbags'
  | 'AC Vents & Controls';

export type ElectricalSubcategory =
  | 'Alternators'
  | 'Starters'
  | 'Sensors & Relays'
  | 'Batteries & Wiring'
  | 'General Electricals';

export type CarBrand =
  | 'Toyota'
  | 'Nissan'
  | 'Daihatsu'
  | 'Suzuki'
  | 'Subaru'
  | 'Isuzu'
  | 'Mazda'
  | 'Honda'
  | 'Mitsubishi'
  | 'Mercedes'
  | 'VW'
  | 'Audi'
  | 'Lexus'
  | 'Volvo'
  | 'Universal';

export interface SparePart {
  id: string;
  name: string;
  description: string;
  price: number;
  previousPrice?: number;
  isOffer?: boolean;
  category: PrimaryCategory;
  subcategory: string;
  brand?: CarBrand;
  carModel?: string;
  yearOfMake?: string;
  conditionGrade?: BodyPartConditionGrade;
  gearboxOilType?: string;
  sku: string;
  stock: number;
  imageUrl: string;
  imageUrls?: string[];
  floorPrice?: number;
  createdAt: string;
}

export interface CartItem {
  part: SparePart;
  quantity: number;
}

export interface ReceiptLineItem {
  partId: string;
  name: string;
  sku: string;
  category: PrimaryCategory;
  subcategory: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  volumeDiscountPct?: number;
  volumeDiscountAmount?: number;
}

export type UserRole = 'user' | 'admin';

export type GaragePartnerType = 'mechanic' | 'garage';

export type GaragePartnerStatus = 'pending' | 'active' | 'paused' | 'rejected';

export interface GaragePartnerProfile {
  id: string;
  userId: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  partnerType: GaragePartnerType;
  location: string;
  specialty?: string;
  referralCode: string;
  status: GaragePartnerStatus;
  discountTierPercent: number;
  ordersCount: number;
  itemsCount?: number;
  referralsCount: number;
  referredRevenue: number;
  referralCreditPending?: number;
  referralCreditBalance?: number;
  totalSpent: number;
  proofUrl?: string;
  proofType?: string;
  proofFileName?: string;
  proofMimeType?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  isProfessionalMechanicOrGarage?: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  isProfessionalMechanicOrGarage?: boolean;
  savedCarBrand?: CarBrand;
  savedCarModel?: string;
  savedCarYear?: string;
  createdAt: string;
  partnerProfile?: GaragePartnerProfile;
  wishlistPartIds?: string[];
}

export type OrderStatus = 'Pending' | 'Shipped' | 'Delivered';
export type OrderTrackingStage =
  | 'processing'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivered';

export interface OrderTrackingEvent {
  stage: OrderTrackingStage;
  label: string;
  note?: string;
  location?: string;
  updatedAt: string;
  updatedBy?: string;
}

export type DeliveryRegion = 'nairobi' | 'outside_nairobi' | 'pickup' | 'garage_fitting';
export type FittingAppointmentStatus = 'Scheduled' | 'In Bay' | 'Completed' | 'Cancelled';
export type MpesaStkStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface GarageFittingSlotAvailability {
  id: string;
  label: string;
  startHour: number;
  bookedCount: number;
  remainingBays: number;
  available: boolean;
  isPast: boolean;
}

export interface VirtualReceipt {
  id: string;
  receiptNumber: string;
  shopName: string;
  guaranteeText: string;
  customerCarePhone: string;
  issuedAt: string;
  status: OrderStatus;
  statusUpdatedAt?: string;
  trackingStage?: OrderTrackingStage;
  trackingLocation?: string;
  trackingEvents?: OrderTrackingEvent[];
  saleConfirmed?: boolean;
  confirmedAt?: string;
  paymentStatus?: 'Paid' | 'Pending';
  mpesaReceiptNumber?: string;
  mpesaPhone?: string;
  mpesaCheckoutRequestId?: string;
  cardTransactionRef?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardAuthCode?: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryRegion?: DeliveryRegion;
  deliveryDestination?: string;
  deliveryDistanceKm?: number;
  deliveryFee?: number;
  riderName?: string;
  riderPhone?: string;
  riderPlateNumber?: string;
  riderPhotoUrl?: string;
  riderLiveLocationUrl?: string;
  courierName?: string;
  pickupCode?: string;
  pickupReservedUntil?: string;
  pickupClaimedAt?: string;
  pickupExpiredRestockedAt?: string;
  pickupStatus?: 'reserved' | 'claimed' | 'expired_restocked';
  pickupBookingAgreement?: string;
  vehicleDetails?: string;
  fittingDate?: string;
  fittingTimeSlot?: string;
  fittingSlotLabel?: string;
  fittingStatus?: FittingAppointmentStatus;
  paymentMethod: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountAmount?: number;
  discountLabel?: string;
  referralCodeUsed?: string;
  referralPartnerId?: string;
  referralPartnerName?: string;
  referralCreditPercent?: number;
  referralCreditAmount?: number;
  referralCreditStatus?: 'pending_fitting' | 'credited';
  referralFittedTestedAt?: string;
  referralCreditApplied?: number;
  partnerId?: string;
  bargainId?: string;
  bargainCode?: string;
  total: number;
}

export interface PartnerReferralOrderSummary {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  orderStatus: OrderStatus;
  customerName: string;
  itemsSummary: string;
  itemsCount: number;
  total: number;
  referralCreditPercent: number;
  referralCreditAmount: number;
  referralCreditStatus: 'pending_fitting' | 'credited';
  referralFittedTestedAt?: string;
}

export type ReviewAuthorType = 'mechanic' | 'garage' | 'customer';

export interface CustomerReview {
  id: string;
  authorName: string;
  authorType: ReviewAuthorType;
  garageOrVehicle?: string;
  rating: number;
  comment: string;
  verifiedPurchase?: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  customerName: string;
  sender: 'customer' | 'support';
  text: string;
  createdAt: string;
}

export interface ChatThreadSummary {
  sessionId: string;
  customerName: string;
  lastMessage: string;
  lastSender: 'customer' | 'support';
  updatedAt: string;
  messageCount: number;
}

export interface SearchLogEntry {
  term: string;
  normalizedTerm: string;
  count: number;
  matchingPartsCount: number;
  inStockCount: number;
  lastSearchedAt: string;
}

export type SmsNotificationType =
  | 'order_confirmation'
  | 'order_status'
  | 'fitting_status'
  | 'partner_approval'
  | 'referral_credit'
  | 'bargain_update'
  | 'manual_status';

export interface SmsRecipientResult {
  name?: string;
  phone: string;
  status: 'sent' | 'failed';
  detail?: string;
}

export interface SmsNotificationRecord {
  id: string;
  type: SmsNotificationType;
  audience: 'order' | 'partner';
  audienceLabel: string;
  senderPhone: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  recipients: SmsRecipientResult[];
  createdAt: string;
  createdBy: string;
  isManual?: boolean;
  orderStatusLabel?: string;
  receiptNumber?: string;
  deliveryChannel?: 'admin_direct' | 'phone_sms_app';
}

export type PartSourceType = 'in_store' | 'outside_shop';

export interface PartSourcingLog {
  id: string;
  date: string;
  receiptNumber?: string;
  orderId?: string;
  orderPartKey?: string;
  partName: string;
  category?: string;
  sku?: string;
  quantity: number;
  sourceType: PartSourceType;
  sourceShopName?: string;
  clientName?: string;
  handledBy: string;
  fittedByOurMechanic: boolean;
  mechanicName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BargainStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'redeemed'
  | 'expired';

export interface BargainItem {
  partId: string;
  name: string;
  sku: string;
  category: PrimaryCategory;
  subcategory: string;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
}

export interface BargainHistoryEntry {
  actor: 'customer' | 'admin';
  action:
    | 'submitted'
    | 'countered'
    | 'accepted'
    | 'rejected'
    | 're_offered'
    | 'withdrawn'
    | 'redeemed';
  amount?: number;
  note?: string;
  createdAt: string;
}

export interface BargainOffer {
  id: string;
  bargainCode: string;
  sessionId: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  items: BargainItem[];
  listedSubtotal: number;
  offeredTotal: number;
  counterTotal?: number;
  agreedTotal?: number;
  status: BargainStatus;
  customerNote?: string;
  adminNote?: string;
  history: BargainHistoryEntry[];
  redeemedReceiptId?: string;
  redeemedReceiptNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BargainSettings {
  autoAcceptMaxDiscountPct: number;
}


