import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Pool } from 'pg';
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_SECTIONS,
} from './src/constants/privacyPolicy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawPort = process.env.PORT?.trim();
const PORT: number | string = rawPort
  ? /^\d+$/.test(rawPort)
    ? Number(rawPort)
    : rawPort
  : 3000;
const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const pgPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function loadStoreFromDb() {
  if (!pgPool) return;
  try {
    await pgPool.query(
      `CREATE TABLE IF NOT EXISTS app_store (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`
    );
    const r = await pgPool.query(`SELECT data FROM app_store WHERE id = 1`);
    if (r.rows[0]?.data) {
      ensureStorageDirs();5
      fs.writeFileSync(STORE_PATH, JSON.stringify(r.rows[0].data), 'utf-8');
      console.log('[store] Restored from Postgres');
    }
  } catch (e) {
    console.error('[store] Postgres load failed, using file:', e);
  }
}

async function saveStoreToDb(data: StoreData) {
  if (!pgPool) return;
  try {
    await pgPool.query(
      `INSERT INTO app_store (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
  } catch (e) {
    console.error('[store] Postgres save failed:', e);
  }
}
const IMAGES_DIR = path.resolve(__dirname, 'src/assets/images');

const SHOP_NAME = 'My Spare Zone';
const CUSTOMER_CARE_NUMBER = '+254706130014';
const GUARANTEE_NOTICE = 'Goods are guaranteed for upto 7 days since purchase';

type PrimaryCategory =
  | 'Body parts'
  | 'Electricals'
  | 'Mechanical Parts'
  | 'Gearbox Oil'
  | 'Dashboard & Interior Parts';

const CATEGORY_MAP: Record<PrimaryCategory, string[]> = {
  'Body parts': [
    'Doors',
    'Headlights',
    'Rearlights',
    'Side Mirrors',
    'Other Mirrors',
    'Front Bumpers',
    'Rear Bumpers',
    'Bonnet',
    'Boot',
    'Wings',
  ],
  Electricals: [
    'Alternators',
    'Starters',
    'Sensors & Relays',
    'Batteries & Wiring',
    'General Electricals',
  ],
  'Mechanical Parts': [
    'Engines',
    'Gearboxes',
    'Suspension parts',
    'Steering Racks',
  ],
  'Gearbox Oil': [
    'CVT TC',
    'CVT FE',
    'ATF / Automatic',
    'Manual (75W-90)',
  ],
  'Dashboard & Interior Parts': [
    'Dashboards',
    'Instrument Clusters',
    'Center Consoles',
    'Seats & Upholstery',
    'Door Trims & Panels',
    'Steering Wheels & Airbags',
    'AC Vents & Controls',
  ],
};

type CarBrand =
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

const CAR_BRAND_SET = new Set<CarBrand>([
  'Toyota',
  'Nissan',
  'Daihatsu',
  'Suzuki',
  'Subaru',
  'Isuzu',
  'Mazda',
  'Honda',
  'Mitsubishi',
  'Mercedes',
  'VW',
  'Audi',
  'Lexus',
  'Volvo',
  'Universal',
]);

type BodyPartConditionGrade = 'A' | 'B' | 'C';

interface SparePartRecord {
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

interface ReceiptLineItemRecord {
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

type UserRole = 'user' | 'admin';

interface UserRecord {
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
}

interface AuthSessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  adminVerified?: boolean;
  adminPasswordAttempts?: number;
}

type OrderStatus = 'Pending' | 'Shipped' | 'Delivered';
type OrderTrackingStage = 'processing' | 'dispatched' | 'out_for_delivery' | 'delivered';
interface OrderTrackingEventRecord {
  stage: OrderTrackingStage;
  label: string;
  note?: string;
  location?: string;
  updatedAt: string;
  updatedBy?: string;
}
type DeliveryRegion = 'nairobi' | 'outside_nairobi' | 'pickup' | 'garage_fitting';
type FittingAppointmentStatus = 'Scheduled' | 'In Bay' | 'Completed' | 'Cancelled';

const GARAGE_SLOT_MAX_BAYS = 2;
const GARAGE_BOOKING_MAX_DAYS_AHEAD = 30;
const GARAGE_FITTING_SLOTS = [
  { id: '08:00', label: '8:00 AM – 9:00 AM', startHour: 8 },
  { id: '09:00', label: '9:00 AM – 10:00 AM', startHour: 9 },
  { id: '10:00', label: '10:00 AM – 11:00 AM', startHour: 10 },
  { id: '11:00', label: '11:00 AM – 12:00 PM', startHour: 11 },
  { id: '12:00', label: '12:00 PM – 1:00 PM', startHour: 12 },
  { id: '14:00', label: '2:00 PM – 3:00 PM', startHour: 14 },
  { id: '15:00', label: '3:00 PM – 4:00 PM', startHour: 15 },
  { id: '16:00', label: '4:00 PM – 5:00 PM', startHour: 16 },
  { id: '17:00', label: '5:00 PM – 6:00 PM', startHour: 17 },
] as const;

type MpesaStkStatus = 'pending' | 'pending_code' | 'completed' | 'failed' | 'cancelled';

type GaragePartnerType = 'mechanic' | 'garage';

type GaragePartnerStatus = 'pending' | 'active' | 'paused' | 'rejected';

interface GaragePartnerRecord {
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

type ReviewAuthorType = 'mechanic' | 'garage' | 'customer';

interface CustomerReviewRecord {
  id: string;
  authorName: string;
  authorType: ReviewAuthorType;
  garageOrVehicle?: string;
  rating: number;
  comment: string;
  verifiedPurchase?: boolean;
  createdAt: string;
}

interface VirtualReceiptRecord {
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
  trackingEvents?: OrderTrackingEventRecord[];
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
  items: ReceiptLineItemRecord[];
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

interface PendingOrderPayloadRecord {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  userId?: string;
  deliveryRegion: DeliveryRegion;
  deliveryAddress: string;
  deliveryDestination?: string;
  deliveryDistanceKm?: number;
  deliveryFee?: number;
  courierName?: string;
  vehicleDetails?: string;
  fittingDate?: string;
  fittingTimeSlot?: string;
  fittingSlotLabel?: string;
  paymentMethod: string;
  partnerId?: string;
  bargainId?: string;
  bargainCode?: string;
  bargainedPartIds?: string[];
  referralCodeUsed?: string;
  referralPartnerId?: string;
  referralPartnerName?: string;
  referralCreditPercent?: number;
  referralCreditAmount?: number;
  referralCreditApplied?: number;
  discountAmount?: number;
  discountLabel?: string;
  items: Array<{ partId: string; quantity: number }>;
}

interface MpesaTransactionRecord {
  id: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  mode: 'daraja' | 'prompt' | 'manual_code';
  phone: string;
  amount: number;
  paybill: string;
  accountNumber: string;
  status: MpesaStkStatus;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
  orderPayload: PendingOrderPayloadRecord;
}

type CardPaymentStatus = 'pending_confirmation' | 'completed' | 'cancelled' | 'failed';

interface CardTransactionRecord {
  id: string;
  transactionId: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardholderName: string;
  amount: number;
  status: CardPaymentStatus;
  resultDesc: string;
  cardTransactionRef?: string;
  cardAuthCode?: string;
  deductedAt?: string;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
  orderPayload: PendingOrderPayloadRecord;
}

interface ChatMessageRecord {
  id: string;
  sessionId: string;
  customerName: string;
  sender: 'customer' | 'support';
  text: string;
  createdAt: string;
}

interface SearchLogRecord {
  term: string;
  normalizedTerm: string;
  count: number;
  lastSearchedAt: string;
}

type SmsNotificationType =
  | 'order_confirmation'
  | 'order_status'
  | 'fitting_status'
  | 'partner_approval'
  | 'referral_credit'
  | 'bargain_update'
  | 'manual_status';

interface SmsRecipientResultRecord {
  name?: string;
  phone: string;
  status: 'sent' | 'failed';
  detail?: string;
}

interface SmsNotificationRecord {
  id: string;
  type: SmsNotificationType;
  audience: 'order' | 'partner';
  audienceLabel: string;
  senderPhone: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  recipients: SmsRecipientResultRecord[];
  createdAt: string;
  createdBy: string;
  isManual?: boolean;
  orderStatusLabel?: string;
  receiptNumber?: string;
  deliveryChannel?: 'admin_direct' | 'phone_sms_app';
}

interface SmsSettingsRecord {
  autoOrderSmsEnabled: boolean;
  adminSenderPhone?: string;
}

type PartSourceType = 'in_store' | 'outside_shop';

interface PartSourcingLogRecord {
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

type BargainStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'redeemed'
  | 'expired';

interface BargainItemRecord {
  partId: string;
  name: string;
  sku: string;
  category: PrimaryCategory;
  subcategory: string;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
}

interface BargainHistoryEntryRecord {
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

interface BargainOfferRecord {
  id: string;
  bargainCode: string;
  sessionId: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  items: BargainItemRecord[];
  listedSubtotal: number;
  offeredTotal: number;
  counterTotal?: number;
  agreedTotal?: number;
  status: BargainStatus;
  customerNote?: string;
  adminNote?: string;
  history: BargainHistoryEntryRecord[];
  redeemedReceiptId?: string;
  redeemedReceiptNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface BargainSettingsRecord {
  autoAcceptMaxDiscountPct: number;
}

interface StoreData {
  parts: SparePartRecord[];
  orders: VirtualReceiptRecord[];
  messages: ChatMessageRecord[];
  users: UserRecord[];
  sessions: AuthSessionRecord[];
  searchLogs: SearchLogRecord[];
  mpesaTransactions: MpesaTransactionRecord[];
  cardTransactions: CardTransactionRecord[];
  reviews: CustomerReviewRecord[];
  partners: GaragePartnerRecord[];
  wishlists: Record<string, string[]>;
  smsLogs: SmsNotificationRecord[];
  smsSettings: SmsSettingsRecord;
  partSourcingLogs: PartSourcingLogRecord[];
  bargains: BargainOfferRecord[];
  bargainSettings: BargainSettingsRecord;
}

function ensureStorageDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getDefaultStore(): StoreData {
  const now = new Date().toISOString();
  return {
    parts: [
      {
        id: 'part-headlight-01',
        name: 'Toyota Corolla / Fielder LED Projector Headlight Assembly',
        description:
          'OEM-spec crystal lens LED projector headlamp with integrated daytime running light bar and plug-and-play harness.',
        price: 24500,
        category: 'Body parts',
        subcategory: 'Headlights',
        brand: 'Toyota',
        sku: 'MSZ-BP-HL01',
        stock: 9,
        imageUrl: '/src/assets/images/part_led_headlight_1794558118253.jpg',
        createdAt: now,
      },
      {
        id: 'part-bumper-02',
        name: 'Toyota Premio / Allion Primed Front Bumper Cover',
        description:
          'Impact-resistant ABS front bumper fascia finished in matte primer, ready for color-match painting with lower mesh insert.',
        price: 18900,
        category: 'Body parts',
        subcategory: 'Front Bumpers',
        brand: 'Toyota',
        sku: 'MSZ-BP-FB02',
        stock: 6,
        imageUrl: '/src/assets/images/part_front_bumper_1794558117406.jpg',
        createdAt: now,
      },
      {
        id: 'part-door-03',
        name: 'Nissan X-Trail / Note Front Side Door Shell Panel',
        description:
          'Electro-coated steel OEM replacement front door shell with factory hinge mounts, window frame, and internal impact beam.',
        price: 28500,
        category: 'Body parts',
        subcategory: 'Doors',
        brand: 'Nissan',
        sku: 'MSZ-BP-DR03',
        stock: 4,
        imageUrl: '/src/assets/images/part_car_door_1794558119566.jpg',
        createdAt: now,
      },
      {
        id: 'part-alternator-04',
        name: 'Toyota 120A High-Output Copper Alternator Unit',
        description:
          'Heavy-duty 12V 120-amp brushless alternator with precision sealed bearings, multi-rib pulley, and integrated voltage regulator.',
        price: 14500,
        category: 'Electricals',
        subcategory: 'Alternators',
        brand: 'Toyota',
        sku: 'MSZ-EL-AL04',
        stock: 14,
        imageUrl: '/src/assets/images/part_alternator_unit_1794558119505.jpg',
        createdAt: now,
      },
      {
        id: 'part-engine-05',
        name: 'Toyota 1.8L 2ZR-FE VVT-i Complete Engine Assembly',
        description:
          'Compression-tested 4-cylinder DOHC variable valve timing engine block with intake manifold, coil packs, and belt drive.',
        price: 145000,
        category: 'Mechanical Parts',
        subcategory: 'Engines',
        brand: 'Toyota',
        sku: 'MSZ-MP-EN05',
        stock: 3,
        imageUrl: '/src/assets/images/part_engine_assembly_1794558119453.jpg',
        createdAt: now,
      },
      {
        id: 'part-steering-06',
        name: 'Subaru Forester Hydraulic Power Steering Rack & Strut Kit',
        description:
          'Precision-machined rack and pinion steering assembly paired with heavy-duty coil-over shock damper and tie-rod ends.',
        price: 32000,
        category: 'Mechanical Parts',
        subcategory: 'Steering Racks',
        brand: 'Subaru',
        sku: 'MSZ-MP-SR06',
        stock: 7,
        imageUrl: '/src/assets/images/part_steering_suspension_1794558120615.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-cvt-07',
        name: 'Toyota CVT Automatic Gearbox Assembly (K111 / K311 Type)',
        description:
          'Low-mileage tested Toyota CVT transmission gearbox assembly (Axio, Fielder, Premio, Wish) with torque converter and valve body. Uses approx. 7L of CVT TC or CVT FE gearbox oil (2 × 4L cans).',
        price: 92000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Toyota',
        gearboxOilType: 'CVT TC / CVT FE Gearbox Oil',
        sku: 'MSZ-MP-GB07',
        stock: 4,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-atf-08',
        name: 'Toyota 6-Speed Automatic Transmission Gearbox (U660E / ATF Type)',
        description:
          'Complete Toyota 6-speed automatic torque-converter gearbox assembly (RAV4, Vanguard, Mark X, Camry) ready for fitment. Uses approx. 7L of ATF WS automatic gearbox oil (2 × 4L cans).',
        price: 105000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Toyota',
        gearboxOilType: 'ATF WS Automatic Gearbox Oil',
        sku: 'MSZ-MP-GB08',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-manual-09',
        name: 'Isuzu D-Max / N-Series 5-Speed Manual Transmission Gearbox',
        description:
          'Tested Isuzu 5-speed synchromesh manual gearbox assembly with clean gear engagement. Uses approx. 7L of SAE 75W-90 manual gearbox oil (2 × 4L cans).',
        price: 74000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Isuzu',
        gearboxOilType: 'SAE 75W-90 Manual Gearbox Oil',
        sku: 'MSZ-MP-GB09',
        stock: 5,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-nissan-16',
        name: 'Nissan X-Trail / Sylphy Xtronic CVT Gearbox (RE0F10A)',
        description:
          'Tested Nissan Xtronic CVT transmission assembly ready for installation. Uses approx. 7L of CVT TC/FE gearbox oil (2 × 4L cans).',
        price: 88000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Nissan',
        gearboxOilType: 'CVT TC / CVT FE Gearbox Oil',
        sku: 'MSZ-MP-NS16',
        stock: 4,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-subaru-17',
        name: 'Subaru Impreza / Forester Lineartronic CVT Gearbox (TR580)',
        description:
          'Genuine AWD Subaru Lineartronic CVT gearbox assembly tested for smooth lock-up. Uses approx. 7L of CVT FE/TC gearbox oil (2 × 4L cans).',
        price: 112000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Subaru',
        gearboxOilType: 'CVT FE / CVT TC Gearbox Oil',
        sku: 'MSZ-MP-SB17',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-honda-18',
        name: 'Honda Fit / Vezel CVT Automatic Gearbox Assembly',
        description:
          'Clean Honda CVT gearbox assembly with verified pressure specs. Uses approx. 7L of CVT FE / TC gearbox oil (2 × 4L cans).',
        price: 85000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Honda',
        gearboxOilType: 'CVT FE / CVT TC Gearbox Oil',
        sku: 'MSZ-MP-HD18',
        stock: 4,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-mazda-19',
        name: 'Mazda Demio / CX-5 Skyactiv 6-Speed ATF Gearbox',
        description:
          'Direct-fit Mazda Skyactiv-Drive 6-speed automatic gearbox assembly. Uses approx. 7L of ATF WS automatic gearbox oil (2 × 4L cans).',
        price: 96000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Mazda',
        gearboxOilType: 'ATF WS Automatic Gearbox Oil',
        sku: 'MSZ-MP-MZ19',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-suzuki-20',
        name: 'Suzuki Swift / Alto CVT & Automatic Gearbox Assembly',
        description:
          'Compact Suzuki CVT automatic gearbox unit with torque converter. Uses approx. 7L of CVT FE/TC gearbox oil (2 × 4L cans).',
        price: 68000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Suzuki',
        gearboxOilType: 'CVT FE / CVT TC Gearbox Oil',
        sku: 'MSZ-MP-SZ20',
        stock: 4,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-daihatsu-21',
        name: 'Daihatsu Terios / Mira 4-Speed ATF & CVT Gearbox',
        description:
          'Tested Daihatsu automatic gearbox assembly for Terios, Boon, and Mira models. Uses approx. 7L of ATF automatic gearbox oil (2 × 4L cans).',
        price: 64000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Daihatsu',
        gearboxOilType: 'ATF Automatic Gearbox Oil',
        sku: 'MSZ-MP-DH21',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-mercedes-22',
        name: 'Mercedes-Benz C-Class / E-Class 7G-Tronic ATF Gearbox',
        description:
          'Low-mileage Mercedes-Benz 7-speed automatic transmission assembly with mechatronic unit. Uses approx. 7L of ATF automatic gearbox oil (2 × 4L cans).',
        price: 158000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Mercedes',
        gearboxOilType: 'ATF Automatic Gearbox Oil',
        sku: 'MSZ-MP-MB22',
        stock: 2,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-vw-23',
        name: 'VW Golf / Tiguan / Passat 6-Speed DSG Automatic Gearbox',
        description:
          'Tested Volkswagen DSG / Tiptronic automatic gearbox assembly with dual-clutch pack. Uses approx. 7L of ATF / DSG automatic gearbox oil (2 × 4L cans).',
        price: 138000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'VW',
        gearboxOilType: 'ATF / DSG Automatic Gearbox Oil',
        sku: 'MSZ-MP-VW23',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-mitsubishi-24',
        name: 'Mitsubishi Outlander / RVR / Lancer INVECS-III CVT Gearbox',
        description:
          'Tested Mitsubishi INVECS-III CVT & automatic gearbox assembly for Lancer, RVR, Galant Fortis, and Outlander. Uses approx. 7L of CVT FE/TC gearbox oil (2 × 4L cans).',
        price: 94000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Mitsubishi',
        gearboxOilType: 'CVT FE / CVT TC Gearbox Oil',
        sku: 'MSZ-MP-MT24',
        stock: 4,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-audi-25',
        name: 'Audi A4 / Q5 S-Tronic 7-Speed Automatic Gearbox Assembly',
        description:
          'Tested Audi S-Tronic / Multitronic automatic transmission assembly for A3, A4, A6, and Q5 models. Uses approx. 7L of ATF / DSG automatic gearbox oil (2 × 4L cans).',
        price: 149000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Audi',
        gearboxOilType: 'ATF / DSG Automatic Gearbox Oil',
        sku: 'MSZ-MP-AD25',
        stock: 2,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-lexus-26',
        name: 'Lexus RX / IS / NX 6-Speed Automatic Transmission Gearbox',
        description:
          'Low-mileage tested Lexus U660E / A760E automatic gearbox assembly for IS250, RX350, and NX models. Uses approx. 7L of ATF WS automatic gearbox oil (2 × 4L cans).',
        price: 142000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Lexus',
        gearboxOilType: 'ATF WS Automatic Gearbox Oil',
        sku: 'MSZ-MP-LX26',
        stock: 3,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-gearbox-volvo-27',
        name: 'Volvo XC60 / S60 / V60 Geartronic 6-Speed ATF Gearbox',
        description:
          'Tested Volvo Aisin TF-80SC 6-speed Geartronic automatic gearbox assembly for XC60, XC90, S60, and V60 models. Uses approx. 7L of ATF WS automatic gearbox oil (2 × 4L cans).',
        price: 152000,
        category: 'Mechanical Parts',
        subcategory: 'Gearboxes',
        brand: 'Volvo',
        gearboxOilType: 'ATF WS Automatic Gearbox Oil',
        sku: 'MSZ-MP-VL27',
        stock: 2,
        imageUrl: '/src/assets/images/part_cvt_gearbox_1794639853321.jpg',
        createdAt: now,
      },
      {
        id: 'part-oil-cvt-tc-10',
        name: 'CVT TC Genuine Gearbox Oil (4 Litre Can)',
        description:
          'OEM-grade CVT TC continuously variable transmission fluid in a sealed 4-litre can. Gearboxes take around 7L, so a pair (2 cans) is recommended.',
        price: 5800,
        category: 'Gearbox Oil',
        subcategory: 'CVT TC',
        brand: 'Universal',
        sku: 'MSZ-GO-CVT10',
        stock: 20,
        imageUrl: '/src/assets/images/part_gearbox_oil_1794639853526.jpg',
        createdAt: now,
      },
      {
        id: 'part-oil-cvt-fe-11',
        name: 'CVT FE High-Efficiency Gearbox Oil (4 Litre Can)',
        description:
          'Low-viscosity CVT FE synthetic transmission oil in a 4-litre can for modern CVT gearboxes. Buy in pairs (2 cans = 8L) for a ~7L gearbox fill.',
        price: 6200,
        category: 'Gearbox Oil',
        subcategory: 'CVT FE',
        brand: 'Universal',
        sku: 'MSZ-GO-CVT11',
        stock: 18,
        imageUrl: '/src/assets/images/part_gearbox_oil_1794639853526.jpg',
        createdAt: now,
      },
      {
        id: 'part-oil-atf-12',
        name: 'ATF WS Automatic Gearbox Oil (4 Litre Can)',
        description:
          'Full-synthetic ATF WS / Dexron VI automatic transmission fluid in a 4-litre can. Gearboxes require ~7L (recommended in pairs of 2 cans).',
        price: 5200,
        category: 'Gearbox Oil',
        subcategory: 'ATF / Automatic',
        brand: 'Universal',
        sku: 'MSZ-GO-ATF12',
        stock: 24,
        imageUrl: '/src/assets/images/part_gearbox_oil_1794639853526.jpg',
        createdAt: now,
      },
      {
        id: 'part-oil-manual-13',
        name: 'SAE 75W-90 Synthetic Manual Gearbox Oil (4 Litre Can)',
        description:
          'Extreme-pressure GL-4/GL-5 75W-90 manual transmission oil in a 4-litre can. Recommended in pairs (2 cans) for complete ~7L gearbox servicing.',
        price: 4600,
        category: 'Gearbox Oil',
        subcategory: 'Manual (75W-90)',
        brand: 'Universal',
        sku: 'MSZ-GO-MAN13',
        stock: 22,
        imageUrl: '/src/assets/images/part_gearbox_oil_1794639853526.jpg',
        createdAt: now,
      },
      {
        id: 'part-dashboard-14',
        name: 'Toyota Premio / Fielder OEM Dashboard Assembly',
        description:
          'Clean dashboard shell with integrated instrument cluster housing, AC vents, and center trim panel. Direct interior fitment.',
        price: 38000,
        category: 'Dashboard & Interior Parts',
        subcategory: 'Dashboards',
        brand: 'Toyota',
        sku: 'MSZ-DI-DB14',
        stock: 4,
        imageUrl: '/src/assets/images/part_dashboard_interior_1794651869552.jpg',
        createdAt: now,
      },
      {
        id: 'part-console-15',
        name: 'Nissan X-Trail Center Console & Climate Control Trim Unit',
        description:
          'Factory center console assembly with shifter surround, cup holders, and AC control bezel.',
        price: 18500,
        category: 'Dashboard & Interior Parts',
        subcategory: 'Center Consoles',
        brand: 'Nissan',
        sku: 'MSZ-DI-CC15',
        stock: 7,
        imageUrl: '/src/assets/images/part_dashboard_interior_1794651869552.jpg',
        createdAt: now,
      },
    ],
    orders: [],
    messages: [],
    users: [
      {
        id: 'usr-admin-01',
        name: 'John Kibunja',
        phone: '+254706130014',
        email: 'kibunjajohn3@gmail.com',
        role: 'admin',
        createdAt: now,
      },
    ],
    sessions: [],
    searchLogs: [],
    mpesaTransactions: [],
    cardTransactions: [],
    reviews: [
      {
        id: 'rev-mech-01',
        authorName: 'Peter Mwangi',
        authorType: 'mechanic',
        garageOrVehicle: 'Mwangi Auto Diagnostics · Ngong Road',
        rating: 5,
        comment:
          'Ordered a Toyota K111 CVT gearbox and the matched 2 cans of CVT TC oil arrived sealed the same afternoon. Clean engagement after installation and zero guesswork on fluid spec.',
        verifiedPurchase: true,
        createdAt: now,
      },
      {
        id: 'rev-garage-02',
        authorName: 'Hassan Omar',
        authorType: 'garage',
        garageOrVehicle: 'Apex Kirinyaga Motors · Industrial Area',
        rating: 5,
        comment:
          'We source alternators, suspension kits, and Volvo & Subaru gearboxes every week through our Garage Partner account. Bulk discounts and WhatsApp dispatch updates keep our bays moving.',
        verifiedPurchase: true,
        createdAt: now,
      },
      {
        id: 'rev-mech-03',
        authorName: 'David Ochieng',
        authorType: 'mechanic',
        garageOrVehicle: 'Mobile Master Mechanic · Westlands / Kiambu',
        rating: 5,
        comment:
          'Picked up a Nissan X-Trail door panel and headlights directly from Seventies Plaza Shop LG9 at 7:45am. Straightforward counter pickup and honest 7-day guarantee.',
        verifiedPurchase: true,
        createdAt: now,
      },
      {
        id: 'rev-cust-04',
        authorName: 'Grace Wanjiku',
        authorType: 'customer',
        garageOrVehicle: 'Toyota Fielder NZE161',
        rating: 5,
        comment:
          'The M-Pesa STK prompt worked instantly and my rider delivered right on time from Kirinyaga Road. Genuine headlight fit perfectly.',
        verifiedPurchase: true,
        createdAt: now,
      },
    ],
    partners: [],
    wishlists: {},
    smsLogs: [],
    smsSettings: {
      autoOrderSmsEnabled: true,
      adminSenderPhone: ADMIN_SMS_SENDER_PHONE,
    },
    partSourcingLogs: [],
    bargains: [],
    bargainSettings: {
      autoAcceptMaxDiscountPct: 0,
    },
  };
}

function readStore(): StoreData {
  ensureStorageDirs();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = getDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const defaults = getDefaultStore();
    const parts = Array.isArray(parsed.parts) ? parsed.parts : defaults.parts;

    // Migrate any Gearbox Oil items previously stored under Mechanical Parts into the main Gearbox Oil category
    let migrated = false;
    for (const part of parts) {
      if ((part.subcategory === 'Gearbox Oil' || part.category === ('Mechanical Parts' as PrimaryCategory)) && part.subcategory === 'Gearbox Oil') {
        const text = `${part.name} ${part.description}`.toLowerCase();
        part.category = 'Gearbox Oil';
        if (text.includes('cvt tc')) {
          part.subcategory = 'CVT TC';
        } else if (text.includes('cvt fe') || text.includes('cvt')) {
          part.subcategory = 'CVT FE';
        } else if (text.includes('75w') || text.includes('manual')) {
          part.subcategory = 'Manual (75W-90)';
        } else {
          part.subcategory = 'ATF / Automatic';
        }
        migrated = true;
      }
    }

    // Backfill Gearbox, Gearbox Oil & Dashboard & Interior Parts catalog items once if none exist in an existing store.json
    const hasGearboxOil = parts.some((p) => p.category === 'Gearbox Oil');
    const hasGearbox = parts.some((p) => p.subcategory === 'Gearboxes');
    const hasDashboardInterior = parts.some((p) => p.category === 'Dashboard & Interior Parts');
    if (!hasGearboxOil || !hasGearbox || !hasDashboardInterior) {
      const existingIds = new Set(parts.map((p) => p.id));
      for (const seed of defaults.parts) {
        if (
          (seed.category === 'Gearbox Oil' ||
            seed.subcategory === 'Gearboxes' ||
            seed.category === 'Dashboard & Interior Parts') &&
          !existingIds.has(seed.id)
        ) {
          parts.push(seed);
          migrated = true;
        }
      }
    }

    // Backfill CarBrand onto existing parts and seed brand-specific gearboxes once
    const needsBrandMigration = parts.some((p) => !p.brand);
    if (needsBrandMigration) {
      const defaultBrandById = new Map(defaults.parts.map((s) => [s.id, s.brand]));
      const inferBrandFromText = (part: SparePartRecord): CarBrand => {
        if (part.category === 'Gearbox Oil') return 'Universal';
        const text = `${part.name} ${part.description}`.toLowerCase();
        if (text.includes('toyota') || text.includes('k111') || text.includes('k311')) return 'Toyota';
        if (text.includes('nissan')) return 'Nissan';
        if (text.includes('daihatsu')) return 'Daihatsu';
        if (text.includes('suzuki')) return 'Suzuki';
        if (text.includes('subaru')) return 'Subaru';
        if (text.includes('isuzu')) return 'Isuzu';
        if (text.includes('mazda')) return 'Mazda';
        if (text.includes('honda')) return 'Honda';
        if (text.includes('mitsubishi')) return 'Mitsubishi';
        if (text.includes('mercedes')) return 'Mercedes';
        if (text.includes('vw') || text.includes('volkswagen')) return 'VW';
        if (text.includes('audi')) return 'Audi';
        if (text.includes('lexus')) return 'Lexus';
        if (text.includes('volvo')) return 'Volvo';
        return 'Toyota';
      };
      for (const part of parts) {
        if (!part.brand) {
          part.brand = defaultBrandById.get(part.id) ?? inferBrandFromText(part);
        }
      }
      const existingIds = new Set(parts.map((p) => p.id));
      for (const seed of defaults.parts) {
        if (seed.subcategory === 'Gearboxes' && !existingIds.has(seed.id)) {
          parts.push(seed);
        }
      }
      migrated = true;
    }

    // Backfill Mitsubishi, Audi, Lexus & Volvo gearboxes once if any of those brands are missing from store yet
    const hasMitsubishi = parts.some((p) => p.brand === 'Mitsubishi');
    const hasAudi = parts.some((p) => p.brand === 'Audi');
    const hasLexus = parts.some((p) => p.brand === 'Lexus');
    const hasVolvo = parts.some((p) => p.brand === 'Volvo');
    if (!hasMitsubishi || !hasAudi || !hasLexus || !hasVolvo) {
      const existingIds = new Set(parts.map((p) => p.id));
      for (const seed of defaults.parts) {
        if (
          ((!hasMitsubishi && seed.brand === 'Mitsubishi') ||
            (!hasAudi && seed.brand === 'Audi') ||
            (!hasLexus && seed.brand === 'Lexus') ||
            (!hasVolvo && seed.brand === 'Volvo')) &&
          !existingIds.has(seed.id)
        ) {
          parts.push(seed);
          migrated = true;
        }
      }
    }

    // Backfill gearboxOilType onto existing gearbox parts once
    const isGearboxRecord = (part: SparePartRecord) =>
      part.category !== 'Gearbox Oil' &&
      (part.subcategory === 'Gearboxes' || /\bgearbox(?:es)?\b/i.test(part.name));
    const needsGearboxOilBackfill = parts.some((p) => isGearboxRecord(p) && !p.gearboxOilType);
    if (needsGearboxOilBackfill) {
      const defaultOilById = new Map(defaults.parts.map((s) => [s.id, s.gearboxOilType]));
      const inferOilFromPart = (part: SparePartRecord): string => {
        const text = `${part.name} ${part.description}`.toLowerCase();
        if (/\bcvt\s*fe\b/.test(text) && /\bcvt\s*tc\b/.test(text)) {
          return 'CVT FE / CVT TC Gearbox Oil';
        }
        if (/\bcvt\s*tc\b/.test(text)) return 'CVT TC / CVT FE Gearbox Oil';
        if (/\bcvt\s*fe\b/.test(text)) return 'CVT FE / CVT TC Gearbox Oil';
        if (/\bcvt\b/.test(text)) return 'CVT TC / CVT FE Gearbox Oil';
        if (/\b75w-?90\b|\bmanual\b/.test(text)) return 'SAE 75W-90 Manual Gearbox Oil';
        if (/\bdsg\b|\bdct\b|\bs-tronic\b/.test(text)) return 'ATF / DSG Automatic Gearbox Oil';
        if (/\batf\s*ws\b/.test(text)) return 'ATF WS Automatic Gearbox Oil';
        if (/\batf\b|\bauto(?:matic)?\b|\btiptronic\b/.test(text)) return 'ATF Automatic Gearbox Oil';
        return 'ATF / CVT Compatible Gearbox Oil';
      };
      for (const part of parts) {
        if (isGearboxRecord(part) && !part.gearboxOilType) {
          part.gearboxOilType = defaultOilById.get(part.id) ?? inferOilFromPart(part);
        }
      }
      migrated = true;
    }

    for (const part of parts) {
      const normalizedGallery = Array.from(
        new Set(
          [...(Array.isArray(part.imageUrls) ? part.imageUrls : []), part.imageUrl]
            .map((u) => (typeof u === 'string' ? u.trim() : ''))
            .filter(Boolean),
        ),
      ).slice(0, 3);
      if (normalizedGallery.length > 0 && (!Array.isArray(part.imageUrls) || part.imageUrls.length === 0)) {
        part.imageUrls = normalizedGallery;
        part.imageUrl = normalizedGallery[0];
        migrated = true;
      }
    }

    const orders = Array.isArray(parsed.orders) ? parsed.orders : [];
    const existingPickupCodes = new Set(
      orders.map((o) => o.pickupCode).filter((c): c is string => Boolean(c)),
    );
    for (const order of orders) {
      if (order.status !== 'Pending' && order.status !== 'Shipped' && order.status !== 'Delivered') {
        order.status = 'Pending';
        order.statusUpdatedAt = order.statusUpdatedAt || order.issuedAt;
        migrated = true;
      }
      if (order.deliveryRegion === 'pickup' && !order.pickupCode) {
        const code = generatePickupCode(existingPickupCodes);
        existingPickupCodes.add(code);
        const issuedMs = Date.parse(order.issuedAt) || Date.now();
        const reservedUntilIso = new Date(
          issuedMs + PICKUP_RESERVATION_HOURS * 60 * 60 * 1000,
        ).toISOString();
        order.pickupCode = code;
        order.pickupReservedUntil = reservedUntilIso;
        order.pickupStatus = order.status === 'Delivered' ? 'claimed' : 'reserved';
        if (order.status === 'Delivered') {
          order.pickupClaimedAt = order.confirmedAt || order.statusUpdatedAt || order.issuedAt;
        }
        order.pickupBookingAgreement = buildPickupBookingAgreement({
          receiptNumber: order.receiptNumber,
          pickupCode: code,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          reservedUntilIso,
          items: order.items,
          total: order.total,
        });
        migrated = true;
      }
      if ((order.pickupStatus as string | undefined) === 'expired') {
        order.pickupStatus = 'expired_restocked';
        migrated = true;
      }
      if (!order.trackingStage) {
        order.trackingStage =
          order.status === 'Delivered'
            ? 'delivered'
            : order.status === 'Shipped'
              ? 'dispatched'
              : 'processing';
        migrated = true;
      }
      if (!Array.isArray(order.trackingEvents) || order.trackingEvents.length === 0) {
        order.trackingEvents = buildInitialTrackingEvents(order);
        migrated = true;
      }
    }

    const rawUsers = Array.isArray(parsed.users) ? parsed.users : defaults.users;
    const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const revokedUserIds = new Set<string>();

    for (const u of rawUsers) {
      if (
        u.id === 'usr-admin-01' &&
        (u.email.toLowerCase() !== ADMIN_EMAIL ||
          normalizePhone(u.phone) !== ADMIN_PHONE ||
          normalizeName(u.name) !== normalizeName(ADMIN_NAME))
      ) {
        u.name = ADMIN_NAME;
        u.phone = ADMIN_PHONE;
        u.email = ADMIN_EMAIL;
        u.role = 'admin';
        revokedUserIds.add(u.id);
        migrated = true;
      } else if (u.role === 'admin' && !isStrictAdminIdentity(u.phone, u.email, u.name)) {
        u.role = 'user';
        revokedUserIds.add(u.id);
        migrated = true;
      }
    }

    if (!rawUsers.some((u) => isStrictAdminIdentity(u.phone, u.email, u.name) && u.role === 'admin')) {
      rawUsers.unshift({
        id: 'usr-admin-01',
        name: ADMIN_NAME,
        phone: ADMIN_PHONE,
        email: ADMIN_EMAIL,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
      migrated = true;
    }

    const sessions =
      revokedUserIds.size > 0
        ? rawSessions.filter((s) => !revokedUserIds.has(s.userId))
        : rawSessions;

    const rawWishlists =
      parsed.wishlists && typeof parsed.wishlists === 'object' && !Array.isArray(parsed.wishlists)
        ? parsed.wishlists
        : {};
    const wishlists: Record<string, string[]> = {};
    for (const [userId, ids] of Object.entries(rawWishlists)) {
      if (Array.isArray(ids)) {
        const cleanIds = Array.from(
          new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
        );
        if (cleanIds.length > 0) {
          wishlists[userId] = cleanIds;
        }
      }
    }

    const smsLogs: SmsNotificationRecord[] = Array.isArray(parsed.smsLogs)
      ? (parsed.smsLogs as unknown[])
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === 'object' && (entry as { type?: string }).type !== 'bulk',
          )
          .map((raw) => {
            const rawRecipients = Array.isArray(raw.recipients)
              ? (raw.recipients as Array<Record<string, unknown>>)
              : [];
            const senderPhone =
              typeof raw.senderPhone === 'string' && raw.senderPhone.trim()
                ? raw.senderPhone.trim()
                : ADMIN_SMS_SENDER_PHONE;
            const type = (raw.type as SmsNotificationType) || 'order_status';
            const audienceLabel = String(raw.audienceLabel || 'Order Status SMS');
            const createdBy = String(raw.createdBy || 'Automated Order SMS');
            const inferredManual =
              raw.isManual === true ||
              type === 'manual_status' ||
              createdBy.includes('Connectivity Test') ||
              audienceLabel.startsWith('Connectivity Test') ||
              audienceLabel.startsWith('Manual ');
            return {
              id: String(raw.id || `sms-${crypto.randomBytes(4).toString('hex')}`),
              type,
              audience: raw.audience === 'partner' ? 'partner' : 'order',
              audienceLabel,
              senderPhone,
              message: String(raw.message || ''),
              recipientCount: Number(raw.recipientCount) || rawRecipients.length,
              sentCount: Number(raw.sentCount) || rawRecipients.length,
              failedCount: Number(raw.failedCount) || 0,
              recipients: rawRecipients.map((r) => ({
                ...(typeof r.name === 'string' && r.name.trim() ? { name: r.name.trim() } : {}),
                phone: String(r.phone || ''),
                status: r.status === 'failed' ? 'failed' : 'sent',
                ...(typeof r.detail === 'string' && r.detail.trim()
                  ? { detail: r.detail.trim() }
                  : {}),
              })),
              createdAt: String(raw.createdAt || new Date().toISOString()),
              createdBy,
              isManual: inferredManual,
              ...(typeof raw.orderStatusLabel === 'string' && raw.orderStatusLabel.trim()
                ? { orderStatusLabel: raw.orderStatusLabel.trim() }
                : {}),
              ...(typeof raw.receiptNumber === 'string' && raw.receiptNumber.trim()
                ? { receiptNumber: raw.receiptNumber.trim() }
                : {}),
              ...(raw.deliveryChannel === 'phone_sms_app' || raw.deliveryChannel === 'admin_direct'
                ? { deliveryChannel: raw.deliveryChannel }
                : {}),
            };
          })
      : [];
    const rawSmsSettings: Partial<SmsSettingsRecord> =
      parsed.smsSettings && typeof parsed.smsSettings === 'object' ? parsed.smsSettings : {};
    const parsedAdminSenderPhone =
      typeof rawSmsSettings.adminSenderPhone === 'string' &&
      isValidPhone(rawSmsSettings.adminSenderPhone)
        ? formatSmsPhone(rawSmsSettings.adminSenderPhone) || ADMIN_SMS_SENDER_PHONE
        : ADMIN_SMS_SENDER_PHONE;
    const smsSettings: SmsSettingsRecord = {
      autoOrderSmsEnabled:
        typeof rawSmsSettings.autoOrderSmsEnabled === 'boolean'
          ? rawSmsSettings.autoOrderSmsEnabled
          : true,
      adminSenderPhone: parsedAdminSenderPhone,
    };

    const rawPartners: GaragePartnerRecord[] = Array.isArray(parsed.partners)
      ? (parsed.partners as GaragePartnerRecord[])
      : [];
    const partners = rawPartners.map((p) => {
      let next = p;
      if (typeof next.itemsCount !== 'number' || !Number.isFinite(next.itemsCount)) {
        migrated = true;
        const unitsFromOrders = orders
          .filter((o) => o.partnerId === next.id)
          .reduce(
            (sum, o) => sum + o.items.reduce((lineSum, it) => lineSum + (it.quantity || 0), 0),
            0,
          );
        next = {
          ...next,
          itemsCount: unitsFromOrders > 0 ? unitsFromOrders : Math.max(0, next.ordersCount || 0),
        };
      }
      if (
        typeof next.referralCreditPending !== 'number' ||
        typeof next.referralCreditBalance !== 'number'
      ) {
        migrated = true;
        next = {
          ...next,
          referralCreditPending:
            typeof next.referralCreditPending === 'number' &&
            Number.isFinite(next.referralCreditPending)
              ? next.referralCreditPending
              : 0,
          referralCreditBalance:
            typeof next.referralCreditBalance === 'number' &&
            Number.isFinite(next.referralCreditBalance)
              ? next.referralCreditBalance
              : 0,
        };
      }
      return next;
    });

    const partSourcingLogs = Array.isArray(parsed.partSourcingLogs)
      ? parsed.partSourcingLogs
      : [];
    const bargains = Array.isArray(parsed.bargains)
      ? (parsed.bargains as BargainOfferRecord[])
      : [];
    const rawAutoAccept =
      parsed.bargainSettings &&
      typeof parsed.bargainSettings === 'object' &&
      typeof (parsed.bargainSettings as { autoAcceptMaxDiscountPct?: unknown })
        .autoAcceptMaxDiscountPct === 'number'
        ? (parsed.bargainSettings as { autoAcceptMaxDiscountPct: number })
            .autoAcceptMaxDiscountPct
        : 0;
    const bargainSettings: BargainSettingsRecord = {
      autoAcceptMaxDiscountPct: Math.min(
        BARGAIN_MAX_DISCOUNT_PCT,
        Math.max(0, Math.round(Number.isFinite(rawAutoAccept) ? rawAutoAccept : 0)),
      ),
    };

    const store: StoreData = {
      parts,
      orders,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      users: rawUsers,
      sessions,
      searchLogs: Array.isArray(parsed.searchLogs) ? parsed.searchLogs : [],
      mpesaTransactions: Array.isArray(parsed.mpesaTransactions) ? parsed.mpesaTransactions : [],
      cardTransactions: Array.isArray(parsed.cardTransactions) ? parsed.cardTransactions : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : defaults.reviews,
      partners,
      wishlists,
      smsLogs,
      smsSettings,
      partSourcingLogs,
      bargains,
      bargainSettings,
    };
    if (expireUnclaimedCounterPickups(store)) {
      migrated = true;
    }
    // Automatically synchronize professional mechanic/garage flags strictly from Partner Program membership
    for (const p of store.partners) {
      const joined = isPartnerJoinedInProgram(p);
      if (Boolean(p.isProfessionalMechanicOrGarage) !== joined) {
        p.isProfessionalMechanicOrGarage = joined;
        migrated = true;
      }
    }
    for (const u of store.users) {
      if (isAuthorizedAdminUser(u)) {
        if (u.isProfessionalMechanicOrGarage) {
          delete u.isProfessionalMechanicOrGarage;
          migrated = true;
        }
        continue;
      }
      const linkedPartner = findPartnerForUser(store, u);
      const joined = isPartnerJoinedInProgram(linkedPartner);
      if (Boolean(u.isProfessionalMechanicOrGarage) !== joined) {
        u.isProfessionalMechanicOrGarage = joined;
        migrated = true;
      }
    }
    if (
      !Array.isArray(parsed.reviews) ||
      !Array.isArray(parsed.cardTransactions) ||
      !Array.isArray(parsed.partners) ||
      !parsed.wishlists ||
      typeof parsed.wishlists !== 'object' ||
      Array.isArray(parsed.wishlists) ||
      !Array.isArray(parsed.smsLogs) ||
      !parsed.smsSettings ||
      !Array.isArray(parsed.partSourcingLogs) ||
      !Array.isArray(parsed.bargains) ||
      !parsed.bargainSettings
    ) {
      migrated = true;
    }
    if (migrated) {
      writeStore(store);
    }
    return store;
  } catch {
    const fallback = getDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeStore(data: StoreData) {
  ensureStorageDirs();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, STORE_PATH);
    // Also persist to Postgres — fire and forget, don't block the request
      saveStoreToDb(data).catch(() => {});
}

function saveBase64Image(dataUrl: string): string | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif|avif|bmp));base64,(.+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64Data = match[2];
  const ext = mime.includes('png')
    ? 'png'
    : mime.includes('webp')
      ? 'webp'
      : mime.includes('gif')
        ? 'gif'
        : mime.includes('avif')
          ? 'avif'
          : mime.includes('bmp')
            ? 'bmp'
            : 'jpg';
  const filename = `part_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  ensureStorageDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, 'base64'));
  return `/uploads/${filename}`;
}

const PARTNER_PROOF_MAX_BYTES = 10 * 1024 * 1024;

function savePartnerProofFile(
  dataUrl: string,
): { url: string; mimeType: string } | { error: string } {
  const match =
    /^data:(image\/(?:png|jpeg|jpg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      dataUrl.trim(),
    );
  if (!match) {
    return {
      error: 'Verification proof must be a PNG, JPG, WEBP, GIF image or PDF document.',
    };
  }
  const rawMime = match[1].toLowerCase();
  const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (buffer.length === 0) {
    return { error: 'Uploaded proof file appears to be empty.' };
  }
  if (buffer.length > PARTNER_PROOF_MAX_BYTES) {
    return { error: 'Verification proof file must be 10 MB or smaller.' };
  }
  const ext =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType.includes('png')
        ? 'png'
        : mimeType.includes('webp')
          ? 'webp'
          : mimeType.includes('gif')
            ? 'gif'
            : 'jpg';
  const filename = `partner_proof_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  ensureStorageDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, mimeType };
}

function isPrimaryCategory(value: unknown): value is PrimaryCategory {
  return (
    value === 'Body parts' ||
    value === 'Electricals' ||
    value === 'Mechanical Parts' ||
    value === 'Gearbox Oil' ||
    value === 'Dashboard & Interior Parts'
  );
}

function normalizeCarBrand(value: unknown, fallback: CarBrand = 'Universal'): CarBrand {
  if (typeof value === 'string') {
    const trimmed = value.trim() as CarBrand;
    if (CAR_BRAND_SET.has(trimmed)) {
      return trimmed;
    }
  }
  return fallback;
}

function generateReceiptNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const code = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `MSZ-${y}${m}${day}-${code}`;
}

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (/^07\d{8}$/.test(cleaned) || /^01\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`;
  }
  if (/^254\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  return `+${cleaned}`;
}

function formatMpesaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^[17]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }
  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }
  return null;
}

function formatSmsPhone(raw: string): string | null {
  const keDigits = formatMpesaPhone(raw);
  if (keDigits) {
    return `+${keDigits}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

const ADMIN_PHONE = normalizePhone('0706130014');
const ADMIN_EMAIL = 'kibunjajohn3@gmail.com';
const ADMIN_NAME = 'John Kibunja';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abdirahman@9706';
const ADMIN_SMS_SENDER_PHONE =
  formatSmsPhone(process.env.ADMIN_SMS_SENDER_PHONE?.trim() || ADMIN_PHONE) || '+254706130014';

function getActiveAdminSenderPhone(store?: StoreData): string {
  const configured = store?.smsSettings?.adminSenderPhone?.trim();
  if (configured && isValidPhone(configured)) {
    return formatSmsPhone(configured) || ADMIN_SMS_SENDER_PHONE;
  }
  return ADMIN_SMS_SENDER_PHONE;
}

async function dispatchSmsBatch(
  rawRecipients: Array<{ name?: string; phone: string }>,
  message: string,
  configuredSenderPhone?: string,
): Promise<{
  senderPhone: string;
  recipients: SmsRecipientResultRecord[];
  sentCount: number;
  failedCount: number;
}> {
  const senderPhone =
    (configuredSenderPhone && isValidPhone(configuredSenderPhone)
      ? formatSmsPhone(configuredSenderPhone)
      : null) || ADMIN_SMS_SENDER_PHONE;
  const deduped = new Map<string, { name?: string; phone: string }>();
  for (const r of rawRecipients) {
    const formatted = formatSmsPhone(r.phone);
    if (!formatted) continue;
    if (!deduped.has(formatted)) {
      deduped.set(formatted, { name: r.name?.trim() || undefined, phone: formatted });
    }
  }

  const targets = Array.from(deduped.values());
  const webhookUrl = process.env.SMS_WEBHOOK_URL?.trim();
  const atApiKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const atUsername = process.env.AFRICASTALKING_USERNAME?.trim();
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();

  if (webhookUrl) {
    const recipients: SmsRecipientResultRecord[] = [];
    for (const target of targets) {
      try {
        const gwRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: senderPhone,
            to: target.phone,
            message,
          }),
        });
        recipients.push({
          name: target.name,
          phone: target.phone,
          status: gwRes.ok ? 'sent' : 'failed',
          detail: gwRes.ok
            ? `Delivered via SMS webhook from admin number ${senderPhone}`
            : `SMS webhook returned HTTP ${gwRes.status}`,
        });
      } catch {
        recipients.push({
          name: target.name,
          phone: target.phone,
          status: 'failed',
          detail: 'Network error contacting SMS webhook gateway',
        });
      }
    }
    const sentCount = recipients.filter((r) => r.status === 'sent').length;
    return {
      senderPhone,
      recipients,
      sentCount,
      failedCount: recipients.length - sentCount,
    };
  }

  if (atApiKey && atUsername && targets.length > 0) {
    try {
      const endpoint =
        atUsername.toLowerCase() === 'sandbox'
          ? 'https://api.sandbox.africastalking.com/version1/messaging'
          : 'https://api.africastalking.com/version1/messaging';
      const params = new URLSearchParams({
        username: atUsername,
        to: targets.map((t) => t.phone).join(','),
        message: `${message} [From Admin ${senderPhone}]`,
      });
      if (process.env.AFRICASTALKING_SENDER_ID?.trim()) {
        params.set('from', process.env.AFRICASTALKING_SENDER_ID.trim());
      }
      const atRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apiKey: atApiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (atRes.ok) {
        const recipients: SmsRecipientResultRecord[] = targets.map((t) => ({
          name: t.name,
          phone: t.phone,
          status: 'sent',
          detail: `Sent via Africa's Talking (Admin reply number ${senderPhone})`,
        }));
        return {
          senderPhone,
          recipients,
          sentCount: recipients.length,
          failedCount: 0,
        };
      }
    } catch {
      // Fall through cleanly below if external AT call fails in sandbox
    }
  }

  if (twilioSid && twilioToken && twilioFrom && targets.length > 0) {
    const recipients: SmsRecipientResultRecord[] = [];
    const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    for (const target of targets) {
      try {
        const params = new URLSearchParams({
          To: target.phone,
          From: twilioFrom,
          Body: `${message} (Admin: ${senderPhone})`,
        });
        const twRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          },
        );
        recipients.push({
          name: target.name,
          phone: target.phone,
          status: twRes.ok ? 'sent' : 'failed',
          detail: twRes.ok
            ? `Sent via Twilio (Admin line ${senderPhone})`
            : `Twilio gateway returned HTTP ${twRes.status}`,
        });
      } catch {
        recipients.push({
          name: target.name,
          phone: target.phone,
          status: 'failed',
          detail: 'Network error contacting Twilio SMS gateway',
        });
      }
    }
    const sentCount = recipients.filter((r) => r.status === 'sent').length;
    return {
      senderPhone,
      recipients,
      sentCount,
      failedCount: recipients.length - sentCount,
    };
  }

  const recipients: SmsRecipientResultRecord[] = targets.map((t) => ({
    name: t.name,
    phone: t.phone,
    status: 'sent',
    detail: `Automated SMS dispatched from admin number ${senderPhone}`,
  }));

  return {
    senderPhone,
    recipients,
    sentCount: recipients.length,
    failedCount: 0,
  };
}

function getNairobiNowParts(now = new Date()): { dateStr: string; hour: number } {
  const nairobiMs = now.getTime() + 3 * 60 * 60 * 1000;
  const d = new Date(nairobiMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${y}-${m}-${day}`,
    hour: d.getUTCHours(),
  };
}

function addDaysToDateStrServer(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function isValidDateStrServer(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

function isSundayDateStrServer(dateStr: string): boolean {
  if (!isValidDateStrServer(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

function getDefaultFittingDateServer(now = new Date()): string {
  const { dateStr, hour } = getNairobiNowParts(now);
  let candidate = hour >= 17 ? addDaysToDateStrServer(dateStr, 1) : dateStr;
  if (isSundayDateStrServer(candidate)) {
    candidate = addDaysToDateStrServer(candidate, 1);
  }
  return candidate;
}

function computeGarageSlotsForDate(store: StoreData, date: string) {
  const { dateStr: todayStr, hour: currentHour } = getNairobiNowParts();
  const isSunday = isSundayDateStrServer(date);
  const isPastDate = date < todayStr;
  const isToday = date === todayStr;

  const slots = GARAGE_FITTING_SLOTS.map((slot) => {
    const bookedCount = store.orders.filter(
      (o) =>
        o.deliveryRegion === 'garage_fitting' &&
        o.fittingDate === date &&
        o.fittingTimeSlot === slot.id &&
        o.fittingStatus !== 'Cancelled',
    ).length;
    const isPast = isPastDate || (isToday && slot.startHour <= currentHour);
    const remainingBays = Math.max(0, GARAGE_SLOT_MAX_BAYS - bookedCount);
    const available = !isSunday && !isPast && remainingBays > 0;
    return {
      id: slot.id,
      label: slot.label,
      startHour: slot.startHour,
      bookedCount,
      remainingBays,
      available,
      isPast,
    };
  });

  return {
    date,
    isSunday,
    isPastDate,
    maxBaysPerSlot: GARAGE_SLOT_MAX_BAYS,
    slots,
  };
}

function buildOrderConfirmationSmsText(receipt: VirtualReceiptRecord): string {
  const totalStr = `KSh ${receipt.total.toLocaleString('en-KE')}`;
  const regionNote =
    receipt.deliveryRegion === 'garage_fitting'
      ? receipt.fittingDate && receipt.fittingSlotLabel
        ? `In-garage fitting appointment booked for ${receipt.fittingDate} (${receipt.fittingSlotLabel}) at Seventies Plaza, Kirinyaga Rd — fit while you wait.`
        : 'Drive in with your vehicle for in-garage fitting while you wait at Seventies Plaza, Kirinyaga Rd (Mon-Sat 7:30am-6:30pm).'
      : receipt.deliveryRegion === 'pickup'
        ? `Counter pickup code: ${receipt.pickupCode || receipt.receiptNumber}. Your part is reserved for 24hrs at Seventies Plaza, Kirinyaga Rd; any unclaimed part after 24 hours automatically returns to stock.`
        : receipt.deliveryRegion === 'outside_nairobi'
          ? `Courier dispatch via ${receipt.courierName || 'selected courier'}.`
          : `Nairobi delivery to ${receipt.deliveryDestination || 'your destination'} (Rider fee KSh ${(receipt.deliveryFee || 0).toLocaleString('en-KE')} included). After payment, the rider will send his live location from his WhatsApp to your WhatsApp (${receipt.customerPhone}), along with his picture & number plate number for easy live tracking.`;
  return `My Spare Zone: Order ${receipt.receiptNumber} confirmed (${totalStr}). ${regionNote} Care: ${CUSTOMER_CARE_NUMBER}.`;
}

function buildOrderStatusSmsText(
  receipt: VirtualReceiptRecord,
  nextStatus: OrderStatus,
  senderPhone = CUSTOMER_CARE_NUMBER,
  trackingStage?: OrderTrackingStage,
): string {
  const totalStr = `KSh ${receipt.total.toLocaleString('en-KE')}`;
  if (trackingStage === 'out_for_delivery') {
    const destNote =
      receipt.deliveryRegion === 'nairobi'
        ? ` Our rider (${receipt.riderPlateNumber || 'Nairobi dispatch'}) is sending live location from WhatsApp to your WhatsApp (${receipt.customerPhone}).`
        : '';
    return `My Spare Zone: Order ${receipt.receiptNumber} is OUT FOR DELIVERY.${destNote} Total ${totalStr}. Admin: ${senderPhone}.`;
  }
  if (nextStatus === 'Shipped') {
    const courierPart = receipt.courierName ? ` via ${receipt.courierName}` : '';
    const riderPart =
      receipt.deliveryRegion === 'nairobi' && receipt.riderPlateNumber
        ? ` Rider ${receipt.riderName || ''} (${receipt.riderPlateNumber}).`
        : '';
    return `My Spare Zone: Order ${receipt.receiptNumber} has been SHIPPED${courierPart}.${riderPart} Total ${totalStr}. Admin: ${senderPhone}.`;
  }
  if (nextStatus === 'Delivered') {
    return `My Spare Zone: Order ${receipt.receiptNumber} has been DELIVERED. Thank you for trusting My Spare Zone (Seventies Plaza, Kirinyaga Rd). Admin: ${senderPhone}.`;
  }
  return `My Spare Zone: Order ${receipt.receiptNumber} status is now Pending (${totalStr}). Admin: ${senderPhone}.`;
}

function resolveOrderSmsRecipients(
  store: StoreData,
  receipt: VirtualReceiptRecord,
): Array<{ name?: string; phone: string }> {
  const recipientsByPhone = new Map<string, { name?: string; phone: string }>();
  const addTarget = (label: string, rawPhone?: string) => {
    if (!rawPhone) return;
    const formatted = formatSmsPhone(rawPhone);
    if (!formatted) return;
    if (!recipientsByPhone.has(formatted)) {
      recipientsByPhone.set(formatted, { name: label, phone: formatted });
    }
  };

  const purchasingPartner = receipt.partnerId
    ? store.partners.find((p) => p.id === receipt.partnerId)
    : undefined;
  const orderUser = receipt.userId
    ? store.users.find((u) => u.id === receipt.userId)
    : undefined;

  const orderUserPartner = findPartnerForUser(store, orderUser);
  if (purchasingPartner) {
    const partnerRole = purchasingPartner.partnerType === 'garage' ? 'Garage' : 'Mechanic';
    addTarget(
      `${purchasingPartner.businessName} (${partnerRole})`,
      receipt.customerPhone,
    );
    addTarget(
      `${purchasingPartner.businessName} (${partnerRole})`,
      purchasingPartner.phone,
    );
  } else if (isPartnerJoinedInProgram(orderUserPartner)) {
    const partnerRole = orderUserPartner!.partnerType === 'garage' ? 'Garage' : 'Mechanic';
    addTarget(`${orderUserPartner!.businessName} (${partnerRole})`, receipt.customerPhone);
  } else {
    addTarget(`${receipt.customerName} (Customer)`, receipt.customerPhone);
  }

  if (receipt.referralPartnerId || receipt.referralCodeUsed) {
    const refPartner = store.partners.find(
      (p) =>
        (receipt.referralPartnerId && p.id === receipt.referralPartnerId) ||
        (receipt.referralCodeUsed &&
          p.referralCode.toUpperCase() === receipt.referralCodeUsed.toUpperCase()),
    );
    if (refPartner) {
      const refRole = refPartner.partnerType === 'garage' ? 'Garage' : 'Mechanic';
      addTarget(`${refPartner.businessName} (${refRole})`, refPartner.phone);
    }
  }

  const orderPartLogs = store.partSourcingLogs.filter(
    (l) =>
      l.fittedByOurMechanic &&
      Boolean(l.mechanicName?.trim()) &&
      (l.orderId === receipt.id ||
        (Boolean(receipt.receiptNumber) && l.receiptNumber === receipt.receiptNumber)),
  );
  for (const log of orderPartLogs) {
    const mechNameLower = log.mechanicName!.trim().toLowerCase();
    const partnerMatch = store.partners.find(
      (p) =>
        p.contactName.trim().toLowerCase() === mechNameLower ||
        p.businessName.trim().toLowerCase() === mechNameLower,
    );
    if (partnerMatch) {
      const role = partnerMatch.partnerType === 'garage' ? 'Garage' : 'Mechanic';
      addTarget(`${partnerMatch.contactName || partnerMatch.businessName} (${role})`, partnerMatch.phone);
      continue;
    }
    const userMatch = store.users.find(
      (u) => u.role !== 'admin' && u.name.trim().toLowerCase() === mechNameLower,
    );
    if (userMatch) {
      addTarget(`${userMatch.name} (Mechanic)`, userMatch.phone);
    }
  }

  return Array.from(recipientsByPhone.values());
}

async function appendOrderSmsNotification(
  store: StoreData,
  receipt: VirtualReceiptRecord,
  type: 'order_confirmation' | 'order_status',
  statusForMessage?: OrderStatus,
  triggeredBy = 'Automated Order SMS',
): Promise<SmsNotificationRecord | null> {
  if (type === 'order_status' && store.smsSettings?.autoOrderSmsEnabled === false) {
    return null;
  }
  const recipients = resolveOrderSmsRecipients(store, receipt);
  if (recipients.length === 0) {
    return null;
  }
  const activeSenderPhone = getActiveAdminSenderPhone(store);
  const message =
    type === 'order_confirmation'
      ? buildOrderConfirmationSmsText(receipt)
      : buildOrderStatusSmsText(
          receipt,
          statusForMessage || receipt.status || 'Pending',
          activeSenderPhone,
          receipt.trackingStage,
        );

  const dispatch = await dispatchSmsBatch(recipients, message, activeSenderPhone);
  const autoActor =
    triggeredBy === 'Automated Order SMS'
      ? 'Automated Order SMS'
      : `${triggeredBy} (Auto Status SMS)`;
  const record: SmsNotificationRecord = {
    id: `sms-${crypto.randomBytes(4).toString('hex')}`,
    type,
    audience: 'order',
    audienceLabel:
      type === 'order_confirmation'
        ? `Order ${receipt.receiptNumber} Confirmation`
        : `Order ${receipt.receiptNumber} · ${statusForMessage || receipt.status}`,
    senderPhone: dispatch.senderPhone,
    message,
    recipientCount: dispatch.recipients.length,
    sentCount: dispatch.sentCount,
    failedCount: dispatch.failedCount,
    recipients: dispatch.recipients,
    createdAt: new Date().toISOString(),
    createdBy: autoActor,
    isManual: false,
    orderStatusLabel:
      type === 'order_confirmation' ? 'Confirmed' : statusForMessage || receipt.status || 'Pending',
    receiptNumber: receipt.receiptNumber,
    deliveryChannel: 'admin_direct',
  };
  store.smsLogs.unshift(record);
  if (store.smsLogs.length > 200) {
    store.smsLogs = store.smsLogs.slice(0, 200);
  }
  return record;
}

async function appendPartnerApprovalSmsNotification(
  store: StoreData,
  partner: GaragePartnerRecord,
  approvedBy = 'Admin Verification',
): Promise<SmsNotificationRecord | null> {
  const formatted = formatSmsPhone(partner.phone);
  if (!formatted) {
    return null;
  }
  const effectiveTier = computePartnerTierPercent(
    getPartnerLoyaltyItemsCountServer(partner),
    partner.discountTierPercent,
    isPartnerJoinedInProgram(partner),
  );
  const roleLabel = partner.partnerType === 'garage' ? 'Garage' : 'Mechanic';
  const message = `My Spare Zone: Congratulations ${partner.contactName}! Your ${roleLabel} Partner account for ${partner.businessName} is APPROVED (${effectiveTier}% base discount + ${PARTNER_BULK_BONUS_PCT}% bulk bonus on ${PARTNER_BULK_MIN_QTY}+ items & orders >= KSh ${PARTNER_BULK_MIN_SUBTOTAL.toLocaleString('en-KE')}). Referral code: ${partner.referralCode} (${REFERRAL_MECHANIC_CREDIT_PCT}% mechanic credit after fitting & testing). Care: ${CUSTOMER_CARE_NUMBER}.`;

  const dispatch = await dispatchSmsBatch(
    [{ name: `${partner.businessName} (${roleLabel})`, phone: formatted }],
    message,
    getActiveAdminSenderPhone(store),
  );
  const record: SmsNotificationRecord = {
    id: `sms-${crypto.randomBytes(4).toString('hex')}`,
    type: 'partner_approval',
    audience: 'partner',
    audienceLabel: `Partner Approved · ${partner.businessName}`,
    senderPhone: dispatch.senderPhone,
    message,
    recipientCount: dispatch.recipients.length,
    sentCount: dispatch.sentCount,
    failedCount: dispatch.failedCount,
    recipients: dispatch.recipients,
    createdAt: new Date().toISOString(),
    createdBy: approvedBy,
  };
  store.smsLogs.unshift(record);
  if (store.smsLogs.length > 200) {
    store.smsLogs = store.smsLogs.slice(0, 200);
  }
  return record;
}

async function appendReferralCreditReleasedSmsNotification(
  store: StoreData,
  partner: GaragePartnerRecord,
  receipt: VirtualReceiptRecord,
  creditAmount: number,
  releasedBy = 'Admin Verification',
): Promise<SmsNotificationRecord | null> {
  const formatted = formatSmsPhone(partner.phone);
  if (!formatted) {
    return null;
  }
  const balanceAfter = partner.referralCreditBalance || 0;
  const roleLabel = partner.partnerType === 'garage' ? 'Garage' : 'Mechanic';
  const message = `My Spare Zone: Good news ${partner.contactName}! Fitting & testing for referred order ${receipt.receiptNumber} is confirmed. KSh ${creditAmount.toLocaleString('en-KE')} (1% referral credit) has been credited to ${partner.businessName}. Available credit: KSh ${balanceAfter.toLocaleString('en-KE')}.`;

  const dispatch = await dispatchSmsBatch(
    [{ name: `${partner.businessName} (${roleLabel})`, phone: formatted }],
    message,
    getActiveAdminSenderPhone(store),
  );
  const record: SmsNotificationRecord = {
    id: `sms-${crypto.randomBytes(4).toString('hex')}`,
    type: 'referral_credit',
    audience: 'partner',
    audienceLabel: `Referral Credit · ${partner.businessName} (${receipt.receiptNumber})`,
    senderPhone: dispatch.senderPhone,
    message,
    recipientCount: dispatch.recipients.length,
    sentCount: dispatch.sentCount,
    failedCount: dispatch.failedCount,
    recipients: dispatch.recipients,
    createdAt: new Date().toISOString(),
    createdBy: releasedBy,
  };
  store.smsLogs.unshift(record);
  if (store.smsLogs.length > 200) {
    store.smsLogs = store.smsLogs.slice(0, 200);
  }
  return record;
}

async function appendFittingStatusSmsNotification(
  store: StoreData,
  receipt: VirtualReceiptRecord,
  nextFittingStatus: FittingAppointmentStatus,
  updatedBy = 'Garage Desk',
): Promise<SmsNotificationRecord | null> {
  const recipients = resolveOrderSmsRecipients(store, receipt);
  if (recipients.length === 0) {
    return null;
  }
  const slotInfo =
    receipt.fittingDate && receipt.fittingSlotLabel
      ? `${receipt.fittingDate} (${receipt.fittingSlotLabel})`
      : 'your booked visit';
  const vehiclePart = receipt.vehicleDetails ? ` for ${receipt.vehicleDetails}` : '';
  const message =
    nextFittingStatus === 'In Bay'
      ? `My Spare Zone: Your vehicle${vehiclePart} is now IN THE GARAGE BAY for order ${receipt.receiptNumber} (${slotInfo}) at Seventies Plaza, Kirinyaga Rd. Fitting is underway while you wait.`
      : nextFittingStatus === 'Completed'
        ? `My Spare Zone: Part fitting & testing is COMPLETED${vehiclePart} for order ${receipt.receiptNumber}! Your vehicle is ready to drive off from Seventies Plaza, Kirinyaga Rd. Care: ${CUSTOMER_CARE_NUMBER}.`
        : nextFittingStatus === 'Cancelled'
          ? `My Spare Zone: Your garage fitting appointment (${slotInfo}) for order ${receipt.receiptNumber} was cancelled. Contact ${CUSTOMER_CARE_NUMBER} to reschedule.`
          : `My Spare Zone: Your garage fitting appointment for order ${receipt.receiptNumber} is scheduled for ${slotInfo} at Seventies Plaza, Kirinyaga Rd.`;

  const dispatch = await dispatchSmsBatch(recipients, message, getActiveAdminSenderPhone(store));
  const record: SmsNotificationRecord = {
    id: `sms-${crypto.randomBytes(4).toString('hex')}`,
    type: 'fitting_status',
    audience: 'order',
    audienceLabel: `Fitting ${receipt.receiptNumber} · ${nextFittingStatus}`,
    senderPhone: dispatch.senderPhone,
    message,
    recipientCount: dispatch.recipients.length,
    sentCount: dispatch.sentCount,
    failedCount: dispatch.failedCount,
    recipients: dispatch.recipients,
    createdAt: new Date().toISOString(),
    createdBy: `${updatedBy} (Auto Bay SMS)`,
    isManual: false,
    orderStatusLabel: `Bay: ${nextFittingStatus}`,
    receiptNumber: receipt.receiptNumber,
    deliveryChannel: 'admin_direct',
  };
  store.smsLogs.unshift(record);
  if (store.smsLogs.length > 200) {
    store.smsLogs = store.smsLogs.slice(0, 200);
  }
  return record;
}

const BARGAIN_MIN_OFFER_PCT_OF_LISTED = 80;
const BARGAIN_MAX_DISCOUNT_PCT = 20;
const PICKUP_RESERVATION_HOURS = 24;
const NAIROBI_DELIVERY_RATE_PER_10KM = 500;
const SHOP_ORIGIN_COORDS_SERVER = { lat: -1.2819, lng: 36.8266 };

const NAIROBI_DELIVERY_ZONES_SERVER: Array<{
  name: string;
  distanceKm: number;
  aliases: string[];
}> = [
  { name: 'Nairobi CBD / Kirinyaga Rd / River Rd', distanceKm: 1.5, aliases: ['cbd', 'kirinyaga', 'river road', 'tom mboya', 'moi avenue', 'kencom', 'archives', 'globe', 'koja', 'downtown'] },
  { name: 'Ngara / Parklands / Museum Hill', distanceKm: 3.2, aliases: ['ngara', 'parklands', 'museum hill', 'fig tree', 'muthaiga', 'highridge'] },
  { name: 'Westlands / Sarit / Waiyaki Way', distanceKm: 5.5, aliases: ['westlands', 'sarit', 'westgate', 'mpaka', 'raphta', 'riverside', 'chiromo'] },
  { name: 'Upper Hill / Community / Kenyatta', distanceKm: 4.0, aliases: ['upper hill', 'upperhill', 'community', 'kenyatta hospital', 'knh', 'milimani'] },
  { name: 'Kilimani / Yaya / Hurlingham', distanceKm: 6.0, aliases: ['kilimani', 'yaya', 'hurlingham', 'argwings kodhek', 'wood avenue', 'kindaruma'] },
  { name: 'Kileleshwa', distanceKm: 7.0, aliases: ['kileleshwa', 'gatundu', 'ole dume', 'laikipia'] },
  { name: 'Lavington / Valley Arcade', distanceKm: 8.5, aliases: ['lavington', 'valley arcade', 'james gichuru', 'gitanga', 'muthangari'] },
  { name: 'Kawangware / Dagoretti Corner', distanceKm: 9.8, aliases: ['kawangware', 'dagoretti corner', 'dagoretti', 'riara'] },
  { name: 'South B / Capital Centre', distanceKm: 5.5, aliases: ['south b', 'mariakani', 'golden gate', 'capital centre', 'likoni'] },
  { name: 'South C / Mugoya / Bellevue', distanceKm: 7.2, aliases: ['south c', 'mugoya', 'bellevue', 'nyayo stadium', 'nextgen'] },
  { name: 'Industrial Area / Enterprise Rd', distanceKm: 4.5, aliases: ['industrial area', 'enterprise road', 'lusaka road', 'likoni road', 'bunyala', 'mombasa road'] },
  { name: 'Nairobi West / Madaraka', distanceKm: 4.8, aliases: ['nairobi west', 'madaraka', 'strathmore', 'tmall', 'langata road'] },
  { name: 'Eastleigh / Pangani', distanceKm: 4.2, aliases: ['eastleigh', 'pangani', 'juja road', '1st avenue', 'mlango kubwa'] },
  { name: 'Buruburu / Umoja / Donholm', distanceKm: 9.2, aliases: ['buruburu', 'umoja', 'donholm', 'jogoo road', 'makadara', 'jericho', 'jerusalem', 'kariobangi', 'out-ring'] },
  { name: 'Pangani / Muthaiga North', distanceKm: 6.5, aliases: ['muthaiga north', 'thika road', 'mathare'] },
  { name: 'Roysambu / TRM / Kasarani', distanceKm: 13.5, aliases: ['roysambu', 'trm', 'kasarani', 'mwiki', 'zimmerman', 'garden city'] },
  { name: 'Kahawa West / Kahawa Sukari', distanceKm: 18.0, aliases: ['kahawa', 'kahawa west', 'kahawa sukari', 'kahawa wendani', 'githurai'] },
  { name: 'Ruiru / Bypass / Kamakis', distanceKm: 23.0, aliases: ['ruiru', 'kamakis', 'membley', 'eastern bypass', 'ku', 'kenyatta university'] },
  { name: 'Juja / Thika Road Outer', distanceKm: 33.0, aliases: ['juja', 'jkuat', 'kalimoni', 'tolls'] },
  { name: 'Langata / Galleria / Wilson', distanceKm: 9.6, aliases: ['langata', "lang'ata", 'galleria', 'wilson', 'ongata', 'onyonka', 'maasai'] },
  { name: 'Karen / Hardy', distanceKm: 16.5, aliases: ['karen', 'hardy', 'hub karen', 'bomas', 'waterfront'] },
  { name: 'Rongai / Ongata Rongai', distanceKm: 21.5, aliases: ['rongai', 'ongata rongai', 'maasai lodge', 'kware', 'nkoroi'] },
  { name: 'Kiserian', distanceKm: 28.0, aliases: ['kiserian'] },
  { name: 'Ngong Town', distanceKm: 24.5, aliases: ['ngong', 'matasia', 'bulbul'] },
  { name: 'Kinoo / Kikuyu / Uthiru', distanceKm: 17.5, aliases: ['kikuyu', 'kinoo', 'uthiru', 'kangemi', 'regen', 'wanga'] },
  { name: 'Kangemi / Mountain View', distanceKm: 9.5, aliases: ['kangemi', 'mountain view'] },
  { name: 'Runda / Gigiri / Rosslyn', distanceKm: 12.2, aliases: ['runda', 'gigiri', 'rosslyn', 'village market', 'un', 'united nations', 'karura'] },
  { name: 'Kiambu Rd / Ridgeways / Thindigua', distanceKm: 13.8, aliases: ['kiambu', 'ridgeways', 'thindigua', 'fourways', 'cianda'] },
  { name: 'Ruaka / Two Rivers', distanceKm: 14.5, aliases: ['ruaka', 'two rivers', 'ndenderu'] },
  { name: 'Limuru / Banana', distanceKm: 27.0, aliases: ['limuru', 'banana', 'tigoni'] },
  { name: 'Embakasi / Fedha / Pipeline / JKIA', distanceKm: 13.5, aliases: ['embakasi', 'fedha', 'pipeline', 'jkia', 'airport', 'nyayo estate', 'tassia', 'imara daima'] },
  { name: 'Syokimau / Mlolongo / Gateway Mall', distanceKm: 21.0, aliases: ['syokimau', 'mlolongo', 'gateway mall', 'sgr', 'katani'] },
  { name: 'Kitengela / Athi River', distanceKm: 32.0, aliases: ['kitengela', 'athi river', 'mavoko', 'yukos'] },
  { name: 'Utawala / Ruai / Chokaa', distanceKm: 22.5, aliases: ['utawala', 'ruai', 'chokaa', 'mihango', 'kamulu'] },
  { name: 'Komarock / Kayole / Saika', distanceKm: 14.2, aliases: ['komarock', 'kayole', 'saika', 'njiru'] },
];

const nairobiGeocodeCache = new Map<
  string,
  { matchedZone: string | null; distanceKm: number; slabs: number; fee: number; source: 'zone_table' | 'openstreetmap' | 'keyword_fallback' }
>();

function computeNairobiFeeFromKm(distanceKm: number): { distanceKm: number; slabs: number; fee: number } {
  const safeKm = Math.max(0.5, Math.round(distanceKm * 10) / 10);
  const slabs = Math.max(1, Math.ceil(safeKm / 10));
  return {
    distanceKm: safeKm,
    slabs,
    fee: slabs * NAIROBI_DELIVERY_RATE_PER_10KM,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveNairobiDeliverySync(destination: string): {
  matchedZone: string | null;
  distanceKm: number;
  slabs: number;
  fee: number;
  source: 'zone_table' | 'openstreetmap' | 'keyword_fallback';
} {
  const cleaned = destination.trim().toLowerCase();
  if (!cleaned) {
    return { matchedZone: null, ...computeNairobiFeeFromKm(5), source: 'keyword_fallback' };
  }
  const cached = nairobiGeocodeCache.get(cleaned);
  if (cached) return cached;

  for (const zone of NAIROBI_DELIVERY_ZONES_SERVER) {
    if (zone.aliases.some((alias) => cleaned.includes(alias))) {
      const calc = computeNairobiFeeFromKm(zone.distanceKm);
      const quote = { matchedZone: zone.name, ...calc, source: 'zone_table' as const };
      nairobiGeocodeCache.set(cleaned, quote);
      return quote;
    }
  }

  let hash = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) % 1000;
  }
  const fallbackKm = Math.round((6 + (hash % 120) / 10) * 10) / 10;
  return { matchedZone: null, ...computeNairobiFeeFromKm(fallbackKm), source: 'keyword_fallback' };
}

async function resolveNairobiDeliveryAsync(destination: string): Promise<{
  matchedZone: string | null;
  distanceKm: number;
  slabs: number;
  fee: number;
  source: 'zone_table' | 'openstreetmap' | 'keyword_fallback';
}> {
  const cleaned = destination.trim().toLowerCase();
  if (!cleaned) {
    return resolveNairobiDeliverySync(destination);
  }
  const cached = nairobiGeocodeCache.get(cleaned);
  if (cached) return cached;

  for (const zone of NAIROBI_DELIVERY_ZONES_SERVER) {
    if (zone.aliases.some((alias) => cleaned.includes(alias))) {
      const calc = computeNairobiFeeFromKm(zone.distanceKm);
      const quote = { matchedZone: zone.name, ...calc, source: 'zone_table' as const };
      nairobiGeocodeCache.set(cleaned, quote);
      return quote;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q=${encodeURIComponent(
      `${destination.trim()}, Nairobi, Kenya`,
    )}`;
    const geoRes = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MySpareZone/1.0 (+https://mysparezone.co.ke)' },
    });
    clearTimeout(timer);
    if (geoRes.ok) {
      const matches = (await geoRes.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
      const first = matches[0];
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -1.65 &&
        lat <= -0.95 &&
        lon >= 36.55 &&
        lon <= 37.25
      ) {
        const directKm = haversineKm(SHOP_ORIGIN_COORDS_SERVER.lat, SHOP_ORIGIN_COORDS_SERVER.lng, lat, lon);
        const roadKm = Math.max(1.0, Math.round(directKm * 1.25 * 10) / 10);
        const calc = computeNairobiFeeFromKm(roadKm);
        const quote = {
          matchedZone: first?.display_name?.split(',').slice(0, 2).join(', ') || destination.trim(),
          ...calc,
          source: 'openstreetmap' as const,
        };
        nairobiGeocodeCache.set(cleaned, quote);
        return quote;
      }
    }
  } catch {
    // fallback deterministically below when network geocoding is unavailable
  }

  const fallback = resolveNairobiDeliverySync(destination);
  nairobiGeocodeCache.set(cleaned, fallback);
  return fallback;
}

function serializePartForClient(part: SparePartRecord, includeSecretFloor: boolean): SparePartRecord {
  const gallery = Array.from(
    new Set(
      [...(Array.isArray(part.imageUrls) ? part.imageUrls : []), part.imageUrl]
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean),
    ),
  ).slice(0, 3);
  const { floorPrice, ...publicFields } = part;
  return {
    ...publicFields,
    imageUrl: gallery[0] || part.imageUrl,
    imageUrls: gallery.length > 0 ? gallery : part.imageUrl ? [part.imageUrl] : [],
    ...(includeSecretFloor && typeof floorPrice === 'number' && Number.isFinite(floorPrice) && floorPrice > 0
      ? { floorPrice }
      : {}),
  };
}

function resolveSubmittedPartImages(
  body: Record<string, unknown>,
): { imageUrls: string[] } | { error: string } {
  const rawList = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const rawInputs: string[] = [];

  for (const item of rawList) {
    if (typeof item === 'string' && item.trim()) {
      rawInputs.push(item.trim());
    }
  }

  if (rawInputs.length === 0) {
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';
    const imageUrlInput = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (imageDataUrl) rawInputs.push(imageDataUrl);
    else if (imageUrlInput) rawInputs.push(imageUrlInput);
  }

  if (rawInputs.length > 3) {
    return { error: 'Maximum of 3 pictures allowed per spare part.' };
  }

  const resolved: string[] = [];
  for (const entry of rawInputs) {
    if (entry.startsWith('data:image/')) {
      const saved = saveBase64Image(entry);
      if (!saved) {
        return { error: 'One of the uploaded images has an invalid format. Use PNG, JPG, or WEBP.' };
      }
      resolved.push(saved);
    } else {
      resolved.push(entry);
    }
  }

  return { imageUrls: resolved };
}

function generatePickupCode(existingCodes: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const bytes = crypto.randomBytes(6);
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += chars[bytes[i] % chars.length];
    }
    const candidate = `PKP-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `PKP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function buildPickupBookingAgreement(params: {
  receiptNumber: string;
  pickupCode: string;
  customerName: string;
  customerPhone: string;
  reservedUntilIso: string;
  items: ReceiptLineItemRecord[];
  total: number;
}): string {
  const deadlineLabel = new Date(params.reservedUntilIso).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const partList = params.items.map((i) => `${i.quantity}x ${i.name} (${i.sku})`).join('; ');
  return [
    `COUNTER PICKUP BOOKING AGREEMENT — ${SHOP_NAME}`,
    `Pickup Code: ${params.pickupCode} | Receipt: ${params.receiptNumber}`,
    `Customer: ${params.customerName} (${params.customerPhone})`,
    `Reserved Parts: ${partList}`,
    `Agreed Order Total: KSh ${params.total.toLocaleString('en-KE')}`,
    `Reservation Window: Held strictly for 24 hours until ${deadlineLabel} (EAT).`,
    `Unclaimed Stock Policy: Any unclaimed part after 24 hours automatically returns to available store stock.`,
    `Guarantee: ${GUARANTEE_NOTICE}. Present Pickup Code ${params.pickupCode} at Seventies Plaza, Kirinyaga Rd (Shops LG9 & LG10) to collect.`,
  ].join('\n');
}

function getTrackingStageLabelServer(stage: OrderTrackingStage): string {
  switch (stage) {
    case 'processing':
      return 'Processing';
    case 'dispatched':
      return 'Dispatched';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
  }
}

function normalizeTrackingStageServer(
  rawStage?: unknown,
  orderStatus?: OrderStatus,
): OrderTrackingStage {
  if (
    rawStage === 'processing' ||
    rawStage === 'dispatched' ||
    rawStage === 'out_for_delivery' ||
    rawStage === 'delivered'
  ) {
    return rawStage;
  }
  if (orderStatus === 'Delivered') return 'delivered';
  if (orderStatus === 'Shipped') return 'dispatched';
  return 'processing';
}

function trackingStageToOrderStatusServer(stage: OrderTrackingStage): OrderStatus {
  if (stage === 'delivered') return 'Delivered';
  if (stage === 'dispatched' || stage === 'out_for_delivery') return 'Shipped';
  return 'Pending';
}

function getDefaultTrackingNoteServer(
  stage: OrderTrackingStage,
  order: Pick<VirtualReceiptRecord, 'deliveryRegion' | 'deliveryDestination' | 'courierName' | 'pickupCode'>,
): string {
  if (order.deliveryRegion === 'pickup') {
    if (stage === 'processing') return 'Parts picked & reserved for Counter Pickup.';
    if (stage === 'dispatched') return `Ready at Kirinyaga Rd counter (Code: ${order.pickupCode || 'Assigned'}).`;
    if (stage === 'out_for_delivery') return 'Staged at counter desk awaiting customer inspection & pickup.';
    return 'Claimed & handed over at the Kirinyaga Rd counter.';
  }
  if (order.deliveryRegion === 'garage_fitting') {
    if (stage === 'processing') return 'Parts reserved for your booked garage fitting bay.';
    if (stage === 'dispatched') return 'Parts staged at Seventies Plaza garage bay.';
    if (stage === 'out_for_delivery') return 'Active in garage service bay for fitting.';
    return 'In-garage fitting completed and vehicle released.';
  }
  if (order.deliveryRegion === 'outside_nairobi') {
    if (stage === 'processing') return 'Order verified & packed for courier dispatch.';
    if (stage === 'dispatched') return `Dispatched via ${order.courierName || 'courier service'}.`;
    if (stage === 'out_for_delivery') return `Out for delivery / collection via ${order.courierName || 'courier'}.`;
    return 'Delivered via courier and confirmed received.';
  }
  if (stage === 'processing') return 'Order verified & spare parts being packed at Kirinyaga Rd. After payment, our rider sends his live location from his WhatsApp to your WhatsApp, plus his picture & number plate number.';
  if (stage === 'dispatched') return `Handed over to Nairobi rider${order.deliveryDestination ? ` for ${order.deliveryDestination}` : ''} — live location sent from the rider's WhatsApp to your WhatsApp, with rider picture & number plate number.`;
  if (stage === 'out_for_delivery') return `Rider is out for delivery${order.deliveryDestination ? ` to ${order.deliveryDestination}` : ''} with live location sent from the rider's WhatsApp to your WhatsApp, plus picture & number plate.`;
  return 'Delivered to customer destination and confirmed.';
}

function buildInitialTrackingEvents(order: VirtualReceiptRecord): OrderTrackingEventRecord[] {
  const stage = normalizeTrackingStageServer(order.trackingStage, order.status);
  const events: OrderTrackingEventRecord[] = [
    {
      stage: 'processing',
      label: getTrackingStageLabelServer('processing'),
      note: getDefaultTrackingNoteServer('processing', order),
      location: 'Seventies Plaza, Kirinyaga Rd',
      updatedAt: order.issuedAt,
    },
  ];
  if (stage === 'dispatched' || stage === 'out_for_delivery' || stage === 'delivered') {
    events.push({
      stage: 'dispatched',
      label: getTrackingStageLabelServer('dispatched'),
      note: getDefaultTrackingNoteServer('dispatched', order),
      updatedAt: order.statusUpdatedAt || order.issuedAt,
    });
  }
  if (stage === 'out_for_delivery' || stage === 'delivered') {
    events.push({
      stage: 'out_for_delivery',
      label: getTrackingStageLabelServer('out_for_delivery'),
      note: getDefaultTrackingNoteServer('out_for_delivery', order),
      updatedAt: order.statusUpdatedAt || order.issuedAt,
    });
  }
  if (stage === 'delivered') {
    events.push({
      stage: 'delivered',
      label: getTrackingStageLabelServer('delivered'),
      note: getDefaultTrackingNoteServer('delivered', order),
      updatedAt: order.confirmedAt || order.statusUpdatedAt || order.issuedAt,
    });
  }
  return events;
}

function sanitizeTrackingUrl(raw: unknown, allowRelativeAndDataImage = false): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().slice(0, 2000);
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (allowRelativeAndDataImage && (trimmed.startsWith('/uploads/') || /^data:image\//i.test(trimmed))) {
    return trimmed;
  }
  return undefined;
}

function applyTrackingUpdateToOrder(
  existingOrder: VirtualReceiptRecord,
  params: {
    trackingStage: OrderTrackingStage;
    trackingLocation?: string;
    trackingNote?: string;
    riderName?: string;
    riderPhone?: string;
    riderPlateNumber?: string;
    riderPhotoUrl?: string;
    riderLiveLocationUrl?: string;
    updatedBy?: string;
    nowIso?: string;
  },
): VirtualReceiptRecord {
  const nowIso = params.nowIso || new Date().toISOString();
  const nextStage = params.trackingStage;
  const nextStatus = trackingStageToOrderStatusServer(nextStage);
  const shouldConfirm = nextStatus === 'Shipped' || nextStatus === 'Delivered';
  const existingEvents =
    Array.isArray(existingOrder.trackingEvents) && existingOrder.trackingEvents.length > 0
      ? [...existingOrder.trackingEvents]
      : buildInitialTrackingEvents(existingOrder);
  const nextLocation =
    typeof params.trackingLocation === 'string' && params.trackingLocation.trim()
      ? params.trackingLocation.trim().slice(0, 120)
      : existingOrder.trackingLocation;
  const nextRiderName =
    typeof params.riderName === 'string' && params.riderName.trim()
      ? params.riderName.trim().slice(0, 80)
      : existingOrder.riderName;
  const nextRiderPhone =
    typeof params.riderPhone === 'string' && params.riderPhone.trim()
      ? params.riderPhone.trim().slice(0, 40)
      : existingOrder.riderPhone;
  const nextRiderPlate =
    typeof params.riderPlateNumber === 'string' && params.riderPlateNumber.trim()
      ? params.riderPlateNumber.trim().toUpperCase().slice(0, 30)
      : existingOrder.riderPlateNumber;
  const nextRiderPhoto =
    sanitizeTrackingUrl(params.riderPhotoUrl, true) ?? existingOrder.riderPhotoUrl;
  const nextRiderLiveLocation =
    sanitizeTrackingUrl(params.riderLiveLocationUrl, false) ??
    existingOrder.riderLiveLocationUrl;

  const eventNote =
    typeof params.trackingNote === 'string' && params.trackingNote.trim()
      ? params.trackingNote.trim().slice(0, 200)
      : getDefaultTrackingNoteServer(nextStage, existingOrder);

  const newEvent: OrderTrackingEventRecord = {
    stage: nextStage,
    label: getTrackingStageLabelServer(nextStage),
    note: eventNote,
    ...(nextLocation ? { location: nextLocation } : {}),
    updatedAt: nowIso,
    ...(params.updatedBy ? { updatedBy: params.updatedBy } : {}),
  };

  // Replace latest event if updating metadata on same stage, otherwise append
  const filteredEvents = existingEvents.filter((e) => e.stage !== nextStage);
  filteredEvents.push(newEvent);

  return {
    ...existingOrder,
    status: nextStatus,
    statusUpdatedAt: nowIso,
    trackingStage: nextStage,
    ...(nextLocation ? { trackingLocation: nextLocation } : {}),
    ...(nextRiderName ? { riderName: nextRiderName } : {}),
    ...(nextRiderPhone ? { riderPhone: nextRiderPhone } : {}),
    ...(nextRiderPlate ? { riderPlateNumber: nextRiderPlate } : {}),
    ...(nextRiderPhoto ? { riderPhotoUrl: nextRiderPhoto } : {}),
    ...(nextRiderLiveLocation ? { riderLiveLocationUrl: nextRiderLiveLocation } : {}),
    trackingEvents: filteredEvents,
    ...(shouldConfirm
      ? {
          saleConfirmed: true,
          confirmedAt: existingOrder.confirmedAt || nowIso,
        }
      : {}),
  };
}

function expireUnclaimedCounterPickups(store: StoreData, nowMs = Date.now()): boolean {
  let changed = false;
  const nowIso = new Date(nowMs).toISOString();
  for (const order of store.orders) {
    if (order.deliveryRegion !== 'pickup') continue;
    if (order.pickupStatus === 'claimed' || order.pickupStatus === 'expired_restocked') continue;
    if (order.status === 'Delivered') continue;
    if (!order.pickupReservedUntil) continue;
    const deadlineMs = Date.parse(order.pickupReservedUntil);
    if (!Number.isFinite(deadlineMs) || nowMs < deadlineMs) continue;

    for (const line of order.items) {
      const partIdx = store.parts.findIndex((p) => p.id === line.partId);
      if (partIdx !== -1) {
        store.parts[partIdx].stock = Math.max(0, store.parts[partIdx].stock) + Math.max(0, line.quantity);
      }
    }
    order.pickupStatus = 'expired_restocked';
    order.pickupExpiredRestockedAt = nowIso;
    changed = true;
  }
  return changed;
}

function evaluateBargainAgainstFloor(
  store: StoreData,
  items: BargainItemRecord[],
  offeredTotal: number,
): { outcome: 'auto_accept' | 'auto_decline' | 'manual_review' } {
  const autoAcceptThreshold = Math.min(
    BARGAIN_MAX_DISCOUNT_PCT,
    Math.max(0, store.bargainSettings?.autoAcceptMaxDiscountPct || 0),
  );
  let hasPartFloor = false;
  let totalFloorPrice = 0;
  let totalListedPrice = 0;

  for (const item of items) {
    const part = store.parts.find((p) => p.id === item.partId);
    const unitListed = part?.price ?? item.unitPrice;
    totalListedPrice += unitListed * item.quantity;

    if (part && typeof part.floorPrice === 'number' && Number.isFinite(part.floorPrice) && part.floorPrice > 0) {
      hasPartFloor = true;
      totalFloorPrice += Math.round(part.floorPrice) * item.quantity;
    } else if (autoAcceptThreshold > 0) {
      totalFloorPrice +=
        Math.round((unitListed * (100 - autoAcceptThreshold)) / 100) *
        item.quantity;
    } else {
      totalFloorPrice += unitListed * item.quantity;
    }
  }

  if (hasPartFloor || autoAcceptThreshold > 0) {
    return offeredTotal >= totalFloorPrice
      ? { outcome: 'auto_accept' }
      : { outcome: 'auto_decline' };
  }

  if (totalListedPrice > 0 && offeredTotal >= totalListedPrice) {
    return { outcome: 'auto_accept' };
  }

  return { outcome: 'manual_review' };
}

function generateBargainCode(existingCodes: Set<string>): string {
  for (let i = 0; i < 20; i += 1) {
    const token = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `BRG-${token}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `BRG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function appendBargainSmsNotification(
  store: StoreData,
  bargain: BargainOfferRecord,
  statusLabel: string,
  message: string,
  triggeredBy = 'Admin Bargain Desk',
): Promise<SmsNotificationRecord | null> {
  const formatted = formatSmsPhone(bargain.customerPhone);
  if (!formatted) {
    return null;
  }
  const dispatch = await dispatchSmsBatch(
    [{ name: `${bargain.customerName} (Customer)`, phone: formatted }],
    message,
    getActiveAdminSenderPhone(store),
  );
  const record: SmsNotificationRecord = {
    id: `sms-${crypto.randomBytes(4).toString('hex')}`,
    type: 'bargain_update',
    audience: 'order',
    audienceLabel: `Bargain ${bargain.bargainCode} · ${statusLabel}`,
    senderPhone: dispatch.senderPhone,
    message,
    recipientCount: dispatch.recipients.length,
    sentCount: dispatch.sentCount,
    failedCount: dispatch.failedCount,
    recipients: dispatch.recipients,
    createdAt: new Date().toISOString(),
    createdBy: triggeredBy,
    isManual: false,
    orderStatusLabel: `Bargain: ${statusLabel}`,
    receiptNumber: bargain.bargainCode,
    deliveryChannel: 'admin_direct',
  };
  store.smsLogs.unshift(record);
  if (store.smsLogs.length > 200) {
    store.smsLogs = store.smsLogs.slice(0, 200);
  }
  return record;
}

function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

const MPESA_PAYBILL = '247247';
const MPESA_ACCOUNT = '0940179972097';

function hasDarajaConfig(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY?.trim() &&
      process.env.MPESA_CONSUMER_SECRET?.trim() &&
      process.env.MPESA_PASSKEY?.trim(),
  );
}

function getDarajaBaseUrl(): string {
  return process.env.MPESA_ENV?.trim().toLowerCase() === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function generateDarajaTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function getDarajaAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY?.trim() || '';
  const secret = process.env.MPESA_CONSUMER_SECRET?.trim() || '';
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  const response = await fetch(
    `${getDarajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error('Could not authenticate with M-Pesa Daraja gateway.');
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Missing access token from M-Pesa Daraja gateway.');
  }
  return data.access_token;
}

function generateMpesaReceiptCode(): string {
  const prefix = 'UB';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `${prefix}${suffix}`;
}

function isStrictAdminIdentity(phone: string, email: string, name: string): boolean {
  return (
    normalizePhone(phone) === ADMIN_PHONE &&
    email.trim().toLowerCase() === ADMIN_EMAIL &&
    normalizeName(name) === normalizeName(ADMIN_NAME)
  );
}

function isAuthorizedAdminUser(user: UserRecord): boolean {
  return user.role === 'admin' && isStrictAdminIdentity(user.phone, user.email, user.name);
}

function verifyAdminPasswordValue(candidate: string): boolean {
  const expectedHash = crypto.createHash('sha256').update(ADMIN_PASSWORD, 'utf8').digest();
  const actualHash = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  return crypto.timingSafeEqual(expectedHash, actualHash);
}

function getAuthSessionAndUser(
  req: express.Request,
  store: StoreData,
): { token: string; session: AuthSessionRecord; user: UserRecord } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const session = store.sessions.find((s) => s.token === token);
  if (!session) return null;
  const user = store.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { token, session, user };
}

function getAuthenticatedUser(req: express.Request, store: StoreData): UserRecord | null {
  return getAuthSessionAndUser(req, store)?.user ?? null;
}

function requireAdminUser(req: express.Request, res: express.Response, store: StoreData): UserRecord | null {
  const auth = getAuthSessionAndUser(req, store);
  if (!auth) {
    res.status(401).json({ error: 'Please sign in with the registered admin credentials.' });
    return null;
  }
  if (!isAuthorizedAdminUser(auth.user)) {
    res.status(403).json({ error: 'Admin access required. Only the registered shop administrator can perform this action.' });
    return null;
  }
  if (!auth.session.adminVerified) {
    res.status(403).json({
      error: 'Admin password verification required to continue.',
      requiresAdminPassword: true,
    });
    return null;
  }
  return auth.user;
}

const INSULTING_WORD_PATTERNS = [
  /\bf+u+c+k+(?:ing|ed|er|ers|s)?\b/i,
  /\bs+h+i+t+(?:ty|s|head)?\b/i,
  /\bb+i+t+c+h+(?:es|ing)?\b/i,
  /\ba+s+s+h+o+l+e+s?\b/i,
  /\bb+a+s+t+a+r+d+s?\b/i,
  /\bi+d+i+o+t+s?\b/i,
  /\bs+t+u+p+i+d+\b/i,
  /\bm+o+r+o+n+s?\b/i,
  /\bd+u+m+b+a+s+s+\b/i,
  /\bc+u+n+t+s?\b/i,
  /\bd+i+c+k+(?:head)?s?\b/i,
  /\bw+h+o+r+e+s?\b/i,
  /\bs+l+u+t+s?\b/i,
  /\bm+a+l+a+y+a+\b/i,
  /\bm+j+i+n+g+a+\b/i,
  /\bt+a+k+a+t+a+k+a+\b/i,
  /\bm+a+t+a+k+o+\b/i,
  /\bumbwa\b/i,
  /\bng['’]?ombe\b/i,
];

function containsInsultingLanguage(text: string): boolean {
  return INSULTING_WORD_PATTERNS.some((pattern) => pattern.test(text));
}

const PARTNER_BASE_DISCOUNT_PCT = 2;
const PARTNER_REGULAR_3_DISCOUNT_PCT = 3;
const PARTNER_REGULAR_6_DISCOUNT_PCT = 5;
const PARTNER_REGULAR_MIN_ITEMS = 6;
const PARTNER_TOP_TIER_MIN_ITEMS = 10;
const PARTNER_BULK_BONUS_PCT = 3;
const PARTNER_BULK_MIN_QTY = 10;
const PARTNER_BULK_MIN_SUBTOTAL = 300000;
const PARTNER_MAX_DISCOUNT_PCT = 8;
const REFERRAL_MECHANIC_CREDIT_PCT = 1;

const ITEM_VOLUME_DISCOUNT_TIERS = [
  { minQty: 2, discountPct: 2 },
  { minQty: 5, discountPct: 4 },
  { minQty: 10, discountPct: 6 },
] as const;

function getItemVolumeDiscountPctServer(quantity: number): number {
  let pct = 0;
  for (const tier of ITEM_VOLUME_DISCOUNT_TIERS) {
    if (quantity >= tier.minQty) {
      pct = tier.discountPct;
    }
  }
  return pct;
}

function applyReceiptVolumeDiscounts(
  items: ReceiptLineItemRecord[],
  excludedPartIds?: Set<string>,
): {
  volumeDiscountAmount: number;
  volumeDiscountLabel?: string;
} {
  let volumeDiscountAmount = 0;
  let qualifyingLinesCount = 0;
  const activePcts = new Set<number>();

  for (const item of items) {
    if (excludedPartIds && excludedPartIds.has(item.partId)) {
      continue;
    }
    const pct =
      item.category !== 'Gearbox Oil'
        ? getItemVolumeDiscountPctServer(item.quantity)
        : 0;
    if (pct > 0) {
      const lineDisc = Math.round((item.lineTotal * pct) / 100);
      item.volumeDiscountPct = pct;
      item.volumeDiscountAmount = lineDisc;
      volumeDiscountAmount += lineDisc;
      qualifyingLinesCount += 1;
      activePcts.add(pct);
    }
  }

  if (volumeDiscountAmount <= 0) {
    return { volumeDiscountAmount: 0 };
  }

  const sortedPcts = Array.from(activePcts).sort((a, b) => a - b);
  const pctText =
    sortedPcts.length === 1
      ? `${sortedPcts[0]}%`
      : `${sortedPcts[0]}%–${sortedPcts[sortedPcts.length - 1]}%`;
  const volumeDiscountLabel =
    qualifyingLinesCount === 1
      ? `Same-Part Volume Discount (${pctText} off)`
      : `Same-Part Volume Discounts (${qualifyingLinesCount} items · ${pctText})`;

  return { volumeDiscountAmount, volumeDiscountLabel };
}

function getPartnerLoyaltyItemsCountServer(partner?: {
  itemsCount?: number;
  ordersCount: number;
} | null): number {
  if (!partner) return 0;
  return typeof partner.itemsCount === 'number' && Number.isFinite(partner.itemsCount)
    ? Math.max(0, Math.floor(partner.itemsCount))
    : Math.max(0, Math.floor(partner.ordersCount || 0));
}

function computePartnerTierPercent(
  loyaltyItemsCount: number,
  customBasePct?: number,
  excludeAutomatedTiers?: boolean,
): number {
  if (excludeAutomatedTiers) {
    return Math.min(
      PARTNER_MAX_DISCOUNT_PCT,
      customBasePct && customBasePct > 0 ? customBasePct : PARTNER_BASE_DISCOUNT_PCT,
    );
  }
  const tierPct =
    loyaltyItemsCount >= PARTNER_TOP_TIER_MIN_ITEMS
      ? PARTNER_REGULAR_6_DISCOUNT_PCT
      : loyaltyItemsCount >= PARTNER_REGULAR_MIN_ITEMS
        ? PARTNER_REGULAR_3_DISCOUNT_PCT
        : PARTNER_BASE_DISCOUNT_PCT;
  return Math.min(PARTNER_MAX_DISCOUNT_PCT, Math.max(tierPct, customBasePct ?? 0));
}

function generatePartnerReferralCode(businessName: string, existingCodes: Set<string>): string {
  const cleanPrefix =
    businessName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4) || 'MSZ';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `${cleanPrefix}-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `MSZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function isPartnerJoinedInProgram(partner?: GaragePartnerRecord | null): boolean {
  return Boolean(partner && partner.status !== 'rejected');
}

function findPartnerForUser(store: StoreData, user?: UserRecord | null): GaragePartnerRecord | undefined {
  if (!user) return undefined;
  const normalizedUserPhone = normalizePhone(user.phone);
  return store.partners.find(
    (p) =>
      p.userId === user.id ||
      normalizePhone(p.phone) === normalizedUserPhone ||
      p.email.toLowerCase() === user.email.toLowerCase(),
  );
}

function resolveUserWishlist(store: StoreData, userId: string): {
  partIds: string[];
  parts: SparePartRecord[];
  cleaned: boolean;
} {
  const rawIds = Array.isArray(store.wishlists[userId]) ? store.wishlists[userId] : [];
  const partsById = new Map(store.parts.map((p) => [p.id, p]));
  const partIds: string[] = [];
  const parts: SparePartRecord[] = [];
  const seen = new Set<string>();

  for (const id of rawIds) {
    if (seen.has(id)) continue;
    const found = partsById.get(id);
    if (found) {
      seen.add(id);
      partIds.push(id);
      parts.push(found);
    }
  }

  const cleaned = partIds.length !== rawIds.length;
  if (cleaned) {
    if (partIds.length > 0) {
      store.wishlists[userId] = partIds;
    } else {
      delete store.wishlists[userId];
    }
  }

  return { partIds, parts, cleaned };
}

function hydrateAuthUser(store: StoreData, user: UserRecord) {
  const isAdminUser = isAuthorizedAdminUser(user);
  const partner = !isAdminUser ? findPartnerForUser(store, user) : undefined;
  const isJoinedPartner = !isAdminUser && isPartnerJoinedInProgram(partner);
  const wishlist = resolveUserWishlist(store, user.id);
  return {
    ...(isAdminUser
      ? user
      : { ...user, role: 'user' as UserRole, isProfessionalMechanicOrGarage: isJoinedPartner }),
    ...(partner
      ? {
          partnerProfile: {
            ...partner,
            isProfessionalMechanicOrGarage: isPartnerJoinedInProgram(partner),
          },
        }
      : {}),
    wishlistPartIds: wishlist.partIds,
  };
}

function calculateOrderDiscount(params: {
  store: StoreData;
  subtotal: number;
  totalUnits: number;
  receiptItems: ReceiptLineItemRecord[];
  authUser: UserRecord | null;
  customerPhone: string;
  referralCodeInput?: string;
  applyReferralCredit?: boolean;
  bargain?: BargainOfferRecord;
  bargainedPartIds?: Set<string>;
  bargainListedSubtotal?: number;
}): {
  partner?: GaragePartnerRecord;
  referralCodeUsed?: string;
  referralPartnerId?: string;
  referralPartnerName?: string;
  referralCreditPercent?: number;
  referralCreditAmount?: number;
  referralCreditApplied?: number;
  discountAmount: number;
  discountLabel?: string;
} {
  const {
    store,
    subtotal,
    totalUnits,
    receiptItems,
    authUser,
    customerPhone,
    referralCodeInput,
    applyReferralCredit,
    bargain,
    bargainedPartIds,
    bargainListedSubtotal = 0,
  } = params;

  let bargainDiscountAmount = 0;
  let bargainDiscountLabel: string | undefined;
  if (bargain) {
    const agreedTotal = Math.max(0, Math.round(bargain.agreedTotal ?? bargain.offeredTotal));
    bargainDiscountAmount = Math.min(subtotal, Math.max(0, bargainListedSubtotal - agreedTotal));
    if (bargainDiscountAmount > 0) {
      bargainDiscountLabel = `Bargain ${bargain.bargainCode}`;
    }
  }

  const eligibleNonBargainSubtotal = Math.max(0, subtotal - bargainListedSubtotal);

  const normalizedCustomerPhone = normalizePhone(customerPhone);
  const activePartner =
    findPartnerForUser(store, authUser) ||
    store.partners.find((p) => normalizePhone(p.phone) === normalizedCustomerPhone);
  const isActivePartner = Boolean(activePartner && activePartner.status === 'active');
  const excludeAutomatedTiers = isPartnerJoinedInProgram(activePartner);

  // Mechanics and garages in the partner program are not eligible for retail same-part tier discounts.
  // Bargained lines are also excluded so agreed bargain totals are never double-discounted.
  const volumeInfo =
    !isActivePartner && !excludeAutomatedTiers
      ? applyReceiptVolumeDiscounts(receiptItems, bargainedPartIds)
      : { volumeDiscountAmount: 0 };
  const volumeDiscountAmount = Math.min(eligibleNonBargainSubtotal, volumeInfo.volumeDiscountAmount);
  const afterBargainAndVolumeSubtotal = Math.max(
    0,
    subtotal - bargainDiscountAmount - volumeDiscountAmount,
  );

  let partnerOrReferralDiscountAmount = 0;
  let partnerOrReferralLabel: string | undefined;
  let partnerRef: GaragePartnerRecord | undefined;
  let referralCodeUsed: string | undefined;
  let referralPartnerId: string | undefined;
  let referralPartnerName: string | undefined;
  let referralCreditPercent: number | undefined;
  let referralCreditAmount: number | undefined;
  let referralCreditApplied = 0;

  if (isActivePartner && activePartner) {
    const basePct = computePartnerTierPercent(
      getPartnerLoyaltyItemsCountServer(activePartner),
      activePartner.discountTierPercent,
      excludeAutomatedTiers,
    );
    const qualifiesBulk =
      totalUnits >= PARTNER_BULK_MIN_QTY && subtotal >= PARTNER_BULK_MIN_SUBTOTAL;
    const bulkPct = qualifiesBulk ? PARTNER_BULK_BONUS_PCT : 0;
    const totalPct = Math.min(PARTNER_MAX_DISCOUNT_PCT, basePct + bulkPct);
    partnerOrReferralDiscountAmount = Math.round((eligibleNonBargainSubtotal * totalPct) / 100);
    const labelParts: string[] = [];
    if (partnerOrReferralDiscountAmount > 0) {
      labelParts.push(
        `${activePartner.partnerType === 'garage' ? 'Garage' : 'Mechanic'} Partner (${basePct}%)`,
      );
      if (bulkPct > 0) {
        labelParts.push(`Bulk Bonus (+${bulkPct}%)`);
      }
    }
    if (applyReferralCredit) {
      const availableCredit = Math.max(0, Math.round(activePartner.referralCreditBalance || 0));
      const remainingPayable = Math.max(
        0,
        subtotal - bargainDiscountAmount - partnerOrReferralDiscountAmount,
      );
      referralCreditApplied = Math.min(availableCredit, remainingPayable);
      if (referralCreditApplied > 0) {
        labelParts.push(`Referral Credit (-KSh ${referralCreditApplied.toLocaleString('en-KE')})`);
      }
    }
    partnerOrReferralLabel = labelParts.length > 0 ? labelParts.join(' + ') : undefined;
    partnerRef = activePartner;
  } else {
    const trimmedCode = (referralCodeInput || '').trim().toUpperCase();
    if (trimmedCode) {
      const referringPartner = store.partners.find(
        (p) => p.status === 'active' && p.referralCode.toUpperCase() === trimmedCode,
      );
      if (
        referringPartner &&
        normalizePhone(referringPartner.phone) !== normalizedCustomerPhone &&
        (!authUser || referringPartner.userId !== authUser.id)
      ) {
        // Customer gets 0% referral discount; referring mechanic earns 1% credit after fitting & testing.
        referralCodeUsed = referringPartner.referralCode;
        referralPartnerId = referringPartner.id;
        referralPartnerName = referringPartner.businessName;
        referralCreditPercent = REFERRAL_MECHANIC_CREDIT_PCT;
        referralCreditAmount = Math.round(
          (afterBargainAndVolumeSubtotal * REFERRAL_MECHANIC_CREDIT_PCT) / 100,
        );
      }
    }
  }

  const discountAmount = Math.min(
    subtotal,
    bargainDiscountAmount +
      volumeDiscountAmount +
      partnerOrReferralDiscountAmount +
      referralCreditApplied,
  );
  const labelParts = [bargainDiscountLabel, volumeInfo.volumeDiscountLabel, partnerOrReferralLabel].filter(
    (s): s is string => Boolean(s),
  );

  return {
    ...(partnerRef ? { partner: partnerRef } : {}),
    ...(referralCodeUsed
      ? {
          referralCodeUsed,
          referralPartnerId,
          referralPartnerName,
          referralCreditPercent,
          referralCreditAmount,
        }
      : {}),
    ...(referralCreditApplied > 0 ? { referralCreditApplied } : {}),
    discountAmount,
    ...(labelParts.length > 0 ? { discountLabel: labelParts.join(' + ') } : {}),
  };
}

interface ChatSocketMeta {
  role: 'admin' | 'customer';
  sessionId: string;
  userId?: string;
  userPhone?: string;
  userEmail?: string;
}

function buildThreadSummaries(messages: ChatMessageRecord[]) {
  const threadMap = new Map<
    string,
    {
      sessionId: string;
      customerName: string;
      lastMessage: string;
      lastSender: 'customer' | 'support';
      updatedAt: string;
      messageCount: number;
    }
  >();

  for (const msg of messages) {
    const existing = threadMap.get(msg.sessionId);
    if (!existing) {
      threadMap.set(msg.sessionId, {
        sessionId: msg.sessionId,
        customerName: msg.customerName,
        lastMessage: msg.text,
        lastSender: msg.sender,
        updatedAt: msg.createdAt,
        messageCount: 1,
      });
    } else {
      existing.lastMessage = msg.text;
      existing.lastSender = msg.sender;
      existing.updatedAt = msg.createdAt;
      existing.messageCount += 1;
      if (msg.sender === 'customer' && msg.customerName) {
        existing.customerName = msg.customerName;
      }
    }
  }

  return Array.from(threadMap.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

async function startServer() {
    await loadStoreFromDb();
  ensureStorageDirs();
  readStore();

  const app = express();
  const httpServer = http.createServer(app);
  const chatWss = new WebSocketServer({ noServer: true });
  const chatClients = new Map<WebSocket, ChatSocketMeta>();

  const resolveSocketMeta = (
    sessionId: string,
    token?: string,
  ): ChatSocketMeta => {
    if (!token) {
      return { role: 'customer', sessionId };
    }
    const store = readStore();
    const session = store.sessions.find((s) => s.token === token);
    if (!session) {
      return { role: 'customer', sessionId };
    }
    const user = store.users.find((u) => u.id === session.userId);
    if (!user) {
      return { role: 'customer', sessionId };
    }
    const role: 'admin' | 'customer' =
      isAuthorizedAdminUser(user) && Boolean(session.adminVerified) ? 'admin' : 'customer';
    return {
      role,
      sessionId,
      userId: user.id,
      userPhone: normalizePhone(user.phone),
      userEmail: user.email.toLowerCase(),
    };
  };

  chatWss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws/chat', 'http://localhost');
    const initialSessionId = url.searchParams.get('sessionId')?.trim() || '';
    const initialToken = url.searchParams.get('token')?.trim() || '';
    chatClients.set(ws, resolveSocketMeta(initialSessionId, initialToken));

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as {
          type?: string;
          sessionId?: string;
          token?: string;
        };
        if (parsed.type === 'subscribe') {
          const nextToken = typeof parsed.token === 'string' ? parsed.token.trim() : '';
          const nextSessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId.trim() : '';
          chatClients.set(ws, resolveSocketMeta(nextSessionId, nextToken));
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      chatClients.delete(ws);
    });
  });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/chat') {
        return;
      }
      chatWss.handleUpgrade(req, socket, head, (ws) => {
        chatWss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  const broadcastChatMessage = (
    message: ChatMessageRecord,
    threadSummary?: ReturnType<typeof buildThreadSummaries>[number],
  ) => {
    const payload = JSON.stringify({
      type: 'chat:message',
      message,
      threadSummary,
    });
    for (const [client, meta] of chatClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (meta.role === 'admin' || (meta.sessionId && meta.sessionId === message.sessionId)) {
        client.send(payload);
      }
    }
  };

  const broadcastBargainUpdate = (bargain: BargainOfferRecord) => {
    const payload = JSON.stringify({
      type: 'bargain:update',
      bargain,
    });
    for (const [client, meta] of chatClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (meta.role === 'admin' || (meta.sessionId && meta.sessionId === bargain.sessionId)) {
        client.send(payload);
      }
    }
  };

  const broadcastOrderUpdate = (receipt: VirtualReceiptRecord) => {
    const payload = JSON.stringify({
      type: 'order:update',
      receipt,
    });
    const orderPhone = normalizePhone(receipt.customerPhone);
    const orderEmail = receipt.customerEmail ? receipt.customerEmail.toLowerCase() : '';
    for (const [client, meta] of chatClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      const isOwner =
        Boolean(receipt.userId && meta.userId && meta.userId === receipt.userId) ||
        Boolean(orderPhone && meta.userPhone && meta.userPhone === orderPhone) ||
        Boolean(orderEmail && meta.userEmail && meta.userEmail === orderEmail);
      if (meta.role === 'admin' || isOwner) {
        client.send(payload);
      }
    }
  };

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/src/assets/images', express.static(IMAGES_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', shopName: SHOP_NAME, customerCare: CUSTOMER_CARE_NUMBER });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    const reqSessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();

    if (!rawName || rawName.length < 2) {
      res.status(400).json({
        error: 'Please enter your full name (at least 2 characters) so it appears in Customer Care chats and receipts.',
      });
      return;
    }
    if (!rawPhone || !isValidPhone(rawPhone)) {
      res.status(400).json({ error: 'Please enter a valid mobile number (e.g. +254706130014 or 0712345678).' });
      return;
    }
    if (!rawEmail || !isValidEmail(rawEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const phone = normalizePhone(rawPhone);
    const matchesStrictAdmin = isStrictAdminIdentity(phone, rawEmail, rawName);

    if (
      !matchesStrictAdmin &&
      (phone === ADMIN_PHONE ||
        rawEmail === ADMIN_EMAIL ||
        rawEmail === 'admin@mysparezone.co.ke')
    ) {
      res.status(403).json({
        error:
          'Invalid administrator credentials. Only the registered administrator phone number (0706130014), email, and full name may access the admin account.',
      });
      return;
    }

    const role: UserRole = matchesStrictAdmin ? 'admin' : 'user';
    const store = readStore();
    let user = matchesStrictAdmin
      ? store.users.find((u) => isStrictAdminIdentity(u.phone, u.email, u.name))
      : store.users.find(
          (u) =>
            normalizePhone(u.phone) === phone &&
            u.email.toLowerCase() === rawEmail &&
            !isAuthorizedAdminUser(u),
        );

    if (!user) {
      const defaultName =
        role === 'admin'
          ? ADMIN_NAME
          : rawName || rawEmail.split('@')[0] || 'Customer';
      user = {
        id: role === 'admin' ? 'usr-admin-01' : `usr-${crypto.randomBytes(4).toString('hex')}`,
        name: role === 'admin' ? ADMIN_NAME : rawName || defaultName,
        phone,
        email: rawEmail,
        role,
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
    } else {
      user.role = role;
      if (role === 'admin') {
        user.name = ADMIN_NAME;
        user.phone = ADMIN_PHONE;
        user.email = ADMIN_EMAIL;
      } else if (rawName) {
        user.name = rawName;
      }
    }

    const token = crypto.randomBytes(24).toString('hex');
    const requiresAdminPassword = role === 'admin';
    store.sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
      adminVerified: !requiresAdminPassword,
      adminPasswordAttempts: 0,
    });
    if (store.sessions.length > 200) {
      store.sessions = store.sessions.slice(-200);
    }

    if (role !== 'admin' && reqSessionId) {
      for (const msg of store.messages) {
        if (msg.sessionId === reqSessionId && msg.sender === 'customer') {
          msg.customerName = user.name;
        }
      }
    }

    writeStore(store);
    res.json({
      token,
      user: hydrateAuthUser(store, user),
      requiresAdminPassword,
      adminVerified: !requiresAdminPassword,
    });
  });

  app.post('/api/auth/verify-admin-password', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Session expired. Please sign in again.', loggedOut: true });
      return;
    }
    if (!isAuthorizedAdminUser(auth.user)) {
      res.status(403).json({ error: 'Admin account required.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const candidate = typeof body.password === 'string' ? body.password : '';
    if (!candidate) {
      res.status(400).json({
        error: 'Please enter the admin password.',
        loggedOut: false,
        attemptsRemaining: Math.max(0, 2 - (auth.session.adminPasswordAttempts || 0)),
      });
      return;
    }

    if (verifyAdminPasswordValue(candidate)) {
      auth.session.adminVerified = true;
      auth.session.adminPasswordAttempts = 0;
      writeStore(store);
      res.json({ verified: true, user: auth.user });
      return;
    }

    const nextAttempts = (auth.session.adminPasswordAttempts || 0) + 1;
    if (nextAttempts >= 2) {
      store.sessions = store.sessions.filter((s) => s.token !== auth.token);
      writeStore(store);
      res.status(401).json({
        error: 'Incorrect password entered twice. You have been logged out immediately.',
        loggedOut: true,
        attemptsRemaining: 0,
      });
      return;
    }

    auth.session.adminVerified = false;
    auth.session.adminPasswordAttempts = nextAttempts;
    writeStore(store);
    res.status(401).json({
      error: 'Incorrect admin password. 1 attempt remaining before immediate logout.',
      loggedOut: false,
      attemptsRemaining: 2 - nextAttempts,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const isAdminUser = isAuthorizedAdminUser(auth.user);
    res.json({
      user: hydrateAuthUser(store, auth.user),
      adminVerified: !isAdminUser || Boolean(auth.session.adminVerified),
      adminPasswordAttempts: auth.session.adminPasswordAttempts || 0,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const store = readStore();
      store.sessions = store.sessions.filter((s) => s.token !== token);
      writeStore(store);
    }
    res.json({ loggedOut: true });
  });

  app.patch('/api/auth/vehicle', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Sign in to save your vehicle to your account.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const rawBrand = typeof body.savedCarBrand === 'string' ? body.savedCarBrand.trim() : '';
    const savedCarModel =
      typeof body.savedCarModel === 'string' ? body.savedCarModel.trim().slice(0, 60) : '';
    const savedCarYear =
      typeof body.savedCarYear === 'string' ? body.savedCarYear.trim().slice(0, 20) : '';

    if (rawBrand && rawBrand !== 'All') {
      auth.user.savedCarBrand = normalizeCarBrand(rawBrand, 'Toyota');
    } else {
      delete auth.user.savedCarBrand;
    }
    if (savedCarModel) {
      auth.user.savedCarModel = savedCarModel;
    } else {
      delete auth.user.savedCarModel;
    }
    if (savedCarYear) {
      auth.user.savedCarYear = savedCarYear;
    } else {
      delete auth.user.savedCarYear;
    }

    writeStore(store);
    res.json({ user: hydrateAuthUser(store, auth.user) });
  });

  // --- Registered User Wishlist ---
  app.get('/api/wishlist', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({
        error: 'Please sign in with a registered account to view your wishlist.',
      });
      return;
    }
    const resolved = resolveUserWishlist(store, auth.user.id);
    if (resolved.cleaned) {
      writeStore(store);
    }
    res.json({ partIds: resolved.partIds, parts: resolved.parts });
  });

  app.post('/api/wishlist/toggle', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({
        error: 'Please sign in with a registered account to save parts to your wishlist.',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const partId = typeof body.partId === 'string' ? body.partId.trim() : '';
    if (!partId) {
      res.status(400).json({ error: 'partId is required.' });
      return;
    }

    const part = store.parts.find((p) => p.id === partId);
    if (!part) {
      res.status(404).json({ error: 'Spare part not found.' });
      return;
    }

    const currentIds = resolveUserWishlist(store, auth.user.id).partIds;
    const exists = currentIds.includes(partId);
    const nextIds = exists
      ? currentIds.filter((id) => id !== partId)
      : [partId, ...currentIds];

    if (nextIds.length > 0) {
      store.wishlists[auth.user.id] = nextIds;
    } else {
      delete store.wishlists[auth.user.id];
    }
    writeStore(store);

    const resolved = resolveUserWishlist(store, auth.user.id);
    res.json({
      saved: !exists,
      partId,
      partIds: resolved.partIds,
      parts: resolved.parts,
    });
  });

  app.delete('/api/wishlist/:partId', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Please sign in with a registered account.' });
      return;
    }
    const { partId } = req.params;
    const currentIds = resolveUserWishlist(store, auth.user.id).partIds;
    const nextIds = currentIds.filter((id) => id !== partId);
    if (nextIds.length > 0) {
      store.wishlists[auth.user.id] = nextIds;
    } else {
      delete store.wishlists[auth.user.id];
    }
    writeStore(store);

    const resolved = resolveUserWishlist(store, auth.user.id);
    res.json({
      saved: false,
      partId,
      partIds: resolved.partIds,
      parts: resolved.parts,
    });
  });

  app.delete('/api/wishlist', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Please sign in with a registered account.' });
      return;
    }
    delete store.wishlists[auth.user.id];
    writeStore(store);
    res.json({ partIds: [], parts: [] });
  });

  // --- Customer & Mechanic Reviews (Admin-deletable profanity protection) ---
  app.get('/api/reviews', (_req, res) => {
    const store = readStore();
    const sorted = [...store.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const totalCount = sorted.length;
    const averageRating =
      totalCount > 0
        ? Number((sorted.reduce((sum, r) => sum + r.rating, 0) / totalCount).toFixed(1))
        : 5;
    res.json({ reviews: sorted, averageRating, totalCount });
  });

  app.post('/api/reviews', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const authorName = typeof body.authorName === 'string' ? body.authorName.trim() : '';
    const authorType: ReviewAuthorType =
      body.authorType === 'garage'
        ? 'garage'
        : body.authorType === 'mechanic'
          ? 'mechanic'
          : 'customer';
    const garageOrVehicle =
      typeof body.garageOrVehicle === 'string' ? body.garageOrVehicle.trim() : '';
    const ratingRaw = Number(body.rating);
    const rating = Number.isFinite(ratingRaw) ? Math.min(5, Math.max(1, Math.round(ratingRaw))) : 5;
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (authorName.length < 2 || authorName.length > 60) {
      res.status(400).json({ error: 'Please enter your name (2–60 characters).' });
      return;
    }
    if (comment.length < 8 || comment.length > 500) {
      res.status(400).json({ error: 'Review must be between 8 and 500 characters.' });
      return;
    }
    if (
      containsInsultingLanguage(authorName) ||
      containsInsultingLanguage(garageOrVehicle) ||
      containsInsultingLanguage(comment)
    ) {
      res.status(400).json({
        error:
          'Please keep reviews respectful. Insulting or abusive words are not allowed.',
      });
      return;
    }

    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const review: CustomerReviewRecord = {
      id: `rev-${crypto.randomBytes(4).toString('hex')}`,
      authorName,
      authorType,
      ...(garageOrVehicle ? { garageOrVehicle } : {}),
      rating,
      comment,
      verifiedPurchase: Boolean(authUser),
      createdAt: new Date().toISOString(),
    };

    store.reviews.unshift(review);
    writeStore(store);
    res.status(201).json({ review });
  });

  app.delete('/api/reviews/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const nextReviews = store.reviews.filter((r) => r.id !== id);
    if (nextReviews.length === store.reviews.length) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    store.reviews = nextReviews;
    writeStore(store);
    res.json({ deleted: true, id });
  });

  // --- Garage / Mechanic Partner Accounts (Pending Approval + Proof Verification + Automated SMS) ---
  app.post('/api/partners/register', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const partnerType: GaragePartnerType = body.partnerType === 'garage' ? 'garage' : 'mechanic';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : '';
    const proofDataUrl = typeof body.proofDataUrl === 'string' ? body.proofDataUrl.trim() : '';
    const proofType = typeof body.proofType === 'string' ? body.proofType.trim() : '';
    const proofFileName = typeof body.proofFileName === 'string' ? body.proofFileName.trim().slice(0, 140) : '';

    if (!businessName || businessName.length < 2) {
      res.status(400).json({ error: 'Garage or mechanic workshop name is required.' });
      return;
    }
    if (!contactName || contactName.length < 2) {
      res.status(400).json({ error: 'Contact person full name is required.' });
      return;
    }
    if (!rawPhone || !isValidPhone(rawPhone)) {
      res.status(400).json({ error: 'Please enter a valid Kenyan mobile number.' });
      return;
    }
    if (!rawEmail || !isValidEmail(rawEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!location) {
      res.status(400).json({ error: 'Please enter your garage/service area location.' });
      return;
    }

    const phone = normalizePhone(rawPhone);
    if (phone === ADMIN_PHONE || rawEmail === ADMIN_EMAIL) {
      res.status(403).json({
        error: 'The registered shop administrator account cannot be converted into a partner account.',
      });
      return;
    }

    const store = readStore();
    let user = store.users.find(
      (u) =>
        !isAuthorizedAdminUser(u) &&
        (normalizePhone(u.phone) === phone || u.email.toLowerCase() === rawEmail),
    );

    const existingPartner = user ? findPartnerForUser(store, user) : undefined;
    const requiresProofUpload = !existingPartner || existingPartner.status === 'rejected' || !existingPartner.proofUrl;

    let savedProof: { url: string; mimeType: string } | null = null;
    if (proofDataUrl) {
      if (!proofType) {
        res.status(400).json({ error: 'Please select the type of mechanic/garage proof document.' });
        return;
      }
      const result = savePartnerProofFile(proofDataUrl);
      if ('error' in result) {
        res.status(400).json({ error: result.error });
        return;
      }
      savedProof = result;
    } else if (requiresProofUpload) {
      res.status(400).json({
        error: 'Please upload a photo or PDF document proving you operate as a mechanic or garage (e.g. workshop photo, NITA certificate, or business permit).',
      });
      return;
    }

    const nowIso = new Date().toISOString();

    if (!user) {
      user = {
        id: `usr-${crypto.randomBytes(4).toString('hex')}`,
        name: contactName,
        phone,
        email: rawEmail,
        role: 'user',
        isProfessionalMechanicOrGarage: true,
        createdAt: nowIso,
      };
      store.users.push(user);
    } else {
      user.name = contactName;
      user.phone = phone;
      user.email = rawEmail;
      user.isProfessionalMechanicOrGarage = true;
    }

    let partner = existingPartner;
    if (!partner) {
      const existingCodes = new Set(store.partners.map((p) => p.referralCode.toUpperCase()));
      partner = {
        id: `ptr-${crypto.randomBytes(4).toString('hex')}`,
        userId: user.id,
        businessName,
        contactName,
        phone,
        email: rawEmail,
        partnerType,
        location,
        ...(specialty ? { specialty } : {}),
        referralCode: generatePartnerReferralCode(businessName, existingCodes),
        status: 'pending',
        discountTierPercent: PARTNER_BASE_DISCOUNT_PCT,
        ordersCount: 0,
        itemsCount: 0,
        referralsCount: 0,
        referredRevenue: 0,
        referralCreditPending: 0,
        referralCreditBalance: 0,
        totalSpent: 0,
        isProfessionalMechanicOrGarage: true,
        ...(savedProof
          ? {
              proofUrl: savedProof.url,
              proofMimeType: savedProof.mimeType,
              proofType: proofType || 'Workshop / Garage Proof',
              ...(proofFileName ? { proofFileName } : {}),
            }
          : {}),
        createdAt: nowIso,
      };
      store.partners.unshift(partner);
    } else {
      partner.businessName = businessName;
      partner.contactName = contactName;
      partner.phone = phone;
      partner.email = rawEmail;
      partner.partnerType = partnerType;
      partner.location = location;
      if (specialty) partner.specialty = specialty;
      else delete partner.specialty;

      if (savedProof) {
        partner.proofUrl = savedProof.url;
        partner.proofMimeType = savedProof.mimeType;
        partner.proofType = proofType || partner.proofType || 'Workshop / Garage Proof';
        if (proofFileName) partner.proofFileName = proofFileName;
        else delete partner.proofFileName;
      }

      if (partner.status === 'rejected') {
        partner.status = 'pending';
        delete partner.rejectionReason;
        delete partner.reviewedAt;
      }
      partner.isProfessionalMechanicOrGarage = isPartnerJoinedInProgram(partner);
      user.isProfessionalMechanicOrGarage = partner.isProfessionalMechanicOrGarage;
    }

    const token = crypto.randomBytes(24).toString('hex');
    store.sessions.push({
      token,
      userId: user.id,
      createdAt: nowIso,
      adminVerified: true,
      adminPasswordAttempts: 0,
    });
    if (store.sessions.length > 200) {
      store.sessions = store.sessions.slice(-200);
    }

    writeStore(store);
    res.status(201).json({
      token,
      user: hydrateAuthUser(store, user),
      partner,
    });
  });

  app.get('/api/partners/me', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Sign in to view your partner account.' });
      return;
    }
    const partner = findPartnerForUser(store, auth.user);
    if (!partner) {
      res.status(404).json({ error: 'No Garage/Mechanic partner profile found for this account.' });
      return;
    }
    res.json({ partner });
  });

  app.get('/api/partners/me/referrals', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Sign in to view referral credits.' });
      return;
    }
    const partner = findPartnerForUser(store, auth.user);
    if (!partner) {
      res.status(404).json({ error: 'No Garage/Mechanic partner profile found for this account.' });
      return;
    }
    const referrals = store.orders
      .filter(
        (o) =>
          o.referralPartnerId === partner.id ||
          (o.referralCodeUsed &&
            o.referralCodeUsed.toUpperCase() === partner.referralCode.toUpperCase()),
      )
      .map((o) => ({
        id: o.id,
        receiptNumber: o.receiptNumber,
        issuedAt: o.issuedAt,
        orderStatus: o.status || 'Pending',
        customerName: o.customerName,
        itemsSummary: o.items.map((it) => `${it.quantity}× ${it.name}`).join(', '),
        itemsCount: o.items.reduce((sum, it) => sum + (it.quantity || 0), 0),
        total: o.total,
        referralCreditPercent: o.referralCreditPercent ?? REFERRAL_MECHANIC_CREDIT_PCT,
        referralCreditAmount:
          o.referralCreditAmount ?? Math.round((o.total * REFERRAL_MECHANIC_CREDIT_PCT) / 100),
        referralCreditStatus: o.referralCreditStatus === 'credited' ? 'credited' : 'pending_fitting',
        ...(o.referralFittedTestedAt ? { referralFittedTestedAt: o.referralFittedTestedAt } : {}),
      }));
    res.json({ partner, referrals });
  });

  app.get('/api/partners/validate-referral', (req, res) => {
    const rawCode = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!rawCode) {
      res.status(400).json({ valid: false, error: 'Enter a referral code to validate.' });
      return;
    }
    const store = readStore();
    const partner = store.partners.find(
      (p) => p.status === 'active' && p.referralCode.toUpperCase() === rawCode,
    );
    if (!partner) {
      res.status(404).json({ valid: false, error: 'Referral code not found or inactive.' });
      return;
    }
    res.json({
      valid: true,
      code: partner.referralCode,
      creditPercent: REFERRAL_MECHANIC_CREDIT_PCT,
      discountPercent: 0,
      customerDiscountPercent: 0,
      partnerName: partner.businessName,
      partnerType: partner.partnerType,
    });
  });

  app.get('/api/admin/partners', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;
    res.json({ partners: store.partners });
  });

  app.patch('/api/admin/partners/:id', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;
    const { id } = req.params;
    const partner = store.partners.find((p) => p.id === id);
    if (!partner) {
      res.status(404).json({ error: 'Partner account not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const previousStatus = partner.status;
    const nowIso = new Date().toISOString();

    if (
      body.status === 'pending' ||
      body.status === 'active' ||
      body.status === 'paused' ||
      body.status === 'rejected'
    ) {
      partner.status = body.status;
      if (body.status === 'active') {
        partner.reviewedAt = nowIso;
        delete partner.rejectionReason;
      } else if (body.status === 'rejected') {
        partner.reviewedAt = nowIso;
        const reason =
          typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 300) : '';
        if (reason) {
          partner.rejectionReason = reason;
        } else {
          partner.rejectionReason =
            'Submitted verification proof could not be verified. Please upload a clearer garage photo, NITA certificate, or business permit.';
        }
      }
    }

    const joinedFlag = isPartnerJoinedInProgram(partner);
    partner.isProfessionalMechanicOrGarage = joinedFlag;
    const linkedUser = store.users.find(
      (u) =>
        !isAuthorizedAdminUser(u) &&
        (u.id === partner.userId ||
          normalizePhone(u.phone) === normalizePhone(partner.phone) ||
          u.email.toLowerCase() === partner.email.toLowerCase()),
    );
    if (linkedUser) {
      linkedUser.isProfessionalMechanicOrGarage = joinedFlag;
    }

    if (body.discountTierPercent !== undefined) {
      const nextPct = Number(body.discountTierPercent);
      if (Number.isFinite(nextPct) && nextPct >= 0 && nextPct <= PARTNER_MAX_DISCOUNT_PCT) {
        partner.discountTierPercent = Math.round(nextPct);
      }
    }

    let smsNotification: SmsNotificationRecord | null = null;
    if (
      (previousStatus === 'pending' || previousStatus === 'rejected') &&
      partner.status === 'active'
    ) {
      smsNotification = await appendPartnerApprovalSmsNotification(
        store,
        partner,
        adminUser.name,
      );
    }

    writeStore(store);
    res.json({ partner, ...(smsNotification ? { smsNotification } : {}) });
  });

  app.get('/api/parts', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    const isVerifiedAdmin = Boolean(
      auth && isAuthorizedAdminUser(auth.user) && auth.session.adminVerified,
    );
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const subcategory =
      typeof req.query.subcategory === 'string' ? req.query.subcategory.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const carModel = typeof req.query.carModel === 'string' ? req.query.carModel.trim().toLowerCase() : '';
    const yearOfMake = typeof req.query.yearOfMake === 'string' ? req.query.yearOfMake.trim().toLowerCase() : '';
    const offersOnly = req.query.offers === 'true' || req.query.offers === '1';

    const filtered = store.parts
      .filter((part) => {
        if (
          offersOnly &&
          !(part.isOffer && typeof part.previousPrice === 'number' && part.previousPrice > part.price)
        ) {
          return false;
        }
        if (category && category !== 'All' && part.category !== category) {
          return false;
        }
        if (subcategory && subcategory !== 'All' && part.subcategory !== subcategory) {
          return false;
        }
        if (brand && brand !== 'All') {
          const partBrand = part.brand || 'Universal';
          const isCompatibleOil = part.category === 'Gearbox Oil' && partBrand === 'Universal';
          if (partBrand !== brand && !isCompatibleOil) {
            return false;
          }
        }
        if (carModel) {
          const modelText = `${part.name} ${part.description} ${part.carModel || ''}`.toLowerCase();
          if (!modelText.includes(carModel)) {
            return false;
          }
        }
        if (yearOfMake) {
          const yearText = `${part.yearOfMake || ''} ${part.name} ${part.description}`.toLowerCase();
          if (!yearText.includes(yearOfMake)) {
            return false;
          }
        }
        if (q) {
          const haystack =
            `${part.name} ${part.description} ${part.category} ${part.subcategory} ${part.brand || ''} ${part.carModel || ''} ${part.yearOfMake || ''} ${part.conditionGrade ? `grade ${part.conditionGrade}` : ''} ${part.gearboxOilType || ''} ${part.sku}`.toLowerCase();
          if (!haystack.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .map((part) => serializePartForClient(part, isVerifiedAdmin));

    res.json({ parts: filtered });
  });

  app.post('/api/search-logs', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const rawQuery = typeof body.query === 'string' ? body.query.trim().replace(/\s+/g, ' ') : '';
    if (rawQuery.length < 2 || rawQuery.length > 80) {
      res.status(400).json({ error: 'Search term must be between 2 and 80 characters.' });
      return;
    }

    const normalizedTerm = rawQuery.toLowerCase();
    const store = readStore();
    const now = new Date().toISOString();
    const existing = store.searchLogs.find((entry) => entry.normalizedTerm === normalizedTerm);

    if (existing) {
      existing.term = rawQuery;
      existing.count += 1;
      existing.lastSearchedAt = now;
    } else {
      store.searchLogs.push({
        term: rawQuery,
        normalizedTerm,
        count: 1,
        lastSearchedAt: now,
      });
    }

    writeStore(store);
    res.status(201).json({ logged: true });
  });

  app.get('/api/admin/search-logs', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const logs = [...store.searchLogs]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastSearchedAt.localeCompare(a.lastSearchedAt);
      })
      .map((entry) => {
        const matchingParts = store.parts.filter((part) => {
          const haystack =
            `${part.name} ${part.description} ${part.category} ${part.subcategory} ${part.brand || ''} ${part.gearboxOilType || ''} ${part.sku}`.toLowerCase();
          return haystack.includes(entry.normalizedTerm);
        });
        const inStockCount = matchingParts.filter((part) => part.stock > 0).length;
        return {
          term: entry.term,
          normalizedTerm: entry.normalizedTerm,
          count: entry.count,
          matchingPartsCount: matchingParts.length,
          inStockCount,
          lastSearchedAt: entry.lastSearchedAt,
        };
      });

    res.json({ logs });
  });

  app.delete('/api/admin/search-logs', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;
    store.searchLogs = [];
    writeStore(store);
    res.json({ cleared: true });
  });

  app.delete('/api/admin/search-logs/:term', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;
    const normalized = decodeURIComponent(req.params.term || '').trim().toLowerCase();
    store.searchLogs = store.searchLogs.filter((entry) => entry.normalizedTerm !== normalized);
    writeStore(store);
    res.json({ removed: true });
  });

  app.post('/api/parts', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const price = Number(body.price);
    const category = body.category;
    const rawSubcategory = typeof body.subcategory === 'string' ? body.subcategory.trim() : '';
    const skuInput = typeof body.sku === 'string' ? body.sku.trim() : '';
    const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.floor(Number(body.stock))) : 10;
    const isOfferRequested = Boolean(body.isOffer);
    const rawPreviousPrice =
      body.previousPrice !== undefined && body.previousPrice !== null && body.previousPrice !== ''
        ? Number(body.previousPrice)
        : NaN;
    const rawFloorPrice =
      body.floorPrice !== undefined && body.floorPrice !== null && body.floorPrice !== ''
        ? Number(body.floorPrice)
        : NaN;

    if (!name) {
      res.status(400).json({ error: 'Item name is required.' });
      return;
    }
    if (!description) {
      res.status(400).json({ error: 'Short description is required.' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({
        error: isOfferRequested
          ? 'Valid offer price greater than zero is required.'
          : 'Valid item price greater than zero is required.',
      });
      return;
    }

    const roundedPrice = Math.round(price);
    let resolvedFloorPrice: number | undefined;
    if (body.floorPrice !== undefined && body.floorPrice !== null && body.floorPrice !== '') {
      if (!Number.isFinite(rawFloorPrice) || rawFloorPrice <= 0) {
        res.status(400).json({ error: 'Floor price must be a positive amount greater than zero.' });
        return;
      }
      if (Math.round(rawFloorPrice) > roundedPrice) {
        res.status(400).json({ error: 'Floor price cannot exceed the listed selling price.' });
        return;
      }
      resolvedFloorPrice = Math.round(rawFloorPrice);
    }

    let resolvedOffer: { isOffer: true; previousPrice: number } | null = null;
    if (isOfferRequested) {
      if (!Number.isFinite(rawPreviousPrice) || rawPreviousPrice <= 0) {
        res.status(400).json({
          error: 'Please enter a valid previous price greater than zero when posting in offers.',
        });
        return;
      }
      const roundedPreviousPrice = Math.round(rawPreviousPrice);
      if (roundedPreviousPrice <= roundedPrice) {
        res.status(400).json({
          error: 'Offer price must be lower than the previous price.',
        });
        return;
      }
      resolvedOffer = { isOffer: true, previousPrice: roundedPreviousPrice };
    }
    if (!isPrimaryCategory(category)) {
      res.status(400).json({
        error:
          'Primary category must be Body parts, Electricals, Mechanical Parts, Gearbox Oil, or Dashboard & Interior Parts.',
      });
      return;
    }

    const allowedSubs = CATEGORY_MAP[category];
    const subcategory = allowedSubs.includes(rawSubcategory) ? rawSubcategory : allowedSubs[0];
    const brand = normalizeCarBrand(body.brand, category === 'Gearbox Oil' ? 'Universal' : 'Toyota');
    const carModel = typeof body.carModel === 'string' ? body.carModel.trim().slice(0, 60) : '';
    const yearOfMake = typeof body.yearOfMake === 'string' ? body.yearOfMake.trim().slice(0, 24) : '';
    const rawGrade =
      typeof body.conditionGrade === 'string' ? body.conditionGrade.trim().toUpperCase() : '';
    let resolvedConditionGrade: BodyPartConditionGrade | undefined;
    if (category === 'Body parts' && rawGrade) {
      if (rawGrade !== 'A' && rawGrade !== 'B' && rawGrade !== 'C') {
        res.status(400).json({ error: 'Body part condition grade must be A, B, or C.' });
        return;
      }
      resolvedConditionGrade = rawGrade;
    }
    const gearboxOilType =
      typeof body.gearboxOilType === 'string' ? body.gearboxOilType.trim() : '';
    const isGearboxItem =
      category !== 'Gearbox Oil' &&
      (subcategory === 'Gearboxes' || /\bgearbox(?:es)?\b/i.test(name));

    if (isGearboxItem && !gearboxOilType) {
      res.status(400).json({
        error: 'Please enter the type of gearbox oil this gearbox uses.',
      });
      return;
    }

    const imagesResult = resolveSubmittedPartImages(body);
    if ('error' in imagesResult) {
      res.status(400).json({ error: imagesResult.error });
      return;
    }
    if (imagesResult.imageUrls.length === 0) {
      res.status(400).json({ error: 'Please upload at least 1 cover image for the spare part (up to 3 allowed).' });
      return;
    }

    const newPart: SparePartRecord = {
      id: `part-${crypto.randomBytes(4).toString('hex')}`,
      name,
      description,
      price: roundedPrice,
      ...(resolvedOffer ? resolvedOffer : {}),
      ...(resolvedFloorPrice !== undefined ? { floorPrice: resolvedFloorPrice } : {}),
      category,
      subcategory,
      brand,
      ...(carModel ? { carModel } : {}),
      ...(yearOfMake ? { yearOfMake } : {}),
      ...(resolvedConditionGrade ? { conditionGrade: resolvedConditionGrade } : {}),
      ...(isGearboxItem && gearboxOilType ? { gearboxOilType } : {}),
      sku: skuInput || `MSZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      stock,
      imageUrl: imagesResult.imageUrls[0],
      imageUrls: imagesResult.imageUrls,
      createdAt: new Date().toISOString(),
    };

    store.parts.unshift(newPart);
    writeStore(store);

    res.status(201).json({ part: serializePartForClient(newPart, true) });
  });

  app.put('/api/parts/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const index = store.parts.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Spare part not found.' });
      return;
    }

    const existing = store.parts[index];
    const nextName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
    const nextDescription =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : existing.description;
    const nextPrice =
      body.price !== undefined && Number.isFinite(Number(body.price)) && Number(body.price) > 0
        ? Math.round(Number(body.price))
        : existing.price;

    let nextFloorPrice: number | undefined = existing.floorPrice;
    if (body.floorPrice !== undefined) {
      if (body.floorPrice === null || body.floorPrice === '') {
        nextFloorPrice = undefined;
      } else {
        const parsedFloor = Number(body.floorPrice);
        if (!Number.isFinite(parsedFloor) || parsedFloor <= 0) {
          res.status(400).json({ error: 'Floor price must be a positive amount greater than zero.' });
          return;
        }
        if (Math.round(parsedFloor) > nextPrice) {
          res.status(400).json({ error: 'Floor price cannot exceed the listed selling price.' });
          return;
        }
        nextFloorPrice = Math.round(parsedFloor);
      }
    }

    const nextCategory = isPrimaryCategory(body.category) ? body.category : existing.category;
    const allowedSubs = CATEGORY_MAP[nextCategory];
    const nextSubcategory =
      typeof body.subcategory === 'string' && allowedSubs.includes(body.subcategory.trim())
        ? body.subcategory.trim()
        : allowedSubs.includes(existing.subcategory)
          ? existing.subcategory
          : allowedSubs[0];
    const isRelist = body.relist === true;
    const nextStock =
      body.stock !== undefined && Number.isFinite(Number(body.stock))
        ? Math.max(0, Math.floor(Number(body.stock)))
        : isRelist && existing.stock <= 0
          ? 1
          : existing.stock;
    const nextBrand =
      body.brand !== undefined
        ? normalizeCarBrand(body.brand, existing.brand || 'Universal')
        : existing.brand || 'Universal';
    const nextCarModel =
      body.carModel !== undefined
        ? typeof body.carModel === 'string'
          ? body.carModel.trim().slice(0, 60)
          : ''
        : existing.carModel || '';
    const nextYearOfMake =
      body.yearOfMake !== undefined
        ? typeof body.yearOfMake === 'string'
          ? body.yearOfMake.trim().slice(0, 24)
          : ''
        : existing.yearOfMake || '';
    let nextConditionGrade: BodyPartConditionGrade | undefined =
      nextCategory === 'Body parts' ? existing.conditionGrade : undefined;
    if (nextCategory === 'Body parts' && body.conditionGrade !== undefined) {
      if (body.conditionGrade === null || body.conditionGrade === '') {
        nextConditionGrade = undefined;
      } else {
        const rawEditGrade = String(body.conditionGrade).trim().toUpperCase();
        if (rawEditGrade !== 'A' && rawEditGrade !== 'B' && rawEditGrade !== 'C') {
          res.status(400).json({ error: 'Body part condition grade must be A, B, or C.' });
          return;
        }
        nextConditionGrade = rawEditGrade;
      }
    }
    const nextIsGearbox =
      nextCategory !== 'Gearbox Oil' &&
      (nextSubcategory === 'Gearboxes' || /\bgearbox(?:es)?\b/i.test(nextName));
    const nextGearboxOilType =
      body.gearboxOilType !== undefined
        ? typeof body.gearboxOilType === 'string'
          ? body.gearboxOilType.trim()
          : ''
        : existing.gearboxOilType || '';

    if (nextIsGearbox && !nextGearboxOilType) {
      res.status(400).json({
        error: 'Please enter the type of gearbox oil this gearbox uses.',
      });
      return;
    }

    let nextIsOffer =
      typeof body.isOffer === 'boolean' ? body.isOffer : Boolean(existing.isOffer);
    if (
      isRelist &&
      typeof body.isOffer !== 'boolean' &&
      nextIsOffer &&
      existing.previousPrice &&
      nextPrice >= existing.previousPrice
    ) {
      nextIsOffer = false;
    }
    let nextPreviousPrice: number | undefined;
    if (nextIsOffer) {
      const candidatePrev =
        body.previousPrice !== undefined && body.previousPrice !== null && body.previousPrice !== ''
          ? Number(body.previousPrice)
          : existing.previousPrice;
      if (!Number.isFinite(candidatePrev) || Number(candidatePrev) <= 0) {
        res.status(400).json({
          error: 'Please enter a valid previous price greater than zero when listing in offers.',
        });
        return;
      }
      const roundedPrev = Math.round(Number(candidatePrev));
      if (roundedPrev <= nextPrice) {
        res.status(400).json({
          error: 'Offer price must be lower than the previous price.',
        });
        return;
      }
      nextPreviousPrice = roundedPrev;
    }

    const existingGallery =
      Array.isArray(existing.imageUrls) && existing.imageUrls.length > 0
        ? existing.imageUrls
        : existing.imageUrl
          ? [existing.imageUrl]
          : [];
    let nextImageUrls = existingGallery;
    if (Array.isArray(body.imageUrls) || body.imageDataUrl || body.imageUrl) {
      const imagesResult = resolveSubmittedPartImages(body);
      if ('error' in imagesResult) {
        res.status(400).json({ error: imagesResult.error });
        return;
      }
      if (imagesResult.imageUrls.length === 0) {
        res.status(400).json({ error: 'At least 1 cover image is required for the spare part.' });
        return;
      }
      nextImageUrls = imagesResult.imageUrls;
    }

    const updated: SparePartRecord = {
      ...existing,
      name: nextName,
      description: nextDescription,
      price: nextPrice,
      category: nextCategory,
      subcategory: nextSubcategory,
      brand: nextBrand,
      stock: nextStock,
      imageUrl: nextImageUrls[0] || existing.imageUrl,
      imageUrls: nextImageUrls,
      ...(isRelist ? { createdAt: new Date().toISOString() } : {}),
    };
    if (nextCarModel) {
      updated.carModel = nextCarModel;
    } else {
      delete updated.carModel;
    }
    if (nextYearOfMake) {
      updated.yearOfMake = nextYearOfMake;
    } else {
      delete updated.yearOfMake;
    }
    if (nextConditionGrade) {
      updated.conditionGrade = nextConditionGrade;
    } else {
      delete updated.conditionGrade;
    }
    if (nextFloorPrice !== undefined) {
      updated.floorPrice = nextFloorPrice;
    } else {
      delete updated.floorPrice;
    }
    if (nextIsOffer && nextPreviousPrice) {
      updated.isOffer = true;
      updated.previousPrice = nextPreviousPrice;
    } else {
      delete updated.isOffer;
      delete updated.previousPrice;
    }
    if (nextIsGearbox && nextGearboxOilType) {
      updated.gearboxOilType = nextGearboxOilType;
    } else {
      delete updated.gearboxOilType;
    }

    if (isRelist) {
      store.parts.splice(index, 1);
      store.parts.unshift(updated);
    } else {
      store.parts[index] = updated;
    }
    writeStore(store);

    res.json({ part: serializePartForClient(updated, true) });
  });

  app.delete('/api/parts/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const nextParts = store.parts.filter((p) => p.id !== id);
    if (nextParts.length === store.parts.length) {
      res.status(404).json({ error: 'Spare part not found.' });
      return;
    }
    store.parts = nextParts;
    writeStore(store);
    res.json({ deleted: true, id });
  });

  const validateOrderPayload = (
    body: Record<string, unknown>,
    store: StoreData,
    authUser: UserRecord | null,
    requestSessionId = '',
  ):
    | { error: string }
    | {
        payload: PendingOrderPayloadRecord;
        receiptItems: ReceiptLineItemRecord[];
        subtotal: number;
        total: number;
      } => {
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const rawDeliveryAddress =
      typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
    const deliveryRegion: DeliveryRegion =
      body.deliveryRegion === 'outside_nairobi'
        ? 'outside_nairobi'
        : body.deliveryRegion === 'pickup'
          ? 'pickup'
          : body.deliveryRegion === 'garage_fitting'
            ? 'garage_fitting'
            : 'nairobi';
    const courierName = typeof body.courierName === 'string' ? body.courierName.trim() : '';
    const vehicleDetails =
      typeof body.vehicleDetails === 'string' ? body.vehicleDetails.trim().slice(0, 160) : '';
    const rawFittingDate =
      typeof body.fittingDate === 'string' ? body.fittingDate.trim() : '';
    const rawFittingTimeSlot =
      typeof body.fittingTimeSlot === 'string' ? body.fittingTimeSlot.trim() : '';
    const paymentMethod =
      typeof body.paymentMethod === 'string' && body.paymentMethod.trim()
        ? body.paymentMethod.trim()
        : `M-Pesa Paybill (${MPESA_PAYBILL} / Acc: ${MPESA_ACCOUNT})`;
    const referralCodeInput =
      typeof body.referralCode === 'string' ? body.referralCode.trim() : '';
    const applyReferralCredit = body.applyReferralCredit === true;
    const requestedBargainId =
      typeof body.bargainId === 'string' ? body.bargainId.trim() : '';
    const requestedBargainCode =
      typeof body.bargainCode === 'string' ? body.bargainCode.trim().toUpperCase() : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName) {
      return { error: 'Customer name is required to generate a receipt.' };
    }
    if (!customerPhone) {
      return { error: 'Customer phone number is required.' };
    }
    if (deliveryRegion === 'outside_nairobi' && !courierName) {
      return {
        error:
          'Please enter the name of your preferred courier service for delivery outside Nairobi.',
      };
    }

    let validatedFittingDate: string | undefined;
    let validatedFittingTimeSlot: string | undefined;
    let validatedFittingSlotLabel: string | undefined;

    if (deliveryRegion === 'garage_fitting') {
      if (!rawFittingDate || !isValidDateStrServer(rawFittingDate)) {
        return {
          error: 'Please select a valid appointment date (YYYY-MM-DD) for your in-garage fitting.',
        };
      }
      if (isSundayDateStrServer(rawFittingDate)) {
        return {
          error:
            'Our fitting garage is closed on Sundays (open Mon–Sat, 7:30 AM – 6:30 PM). Please pick Monday to Saturday.',
        };
      }
      const { dateStr: todayStr } = getNairobiNowParts();
      const maxAllowedDate = addDaysToDateStrServer(todayStr, GARAGE_BOOKING_MAX_DAYS_AHEAD);
      if (rawFittingDate < todayStr) {
        return { error: 'Please select today or an upcoming date for your fitting appointment.' };
      }
      if (rawFittingDate > maxAllowedDate) {
        return {
          error: `Appointments can be booked up to ${GARAGE_BOOKING_MAX_DAYS_AHEAD} days in advance.`,
        };
      }
      const matchedSlot = GARAGE_FITTING_SLOTS.find((s) => s.id === rawFittingTimeSlot);
      if (!matchedSlot) {
        return { error: 'Please select a valid hourly fitting time slot.' };
      }
      const daySlots = computeGarageSlotsForDate(store, rawFittingDate);
      const slotStatus = daySlots.slots.find((s) => s.id === matchedSlot.id);
      if (!slotStatus || slotStatus.isPast) {
        return {
          error: 'That fitting time slot has already passed. Please choose an upcoming time slot.',
        };
      }
      if (!slotStatus.available) {
        return {
          error: `The ${matchedSlot.label} bay is fully booked on ${rawFittingDate}. Please pick another open slot.`,
        };
      }
      validatedFittingDate = rawFittingDate;
      validatedFittingTimeSlot = matchedSlot.id;
      validatedFittingSlotLabel = matchedSlot.label;
    }

    if (/payment on delivery|cash on delivery|pay on delivery|\bcod\b/i.test(paymentMethod)) {
      return {
        error:
          'Payment on delivery has been removed for Nairobi and all deliveries. Please complete checkout upfront (your rider fee is included in the total), or choose Counter Pickup to pay and collect in person at our Kirinyaga Rd shop.',
      };
    }
    if (rawItems.length === 0) {
      return { error: 'Your cart is empty.' };
    }

    const receiptItems: ReceiptLineItemRecord[] = [];
    const normalizedItems: Array<{ partId: string; quantity: number }> = [];
    let subtotal = 0;
    let totalUnits = 0;

    for (const entry of rawItems) {
      const itemObj = entry as Record<string, unknown>;
      const partId = typeof itemObj.partId === 'string' ? itemObj.partId : '';
      const quantity = Math.max(1, Math.floor(Number(itemObj.quantity) || 1));
      const part = store.parts.find((p) => p.id === partId);
      if (!part) {
        return { error: `Requested spare part (${partId}) is no longer available.` };
      }
      const lineTotal = part.price * quantity;
      subtotal += lineTotal;
      totalUnits += quantity;
      normalizedItems.push({ partId: part.id, quantity });
      receiptItems.push({
        partId: part.id,
        name: part.name,
        sku: part.sku,
        category: part.category,
        subcategory: part.subcategory,
        unitPrice: part.price,
        quantity,
        lineTotal,
      });
    }

    let matchedBargain: BargainOfferRecord | undefined;
    const bargainedPartIds = new Set<string>();
    let bargainListedSubtotal = 0;

    if (requestedBargainId || requestedBargainCode) {
      matchedBargain = store.bargains.find(
        (b) =>
          (requestedBargainId && b.id === requestedBargainId) ||
          (requestedBargainCode && b.bargainCode.toUpperCase() === requestedBargainCode),
      );
      if (!matchedBargain) {
        return { error: 'The selected bargain deal could not be found.' };
      }
      if (matchedBargain.status === 'redeemed') {
        return { error: `Bargain ${matchedBargain.bargainCode} has already been redeemed on an earlier order.` };
      }
      if (matchedBargain.status !== 'accepted') {
        return {
          error: `Bargain ${matchedBargain.bargainCode} is currently "${matchedBargain.status}" and cannot be applied at checkout yet.`,
        };
      }
      const normalizedCustomerPhone = normalizePhone(customerPhone);
      const isBargainOwner =
        Boolean(authUser && matchedBargain.userId && matchedBargain.userId === authUser.id) ||
        Boolean(requestSessionId && matchedBargain.sessionId === requestSessionId) ||
        Boolean(
          normalizedCustomerPhone &&
            normalizePhone(matchedBargain.customerPhone) === normalizedCustomerPhone,
        );
      if (!isBargainOwner) {
        return {
          error: 'This agreed bargain belongs to a different customer account or session.',
        };
      }

      const qtyAndSubtotalByPartId = new Map<string, { quantity: number; lineSubtotal: number }>();
      for (const rItem of receiptItems) {
        const prev = qtyAndSubtotalByPartId.get(rItem.partId);
        if (prev) {
          qtyAndSubtotalByPartId.set(rItem.partId, {
            quantity: prev.quantity + rItem.quantity,
            lineSubtotal: prev.lineSubtotal + rItem.lineTotal,
          });
        } else {
          qtyAndSubtotalByPartId.set(rItem.partId, {
            quantity: rItem.quantity,
            lineSubtotal: rItem.lineTotal,
          });
        }
      }

      for (const bItem of matchedBargain.items) {
        const cartMatch = qtyAndSubtotalByPartId.get(bItem.partId);
        if (!cartMatch || cartMatch.quantity !== bItem.quantity) {
          return {
            error: `Cart items or quantities do not match agreed bargain ${matchedBargain.bargainCode}. Open My Bargains to reload the exact deal items.`,
          };
        }
        bargainedPartIds.add(bItem.partId);
        bargainListedSubtotal += cartMatch.lineSubtotal;
      }
    }

    if (deliveryRegion === 'nairobi' && !rawDeliveryAddress) {
      return {
        error: 'Please enter your delivery destination in Nairobi so we can calculate the delivery fee (KSh 500 per 10km).',
      };
    }

    let deliveryDestination: string | undefined;
    let deliveryDistanceKm: number | undefined;
    let deliveryFee = 0;
    if (deliveryRegion === 'nairobi') {
      deliveryDestination = rawDeliveryAddress.slice(0, 140);
      const quote = resolveNairobiDeliverySync(deliveryDestination);
      deliveryDistanceKm = quote.distanceKm;
      deliveryFee = quote.fee;
    }

    const discountInfo = calculateOrderDiscount({
      store,
      subtotal,
      totalUnits,
      receiptItems,
      authUser,
      customerPhone,
      referralCodeInput,
      applyReferralCredit,
      bargain: matchedBargain,
      bargainedPartIds,
      bargainListedSubtotal,
    });
    const total = Math.max(0, subtotal - discountInfo.discountAmount) + deliveryFee;

    const formattedDeliveryAddress =
      deliveryRegion === 'garage_fitting'
        ? `In-Garage Fitting (${validatedFittingDate} · ${validatedFittingSlotLabel}) — Seventies Plaza, Kirinyaga Road, Shops LG9 and LG10 (Mon-Sat: 7.30am - 6.30pm)`
        : deliveryRegion === 'pickup'
          ? 'Counter Pickup — Seventies Plaza, Kirinyaga Road, Shops LG9 and LG10 (Mon-Sat: 7.30am - 6.30pm)'
          : deliveryRegion === 'outside_nairobi'
            ? `Paid Delivery (Outside Nairobi: ${rawDeliveryAddress || 'Town / Destination'}) · Courier: ${courierName}`
            : `Nairobi Delivery to ${deliveryDestination} (~${deliveryDistanceKm} km · Fee: KSh ${deliveryFee.toLocaleString('en-KE')})`;

    return {
      payload: {
        customerName,
        customerPhone: normalizePhone(customerPhone),
        customerEmail: authUser?.email,
        userId: authUser?.id,
        deliveryRegion,
        deliveryAddress: formattedDeliveryAddress,
        ...(deliveryRegion === 'nairobi'
          ? {
              deliveryDestination,
              deliveryDistanceKm,
              deliveryFee,
            }
          : {}),
        courierName: deliveryRegion === 'outside_nairobi' ? courierName : undefined,
        vehicleDetails:
          deliveryRegion === 'garage_fitting' && vehicleDetails ? vehicleDetails : undefined,
        fittingDate: validatedFittingDate,
        fittingTimeSlot: validatedFittingTimeSlot,
        fittingSlotLabel: validatedFittingSlotLabel,
        paymentMethod,
        partnerId: discountInfo.partner?.id,
        ...(matchedBargain
          ? {
              bargainId: matchedBargain.id,
              bargainCode: matchedBargain.bargainCode,
              bargainedPartIds: Array.from(bargainedPartIds),
            }
          : {}),
        referralCodeUsed: discountInfo.referralCodeUsed,
        referralPartnerId: discountInfo.referralPartnerId,
        referralPartnerName: discountInfo.referralPartnerName,
        referralCreditPercent: discountInfo.referralCreditPercent,
        referralCreditAmount: discountInfo.referralCreditAmount,
        referralCreditApplied: discountInfo.referralCreditApplied,
        discountAmount: discountInfo.discountAmount > 0 ? discountInfo.discountAmount : undefined,
        discountLabel: discountInfo.discountLabel,
        items: normalizedItems,
      },
      receiptItems,
      subtotal,
      total,
    };
  };

  const isValidCardLuhn = (digits: string): boolean => {
    if (!/^\d{13,19}$/.test(digits)) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  const detectCardBrand = (digits: string): string => {
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7([01]\d|20)))/.test(digits)) {
      return 'Mastercard';
    }
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Card';
  };

  const validateCardDetails = (raw: {
    cardholderName?: unknown;
    cardNumber?: unknown;
    expiry?: unknown;
    cvv?: unknown;
  }):
    | { error: string }
    | {
        cardholderName: string;
        cardBrand: string;
        cardLast4: string;
        cardExpMonth: string;
        cardExpYear: string;
      } => {
    const cardholderName =
      typeof raw.cardholderName === 'string' ? raw.cardholderName.trim().slice(0, 80) : '';
    if (cardholderName.length < 2) {
      return { error: 'Please enter the cardholder name as shown on the card.' };
    }
    const cardDigits =
      typeof raw.cardNumber === 'string' ? raw.cardNumber.replace(/\D/g, '') : '';
    if (!isValidCardLuhn(cardDigits)) {
      return {
        error: 'Please enter a valid 13–19 digit debit or credit card number.',
      };
    }
    const rawExpiry = typeof raw.expiry === 'string' ? raw.expiry.trim() : '';
    const expMatch = rawExpiry.match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
    if (!expMatch) {
      return { error: 'Please enter card expiry in MM/YY format (e.g. 08/28).' };
    }
    const expMonthNum = Number(expMatch[1]);
    const expYearNum =
      expMatch[2].length === 2 ? 2000 + Number(expMatch[2]) : Number(expMatch[2]);
    if (expMonthNum < 1 || expMonthNum > 12) {
      return { error: 'Card expiry month must be between 01 and 12.' };
    }
    const { dateStr } = getNairobiNowParts();
    const [curYearStr, curMonthStr] = dateStr.split('-');
    const curYear = Number(curYearStr);
    const curMonth = Number(curMonthStr);
    if (expYearNum < curYear || (expYearNum === curYear && expMonthNum < curMonth)) {
      return { error: 'This card has expired. Please use an active debit or credit card.' };
    }
    if (expYearNum > curYear + 20) {
      return { error: 'Please enter a valid card expiry year.' };
    }
    const cvvDigits = typeof raw.cvv === 'string' ? raw.cvv.replace(/\D/g, '') : '';
    if (!/^\d{3,4}$/.test(cvvDigits)) {
      return { error: 'Please enter a valid 3 or 4 digit card security code (CVV).' };
    }

    return {
      cardholderName,
      cardBrand: detectCardBrand(cardDigits),
      cardLast4: cardDigits.slice(-4),
      cardExpMonth: String(expMonthNum).padStart(2, '0'),
      cardExpYear: String(expYearNum).slice(-2),
    };
  };

  const generateCardTransactionRef = (): string => {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `MSZCRD${token}`;
  };

  const generateCardAuthCode = (): string => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  };

  const finalizeOrderInStore = (
    store: StoreData,
    payload: PendingOrderPayloadRecord,
    mpesaMeta?: {
      mpesaReceiptNumber: string;
      mpesaPhone: string;
      mpesaCheckoutRequestId: string;
    },
    cardMeta?: {
      cardTransactionRef: string;
      cardBrand: string;
      cardLast4: string;
      cardAuthCode: string;
    },
  ): VirtualReceiptRecord => {
    const receiptItems: ReceiptLineItemRecord[] = [];
    let subtotal = 0;

    const orderUser = payload.userId
      ? store.users.find((u) => u.id === payload.userId)
      : undefined;
    const orderPartner =
      (payload.partnerId ? store.partners.find((p) => p.id === payload.partnerId) : undefined) ||
      findPartnerForUser(store, orderUser);
    const isPartnerOrder = Boolean(payload.partnerId || isPartnerJoinedInProgram(orderPartner));
    const bargainedPartIds = new Set(payload.bargainedPartIds || []);

    for (const line of payload.items) {
      const partIdx = store.parts.findIndex((p) => p.id === line.partId);
      const part = partIdx !== -1 ? store.parts[partIdx] : null;
      if (!part) continue;
      const lineTotal = part.price * line.quantity;
      const pct =
        !isPartnerOrder && part.category !== 'Gearbox Oil' && !bargainedPartIds.has(part.id)
          ? getItemVolumeDiscountPctServer(line.quantity)
          : 0;
      const lineDisc = pct > 0 ? Math.round((lineTotal * pct) / 100) : 0;
      subtotal += lineTotal;
      receiptItems.push({
        partId: part.id,
        name: part.name,
        sku: part.sku,
        category: part.category,
        subcategory: part.subcategory,
        unitPrice: part.price,
        quantity: line.quantity,
        lineTotal,
        ...(pct > 0 ? { volumeDiscountPct: pct, volumeDiscountAmount: lineDisc } : {}),
      });
      if (store.parts[partIdx].stock > 0) {
        store.parts[partIdx].stock = Math.max(0, store.parts[partIdx].stock - line.quantity);
      }
    }

    const discountAmount = Math.min(subtotal, Math.max(0, Math.round(payload.discountAmount || 0)));
    const deliveryFee =
      payload.deliveryRegion === 'nairobi'
        ? Math.max(0, Math.round(payload.deliveryFee || 0))
        : 0;
    const total = Math.max(0, subtotal - discountAmount) + deliveryFee;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const receiptNumber = generateReceiptNumber();

    let pickupMeta:
      | {
          pickupCode: string;
          pickupReservedUntil: string;
          pickupStatus: 'reserved';
          pickupBookingAgreement: string;
        }
      | undefined;

    if (payload.deliveryRegion === 'pickup') {
      const existingPickupCodes = new Set(
        store.orders.map((o) => o.pickupCode).filter((c): c is string => Boolean(c)),
      );
      const pickupCode = generatePickupCode(existingPickupCodes);
      const pickupReservedUntil = new Date(
        nowMs + PICKUP_RESERVATION_HOURS * 60 * 60 * 1000,
      ).toISOString();
      pickupMeta = {
        pickupCode,
        pickupReservedUntil,
        pickupStatus: 'reserved',
        pickupBookingAgreement: buildPickupBookingAgreement({
          receiptNumber,
          pickupCode,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          reservedUntilIso: pickupReservedUntil,
          items: receiptItems,
          total,
        }),
      };
    }

    const receipt: VirtualReceiptRecord = {
      id: `ord-${crypto.randomBytes(4).toString('hex')}`,
      receiptNumber,
      shopName: SHOP_NAME,
      guaranteeText: GUARANTEE_NOTICE,
      customerCarePhone: CUSTOMER_CARE_NUMBER,
      issuedAt: nowIso,
      status: 'Pending',
      statusUpdatedAt: nowIso,
      trackingStage: 'processing',
      trackingLocation: 'Seventies Plaza, Kirinyaga Rd',
      trackingEvents: [
        {
          stage: 'processing',
          label: getTrackingStageLabelServer('processing'),
          note: getDefaultTrackingNoteServer('processing', {
            deliveryRegion: payload.deliveryRegion,
            deliveryDestination: payload.deliveryDestination,
            courierName: payload.courierName,
            pickupCode: pickupMeta?.pickupCode,
          }),
          location: 'Seventies Plaza, Kirinyaga Rd',
          updatedAt: nowIso,
        },
      ],
      ...(mpesaMeta
        ? {
            paymentStatus: 'Paid',
            saleConfirmed: true,
            confirmedAt: nowIso,
            mpesaReceiptNumber: mpesaMeta.mpesaReceiptNumber,
            mpesaPhone: mpesaMeta.mpesaPhone,
            mpesaCheckoutRequestId: mpesaMeta.mpesaCheckoutRequestId,
          }
        : cardMeta
          ? {
              paymentStatus: 'Paid',
              saleConfirmed: true,
              confirmedAt: nowIso,
              cardTransactionRef: cardMeta.cardTransactionRef,
              cardBrand: cardMeta.cardBrand,
              cardLast4: cardMeta.cardLast4,
              cardAuthCode: cardMeta.cardAuthCode,
            }
          : {}),
      userId: payload.userId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      deliveryAddress: payload.deliveryAddress,
      deliveryRegion: payload.deliveryRegion,
      ...(payload.deliveryRegion === 'nairobi'
        ? {
            deliveryDestination: payload.deliveryDestination,
            deliveryDistanceKm: payload.deliveryDistanceKm,
            deliveryFee,
          }
        : {}),
      courierName: payload.courierName,
      ...(pickupMeta ? pickupMeta : {}),
      ...(payload.vehicleDetails ? { vehicleDetails: payload.vehicleDetails } : {}),
      ...(payload.deliveryRegion === 'garage_fitting' && payload.fittingDate
        ? {
            fittingDate: payload.fittingDate,
            fittingTimeSlot: payload.fittingTimeSlot,
            fittingSlotLabel: payload.fittingSlotLabel,
            fittingStatus: 'Scheduled' as const,
          }
        : {}),
      paymentMethod: mpesaMeta
        ? `M-Pesa STK Push (Ref: ${mpesaMeta.mpesaReceiptNumber})`
        : cardMeta
          ? `${cardMeta.cardBrand} •••• ${cardMeta.cardLast4} (Ref: ${cardMeta.cardTransactionRef})`
          : payload.paymentMethod,
      items: receiptItems,
      subtotal,
      ...(discountAmount > 0 ? { discountAmount, discountLabel: payload.discountLabel } : {}),
      ...(payload.referralCodeUsed
        ? {
            referralCodeUsed: payload.referralCodeUsed,
            referralPartnerId: payload.referralPartnerId,
            referralPartnerName: payload.referralPartnerName,
            referralCreditPercent:
              payload.referralCreditPercent ?? REFERRAL_MECHANIC_CREDIT_PCT,
            referralCreditAmount:
              payload.referralCreditAmount ??
              Math.round((Math.max(0, subtotal - discountAmount) * REFERRAL_MECHANIC_CREDIT_PCT) / 100),
            referralCreditStatus: 'pending_fitting' as const,
          }
        : {}),
      ...(payload.referralCreditApplied && payload.referralCreditApplied > 0
        ? { referralCreditApplied: payload.referralCreditApplied }
        : {}),
      ...(payload.partnerId ? { partnerId: payload.partnerId } : {}),
      ...(payload.bargainId ? { bargainId: payload.bargainId } : {}),
      ...(payload.bargainCode ? { bargainCode: payload.bargainCode } : {}),
      total,
    };

    if (payload.bargainId) {
      const redeemedBargain = store.bargains.find((b) => b.id === payload.bargainId);
      if (redeemedBargain && redeemedBargain.status === 'accepted') {
        const agreedTotal = Math.max(
          0,
          Math.round(redeemedBargain.agreedTotal ?? redeemedBargain.offeredTotal),
        );
        redeemedBargain.status = 'redeemed';
        redeemedBargain.redeemedReceiptId = receipt.id;
        redeemedBargain.redeemedReceiptNumber = receipt.receiptNumber;
        redeemedBargain.updatedAt = nowIso;
        redeemedBargain.history.push({
          actor: 'customer',
          action: 'redeemed',
          amount: agreedTotal,
          note: `Redeemed on order ${receipt.receiptNumber}`,
          createdAt: nowIso,
        });
        broadcastBargainUpdate(redeemedBargain);
      }
    }

    if (payload.partnerId) {
      const partner = store.partners.find((p) => p.id === payload.partnerId);
      if (partner) {
        const orderedUnits = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
        partner.ordersCount += 1;
        partner.itemsCount = getPartnerLoyaltyItemsCountServer(partner) + orderedUnits;
        partner.totalSpent += total;
        if (payload.referralCreditApplied && payload.referralCreditApplied > 0) {
          partner.referralCreditBalance = Math.max(
            0,
            (partner.referralCreditBalance || 0) - payload.referralCreditApplied,
          );
        }
        const excludeAutomatedTiers = isPartnerJoinedInProgram(partner);
        partner.discountTierPercent = computePartnerTierPercent(
          partner.itemsCount,
          partner.discountTierPercent,
          excludeAutomatedTiers,
        );
      }
    }

    if (payload.referralCodeUsed) {
      const refPartner = store.partners.find(
        (p) => p.referralCode.toUpperCase() === payload.referralCodeUsed!.toUpperCase(),
      );
      if (refPartner) {
        const earnedCredit =
          receipt.referralCreditAmount ??
          Math.round((total * REFERRAL_MECHANIC_CREDIT_PCT) / 100);
        refPartner.referralsCount += 1;
        refPartner.referredRevenue += total;
        refPartner.referralCreditPending =
          (refPartner.referralCreditPending || 0) + earnedCredit;
      }
    }

    store.orders.unshift(receipt);

    const { dateStr: orderDateStr } = getNairobiNowParts(new Date(nowIso));
    const existingKeys = new Set(
      store.partSourcingLogs.map((l) => l.orderPartKey).filter(Boolean),
    );
    for (const item of receiptItems) {
      const orderPartKey = `${receipt.id}:${item.partId}`;
      if (existingKeys.has(orderPartKey)) continue;
      store.partSourcingLogs.unshift({
        id: `pslog-${crypto.randomBytes(4).toString('hex')}`,
        date: orderDateStr,
        receiptNumber: receipt.receiptNumber,
        orderId: receipt.id,
        orderPartKey,
        partName: item.name,
        category: item.category || undefined,
        sku: item.sku,
        quantity: item.quantity,
        sourceType: 'in_store',
        clientName: receipt.vehicleDetails
          ? `${receipt.customerName} (${receipt.vehicleDetails})`
          : receipt.customerName,
        handledBy: '',
        fittedByOurMechanic: receipt.deliveryRegion === 'garage_fitting',
        mechanicName: '',
        notes:
          receipt.deliveryRegion === 'garage_fitting' && receipt.fittingSlotLabel
            ? `Garage slot: ${receipt.fittingDate} ${receipt.fittingSlotLabel}`
            : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    return receipt;
  };

  app.get('/api/garage-slots', (req, res) => {
    const rawDate =
      typeof req.query.date === 'string' && req.query.date.trim()
        ? req.query.date.trim()
        : getDefaultFittingDateServer();
    if (!isValidDateStrServer(rawDate)) {
      res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD.' });
      return;
    }
    const store = readStore();
    res.json(computeGarageSlotsForDate(store, rawDate));
  });

  app.post('/api/orders', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const reqSessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();
    const validated = validateOrderPayload(body, store, authUser, reqSessionId);

    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const rawMpesaCode =
      typeof body.mpesaTransactionCode === 'string'
        ? body.mpesaTransactionCode.trim().toUpperCase()
        : '';
    let directMpesaMeta:
      | {
          mpesaReceiptNumber: string;
          mpesaPhone: string;
          mpesaCheckoutRequestId: string;
        }
      | undefined;

    if (rawMpesaCode) {
      if (!/^[A-Z0-9]{8,12}$/.test(rawMpesaCode) || !/[A-Z]/.test(rawMpesaCode) || !/\d/.test(rawMpesaCode)) {
        res.status(400).json({
          error: 'Please enter a valid M-Pesa transaction code (8–12 letters & numbers, e.g. SLK8X9M2Q4).',
        });
        return;
      }
      const duplicateOrder = store.orders.find(
        (o) => (o.mpesaReceiptNumber || '').toUpperCase() === rawMpesaCode,
      );
      if (duplicateOrder) {
        res.status(400).json({
          error: `M-Pesa transaction code ${rawMpesaCode} is already linked to receipt ${duplicateOrder.receiptNumber}.`,
        });
        return;
      }
      directMpesaMeta = {
        mpesaReceiptNumber: rawMpesaCode,
        mpesaPhone: normalizePhone(validated.payload.customerPhone),
        mpesaCheckoutRequestId: `mpesa-direct-${crypto.randomBytes(4).toString('hex')}`,
      };
    }

    const receipt = finalizeOrderInStore(store, validated.payload, directMpesaMeta);
    await appendOrderSmsNotification(store, receipt, 'order_confirmation');
    writeStore(store);

    res.status(201).json({ receipt });
  });

  const isValidMpesaTransactionCode = (raw: string): boolean => {
    const code = raw.trim().toUpperCase();
    return /^[A-Z0-9]{8,12}$/.test(code) && /[A-Z]/.test(code) && /\d/.test(code);
  };

  app.post('/api/mpesa/manual-initiate', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const reqSessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();
    const validated = validateOrderPayload(body, store, authUser, reqSessionId);

    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const amount = Math.max(1, Math.round(validated.total));
    const nowIso = new Date().toISOString();
    const checkoutRequestId = `mpesa-man-${crypto.randomBytes(6).toString('hex')}`;
    const merchantRequestId = `man-${crypto.randomBytes(5).toString('hex')}`;
    const normalizedCustomerPhone = formatMpesaPhone(validated.payload.customerPhone) || normalizePhone(validated.payload.customerPhone).replace(/^\+/, '');

    const tx: MpesaTransactionRecord = {
      id: `mptx-${crypto.randomBytes(4).toString('hex')}`,
      checkoutRequestId,
      merchantRequestId,
      mode: 'manual_code',
      phone: normalizedCustomerPhone,
      amount,
      paybill: MPESA_PAYBILL,
      accountNumber: MPESA_ACCOUNT,
      status: 'pending_code',
      resultDesc: `Order initiated for KSh ${amount.toLocaleString('en-KE')}. Pay to Paybill ${MPESA_PAYBILL} (Account ${MPESA_ACCOUNT}) and enter your M-Pesa transaction code to link your VirtualReceipt.`,
      createdAt: nowIso,
      updatedAt: nowIso,
      orderPayload: validated.payload,
    };

    store.mpesaTransactions.unshift(tx);
    if (store.mpesaTransactions.length > 200) {
      store.mpesaTransactions = store.mpesaTransactions.slice(0, 200);
    }
    writeStore(store);

    res.status(201).json({
      mode: tx.mode,
      checkoutRequestId: tx.checkoutRequestId,
      merchantRequestId: tx.merchantRequestId,
      mpesaPhone: tx.phone,
      amount: tx.amount,
      paybill: tx.paybill,
      accountNumber: tx.accountNumber,
      customerMessage: tx.resultDesc,
    });
  });

  app.post('/api/mpesa/verify-code', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const checkoutRequestId =
      typeof body.checkoutRequestId === 'string' ? body.checkoutRequestId.trim() : '';
    const action = body.action === 'cancel' ? 'cancel' : 'verify';
    const rawCode =
      typeof body.mpesaTransactionCode === 'string'
        ? body.mpesaTransactionCode.trim().toUpperCase()
        : '';

    if (!checkoutRequestId) {
      res.status(400).json({ error: 'Checkout initiation reference is required.' });
      return;
    }

    const store = readStore();
    const tx = store.mpesaTransactions.find((t) => t.checkoutRequestId === checkoutRequestId);
    if (!tx) {
      res.status(404).json({ error: 'M-Pesa checkout session not found or expired.' });
      return;
    }

    if (tx.status === 'completed' && tx.receiptId) {
      const existingReceipt = store.orders.find((o) => o.id === tx.receiptId);
      if (existingReceipt) {
        res.json({
          status: 'completed',
          mpesaReceiptNumber: tx.mpesaReceiptNumber,
          receipt: existingReceipt,
        });
        return;
      }
    }

    if (action === 'cancel') {
      tx.status = 'cancelled';
      tx.resultDesc = 'M-Pesa verification cancelled by customer.';
      tx.updatedAt = new Date().toISOString();
      writeStore(store);
      res.json({ status: 'cancelled' });
      return;
    }

    if (!rawCode || !isValidMpesaTransactionCode(rawCode)) {
      res.status(400).json({
        error:
          'Please enter a valid M-Pesa transaction code from your confirmation SMS (8–12 alphanumeric characters, e.g. SLK8X9M2Q4).',
      });
      return;
    }

    if (
      tx.mode === 'prompt' &&
      tx.mpesaReceiptNumber &&
      tx.mpesaReceiptNumber.toUpperCase() !== rawCode
    ) {
      res.status(400).json({
        error: `That code does not match the M-Pesa confirmation code (${tx.mpesaReceiptNumber}) for this transaction. Please enter ${tx.mpesaReceiptNumber}.`,
      });
      return;
    }

    const duplicateOrder = store.orders.find(
      (o) => (o.mpesaReceiptNumber || '').toUpperCase() === rawCode,
    );
    if (duplicateOrder) {
      res.status(400).json({
        error: `M-Pesa transaction code ${rawCode} is already linked to receipt ${duplicateOrder.receiptNumber}.`,
      });
      return;
    }

    if (tx.orderPayload.bargainId) {
      const bargainCheck = store.bargains.find((b) => b.id === tx.orderPayload.bargainId);
      if (!bargainCheck || bargainCheck.status !== 'accepted') {
        res.status(400).json({
          error: 'This agreed bargain offer has already been redeemed or closed.',
        });
        return;
      }
    }

    tx.status = 'completed';
    tx.mpesaReceiptNumber = rawCode;
    tx.resultDesc = `${rawCode} Validated. Linked to VirtualReceipt for KSh ${tx.amount.toLocaleString('en-KE')}.`;
    tx.updatedAt = new Date().toISOString();

    const receipt = finalizeOrderInStore(store, tx.orderPayload, {
      mpesaReceiptNumber: rawCode,
      mpesaPhone: tx.phone.startsWith('+') ? tx.phone : `+${tx.phone}`,
      mpesaCheckoutRequestId: tx.checkoutRequestId,
    });
    tx.receiptId = receipt.id;
    await appendOrderSmsNotification(store, receipt, 'order_confirmation');
    writeStore(store);

    res.status(201).json({
      status: 'completed',
      mpesaReceiptNumber: rawCode,
      resultDesc: tx.resultDesc,
      receipt,
    });
  });

  app.post('/api/mpesa/stk-push', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const rawMpesaPhone =
      typeof body.mpesaPhone === 'string' && body.mpesaPhone.trim()
        ? body.mpesaPhone.trim()
        : typeof body.customerPhone === 'string'
          ? body.customerPhone.trim()
          : '';

    const mpesaPhone = formatMpesaPhone(rawMpesaPhone);
    if (!mpesaPhone) {
      res.status(400).json({
        error:
          'Please enter a valid Safaricom/Kenyan M-Pesa phone number (e.g. 0712345678 or 254712345678).',
      });
      return;
    }

    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const reqSessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();
    const validated = validateOrderPayload(body, store, authUser, reqSessionId);

    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const amount = Math.max(1, Math.round(validated.total));
    const nowIso = new Date().toISOString();

    if (hasDarajaConfig()) {
      try {
        const accessToken = await getDarajaAccessToken();
        const shortcode = process.env.MPESA_SHORTCODE?.trim() || '174379';
        const passkey = process.env.MPESA_PASSKEY?.trim() || '';
        const timestamp = generateDarajaTimestamp();
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
        const reqHost = req.get('host');
        const inferredAppUrl =
          reqHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqHost)
            ? `${req.protocol}://${reqHost}`
            : '';
        const baseAppUrl = process.env.APP_URL?.trim() || inferredAppUrl;
        const callbackBase =
          process.env.MPESA_CALLBACK_URL?.trim() ||
          (baseAppUrl ? `${baseAppUrl.replace(/\/$/, '')}/api/mpesa/callback` : '');
        if (!callbackBase) {
          throw new Error('MPESA_CALLBACK_URL or APP_URL is required for Daraja STK Push.');
        }

        const darajaRes = await fetch(`${getDarajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: mpesaPhone,
            PartyB: shortcode,
            PhoneNumber: mpesaPhone,
            CallBackURL: callbackBase,
            AccountReference: MPESA_ACCOUNT,
            TransactionDesc: 'My Spare Zone Purchase',
          }),
        });

        const darajaData = (await darajaRes.json()) as {
          MerchantRequestID?: string;
          CheckoutRequestID?: string;
          ResponseCode?: string;
          CustomerMessage?: string;
          errorMessage?: string;
        };

        if (!darajaRes.ok || darajaData.ResponseCode !== '0' || !darajaData.CheckoutRequestID) {
          res.status(502).json({
            error:
              darajaData.errorMessage ||
              darajaData.CustomerMessage ||
              'Failed to initiate M-Pesa STK Push prompt.',
          });
          return;
        }

        const tx: MpesaTransactionRecord = {
          id: `mpesa-${crypto.randomBytes(4).toString('hex')}`,
          checkoutRequestId: darajaData.CheckoutRequestID,
          merchantRequestId: darajaData.MerchantRequestID || `mr-${crypto.randomBytes(4).toString('hex')}`,
          mode: 'daraja',
          phone: mpesaPhone,
          amount,
          paybill: MPESA_PAYBILL,
          accountNumber: MPESA_ACCOUNT,
          status: 'pending',
          resultDesc:
            darajaData.CustomerMessage ||
            `M-Pesa payment prompt sent to ${mpesaPhone}. Enter your M-Pesa PIN to complete.`,
          createdAt: nowIso,
          updatedAt: nowIso,
          orderPayload: validated.payload,
        };

        store.mpesaTransactions.unshift(tx);
        if (store.mpesaTransactions.length > 200) {
          store.mpesaTransactions = store.mpesaTransactions.slice(0, 200);
        }
        writeStore(store);

        res.status(200).json({
          mode: tx.mode,
          checkoutRequestId: tx.checkoutRequestId,
          merchantRequestId: tx.merchantRequestId,
          mpesaPhone: tx.phone,
          amount: tx.amount,
          paybill: tx.paybill,
          accountNumber: tx.accountNumber,
          customerMessage: tx.resultDesc,
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to send Daraja M-Pesa STK Push.';
        res.status(502).json({ error: msg });
        return;
      }
    }

    const checkoutRequestId = `ws_CO_${generateDarajaTimestamp()}_${crypto.randomBytes(4).toString('hex')}`;
    const merchantRequestId = `msz_${crypto.randomBytes(6).toString('hex')}`;
    const tx: MpesaTransactionRecord = {
      id: `mpesa-${crypto.randomBytes(4).toString('hex')}`,
      checkoutRequestId,
      merchantRequestId,
      mode: 'prompt',
      phone: mpesaPhone,
      amount,
      paybill: MPESA_PAYBILL,
      accountNumber: MPESA_ACCOUNT,
      status: 'pending',
      resultDesc: `M-Pesa prompt pushed to +${mpesaPhone}. Enter your 4-digit M-Pesa PIN to authorize payment.`,
      createdAt: nowIso,
      updatedAt: nowIso,
      orderPayload: validated.payload,
    };

    store.mpesaTransactions.unshift(tx);
    if (store.mpesaTransactions.length > 200) {
      store.mpesaTransactions = store.mpesaTransactions.slice(0, 200);
    }
    writeStore(store);

    res.status(200).json({
      mode: tx.mode,
      checkoutRequestId: tx.checkoutRequestId,
      merchantRequestId: tx.merchantRequestId,
      mpesaPhone: tx.phone,
      amount: tx.amount,
      paybill: tx.paybill,
      accountNumber: tx.accountNumber,
      customerMessage: tx.resultDesc,
    });
  });

  app.get('/api/mpesa/stk-status/:checkoutRequestId', async (req, res) => {
    const { checkoutRequestId } = req.params;
    const store = readStore();
    const tx = store.mpesaTransactions.find((t) => t.checkoutRequestId === checkoutRequestId);
    if (!tx) {
      res.status(404).json({ error: 'M-Pesa prompt session not found.' });
      return;
    }

    if (tx.status === 'pending' && tx.mode === 'daraja' && hasDarajaConfig() && req.query.sync === '1') {
      try {
        const accessToken = await getDarajaAccessToken();
        const shortcode = process.env.MPESA_SHORTCODE?.trim() || '174379';
        const passkey = process.env.MPESA_PASSKEY?.trim() || '';
        const timestamp = generateDarajaTimestamp();
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
        const queryRes = await fetch(`${getDarajaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId,
          }),
        });
        const queryData = (await queryRes.json()) as {
          ResultCode?: string | number;
          ResultDesc?: string;
        };
        if (queryData.ResultCode !== undefined) {
          const codeStr = String(queryData.ResultCode);
          if (codeStr === '0') {
            tx.status = 'completed';
            tx.resultDesc = queryData.ResultDesc || 'The service request is processed successfully.';
            tx.mpesaReceiptNumber = tx.mpesaReceiptNumber || generateMpesaReceiptCode();
            if (!tx.receiptId) {
              const receipt = finalizeOrderInStore(store, tx.orderPayload, {
                mpesaReceiptNumber: tx.mpesaReceiptNumber,
                mpesaPhone: `+${tx.phone}`,
                mpesaCheckoutRequestId: tx.checkoutRequestId,
              });
              tx.receiptId = receipt.id;
              await appendOrderSmsNotification(store, receipt, 'order_confirmation');
            }
            tx.updatedAt = new Date().toISOString();
            writeStore(store);
          } else if (codeStr === '1032') {
            tx.status = 'cancelled';
            tx.resultDesc = queryData.ResultDesc || 'Request cancelled by user.';
            tx.updatedAt = new Date().toISOString();
            writeStore(store);
          } else {
            tx.status = 'failed';
            tx.resultDesc = queryData.ResultDesc || 'M-Pesa payment was not completed.';
            tx.updatedAt = new Date().toISOString();
            writeStore(store);
          }
        }
      } catch {
        // Return current stored status on transient Daraja query issues
      }
    }

    const receipt = tx.receiptId
      ? store.orders.find((o) => o.id === tx.receiptId)
      : undefined;

    res.json({
      checkoutRequestId: tx.checkoutRequestId,
      mode: tx.mode,
      status: tx.status,
      resultDesc: tx.resultDesc,
      mpesaReceiptNumber: tx.mpesaReceiptNumber,
      receipt,
    });
  });

  app.post('/api/mpesa/stk-confirm', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const checkoutRequestId =
      typeof body.checkoutRequestId === 'string' ? body.checkoutRequestId.trim() : '';
    const action = body.action === 'cancel' ? 'cancel' : 'confirm';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!checkoutRequestId) {
      res.status(400).json({ error: 'Checkout request ID is required.' });
      return;
    }

    const store = readStore();
    const tx = store.mpesaTransactions.find((t) => t.checkoutRequestId === checkoutRequestId);
    if (!tx) {
      res.status(404).json({ error: 'M-Pesa prompt session not found or expired.' });
      return;
    }

    if (tx.status === 'completed' && tx.receiptId) {
      const existingReceipt = store.orders.find((o) => o.id === tx.receiptId);
      res.json({
        status: 'completed',
        mpesaReceiptNumber: tx.mpesaReceiptNumber,
        receipt: existingReceipt,
      });
      return;
    }

    if (action === 'cancel') {
      tx.status = 'cancelled';
      tx.resultDesc = 'M-Pesa prompt cancelled by customer.';
      tx.updatedAt = new Date().toISOString();
      writeStore(store);
      res.json({ status: 'cancelled', resultDesc: tx.resultDesc });
      return;
    }

    if (tx.mode !== 'prompt') {
      res.status(400).json({ error: 'Please complete the M-Pesa PIN prompt directly on your phone.' });
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: 'Please enter your 4-digit M-Pesa PIN to confirm payment.' });
      return;
    }

    if (tx.orderPayload.bargainId) {
      const bargainCheck = store.bargains.find((b) => b.id === tx.orderPayload.bargainId);
      if (!bargainCheck || bargainCheck.status !== 'accepted') {
        res.status(400).json({
          error: 'This agreed bargain offer has already been redeemed or closed.',
        });
        return;
      }
    }

    const mpesaReceiptNumber = tx.mpesaReceiptNumber || generateMpesaReceiptCode();
    tx.status = 'pending_code';
    tx.mpesaReceiptNumber = mpesaReceiptNumber;
    tx.resultDesc = `${mpesaReceiptNumber} Confirmed. Paid KSh ${tx.amount.toLocaleString('en-KE')} to My Spare Zone. Enter code ${mpesaReceiptNumber} to validate and link your VirtualReceipt.`;
    tx.updatedAt = new Date().toISOString();
    writeStore(store);

    res.status(200).json({
      status: 'awaiting_code_validation',
      checkoutRequestId: tx.checkoutRequestId,
      issuedMpesaCode: mpesaReceiptNumber,
      amount: tx.amount,
      resultDesc: tx.resultDesc,
    });
  });

  app.post('/api/mpesa/callback', async (req, res) => {
    const body = req.body as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
          CallbackMetadata?: {
            Item?: Array<{ Name?: string; Value?: string | number }>;
          };
        };
      };
    };

    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    if (!checkoutRequestId) {
      res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      return;
    }

    const store = readStore();
    const tx = store.mpesaTransactions.find((t) => t.checkoutRequestId === checkoutRequestId);
    if (!tx) {
      res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      return;
    }

    const resultCode = Number(callback.ResultCode);
    const resultDesc = callback.ResultDesc || '';
    const nowIso = new Date().toISOString();

    if (resultCode === 0) {
      const items = callback.CallbackMetadata?.Item || [];
      const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
      const mpesaReceiptNumber =
        (receiptItem?.Value ? String(receiptItem.Value) : '') ||
        tx.mpesaReceiptNumber ||
        generateMpesaReceiptCode();

      tx.status = 'completed';
      tx.resultDesc = resultDesc || 'Payment confirmed.';
      tx.mpesaReceiptNumber = mpesaReceiptNumber;
      tx.updatedAt = nowIso;

      if (!tx.receiptId) {
        const receipt = finalizeOrderInStore(store, tx.orderPayload, {
          mpesaReceiptNumber,
          mpesaPhone: `+${tx.phone}`,
          mpesaCheckoutRequestId: tx.checkoutRequestId,
        });
        tx.receiptId = receipt.id;
        await appendOrderSmsNotification(store, receipt, 'order_confirmation');
      }
    } else if (resultCode === 1032) {
      tx.status = 'cancelled';
      tx.resultDesc = resultDesc || 'Request cancelled by user.';
      tx.updatedAt = nowIso;
    } else {
      tx.status = 'failed';
      tx.resultDesc = resultDesc || 'M-Pesa payment failed.';
      tx.updatedAt = nowIso;
    }

    writeStore(store);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  app.post('/api/payments/card/initiate', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const cardCheck = validateCardDetails({
      cardholderName: body.cardholderName,
      cardNumber: body.cardNumber,
      expiry: body.expiry,
      cvv: body.cvv,
    });
    if ('error' in cardCheck) {
      res.status(400).json({ error: cardCheck.error });
      return;
    }

    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const reqSessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();
    const validated = validateOrderPayload(body, store, authUser, reqSessionId);
    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const amount = Math.max(1, Math.round(validated.total));
    const nowIso = new Date().toISOString();
    const transactionId = `card_tx_${crypto.randomBytes(6).toString('hex')}`;
    const tx: CardTransactionRecord = {
      id: `crd-${crypto.randomBytes(4).toString('hex')}`,
      transactionId,
      cardBrand: cardCheck.cardBrand,
      cardLast4: cardCheck.cardLast4,
      cardExpMonth: cardCheck.cardExpMonth,
      cardExpYear: cardCheck.cardExpYear,
      cardholderName: cardCheck.cardholderName,
      amount,
      status: 'pending_confirmation',
      resultDesc: `Ready to deduct KSh ${amount.toLocaleString('en-KE')} from ${cardCheck.cardBrand} •••• ${cardCheck.cardLast4} upon customer confirmation.`,
      createdAt: nowIso,
      updatedAt: nowIso,
      orderPayload: validated.payload,
    };

    store.cardTransactions.unshift(tx);
    if (store.cardTransactions.length > 200) {
      store.cardTransactions = store.cardTransactions.slice(0, 200);
    }
    writeStore(store);

    res.status(200).json({
      transactionId: tx.transactionId,
      cardBrand: tx.cardBrand,
      cardLast4: tx.cardLast4,
      expiryLabel: `${tx.cardExpMonth}/${tx.cardExpYear}`,
      cardholderName: tx.cardholderName,
      amount: tx.amount,
      status: tx.status,
      resultDesc: tx.resultDesc,
    });
  });

  app.post('/api/payments/card/confirm', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const transactionId =
      typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const action = body.action === 'cancel' ? 'cancel' : 'confirm';

    if (!transactionId) {
      res.status(400).json({ error: 'Card payment transaction ID is required.' });
      return;
    }

    const store = readStore();
    const tx = store.cardTransactions.find((t) => t.transactionId === transactionId);
    if (!tx) {
      res.status(404).json({ error: 'Card payment session not found or expired.' });
      return;
    }

    if (tx.status === 'completed' && tx.receiptId) {
      const existingReceipt = store.orders.find((o) => o.id === tx.receiptId);
      res.json({
        status: 'completed',
        cardTransactionRef: tx.cardTransactionRef,
        cardAuthCode: tx.cardAuthCode,
        deductedAmount: tx.amount,
        receipt: existingReceipt,
      });
      return;
    }

    if (action === 'cancel') {
      tx.status = 'cancelled';
      tx.resultDesc = 'Card payment cancelled by customer before deduction.';
      tx.updatedAt = new Date().toISOString();
      writeStore(store);
      res.json({ status: 'cancelled', resultDesc: tx.resultDesc });
      return;
    }

    if (tx.status !== 'pending_confirmation') {
      res.status(400).json({
        error: 'This card payment session is no longer active. Please enter your card details again.',
      });
      return;
    }

    if (tx.orderPayload.bargainId) {
      const bargainCheck = store.bargains.find((b) => b.id === tx.orderPayload.bargainId);
      if (!bargainCheck || bargainCheck.status !== 'accepted') {
        res.status(400).json({
          error: 'This agreed bargain offer has already been redeemed or closed.',
        });
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const cardTransactionRef = generateCardTransactionRef();
    const cardAuthCode = generateCardAuthCode();
    tx.status = 'completed';
    tx.cardTransactionRef = cardTransactionRef;
    tx.cardAuthCode = cardAuthCode;
    tx.deductedAt = nowIso;
    tx.resultDesc = `${cardTransactionRef} Confirmed. Deducted KSh ${tx.amount.toLocaleString('en-KE')} from ${tx.cardBrand} •••• ${tx.cardLast4}.`;
    tx.updatedAt = nowIso;

    const receipt = finalizeOrderInStore(store, tx.orderPayload, undefined, {
      cardTransactionRef,
      cardBrand: tx.cardBrand,
      cardLast4: tx.cardLast4,
      cardAuthCode,
    });
    tx.receiptId = receipt.id;
    await appendOrderSmsNotification(store, receipt, 'order_confirmation');
    writeStore(store);

    res.status(201).json({
      status: 'completed',
      cardTransactionRef,
      cardAuthCode,
      deductedAmount: tx.amount,
      resultDesc: tx.resultDesc,
      receipt,
    });
  });

  app.post('/api/orders/statuses', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 100)
      : [];
    const receiptNumbers = Array.isArray(body.receiptNumbers)
      ? body.receiptNumbers
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 100)
      : [];

    if (ids.length === 0 && receiptNumbers.length === 0) {
      res.json({ statuses: [] });
      return;
    }

    const idSet = new Set(ids);
    const numSet = new Set(receiptNumbers);
    const store = readStore();
    const statuses = store.orders
      .filter((o) => idSet.has(o.id) || numSet.has(o.receiptNumber))
      .map((o) => ({
        id: o.id,
        receiptNumber: o.receiptNumber,
        status: o.status || 'Pending',
        statusUpdatedAt: o.statusUpdatedAt || o.issuedAt,
      }));

    res.json({ statuses });
  });

  app.patch('/api/orders/bulk-status', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const body = req.body as Record<string, unknown>;
    const rawOrderIds = Array.isArray(body.orderIds)
      ? Array.from(
          new Set(
            body.orderIds.filter(
              (v): v is string => typeof v === 'string' && v.trim().length > 0,
            ),
          ),
        ).slice(0, 100)
      : [];

    if (rawOrderIds.length === 0) {
      res.status(400).json({ error: 'Select at least one order to update.' });
      return;
    }

    const nextStatus = body.status;
    if (nextStatus !== 'Pending' && nextStatus !== 'Shipped' && nextStatus !== 'Delivered') {
      res.status(400).json({ error: 'Order status must be Pending, Shipped, or Delivered.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedReceipts: VirtualReceiptRecord[] = [];
    const smsNotifications: SmsNotificationRecord[] = [];
    const missingOrderIds: string[] = [];

    for (const orderId of rawOrderIds) {
      const index = store.orders.findIndex((o) => o.id === orderId);
      if (index === -1) {
        missingOrderIds.push(orderId);
        continue;
      }

      const existingOrder = store.orders[index];
      const nextStage = normalizeTrackingStageServer(undefined, nextStatus);
      store.orders[index] = applyTrackingUpdateToOrder(existingOrder, {
        trackingStage: nextStage,
        updatedBy: adminUser.name,
        nowIso,
      });
      updatedReceipts.push(store.orders[index]);

      if (body.skipSms !== true) {
        const smsNotification = await appendOrderSmsNotification(
          store,
          store.orders[index],
          'order_status',
          nextStatus,
          adminUser.name,
        );
        if (smsNotification) {
          smsNotifications.push(smsNotification);
        }
      }
    }

    if (updatedReceipts.length === 0) {
      res.status(404).json({ error: 'No matching orders were found.' });
      return;
    }

    writeStore(store);
    updatedReceipts.forEach((receipt) => broadcastOrderUpdate(receipt));

    res.json({
      updatedReceipts,
      smsNotifications,
      missingOrderIds,
      updatedCount: updatedReceipts.length,
      smsSentCount: smsNotifications.length,
    });
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const nextStatus = body.status;
    if (nextStatus !== 'Pending' && nextStatus !== 'Shipped' && nextStatus !== 'Delivered') {
      res.status(400).json({ error: 'Order status must be Pending, Shipped, or Delivered.' });
      return;
    }

    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existingOrder = store.orders[index];
    const nowIso = new Date().toISOString();
    const nextStage = normalizeTrackingStageServer(undefined, nextStatus);
    store.orders[index] = applyTrackingUpdateToOrder(existingOrder, {
      trackingStage: nextStage,
      updatedBy: adminUser.name,
      nowIso,
    });

    const smsNotification =
      body.skipSms === true
        ? null
        : await appendOrderSmsNotification(
            store,
            store.orders[index],
            'order_status',
            nextStatus,
            adminUser.name,
          );

    writeStore(store);
    broadcastOrderUpdate(store.orders[index]);

    res.json({ receipt: store.orders[index], smsNotification });
  });

  app.get('/api/orders/:id/tracking', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Sign in to track your order.' });
      return;
    }
    const { user, session } = auth;
    const { id } = req.params;
    const order = store.orders.find((o) => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const isAdmin = isAuthorizedAdminUser(user) && Boolean(session.adminVerified);
    const userPhone = normalizePhone(user.phone);
    const userEmail = user.email.toLowerCase();
    const isOwner =
      (Boolean(order.userId) && order.userId === user.id) ||
      normalizePhone(order.customerPhone) === userPhone ||
      (Boolean(order.customerEmail) && order.customerEmail!.toLowerCase() === userEmail);

    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to view tracking for this order.' });
      return;
    }

    const enrichedOrder: VirtualReceiptRecord = {
      ...order,
      trackingStage: normalizeTrackingStageServer(order.trackingStage, order.status),
      trackingEvents:
        Array.isArray(order.trackingEvents) && order.trackingEvents.length > 0
          ? order.trackingEvents
          : buildInitialTrackingEvents(order),
    };

    res.json({ receipt: enrichedOrder, serverTime: new Date().toISOString() });
  });

  app.patch('/api/orders/:id/tracking', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const rawStage = body.trackingStage;
    if (
      rawStage !== 'processing' &&
      rawStage !== 'dispatched' &&
      rawStage !== 'out_for_delivery' &&
      rawStage !== 'delivered'
    ) {
      res.status(400).json({
        error: 'Tracking stage must be processing, dispatched, out_for_delivery, or delivered.',
      });
      return;
    }

    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existingOrder = store.orders[index];
    const nowIso = new Date().toISOString();
    const updatedOrder = applyTrackingUpdateToOrder(existingOrder, {
      trackingStage: rawStage,
      trackingLocation:
        typeof body.trackingLocation === 'string' ? body.trackingLocation : undefined,
      trackingNote: typeof body.trackingNote === 'string' ? body.trackingNote : undefined,
      riderName: typeof body.riderName === 'string' ? body.riderName : undefined,
      riderPhone: typeof body.riderPhone === 'string' ? body.riderPhone : undefined,
      riderPlateNumber:
        typeof body.riderPlateNumber === 'string' ? body.riderPlateNumber : undefined,
      riderPhotoUrl: typeof body.riderPhotoUrl === 'string' ? body.riderPhotoUrl : undefined,
      riderLiveLocationUrl:
        typeof body.riderLiveLocationUrl === 'string' ? body.riderLiveLocationUrl : undefined,
      updatedBy: adminUser.name,
      nowIso,
    });
    store.orders[index] = updatedOrder;

    const statusChanged = existingOrder.status !== updatedOrder.status;
    const trackingChanged = existingOrder.trackingStage !== updatedOrder.trackingStage;
    const smsNotification =
      body.skipSms === true || (!statusChanged && !trackingChanged)
        ? null
        : await appendOrderSmsNotification(
            store,
            updatedOrder,
            'order_status',
            updatedOrder.status,
            adminUser.name,
          );

    writeStore(store);
    broadcastOrderUpdate(updatedOrder);

    res.json({ receipt: updatedOrder, smsNotification });
  });

  app.patch('/api/orders/:id/fitting-status', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const nextFittingStatus = body.fittingStatus;
    if (
      nextFittingStatus !== 'Scheduled' &&
      nextFittingStatus !== 'In Bay' &&
      nextFittingStatus !== 'Completed' &&
      nextFittingStatus !== 'Cancelled'
    ) {
      res.status(400).json({
        error: 'Fitting status must be Scheduled, In Bay, Completed, or Cancelled.',
      });
      return;
    }

    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existingOrder = store.orders[index];
    if (existingOrder.deliveryRegion !== 'garage_fitting') {
      res.status(400).json({
        error: 'Only in-garage fitting appointments have a garage bay status.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    store.orders[index] = {
      ...existingOrder,
      fittingStatus: nextFittingStatus,
      statusUpdatedAt: nowIso,
      ...(nextFittingStatus === 'Completed'
        ? {
            saleConfirmed: true,
            confirmedAt: existingOrder.confirmedAt || nowIso,
          }
        : {}),
    };

    const smsNotification =
      body.skipSms === true
        ? null
        : await appendFittingStatusSmsNotification(
            store,
            store.orders[index],
            nextFittingStatus,
            adminUser.name,
          );

    writeStore(store);

    res.json({ receipt: store.orders[index], smsNotification });
  });

  app.patch('/api/orders/:id/confirm', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existingOrder = store.orders[index];
    const nowIso = new Date().toISOString();
    store.orders[index] = {
      ...existingOrder,
      saleConfirmed: true,
      confirmedAt: existingOrder.confirmedAt || nowIso,
    };
    writeStore(store);

    res.json({ receipt: store.orders[index] });
  });

  app.patch('/api/orders/:id/release-referral-credit', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const { id } = req.params;
    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existingOrder = store.orders[index];
    if (!existingOrder.referralCodeUsed) {
      res.status(400).json({ error: 'This order does not have a mechanic referral code.' });
      return;
    }
    if (existingOrder.referralCreditStatus === 'credited') {
      res.status(409).json({ error: 'Referral credit for this order has already been released.' });
      return;
    }

    const refPartner = store.partners.find(
      (p) =>
        (existingOrder.referralPartnerId && p.id === existingOrder.referralPartnerId) ||
        p.referralCode.toUpperCase() === existingOrder.referralCodeUsed!.toUpperCase(),
    );
    if (!refPartner) {
      res.status(404).json({ error: 'Referring mechanic/garage partner account not found.' });
      return;
    }

    const creditPct = existingOrder.referralCreditPercent ?? REFERRAL_MECHANIC_CREDIT_PCT;
    const creditAmount =
      existingOrder.referralCreditAmount ?? Math.round((existingOrder.total * creditPct) / 100);
    const nowIso = new Date().toISOString();

    store.orders[index] = {
      ...existingOrder,
      referralPartnerId: refPartner.id,
      referralPartnerName: refPartner.businessName,
      referralCreditPercent: creditPct,
      referralCreditAmount: creditAmount,
      referralCreditStatus: 'credited',
      referralFittedTestedAt: nowIso,
      saleConfirmed: true,
      confirmedAt: existingOrder.confirmedAt || nowIso,
    };

    refPartner.referralCreditPending = Math.max(
      0,
      (refPartner.referralCreditPending || 0) - creditAmount,
    );
    refPartner.referralCreditBalance = (refPartner.referralCreditBalance || 0) + creditAmount;

    const smsNotification = await appendReferralCreditReleasedSmsNotification(
      store,
      refPartner,
      store.orders[index],
      creditAmount,
      adminUser.name,
    );

    writeStore(store);

    res.json({
      receipt: store.orders[index],
      partner: refPartner,
      smsNotification,
    });
  });

  app.get('/api/delivery/estimate', async (req, res) => {
    const destination =
      typeof req.query.destination === 'string' ? req.query.destination.trim() : '';
    const quote = await resolveNairobiDeliveryAsync(destination);
    res.json({
      destination,
      origin: SHOP_ORIGIN_COORDS_SERVER,
      ratePer10Km: NAIROBI_DELIVERY_RATE_PER_10KM,
      ...quote,
    });
  });

  app.get('/api/admin/pickup-lookup', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!code) {
      res.status(400).json({ error: 'Please enter a counter pickup code (e.g. PKP-XXXXXX).' });
      return;
    }

    const match = store.orders.find(
      (o) =>
        o.deliveryRegion === 'pickup' &&
        (o.pickupCode?.toUpperCase() === code || o.receiptNumber.toUpperCase() === code),
    );
    if (!match) {
      res.status(404).json({
        error: `No counter pickup reservation found for code "${code}". Verify the code and try again.`,
      });
      return;
    }

    res.json({ receipt: match });
  });

  app.post('/api/admin/orders/:id/claim-pickup', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const { id } = req.params;
    const index = store.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const order = store.orders[index];
    if (order.deliveryRegion !== 'pickup') {
      res.status(400).json({ error: 'Only Counter Pickup orders can be claimed with a pickup code.' });
      return;
    }
    if (order.pickupStatus === 'expired_restocked') {
      res.status(400).json({
        error: 'This 24-hour counter pickup reservation has expired and the parts were returned to stock.',
      });
      return;
    }
    if (order.pickupStatus === 'claimed') {
      res.json({ receipt: order, alreadyClaimed: true });
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedPickupOrder = applyTrackingUpdateToOrder(
      {
        ...order,
        pickupStatus: 'claimed',
        pickupClaimedAt: nowIso,
      },
      {
        trackingStage: 'delivered',
        trackingLocation: 'Seventies Plaza, Kirinyaga Rd Counter',
        trackingNote: `Counter pickup ${order.pickupCode || ''} claimed in person.`,
        updatedBy: adminUser.name,
        nowIso,
      },
    );
    store.orders[index] = updatedPickupOrder;

    const body = (req.body || {}) as Record<string, unknown>;
    const smsNotification =
      body.skipSms === true
        ? null
        : await appendOrderSmsNotification(
            store,
            store.orders[index],
            'order_status',
            'Delivered',
            adminUser.name,
          );

    writeStore(store);
    broadcastOrderUpdate(store.orders[index]);
    res.json({ receipt: store.orders[index], smsNotification });
  });

  app.get('/api/orders', (req, res) => {
    const store = readStore();
    const auth = getAuthSessionAndUser(req, store);
    if (!auth) {
      res.status(401).json({ error: 'Sign in to view your orders.' });
      return;
    }
    const { user, session } = auth;
    const scope = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
    if (isAuthorizedAdminUser(user) && Boolean(session.adminVerified) && scope !== 'mine') {
      res.json({ orders: store.orders });
      return;
    }
    const userPhone = normalizePhone(user.phone);
    const userEmail = user.email.toLowerCase();
    const myOrders = store.orders.filter((o) => {
      if (o.userId) {
        return o.userId === user.id;
      }
      return (
        normalizePhone(o.customerPhone) === userPhone ||
        (Boolean(o.customerEmail) && o.customerEmail!.toLowerCase() === userEmail)
      );
    });
    res.json({ orders: myOrders });
  });

  const formatLocalDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getOrderLocalDateKey = (iso: string): string => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatLocalDateKey(parsed);
  };

  const isOrderSaleConfirmed = (order: VirtualReceiptRecord): boolean =>
    Boolean(order.saleConfirmed) || order.status === 'Shipped' || order.status === 'Delivered';

  const aggregateOrderSlice = (orders: VirtualReceiptRecord[]) => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let confirmedOrders = 0;
    let totalUnitsSold = 0;
    const partSales = new Map<
      string,
      { partId: string; name: string; sku: string; category: string; unitsSold: number; revenue: number }
    >();
    const paymentBreakdown = new Map<string, { method: string; ordersCount: number; revenue: number }>();

    for (const order of orders) {
      const orderUnits = order.items.reduce((sum, i) => sum + i.quantity, 0);
      totalOrders += 1;
      if (isOrderSaleConfirmed(order)) confirmedOrders += 1;
      totalRevenue += order.total;
      totalUnitsSold += orderUnits;

      const methodKey = order.paymentMethod || 'Unspecified';
      const existingMethod = paymentBreakdown.get(methodKey);
      if (existingMethod) {
        existingMethod.ordersCount += 1;
        existingMethod.revenue += order.total;
      } else {
        paymentBreakdown.set(methodKey, {
          method: methodKey,
          ordersCount: 1,
          revenue: order.total,
        });
      }

      for (const item of order.items) {
        const existingPart = partSales.get(item.partId);
        if (existingPart) {
          existingPart.unitsSold += item.quantity;
          existingPart.revenue += item.lineTotal;
        } else {
          partSales.set(item.partId, {
            partId: item.partId,
            name: item.name,
            sku: item.sku,
            category: item.category,
            unitsSold: item.quantity,
            revenue: item.lineTotal,
          });
        }
      }
    }

    const topSellingParts = Array.from(partSales.values())
      .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
      .slice(0, 10);

    const paymentMethods = Array.from(paymentBreakdown.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    const sales = [...orders]
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .map((order) => ({
        id: order.id,
        receiptNumber: order.receiptNumber,
        issuedAt: order.issuedAt,
        saleDate: getOrderLocalDateKey(order.issuedAt),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        paymentMethod: order.paymentMethod,
        status: order.status || 'Pending',
        saleConfirmed: isOrderSaleConfirmed(order),
        confirmedAt:
          order.confirmedAt ||
          (order.status === 'Shipped' || order.status === 'Delivered'
            ? order.statusUpdatedAt || order.issuedAt
            : undefined),
        unitsCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        itemsSummary: order.items.map((i) => `${i.name} ×${i.quantity}`).join(', '),
        total: order.total,
      }));

    return {
      summary: {
        totalRevenue,
        totalOrders,
        confirmedOrders,
        totalUnitsSold,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      },
      topSellingParts,
      paymentMethods,
      sales,
    };
  };

  const buildCompiledSalesReport = (
    allOrders: VirtualReceiptRecord[],
    params: {
      period: 'weekly' | 'monthly' | 'yearly';
      weekEnd?: string;
      month?: string;
      year?: string;
      confirmedOnly?: boolean;
    },
  ) => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYearKey = String(now.getFullYear());

    const monthSet = new Set<string>([currentMonthKey]);
    const yearSet = new Set<string>([currentYearKey]);
    for (const o of allOrders) {
      const dk = getOrderLocalDateKey(o.issuedAt);
      if (dk) {
        monthSet.add(dk.slice(0, 7));
        yearSet.add(dk.slice(0, 4));
      }
    }
    const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

    const scopedOrders = params.confirmedOnly
      ? allOrders.filter(isOrderSaleConfirmed)
      : allOrders;

    // Trailing 7-day rollup for current week summary
    const todayAnchor = new Date(now);
    todayAnchor.setHours(0, 0, 0, 0);
    const currentWeekKeys = new Set<string>();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(todayAnchor);
      d.setDate(d.getDate() - offset);
      currentWeekKeys.add(formatLocalDateKey(d));
    }
    const currentWeekOrders = scopedOrders.filter((o) =>
      currentWeekKeys.has(getOrderLocalDateKey(o.issuedAt)),
    );
    const currentMonthOrders = scopedOrders.filter(
      (o) => getOrderLocalDateKey(o.issuedAt).slice(0, 7) === currentMonthKey,
    );
    const currentYearOrders = scopedOrders.filter(
      (o) => getOrderLocalDateKey(o.issuedAt).slice(0, 4) === currentYearKey,
    );

    const summarizeQuick = (slice: VirtualReceiptRecord[]) => ({
      totalRevenue: slice.reduce((s, o) => s + o.total, 0),
      totalOrders: slice.length,
      confirmedOrders: slice.filter(isOrderSaleConfirmed).length,
      totalUnitsSold: slice.reduce(
        (s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0),
        0,
      ),
    });

    const rollupTotals = {
      weekly: summarizeQuick(currentWeekOrders),
      monthly: { ...summarizeQuick(currentMonthOrders), key: currentMonthKey },
      yearly: { ...summarizeQuick(currentYearOrders), key: currentYearKey },
    };

    const dailyTrend30Days: Array<{
      dateKey: string;
      dayLabel: string;
      ordersCount: number;
      confirmedOrdersCount: number;
      unitsSold: number;
      revenue: number;
    }> = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const d = new Date(todayAnchor);
      d.setDate(d.getDate() - offset);
      const dateKey = formatLocalDateKey(d);
      dailyTrend30Days.push({
        dateKey,
        dayLabel: d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
        ordersCount: 0,
        confirmedOrdersCount: 0,
        unitsSold: 0,
        revenue: 0,
      });
    }
    const trend30Map = new Map(dailyTrend30Days.map((entry) => [entry.dateKey, entry]));
    for (const order of scopedOrders) {
      const dk = getOrderLocalDateKey(order.issuedAt);
      const bucket = trend30Map.get(dk);
      if (bucket) {
        bucket.ordersCount += 1;
        if (isOrderSaleConfirmed(order)) bucket.confirmedOrdersCount += 1;
        bucket.unitsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
        bucket.revenue += order.total;
      }
    }

    if (params.period === 'monthly') {
      const targetMonth = /^\d{4}-\d{2}$/.test(params.month || '')
        ? (params.month as string)
        : currentMonthKey;
      const [yStr, mStr] = targetMonth.split('-');
      const yearNum = Number(yStr);
      const monthNum = Number(mStr);
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const monthOrders = scopedOrders.filter(
        (o) => getOrderLocalDateKey(o.issuedAt).slice(0, 7) === targetMonth,
      );

      const weekRanges: Array<{ startDay: number; endDay: number; weekIndex: number }> = [];
      for (let start = 1, idx = 1; start <= daysInMonth; start += 7, idx += 1) {
        weekRanges.push({
          weekIndex: idx,
          startDay: start,
          endDay: Math.min(daysInMonth, start + 6),
        });
      }

      const breakdown = weekRanges.map((wr) => {
        const startDate = new Date(yearNum, monthNum - 1, wr.startDay);
        const endDate = new Date(yearNum, monthNum - 1, wr.endDay);
        const startKey = formatLocalDateKey(startDate);
        const endKey = formatLocalDateKey(endDate);
        const weekSlice = monthOrders.filter((o) => {
          const dk = getOrderLocalDateKey(o.issuedAt);
          return dk >= startKey && dk <= endKey;
        });
        const labelStart = startDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
        const labelEnd = endDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
        return {
          key: `${targetMonth}-W${wr.weekIndex}`,
          label: `Week ${wr.weekIndex}`,
          subLabel: `${labelStart} – ${labelEnd}, ${yearNum}`,
          drillPeriod: 'weekly' as const,
          drillValue: endKey,
          ordersCount: weekSlice.length,
          confirmedOrdersCount: weekSlice.filter(isOrderSaleConfirmed).length,
          unitsSold: weekSlice.reduce(
            (s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0),
            0,
          ),
          revenue: weekSlice.reduce((s, o) => s + o.total, 0),
        };
      });

      const aggregated = aggregateOrderSlice(monthOrders);
      const monthStart = `${targetMonth}-01`;
      const monthEnd = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;
      const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleDateString('en-KE', {
        month: 'long',
        year: 'numeric',
      });

      return {
        period: 'monthly' as const,
        periodLabel: monthLabel,
        periodStart: monthStart,
        periodEnd: monthEnd,
        selectedMonth: targetMonth,
        selectedYear: String(yearNum),
        availableMonths,
        availableYears,
        rollupTotals,
        dailyTrend30Days,
        breakdown,
        dailyBreakdown: breakdown.map((b) => ({
          dateKey: b.key,
          dayLabel: b.label,
          ordersCount: b.ordersCount,
          unitsSold: b.unitsSold,
          revenue: b.revenue,
        })),
        ...aggregated,
      };
    }

    if (params.period === 'yearly') {
      const targetYear = /^\d{4}$/.test(params.year || '')
        ? (params.year as string)
        : currentYearKey;
      const yearNum = Number(targetYear);
      const yearOrders = scopedOrders.filter(
        (o) => getOrderLocalDateKey(o.issuedAt).slice(0, 4) === targetYear,
      );

      const breakdown = Array.from({ length: 12 }, (_, idx) => {
        const monthKey = `${targetYear}-${String(idx + 1).padStart(2, '0')}`;
        const monthSlice = yearOrders.filter(
          (o) => getOrderLocalDateKey(o.issuedAt).slice(0, 7) === monthKey,
        );
        const monthDate = new Date(yearNum, idx, 1);
        const monthName = monthDate.toLocaleDateString('en-KE', { month: 'long' });
        return {
          key: monthKey,
          label: monthName,
          subLabel: `${monthKey} (Weekly rollup)`,
          drillPeriod: 'monthly' as const,
          drillValue: monthKey,
          ordersCount: monthSlice.length,
          confirmedOrdersCount: monthSlice.filter(isOrderSaleConfirmed).length,
          unitsSold: monthSlice.reduce(
            (s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0),
            0,
          ),
          revenue: monthSlice.reduce((s, o) => s + o.total, 0),
        };
      });

      const aggregated = aggregateOrderSlice(yearOrders);
      return {
        period: 'yearly' as const,
        periodLabel: `Year ${targetYear}`,
        periodStart: `${targetYear}-01-01`,
        periodEnd: `${targetYear}-12-31`,
        selectedMonth: `${targetYear}-01`,
        selectedYear: targetYear,
        availableMonths,
        availableYears,
        rollupTotals,
        dailyTrend30Days,
        breakdown,
        dailyBreakdown: breakdown.map((b) => ({
          dateKey: b.key,
          dayLabel: b.label,
          ordersCount: b.ordersCount,
          unitsSold: b.unitsSold,
          revenue: b.revenue,
        })),
        ...aggregated,
      };
    }

    // Weekly report (7-day window ending on weekEnd or today)
    const endAnchor = /^\d{4}-\d{2}-\d{2}$/.test(params.weekEnd || '')
      ? new Date(`${params.weekEnd}T00:00:00`)
      : new Date(todayAnchor);
    if (Number.isNaN(endAnchor.getTime())) {
      endAnchor.setTime(todayAnchor.getTime());
    }
    endAnchor.setHours(0, 0, 0, 0);

    const dayBuckets: Array<{
      dateKey: string;
      dayLabel: string;
      ordersCount: number;
      confirmedOrdersCount: number;
      unitsSold: number;
      revenue: number;
    }> = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(endAnchor);
      d.setDate(d.getDate() - offset);
      const dateKey = formatLocalDateKey(d);
      const dayLabel = d.toLocaleDateString('en-KE', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      dayBuckets.push({
        dateKey,
        dayLabel,
        ordersCount: 0,
        confirmedOrdersCount: 0,
        unitsSold: 0,
        revenue: 0,
      });
    }

    const dayMap = new Map(dayBuckets.map((b) => [b.dateKey, b]));
    const weekStartKey = dayBuckets[0].dateKey;
    const weekEndKey = dayBuckets[dayBuckets.length - 1].dateKey;

    const weekOrders = scopedOrders.filter((order) => {
      const dk = getOrderLocalDateKey(order.issuedAt);
      return dk >= weekStartKey && dk <= weekEndKey;
    });

    for (const order of weekOrders) {
      const dk = getOrderLocalDateKey(order.issuedAt);
      const bucket = dayMap.get(dk);
      if (bucket) {
        bucket.ordersCount += 1;
        if (isOrderSaleConfirmed(order)) bucket.confirmedOrdersCount += 1;
        bucket.unitsSold += order.items.reduce((sum, i) => sum + i.quantity, 0);
        bucket.revenue += order.total;
      }
    }

    const aggregated = aggregateOrderSlice(weekOrders);
    return {
      period: 'weekly' as const,
      periodLabel: `${weekStartKey} to ${weekEndKey}`,
      periodStart: weekStartKey,
      periodEnd: weekEndKey,
      selectedMonth: weekEndKey.slice(0, 7),
      selectedYear: weekEndKey.slice(0, 4),
      availableMonths,
      availableYears,
      rollupTotals,
      dailyTrend30Days,
      breakdown: dayBuckets.map((b) => ({
        key: b.dateKey,
        label: b.dayLabel,
        subLabel: b.dateKey,
        ordersCount: b.ordersCount,
        confirmedOrdersCount: b.confirmedOrdersCount,
        unitsSold: b.unitsSold,
        revenue: b.revenue,
      })),
      dailyBreakdown: dayBuckets,
      ...aggregated,
    };
  };

  app.get('/api/admin/sales-report', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const rawPeriod = typeof req.query.period === 'string' ? req.query.period.trim() : 'weekly';
    const period: 'weekly' | 'monthly' | 'yearly' =
      rawPeriod === 'monthly' || rawPeriod === 'yearly' ? rawPeriod : 'weekly';
    const weekEnd = typeof req.query.weekEnd === 'string' ? req.query.weekEnd.trim() : undefined;
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : undefined;
    const year = typeof req.query.year === 'string' ? req.query.year.trim() : undefined;
    const confirmedOnly = req.query.confirmedOnly === 'true';

    res.json(
      buildCompiledSalesReport(store.orders, {
        period,
        weekEnd,
        month,
        year,
        confirmedOnly,
      }),
    );
  });

  app.get('/api/admin/weekly-sales', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const confirmedOnly = req.query.confirmedOnly === 'true';
    res.json(
      buildCompiledSalesReport(store.orders, {
        period: 'weekly',
        confirmedOnly,
      }),
    );
  });

  // --- Admin Automated Order Status SMS Notifications (From Admin Number to Customer/Mechanic/Garage) ---
  app.get('/api/admin/sms', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    res.json({
      autoOrderSmsEnabled: store.smsSettings?.autoOrderSmsEnabled !== false,
      adminSenderPhone: getActiveAdminSenderPhone(store),
      logs: store.smsLogs,
    });
  });

  app.patch('/api/admin/sms/settings', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const body = req.body as Record<string, unknown>;
    const nextEnabled =
      typeof body.autoOrderSmsEnabled === 'boolean'
        ? body.autoOrderSmsEnabled
        : store.smsSettings?.autoOrderSmsEnabled !== false;

    let nextSenderPhone = getActiveAdminSenderPhone(store);
    if (typeof body.adminSenderPhone === 'string') {
      const trimmedPhone = body.adminSenderPhone.trim();
      const formatted = trimmedPhone && isValidPhone(trimmedPhone) ? formatSmsPhone(trimmedPhone) : null;
      if (!formatted) {
        res.status(400).json({
          error: 'Please enter a valid admin mobile number (e.g. 0706130014 or +254706130014).',
        });
        return;
      }
      nextSenderPhone = formatted;
    }

    store.smsSettings = {
      autoOrderSmsEnabled: nextEnabled,
      adminSenderPhone: nextSenderPhone,
    };
    writeStore(store);

    res.json({
      autoOrderSmsEnabled: store.smsSettings.autoOrderSmsEnabled,
      adminSenderPhone: getActiveAdminSenderPhone(store),
    });
  });

  app.post('/api/admin/sms/test', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const body = req.body as Record<string, unknown>;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const formattedPhone = rawPhone && isValidPhone(rawPhone) ? formatSmsPhone(rawPhone) : null;
    if (!formattedPhone) {
      res.status(400).json({
        error: 'Please enter a valid recipient mobile number (e.g. 0712345678 or +254712345678).',
      });
      return;
    }

    const rawRole = typeof body.recipientRole === 'string' ? body.recipientRole.trim() : 'Customer';
    const recipientRole: 'Customer' | 'Mechanic' | 'Garage' =
      rawRole === 'Mechanic' || rawRole === 'Garage' ? rawRole : 'Customer';
    const recipientName =
      typeof body.recipientName === 'string' ? body.recipientName.trim().slice(0, 80) : '';
    const rawStatus = body.status;
    const orderStatus: OrderStatus =
      rawStatus === 'Pending' || rawStatus === 'Shipped' || rawStatus === 'Delivered'
        ? rawStatus
        : 'Shipped';

    const receiptNumber =
      typeof body.receiptNumber === 'string' && body.receiptNumber.trim()
        ? body.receiptNumber.trim().slice(0, 40)
        : `MSZ-TEST-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;

    const customMessage =
      typeof body.customMessage === 'string' ? body.customMessage.trim().slice(0, 480) : '';
    if (customMessage && customMessage.length < 5) {
      res.status(400).json({ error: 'Custom test SMS message must be at least 5 characters.' });
      return;
    }

    const sampleReceipt: VirtualReceiptRecord = {
      id: 'test-connectivity',
      receiptNumber,
      shopName: 'My Spare Zone',
      guaranteeText: 'Original & Tested Spare Parts',
      customerCarePhone: CUSTOMER_CARE_NUMBER,
      issuedAt: new Date().toISOString(),
      status: orderStatus,
      customerName: recipientName || recipientRole,
      customerPhone: formattedPhone,
      deliveryAddress: 'Nairobi',
      deliveryRegion: 'nairobi',
      paymentMethod: 'M-Pesa Paybill',
      items: [],
      subtotal: 4500,
      total: 4500,
    };
    const activeSenderPhone = getActiveAdminSenderPhone(store);
    const message =
      customMessage || buildOrderStatusSmsText(sampleReceipt, orderStatus, activeSenderPhone);

    const targetLabel = recipientName
      ? `${recipientName} (${recipientRole} · Test)`
      : `${recipientRole} (Connectivity Test)`;

    const dispatch = await dispatchSmsBatch(
      [{ name: targetLabel, phone: formattedPhone }],
      message,
      activeSenderPhone,
    );

    const entry: SmsNotificationRecord = {
      id: `sms-${crypto.randomBytes(4).toString('hex')}`,
      type: 'order_status',
      audience: 'order',
      audienceLabel: `Connectivity Test · ${orderStatus} → ${formattedPhone}`,
      senderPhone: dispatch.senderPhone,
      message,
      recipientCount: dispatch.recipients.length,
      sentCount: dispatch.sentCount,
      failedCount: dispatch.failedCount,
      recipients: dispatch.recipients,
      createdAt: new Date().toISOString(),
      createdBy: `${adminUser.name} (Connectivity Test)`,
      isManual: true,
      orderStatusLabel: `Test · ${orderStatus}`,
      receiptNumber,
      deliveryChannel: 'admin_direct',
    };

    store.smsLogs.unshift(entry);
    if (store.smsLogs.length > 200) {
      store.smsLogs = store.smsLogs.slice(0, 200);
    }
    writeStore(store);

    res.status(201).json({
      entry,
      adminSenderPhone: dispatch.senderPhone,
    });
  });

  app.post('/api/admin/sms/manual', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const body = req.body as Record<string, unknown>;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const formattedPhone = rawPhone && isValidPhone(rawPhone) ? formatSmsPhone(rawPhone) : null;
    if (!formattedPhone) {
      res.status(400).json({
        error: 'Please enter a valid recipient mobile number (e.g. 0712345678 or +254712345678).',
      });
      return;
    }

    const rawRole = typeof body.recipientRole === 'string' ? body.recipientRole.trim() : 'Customer';
    const recipientRole: 'Customer' | 'Mechanic' | 'Garage' =
      rawRole === 'Mechanic' || rawRole === 'Garage' ? rawRole : 'Customer';
    const recipientName =
      typeof body.recipientName === 'string' ? body.recipientName.trim().slice(0, 80) : '';
    const statusLabelRaw =
      typeof body.statusLabel === 'string' ? body.statusLabel.trim().slice(0, 40) : '';
    const statusLabel = statusLabelRaw || 'Custom';
    const receiptNumber =
      typeof body.receiptNumber === 'string' ? body.receiptNumber.trim().slice(0, 40) : '';
    const deliveryChannel: 'admin_direct' | 'phone_sms_app' =
      body.deliveryChannel === 'phone_sms_app' ? 'phone_sms_app' : 'admin_direct';

    const messageInput =
      typeof body.message === 'string' ? body.message.trim().slice(0, 480) : '';

    if (!messageInput || messageInput.length < 5) {
      res.status(400).json({
        error: 'Manual SMS message content must be at least 5 characters.',
      });
      return;
    }

    const targetLabel = recipientName
      ? `${recipientName} (${recipientRole})`
      : recipientRole;

    const dispatch = await dispatchSmsBatch(
      [{ name: targetLabel, phone: formattedPhone }],
      messageInput,
      getActiveAdminSenderPhone(store),
    );

    const refPart = receiptNumber ? ` · ${receiptNumber}` : '';
    const entry: SmsNotificationRecord = {
      id: `sms-${crypto.randomBytes(4).toString('hex')}`,
      type: 'manual_status',
      audience: recipientRole === 'Customer' || Boolean(receiptNumber) ? 'order' : 'partner',
      audienceLabel: `Manual ${statusLabel}${refPart} → ${formattedPhone}`,
      senderPhone: dispatch.senderPhone,
      message: messageInput,
      recipientCount: dispatch.recipients.length,
      sentCount: dispatch.sentCount,
      failedCount: dispatch.failedCount,
      recipients: dispatch.recipients,
      createdAt: new Date().toISOString(),
      createdBy:
        deliveryChannel === 'phone_sms_app'
          ? `${adminUser.name} (Phone SMS App)`
          : adminUser.name,
      isManual: true,
      orderStatusLabel: statusLabel,
      ...(receiptNumber ? { receiptNumber } : {}),
      deliveryChannel,
    };

    store.smsLogs.unshift(entry);
    if (store.smsLogs.length > 200) {
      store.smsLogs = store.smsLogs.slice(0, 200);
    }
    writeStore(store);

    res.status(201).json({
      entry,
      adminSenderPhone: dispatch.senderPhone,
    });
  });

  app.delete('/api/admin/sms/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const nextLogs = store.smsLogs.filter((entry) => entry.id !== id);
    if (nextLogs.length === store.smsLogs.length) {
      res.status(404).json({ error: 'SMS dispatch record not found.' });
      return;
    }
    store.smsLogs = nextLogs;
    writeStore(store);
    res.json({ deleted: true, id });
  });

  app.delete('/api/admin/sms', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    store.smsLogs = [];
    writeStore(store);
    res.json({ cleared: true });
  });

  // --- Admin-only Clean Source Code Archive (.zip) ---
  const computeCrc32 = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return (buf: Buffer): number => {
      let crc = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
  })();

  const buildCleanSourceZipBuffer = (rootDir: string): Buffer => {
    const excludedDirs = new Set([
      'node_modules',
      'dist',
      'dev-dist',
      '.git',
      '.aistudio',
      'data',
      '.gradle',
    ]);
    const excludedFiles = new Set(['server.js', '.DS_Store', 'Thumbs.db']);
    const files: Array<{ relPath: string; content: Buffer; mtime: Date }> = [];

    const walk = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
        if (entry.isDirectory()) {
          if (excludedDirs.has(entry.name) || relPath.startsWith('data/')) continue;
          walk(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        if (excludedFiles.has(entry.name)) continue;
        if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
        if (/\.(zip|tar|gz|aab|apk|keystore|jks)$/i.test(entry.name)) continue;
        const stat = fs.statSync(fullPath);
        if (stat.size > 25 * 1024 * 1024) continue;
        files.push({
          relPath: `my-spare-zone-source/${relPath}`,
          content: fs.readFileSync(fullPath),
          mtime: stat.mtime,
        });
      }
    };

    walk(rootDir);

    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBuf = Buffer.from(file.relPath, 'utf8');
      const crc = computeCrc32(file.content);
      const compressed = zlib.deflateRawSync(file.content);
      const useDeflate = compressed.length < file.content.length;
      const payload = useDeflate ? compressed : file.content;
      const method = useDeflate ? 8 : 0;

      const d = file.mtime;
      const dosTime =
        ((d.getHours() & 0x1f) << 11) |
        ((d.getMinutes() & 0x3f) << 5) |
        ((d.getSeconds() >> 1) & 0x1f);
      const dosDate =
        (((Math.max(1980, d.getFullYear()) - 1980) & 0x7f) << 9) |
        (((d.getMonth() + 1) & 0x0f) << 5) |
        (d.getDate() & 0x1f);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(method, 8);
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(payload.length, 18);
      localHeader.writeUInt32LE(file.content.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localChunks.push(localHeader, nameBuf, payload);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(method, 10);
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(payload.length, 20);
      centralHeader.writeUInt32LE(file.content.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      centralChunks.push(centralHeader, nameBuf);
      offset += localHeader.length + nameBuf.length + payload.length;
    }

    const centralDirBuf = Buffer.concat(centralChunks);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralDirBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localChunks, centralDirBuf, eocd]);
  };

  app.get('/api/admin/export-source', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    try {
      const zipBuffer = buildCleanSourceZipBuffer(__dirname);
      const dateStamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="my-spare-zone-source-${dateStamp}.zip"`,
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to build source archive.';
      res.status(500).json({ error: msg });
    }
  });

  // --- Admin-only Spare Part Sourcing, Client Handler & Mechanic Fitting Log ---
  app.get('/api/admin/part-sourcing', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    res.json({ logs: store.partSourcingLogs });
  });

  app.post('/api/admin/part-sourcing', (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const body = req.body as Record<string, unknown>;
    const rawDate = typeof body.date === 'string' ? body.date.trim() : '';
    const date = isValidDateStrServer(rawDate) ? rawDate : getNairobiNowParts().dateStr;
    const partName =
      typeof body.partName === 'string' ? body.partName.trim().slice(0, 180) : '';
    const category =
      typeof body.category === 'string' ? body.category.trim().slice(0, 80) : '';
    const sku = typeof body.sku === 'string' ? body.sku.trim().slice(0, 60) : '';
    const receiptNumber =
      typeof body.receiptNumber === 'string' ? body.receiptNumber.trim().slice(0, 60) : '';
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    const sourceType: PartSourceType =
      body.sourceType === 'outside_shop' ? 'outside_shop' : 'in_store';
    const sourceShopName =
      sourceType === 'outside_shop' && typeof body.sourceShopName === 'string'
        ? body.sourceShopName.trim().slice(0, 140)
        : '';
    const clientName =
      typeof body.clientName === 'string' ? body.clientName.trim().slice(0, 140) : '';
    const handledBy =
      typeof body.handledBy === 'string'
        ? body.handledBy.trim().slice(0, 120)
        : adminUser.name;
    const fittedByOurMechanic = body.fittedByOurMechanic === true;
    const mechanicName =
      fittedByOurMechanic && typeof body.mechanicName === 'string'
        ? body.mechanicName.trim().slice(0, 120)
        : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 240) : '';

    const nowIso = new Date().toISOString();
    const entry: PartSourcingLogRecord = {
      id: `pslog-${crypto.randomBytes(4).toString('hex')}`,
      date,
      ...(receiptNumber ? { receiptNumber } : {}),
      partName,
      ...(category ? { category } : {}),
      ...(sku ? { sku } : {}),
      quantity,
      sourceType,
      ...(sourceShopName ? { sourceShopName } : {}),
      ...(clientName ? { clientName } : {}),
      handledBy,
      fittedByOurMechanic,
      ...(mechanicName ? { mechanicName } : {}),
      ...(notes ? { notes } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.partSourcingLogs.unshift(entry);
    writeStore(store);

    res.status(201).json({ entry });
  });

  app.post('/api/admin/part-sourcing/sync-orders', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const existingKeys = new Set(
      store.partSourcingLogs.map((l) => l.orderPartKey).filter(Boolean),
    );
    let addedCount = 0;

    for (let i = store.orders.length - 1; i >= 0; i--) {
      const order = store.orders[i];
      const orderDate = getNairobiNowParts(new Date(order.issuedAt || Date.now())).dateStr;
      for (const item of order.items) {
        const orderPartKey = `${order.id}:${item.partId}`;
        if (existingKeys.has(orderPartKey)) continue;
        existingKeys.add(orderPartKey);
        const nowIso = new Date().toISOString();
        store.partSourcingLogs.unshift({
          id: `pslog-${crypto.randomBytes(4).toString('hex')}`,
          date: orderDate,
          receiptNumber: order.receiptNumber,
          orderId: order.id,
          orderPartKey,
          partName: item.name,
          category: item.category || undefined,
          sku: item.sku,
          quantity: item.quantity,
          sourceType: 'in_store',
          clientName: order.vehicleDetails
            ? `${order.customerName} (${order.vehicleDetails})`
            : order.customerName,
          handledBy: '',
          fittedByOurMechanic: order.deliveryRegion === 'garage_fitting',
          mechanicName: '',
          notes:
            order.deliveryRegion === 'garage_fitting' && order.fittingSlotLabel
              ? `Garage slot: ${order.fittingDate} ${order.fittingSlotLabel}`
              : undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      writeStore(store);
    }

    res.json({ addedCount, logs: store.partSourcingLogs });
  });

  app.patch('/api/admin/part-sourcing/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const index = store.partSourcingLogs.findIndex((entry) => entry.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Sourcing & fitting log entry not found.' });
      return;
    }

    const existing = store.partSourcingLogs[index];
    const body = req.body as Record<string, unknown>;

    const nextDate =
      typeof body.date === 'string' && isValidDateStrServer(body.date.trim())
        ? body.date.trim()
        : existing.date;
    const nextPartName =
      typeof body.partName === 'string'
        ? body.partName.trim().slice(0, 180)
        : existing.partName;
    const nextCategory =
      typeof body.category === 'string'
        ? body.category.trim().slice(0, 80) || undefined
        : existing.category;
    const nextSku =
      typeof body.sku === 'string' ? body.sku.trim().slice(0, 60) : existing.sku;
    const nextReceiptNumber =
      typeof body.receiptNumber === 'string'
        ? body.receiptNumber.trim().slice(0, 60)
        : existing.receiptNumber;
    const nextQuantity =
      body.quantity !== undefined
        ? Math.max(1, Math.floor(Number(body.quantity) || 1))
        : existing.quantity;
    const nextSourceType: PartSourceType =
      body.sourceType === 'outside_shop'
        ? 'outside_shop'
        : body.sourceType === 'in_store'
          ? 'in_store'
          : existing.sourceType;
    const nextSourceShopName =
      nextSourceType === 'in_store'
        ? undefined
        : typeof body.sourceShopName === 'string'
          ? body.sourceShopName.trim().slice(0, 140) || undefined
          : existing.sourceShopName;
    const nextClientName =
      typeof body.clientName === 'string'
        ? body.clientName.trim().slice(0, 140) || undefined
        : existing.clientName;
    const nextHandledBy =
      typeof body.handledBy === 'string'
        ? body.handledBy.trim().slice(0, 120)
        : existing.handledBy;
    const nextFittedByOurMechanic =
      typeof body.fittedByOurMechanic === 'boolean'
        ? body.fittedByOurMechanic
        : existing.fittedByOurMechanic;
    const nextMechanicName = !nextFittedByOurMechanic
      ? undefined
      : typeof body.mechanicName === 'string'
        ? body.mechanicName.trim().slice(0, 120) || undefined
        : existing.mechanicName;
    const nextNotes =
      typeof body.notes === 'string'
        ? body.notes.trim().slice(0, 240) || undefined
        : existing.notes;

    const updated: PartSourcingLogRecord = {
      ...existing,
      date: nextDate,
      receiptNumber: nextReceiptNumber || undefined,
      partName: nextPartName,
      category: nextCategory,
      sku: nextSku || undefined,
      quantity: nextQuantity,
      sourceType: nextSourceType,
      sourceShopName: nextSourceShopName,
      clientName: nextClientName,
      handledBy: nextHandledBy,
      fittedByOurMechanic: nextFittedByOurMechanic,
      mechanicName: nextMechanicName,
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    };

    store.partSourcingLogs[index] = updated;
    writeStore(store);

    res.json({ entry: updated });
  });

  app.delete('/api/admin/part-sourcing/:id', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const { id } = req.params;
    const nextLogs = store.partSourcingLogs.filter((entry) => entry.id !== id);
    if (nextLogs.length === store.partSourcingLogs.length) {
      res.status(404).json({ error: 'Sourcing & fitting log entry not found.' });
      return;
    }
    store.partSourcingLogs = nextLogs;
    writeStore(store);

    res.json({ deleted: true, id });
  });

  app.get('/api/chat/threads', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;
    const threads = buildThreadSummaries(store.messages);
    res.json({ threads });
  });

  app.get('/api/chat/messages', (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const store = readStore();
    const messages = sessionId
      ? store.messages.filter((m) => m.sessionId === sessionId)
      : store.messages;
    res.json({ messages });
  });

  app.post('/api/chat/messages', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const customerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim()
        : 'Customer';
    const sender = body.sender === 'support' ? 'support' : 'customer';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!sessionId || !text) {
      res.status(400).json({ error: 'Session ID and message text are required.' });
      return;
    }

    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    if (sender === 'support' && !requireAdminUser(req, res, store)) {
      return;
    }
    const resolvedCustomerName =
      sender === 'customer' && authUser && authUser.role !== 'admin' && authUser.name.trim()
        ? authUser.name.trim()
        : customerName;
    if (sender === 'customer' && authUser && authUser.role !== 'admin' && authUser.name.trim()) {
      for (const existing of store.messages) {
        if (existing.sessionId === sessionId && existing.sender === 'customer') {
          existing.customerName = authUser.name.trim();
        }
      }
    }
    const message: ChatMessageRecord = {
      id: `msg-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      customerName: resolvedCustomerName,
      sender,
      text,
      createdAt: new Date().toISOString(),
    };

    store.messages.push(message);

    // If this is the customer's very first message in this session, record an instant automated welcome acknowledgment
    let welcomeMessage: ChatMessageRecord | null = null;
    const sessionMessages = store.messages.filter((m) => m.sessionId === sessionId);
    if (sender === 'customer' && sessionMessages.length === 1) {
      welcomeMessage = {
        id: `msg-${crypto.randomBytes(4).toString('hex')}`,
        sessionId,
        customerName: 'My Spare Zone Support',
        sender: 'support',
        text: `Welcome to My Spare Zone Customer Care, ${resolvedCustomerName}. An agent has received your inquiry and will reply here shortly. For urgent fitment or order assistance, call us directly on ${CUSTOMER_CARE_NUMBER}.`,
        createdAt: new Date(Date.now() + 200).toISOString(),
      };
      store.messages.push(welcomeMessage);
    }

    writeStore(store);

    const threadSummary = buildThreadSummaries(
      store.messages.filter((m) => m.sessionId === sessionId),
    )[0];
    broadcastChatMessage(message, threadSummary);
    if (welcomeMessage) {
      broadcastChatMessage(welcomeMessage, threadSummary);
    }

    res.status(201).json({ message });
  });

  app.get('/api/bargains', (req, res) => {
    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const sessionId =
      typeof req.query.sessionId === 'string' && req.query.sessionId.trim()
        ? req.query.sessionId.trim()
        : (req.header('x-session-id') || '').trim();

    if (!authUser && sessionId.length < 12) {
      res.status(400).json({ error: 'Valid session or account credentials are required.' });
      return;
    }

    const bargains = store.bargains
      .filter((b) => {
        if (authUser && b.userId && b.userId === authUser.id) return true;
        if (sessionId.length >= 12 && b.sessionId === sessionId) return true;
        return false;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    res.json({ bargains });
  });

  app.post('/api/bargains', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();

    if (sessionId.length < 12) {
      res.status(400).json({ error: 'A valid browser session ID is required to submit a bargain.' });
      return;
    }

    const customerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim().slice(0, 80)
        : authUser?.name || '';
    const customerPhone =
      typeof body.customerPhone === 'string' && body.customerPhone.trim()
        ? body.customerPhone.trim()
        : authUser?.phone || '';
    const customerNote =
      typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0, 280) : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const offeredTotal = Math.round(Number(body.offeredTotal) || 0);

    if (!customerName || customerName.length < 2) {
      res.status(400).json({ error: 'Please enter your name so our desk can respond to your offer.' });
      return;
    }
    if (!customerPhone || !isValidPhone(customerPhone)) {
      res.status(400).json({ error: 'Please enter a valid phone number.' });
      return;
    }
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Please select at least one spare part to bargain on.' });
      return;
    }

    const aggregatedQty = new Map<string, number>();
    for (const entry of rawItems) {
      const obj = entry as Record<string, unknown>;
      const partId = typeof obj.partId === 'string' ? obj.partId.trim() : '';
      const qty = Math.max(1, Math.floor(Number(obj.quantity) || 1));
      if (!partId) continue;
      aggregatedQty.set(partId, (aggregatedQty.get(partId) || 0) + qty);
    }
    if (aggregatedQty.size === 0) {
      res.status(400).json({ error: 'No valid spare parts selected for this bargain.' });
      return;
    }

    const items: BargainItemRecord[] = [];
    let listedSubtotal = 0;
    for (const [partId, quantity] of aggregatedQty.entries()) {
      const part = store.parts.find((p) => p.id === partId);
      if (!part) {
        res.status(404).json({ error: `Spare part (${partId}) is no longer available.` });
        return;
      }
      const lineSubtotal = part.price * quantity;
      listedSubtotal += lineSubtotal;
      items.push({
        partId: part.id,
        name: part.name,
        sku: part.sku,
        category: part.category,
        subcategory: part.subcategory,
        unitPrice: part.price,
        quantity,
        lineSubtotal,
      });
    }

    if (!Number.isFinite(offeredTotal) || offeredTotal < 1) {
      res.status(400).json({
        error: 'Please enter a valid bargain price greater than KSh 0.',
      });
      return;
    }
    if (offeredTotal > listedSubtotal) {
      res.status(400).json({
        error: `Offered price cannot exceed the listed total of KSh ${listedSubtotal.toLocaleString('en-KE')}.`,
      });
      return;
    }

    const evaluation = evaluateBargainAgainstFloor(store, items, offeredTotal);
    const autoAccepted = evaluation.outcome === 'auto_accept';
    const autoDeclined = evaluation.outcome === 'auto_decline';

    const existingCodes = new Set(store.bargains.map((b) => b.bargainCode));
    const bargainCode = generateBargainCode(existingCodes);
    const nowIso = new Date().toISOString();

    const history: BargainHistoryEntryRecord[] = [
      {
        actor: 'customer',
        action: 'submitted',
        amount: offeredTotal,
        ...(customerNote ? { note: customerNote } : {}),
        createdAt: nowIso,
      },
    ];
    if (autoAccepted) {
      history.push({
        actor: 'admin',
        action: 'accepted',
        amount: offeredTotal,
        note: 'Auto-accepted: offer qualifies for instant checkout.',
        createdAt: nowIso,
      });
    } else if (autoDeclined) {
      history.push({
        actor: 'admin',
        action: 'rejected',
        amount: offeredTotal,
        note: 'Offer automatically declined: offered price is below our minimum acceptable price.',
        createdAt: nowIso,
      });
    }

    const bargain: BargainOfferRecord = {
      id: `brg-${crypto.randomBytes(4).toString('hex')}`,
      bargainCode,
      sessionId,
      ...(authUser ? { userId: authUser.id } : {}),
      customerName,
      customerPhone: normalizePhone(customerPhone),
      items,
      listedSubtotal,
      offeredTotal,
      ...(autoAccepted ? { agreedTotal: offeredTotal } : {}),
      status: autoAccepted ? 'accepted' : autoDeclined ? 'rejected' : 'pending',
      ...(customerNote ? { customerNote } : {}),
      ...(autoAccepted
        ? {
            adminNote: 'Auto-accepted! Your bargain offer qualifies for instant checkout.',
          }
        : autoDeclined
          ? {
              adminNote: 'Offer automatically declined because it is below our acceptable price. Try offering a higher price.',
            }
          : {}),
      history,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.bargains.unshift(bargain);
    if (store.bargains.length > 500) {
      store.bargains = store.bargains.slice(0, 500);
    }
    writeStore(store);
    broadcastBargainUpdate(bargain);

    res.status(201).json({ bargain, autoAccepted, autoDeclined });
  });

  app.post('/api/bargains/:id/respond', (req, res) => {
    const id = req.params.id;
    const body = req.body as Record<string, unknown>;
    const store = readStore();
    const authUser = getAuthenticatedUser(req, store);
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : (req.header('x-session-id') || '').trim();

    const bargain = store.bargains.find((b) => b.id === id);
    if (!bargain) {
      res.status(404).json({ error: 'Bargain offer not found.' });
      return;
    }

    const isOwner =
      Boolean(authUser && bargain.userId && bargain.userId === authUser.id) ||
      Boolean(sessionId.length >= 12 && bargain.sessionId === sessionId);
    if (!isOwner) {
      res.status(403).json({ error: 'You do not have permission to update this bargain offer.' });
      return;
    }

    const action = body.action;
    const customerNote =
      typeof body.note === 'string' ? body.note.trim().slice(0, 280) : '';
    const nowIso = new Date().toISOString();

    if (action === 'accept_counter') {
      if (bargain.status !== 'countered' || typeof bargain.counterTotal !== 'number') {
        res.status(400).json({ error: 'There is no active counter-offer to accept on this bargain.' });
        return;
      }
      bargain.status = 'accepted';
      bargain.agreedTotal = bargain.counterTotal;
      bargain.updatedAt = nowIso;
      bargain.history.push({
        actor: 'customer',
        action: 'accepted',
        amount: bargain.agreedTotal,
        ...(customerNote ? { note: customerNote } : {}),
        createdAt: nowIso,
      });
    } else if (action === 're_offer') {
      if (bargain.status !== 'countered' && bargain.status !== 'pending') {
        res.status(400).json({
          error: `Cannot re-offer on a bargain that is already ${bargain.status}.`,
        });
        return;
      }
      const nextOffer = Math.round(Number(body.offeredTotal) || 0);
      if (!Number.isFinite(nextOffer) || nextOffer < 1) {
        res.status(400).json({
          error: 'Please enter a valid re-offer price greater than KSh 0.',
        });
        return;
      }
      const ceiling =
        typeof bargain.counterTotal === 'number' && bargain.counterTotal < bargain.listedSubtotal
          ? bargain.counterTotal
          : bargain.listedSubtotal;
      if (nextOffer > ceiling || (bargain.status === 'countered' && nextOffer === ceiling)) {
        res.status(400).json({
          error:
            bargain.status === 'countered'
              ? `Re-offer must be below KSh ${ceiling.toLocaleString('en-KE')}. To pay the counter price, click Accept instead.`
              : `Re-offer cannot exceed the listed total of KSh ${ceiling.toLocaleString('en-KE')}.`,
        });
        return;
      }

      const evaluation = evaluateBargainAgainstFloor(store, bargain.items, nextOffer);
      const autoAccepted = evaluation.outcome === 'auto_accept';
      const autoDeclined = evaluation.outcome === 'auto_decline';

      bargain.offeredTotal = nextOffer;
      if (customerNote) {
        bargain.customerNote = customerNote;
      }
      bargain.history.push({
        actor: 'customer',
        action: 're_offered',
        amount: nextOffer,
        ...(customerNote ? { note: customerNote } : {}),
        createdAt: nowIso,
      });
      if (autoAccepted) {
        bargain.status = 'accepted';
        bargain.agreedTotal = nextOffer;
        bargain.adminNote = 'Auto-accepted! Your offer qualifies for instant checkout.';
        bargain.history.push({
          actor: 'admin',
          action: 'accepted',
          amount: nextOffer,
          note: bargain.adminNote,
          createdAt: nowIso,
        });
      } else if (autoDeclined) {
        bargain.status = 'rejected';
        bargain.adminNote = 'Offer automatically declined because it is below our acceptable price. Try offering a higher price.';
        bargain.history.push({
          actor: 'admin',
          action: 'rejected',
          amount: nextOffer,
          note: bargain.adminNote,
          createdAt: nowIso,
        });
      } else {
        bargain.status = 'pending';
      }
      bargain.updatedAt = nowIso;
    } else if (action === 'withdraw') {
      if (bargain.status !== 'pending' && bargain.status !== 'countered') {
        res.status(400).json({ error: 'Only open or countered bargains can be withdrawn.' });
        return;
      }
      bargain.status = 'rejected';
      bargain.updatedAt = nowIso;
      bargain.history.push({
        actor: 'customer',
        action: 'withdrawn',
        ...(customerNote ? { note: customerNote } : {}),
        createdAt: nowIso,
      });
    } else {
      res.status(400).json({ error: 'Invalid bargain response action.' });
      return;
    }

    writeStore(store);
    broadcastBargainUpdate(bargain);
    res.json({ bargain });
  });

  app.get('/api/admin/bargains', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const bargains = [...store.bargains].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    res.json({
      bargains,
      settings: store.bargainSettings,
    });
  });

  app.patch('/api/admin/bargains/settings', (req, res) => {
    const store = readStore();
    if (!requireAdminUser(req, res, store)) return;

    const body = req.body as Record<string, unknown>;
    const rawPct = Number(body.autoAcceptMaxDiscountPct);
    const clampedPct = Math.min(
      BARGAIN_MAX_DISCOUNT_PCT,
      Math.max(0, Math.round(Number.isFinite(rawPct) ? rawPct : 0)),
    );
    store.bargainSettings = {
      autoAcceptMaxDiscountPct: clampedPct,
    };
    writeStore(store);
    res.json({ settings: store.bargainSettings });
  });

  app.patch('/api/admin/bargains/:id', async (req, res) => {
    const store = readStore();
    const adminUser = requireAdminUser(req, res, store);
    if (!adminUser) return;

    const id = req.params.id;
    const body = req.body as Record<string, unknown>;
    const action = body.action;
    const adminNote =
      typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 280) : '';
    const sendSms = body.sendSms === true;

    const bargain = store.bargains.find((b) => b.id === id);
    if (!bargain) {
      res.status(404).json({ error: 'Bargain request not found.' });
      return;
    }
    if (bargain.status === 'redeemed' || bargain.status === 'expired') {
      res.status(400).json({
        error: `This bargain is already ${bargain.status} and cannot be modified.`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    let smsStatusLabel = '';
    let smsText = '';

    if (action === 'accept') {
      const customAgreeTotal =
        body.counterTotal !== undefined && Number(body.counterTotal) > 0
          ? Math.round(Number(body.counterTotal))
          : undefined;
      const finalAgreed =
        customAgreeTotal !== undefined
          ? customAgreeTotal
          : bargain.status === 'countered' && typeof bargain.counterTotal === 'number'
            ? bargain.counterTotal
            : bargain.offeredTotal;
      if (finalAgreed <= 0 || finalAgreed > bargain.listedSubtotal) {
        res.status(400).json({
          error: `Agreed total must be between KSh 1 and KSh ${bargain.listedSubtotal.toLocaleString('en-KE')}.`,
        });
        return;
      }
      bargain.status = 'accepted';
      bargain.agreedTotal = finalAgreed;
      if (adminNote) bargain.adminNote = adminNote;
      bargain.updatedAt = nowIso;
      bargain.history.push({
        actor: 'admin',
        action: 'accepted',
        amount: finalAgreed,
        ...(adminNote ? { note: adminNote } : {}),
        createdAt: nowIso,
      });
      smsStatusLabel = 'Accepted';
      smsText = `My Spare Zone: Great news ${bargain.customerName}! Your bargain ${bargain.bargainCode} has been ACCEPTED at KSh ${finalAgreed.toLocaleString('en-KE')}. Open My Bargains on our storefront to load it into your cart & checkout. Care: ${CUSTOMER_CARE_NUMBER}.`;
    } else if (action === 'counter') {
      const counterTotal = Math.round(Number(body.counterTotal) || 0);
      if (!Number.isFinite(counterTotal) || counterTotal <= 0 || counterTotal > bargain.listedSubtotal) {
        res.status(400).json({
          error: `Counter-offer must be between KSh 1 and KSh ${bargain.listedSubtotal.toLocaleString('en-KE')}.`,
        });
        return;
      }
      bargain.status = 'countered';
      bargain.counterTotal = counterTotal;
      if (adminNote) bargain.adminNote = adminNote;
      bargain.updatedAt = nowIso;
      bargain.history.push({
        actor: 'admin',
        action: 'countered',
        amount: counterTotal,
        ...(adminNote ? { note: adminNote } : {}),
        createdAt: nowIso,
      });
      smsStatusLabel = `Countered KSh ${counterTotal.toLocaleString('en-KE')}`;
      smsText = `My Spare Zone: Counter-offer on ${bargain.bargainCode}: we can do KSh ${counterTotal.toLocaleString('en-KE')} (listed KSh ${bargain.listedSubtotal.toLocaleString('en-KE')}).${adminNote ? ` Note: ${adminNote}.` : ''} Open My Bargains to accept or re-offer. Care: ${CUSTOMER_CARE_NUMBER}.`;
    } else if (action === 'reject') {
      bargain.status = 'rejected';
      if (adminNote) bargain.adminNote = adminNote;
      bargain.updatedAt = nowIso;
      bargain.history.push({
        actor: 'admin',
        action: 'rejected',
        ...(adminNote ? { note: adminNote } : {}),
        createdAt: nowIso,
      });
      smsStatusLabel = 'Declined';
      smsText = `My Spare Zone: Your bargain request ${bargain.bargainCode} could not be approved at the offered price.${adminNote ? ` Note: ${adminNote}.` : ''} You may submit a new offer anytime or call ${CUSTOMER_CARE_NUMBER}.`;
    } else {
      res.status(400).json({ error: 'Invalid admin bargain action.' });
      return;
    }

    if (sendSms && smsText) {
      await appendBargainSmsNotification(
        store,
        bargain,
        smsStatusLabel,
        smsText,
        adminUser.name || 'Admin Desk',
      );
    }

    writeStore(store);
    broadcastBargainUpdate(bargain);
    res.json({ bargain });
  });

  const escapePrivacyHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  app.get(['/privacy', '/privacy-policy'], (_req, res) => {
    const sectionsHtml = PRIVACY_POLICY_SECTIONS.map(
      (section) => `
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">${escapePrivacyHtml(section.title)}</h2>
        ${
          section.summary
            ? `<p style="font-size:14px;color:#334155;font-weight:600;margin:0 0 8px 0;">${escapePrivacyHtml(section.summary)}</p>`
            : ''
        }
        <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.65;">
          ${section.bullets
            .map((b) => `<li style="margin-bottom:6px;">${escapePrivacyHtml(b)}</li>`)
            .join('')}
        </ul>
      </section>`,
    ).join('');

    res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy — ${escapePrivacyHtml(SHOP_NAME)}</title>
    <meta name="description" content="Privacy Policy for ${escapePrivacyHtml(SHOP_NAME)}, Nairobi automotive spare parts storefront and mobile app." />
  </head>
  <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <main style="max-width:820px;margin:32px auto;padding:0 16px;">
      <article style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
        <header style="background:#0f172a;color:#ffffff;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#fb923c;font-weight:700;">${escapePrivacyHtml(SHOP_NAME)}</div>
          <h1 style="margin:6px 0 4px 0;font-size:24px;font-weight:800;">Privacy Policy</h1>
          <p style="margin:0;font-size:13px;color:#cbd5e1;">Effective Date: ${escapePrivacyHtml(PRIVACY_POLICY_EFFECTIVE_DATE)} · Kenya Data Protection Act, 2019</p>
        </header>
        <div style="padding:28px;">
          <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:14px;line-height:1.65;color:#334155;margin:0 0 24px 0;">
            ${escapePrivacyHtml(PRIVACY_POLICY_INTRO)}
          </p>
          ${sectionsHtml}
          <footer style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:13px;color:#475569;">
            <span>Seventies Plaza, Kirinyaga Road, Nairobi · Customer Care: ${escapePrivacyHtml(CUSTOMER_CARE_NUMBER)}</span>
            <a href="/" style="color:#c2410c;font-weight:600;text-decoration:none;">← Return to ${escapePrivacyHtml(SHOP_NAME)}</a>
          </footer>
        </div>
      </article>
    </main>
  </body>
</html>`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Periodic 60s check to restock unclaimed 24-hour counter pickup reservations
  setInterval(() => {
    try {
      readStore();
    } catch {
      // ignore background timer read issues
    }
  }, 60 * 1000);

  if (typeof PORT === 'number') {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`My Spare Zone server listening on http://0.0.0.0:${PORT}`);
    });
  } else {
    httpServer.listen(PORT, () => {
      console.log(`My Spare Zone server listening via socket/Passenger (${PORT})`);
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start My Spare Zone server:', err);
  process.exit(1);
});
