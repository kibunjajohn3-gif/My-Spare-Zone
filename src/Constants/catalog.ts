import type {
  BargainOffer,
  BodyPartConditionGrade,
  CarBrand,
  CartItem,
  FittingAppointmentStatus,
  GaragePartnerStatus,
  OrderStatus,
  OrderTrackingStage,
  PrimaryCategory,
  SparePart,
  VirtualReceipt,
} from '../types';

export const SHOP_NAME = 'My Spare Zone';
export const CUSTOMER_CARE_NUMBER = '+254706130014';
export const CUSTOMER_CARE_WHATSAPP_URL = 'https://wa.me/254706130014';
export function getWhatsAppSupportUrl(message?: string): string {
  if (!message) return CUSTOMER_CARE_WHATSAPP_URL;
  return `${CUSTOMER_CARE_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

export function resolveAbsoluteAssetUrl(src: string, origin?: string): string {
  const clean = (src || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith('data:')) return clean;
  const baseOrigin =
    origin || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  if (!baseOrigin) return clean;
  return `${baseOrigin.replace(/\/$/, '')}${clean.startsWith('/') ? '' : '/'}${clean}`;
}

export function getWhatsAppPartShareUrl(
  part: SparePart,
  imageSrc?: string,
  origin?: string,
): string {
  const vehicleBits = [part.brand, part.carModel, part.yearOfMake].filter(Boolean).join(' ');
  const condInfo =
    part.category === 'Body parts' ? getBodyPartConditionInfo(part.conditionGrade) : null;
  const targetImage = imageSrc || part.imageUrl;
  const absoluteImage = resolveAbsoluteAssetUrl(targetImage, origin);
  const lines = [
    `Check out this spare part at ${SHOP_NAME}:`,
    `${part.name}${vehicleBits ? ` (${vehicleBits})` : ''}`,
    `Price: ${formatCurrency(part.price)} · SKU: ${part.sku}`,
    ...(condInfo ? [`Condition: ${condInfo.label}`] : []),
    ...(absoluteImage && !absoluteImage.startsWith('data:') ? [`Picture: ${absoluteImage}`] : []),
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

export const MPESA_PAYBILL_NUMBER = '247247';
export const MPESA_ACCOUNT_NUMBER = '0940179972097';
export const BANK_TRANSFER_ACCOUNT_NUMBER = '0940179972097';

export function formatMpesaPhone(raw: string): string | null {
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

export function getWhatsAppPhoneUrl(rawPhone: string, message?: string): string {
  const formatted = formatMpesaPhone(rawPhone) || rawPhone.replace(/\D/g, '');
  const target = formatted ? `https://wa.me/${formatted}` : 'https://wa.me/';
  if (!message) return target;
  return `${target}?text=${encodeURIComponent(message)}`;
}

export const MECHANIC_SERVICE_NOTICE =
  'Affordable mobile professional mechanics & in-garage fitting services available — bring your vehicle to get your part fitted while you wait.';
export const GARAGE_FITTING_SERVICE_NOTICE =
  'Drive in with your vehicle to our garage at Seventies Plaza, Kirinyaga Road — book a fitting time slot at checkout, get your part fitted while you wait, and leave with your vehicle ready.';
export const DELIVERY_SERVICE_NOTICE =
  'All Nairobi & surrounding deliveries require upfront checkout payment with the rider delivery fee (KSh 500/10km) included in your order total — after payment, our rider sends his live location from his WhatsApp to your WhatsApp, along with his picture and number plate number for easy live tracking. Prefer to inspect first? Select Counter Pickup at our Kirinyaga Rd shop. Outside Nairobi, provide your preferred courier service name.';
export const NAIROBI_RIDER_TRACKING_NOTICE =
  'Once your payment is completed, our assigned Nairobi rider will send his live location from his WhatsApp directly to your WhatsApp, along with his picture and number plate number for easy live tracking.';
export const PHYSICAL_STORE_ADDRESS =
  'Seventies Plaza, Kirinyaga Road, Shops LG9 and LG10';
export const PHYSICAL_STORE_HOURS = 'Mon-Sat: 7.30am - 6.30pm';
export const PHYSICAL_STORE_MAPS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Seventies+Plaza%2C+Kirinyaga+Road%2C+Nairobi';
export const PHYSICAL_STORE_PICKUP_NOTICE =
  'Visit our physical store & fitting garage at Seventies Plaza, Kirinyaga Road, Shops LG9 and LG10 for counter pickup or scheduled drive-in part fitting.';

export const GARAGE_SLOT_MAX_BAYS = 2;
export const GARAGE_BOOKING_MAX_DAYS_AHEAD = 30;
export const GARAGE_FITTING_SLOTS = [
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

export const FITTING_APPOINTMENT_STATUSES: FittingAppointmentStatus[] = [
  'Scheduled',
  'In Bay',
  'Completed',
  'Cancelled',
];

export function getGarageSlotLabel(slotId?: string): string {
  if (!slotId) return '';
  return GARAGE_FITTING_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
}

export function getNairobiDateParts(now = new Date()): { dateStr: string; hour: number } {
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

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function isSundayDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function getDefaultFittingDate(now = new Date()): string {
  const { dateStr, hour } = getNairobiDateParts(now);
  let candidate = hour >= 17 ? addDaysToDateStr(dateStr, 1) : dateStr;
  if (isSundayDateStr(candidate)) {
    candidate = addDaysToDateStr(candidate, 1);
  }
  return candidate;
}

export function formatFittingDateLabel(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const PARTNER_BASE_DISCOUNT_PCT = 2;
export const PARTNER_REGULAR_3_DISCOUNT_PCT = 3;
export const PARTNER_REGULAR_6_DISCOUNT_PCT = 5;
export const PARTNER_STARTER_MAX_ITEMS = 5;
export const PARTNER_REGULAR_MIN_ITEMS = 6;
export const PARTNER_TOP_TIER_MIN_ITEMS = 10;
export const PARTNER_BULK_BONUS_PCT = 3;
export const PARTNER_BULK_MIN_QTY = 10;
export const PARTNER_BULK_MIN_SUBTOTAL = 300000;
export const PARTNER_MAX_DISCOUNT_PCT = 8;
export const REFERRAL_MECHANIC_CREDIT_PCT = 1;
export const REFERRAL_CUSTOMER_DISCOUNT_PCT = REFERRAL_MECHANIC_CREDIT_PCT;

export const ITEM_VOLUME_DISCOUNT_TIERS = [
  { minQty: 2, discountPct: 2, label: '2+ same part' },
  { minQty: 5, discountPct: 4, label: '5+ same part' },
  { minQty: 10, discountPct: 6, label: '10+ same part' },
] as const;

export interface ItemVolumeTier {
  minQty: number;
  discountPct: number;
  label: string;
}

export interface CartVolumeLineSummary {
  partId: string;
  name?: string;
  unitPrice: number;
  quantity: number;
  stock?: number;
  lineSubtotal: number;
  tier: ItemVolumeTier | null;
  discountPct: number;
  discountAmount: number;
  netLineTotal: number;
  nextTier: ItemVolumeTier | null;
  unitsToNextTier: number;
  canUpgradeToNext: boolean;
  nextTierSavings: number;
}

export function getItemVolumeDiscountTier(quantity: number): ItemVolumeTier | null {
  let matched: ItemVolumeTier | null = null;
  for (const tier of ITEM_VOLUME_DISCOUNT_TIERS) {
    if (quantity >= tier.minQty) {
      matched = tier;
    }
  }
  return matched;
}

export function getNextItemVolumeDiscountTier(quantity: number): ItemVolumeTier | null {
  for (const tier of ITEM_VOLUME_DISCOUNT_TIERS) {
    if (tier.minQty > quantity) {
      return tier;
    }
  }
  return null;
}

export function isPartEligibleForSamePartVolumeDiscount(part?: {
  category?: string;
} | null): boolean {
  return part?.category !== 'Gearbox Oil';
}

export type VolumeComputableLine =
  | CartItem
  | {
      partId: string;
      name?: string;
      category?: string;
      unitPrice: number;
      quantity: number;
      stock?: number;
    };

export function calculateCartVolumeDiscounts(items: VolumeComputableLine[]): {
  lines: CartVolumeLineSummary[];
  byPartId: Record<string, CartVolumeLineSummary>;
  totalVolumeDiscountAmount: number;
  qualifyingLinesCount: number;
  volumeDiscountLabel: string | null;
} {
  const lines: CartVolumeLineSummary[] = [];
  const byPartId: Record<string, CartVolumeLineSummary> = {};
  let totalVolumeDiscountAmount = 0;
  let qualifyingLinesCount = 0;

  for (const raw of items) {
    const isCartItem = 'part' in raw;
    const partId = isCartItem ? raw.part.id : raw.partId;
    const name = isCartItem ? raw.part.name : raw.name;
    const category = isCartItem ? raw.part.category : raw.category;
    const unitPrice = isCartItem ? raw.part.price : raw.unitPrice;
    const stock = isCartItem ? raw.part.stock : raw.stock;
    const quantity = Math.max(0, Math.floor(raw.quantity));
    const lineSubtotal = unitPrice * quantity;
    const isEligible = isPartEligibleForSamePartVolumeDiscount({ category });
    const tier = isEligible ? getItemVolumeDiscountTier(quantity) : null;
    const discountPct = tier?.discountPct ?? 0;
    const discountAmount = tier ? Math.round((lineSubtotal * discountPct) / 100) : 0;
    const netLineTotal = Math.max(0, lineSubtotal - discountAmount);
    const nextTier = isEligible ? getNextItemVolumeDiscountTier(quantity) : null;
    const unitsToNextTier = nextTier ? Math.max(0, nextTier.minQty - quantity) : 0;
    const canUpgradeToNext = Boolean(
      isEligible && nextTier && (stock === undefined || stock >= nextTier.minQty),
    );
    const nextTierSavings = nextTier
      ? Math.round((unitPrice * nextTier.minQty * nextTier.discountPct) / 100)
      : 0;

    const summary: CartVolumeLineSummary = {
      partId,
      name,
      unitPrice,
      quantity,
      stock,
      lineSubtotal,
      tier,
      discountPct,
      discountAmount,
      netLineTotal,
      nextTier,
      unitsToNextTier,
      canUpgradeToNext,
      nextTierSavings,
    };

    lines.push(summary);
    byPartId[partId] = summary;
    if (discountAmount > 0) {
      totalVolumeDiscountAmount += discountAmount;
      qualifyingLinesCount += 1;
    }
  }

  let volumeDiscountLabel: string | null = null;
  if (totalVolumeDiscountAmount > 0) {
    const activePcts = Array.from(
      new Set(lines.filter((l) => l.discountPct > 0).map((l) => l.discountPct)),
    ).sort((a, b) => a - b);
    const pctText =
      activePcts.length === 1
        ? `${activePcts[0]}%`
        : `${activePcts[0]}%–${activePcts[activePcts.length - 1]}%`;
    volumeDiscountLabel =
      qualifyingLinesCount === 1
        ? `Same-Part Volume Discount (${pctText} off)`
        : `Same-Part Volume Discounts (${qualifyingLinesCount} items · ${pctText})`;
  }

  return {
    lines,
    byPartId,
    totalVolumeDiscountAmount,
    qualifyingLinesCount,
    volumeDiscountLabel,
  };
}

export const PARTNER_PROOF_TYPES = [
  'Workshop / Garage Photo',
  'NITA / Trade Certificate',
  'Business Permit / KRA PIN',
  'Mechanic ID / Garage Reference',
] as const;

export function getPartOfferDetails(part: {
  price: number;
  previousPrice?: number;
  isOffer?: boolean;
}): {
  hasOffer: boolean;
  previousPrice: number | null;
  savingsAmount: number;
  discountPercent: number;
} {
  const hasValidPrevious =
    typeof part.previousPrice === 'number' &&
    Number.isFinite(part.previousPrice) &&
    part.previousPrice > part.price;
  const hasOffer = Boolean(hasValidPrevious && (part.isOffer ?? true));
  if (!hasOffer || typeof part.previousPrice !== 'number') {
    return {
      hasOffer: false,
      previousPrice: null,
      savingsAmount: 0,
      discountPercent: 0,
    };
  }
  const savingsAmount = Math.max(0, Math.round(part.previousPrice - part.price));
  const discountPercent = Math.max(
    1,
    Math.round((savingsAmount / part.previousPrice) * 100),
  );
  return {
    hasOffer: true,
    previousPrice: Math.round(part.previousPrice),
    savingsAmount,
    discountPercent,
  };
}

export function isJoinedPartnerProgram(
  partner?: { status: GaragePartnerStatus } | null,
): boolean {
  return Boolean(partner && partner.status !== 'rejected');
}

export function isAccountProfessionalPartner(
  user?: {
    role?: string;
    partnerProfile?: { status: GaragePartnerStatus } | null;
  } | null,
): boolean {
  if (!user || user.role === 'admin') return false;
  return isJoinedPartnerProgram(user.partnerProfile);
}

export function getPartnerLoyaltyItemsCount(
  partner?: { itemsCount?: number; ordersCount: number } | null,
): number {
  if (!partner) return 0;
  return typeof partner.itemsCount === 'number' && Number.isFinite(partner.itemsCount)
    ? Math.max(0, Math.floor(partner.itemsCount))
    : Math.max(0, Math.floor(partner.ordersCount || 0));
}

export function getPartnerTierDiscountPct(
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

export interface LoyaltyMilestoneToastInfo {
  id: string;
  receiptNumber: string;
  badgeLabel: string;
  title: string;
  message: string;
  currentItemsCount: number;
  itemsRemaining: number;
}

export function getLoyaltyMilestoneToastData(params: {
  receiptId: string;
  receiptNumber: string;
  previousItemsCount: number;
  currentItemsCount: number;
  partnerStatus?: GaragePartnerStatus;
  isProfessionalMechanicOrGarage?: boolean;
}): LoyaltyMilestoneToastInfo | null {
  const {
    receiptId,
    receiptNumber,
    previousItemsCount,
    currentItemsCount,
    partnerStatus,
    isProfessionalMechanicOrGarage,
  } = params;
  if (isProfessionalMechanicOrGarage) return null;
  if (partnerStatus !== 'active') return null;
  if (currentItemsCount <= previousItemsCount) return null;
  if (currentItemsCount >= PARTNER_TOP_TIER_MIN_ITEMS) return null;

  if (currentItemsCount === PARTNER_TOP_TIER_MIN_ITEMS - 1) {
    return {
      id: `loyalty-${receiptId}`,
      receiptNumber,
      badgeLabel: 'Almost Top Tier Loyalty',
      title: '1 Purchase Away from Top Tier Loyalty!',
      message: `You now have ${currentItemsCount} purchased items. Just 1 more item unlocks Top Tier Loyalty (${PARTNER_REGULAR_6_DISCOUNT_PCT}% base off + ${PARTNER_BULK_BONUS_PCT}% bulk bonus).`,
      currentItemsCount,
      itemsRemaining: 1,
    };
  }

  if (currentItemsCount === PARTNER_STARTER_MAX_ITEMS) {
    const itemsRemaining = PARTNER_TOP_TIER_MIN_ITEMS - currentItemsCount;
    return {
      id: `loyalty-${receiptId}`,
      receiptNumber,
      badgeLabel: 'Starter Tier Milestone',
      title: 'One Purchase Away from Leaving Starter!',
      message: `You've reached ${currentItemsCount} items (Starter ${PARTNER_BASE_DISCOUNT_PCT}%). Your next purchase advances you past Starter — just ${itemsRemaining} more items to reach Top Tier Loyalty (${PARTNER_REGULAR_6_DISCOUNT_PCT}% off)!`,
      currentItemsCount,
      itemsRemaining,
    };
  }

  return null;
}

export const BARGAIN_MIN_DISCOUNT_PCT = 0;
export const BARGAIN_MAX_DISCOUNT_PCT = 20;
export const BARGAIN_MIN_OFFER_PCT_OF_LISTED = 80;
export const BARGAIN_PRESET_DISCOUNTS = [0, 5, 10, 15, 20] as const;

export const PICKUP_RESERVATION_HOURS = 24;
export const NAIROBI_DELIVERY_RATE_PER_10KM = 500;
export const SHOP_ORIGIN_COORDS = {
  lat: -1.2819,
  lng: 36.8266,
  label: 'Seventies Plaza, Kirinyaga Rd CBD',
} as const;

export interface NairobiDeliveryZone {
  name: string;
  distanceKm: number;
  aliases: readonly string[];
}

export const NAIROBI_DELIVERY_ZONES: readonly NairobiDeliveryZone[] = [
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
  { name: 'Langata / Galleria / Wilson', distanceKm: 9.6, aliases: ['langata', 'lang\'ata', 'galleria', 'wilson', 'ongata', 'onyonka', 'maasai'] },
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

export function calculateNairobiDeliveryFee(distanceKm: number): {
  distanceKm: number;
  slabs: number;
  fee: number;
} {
  const safeKm = Math.max(0.5, Math.round(distanceKm * 10) / 10);
  const slabs = Math.max(1, Math.ceil(safeKm / 10));
  return {
    distanceKm: safeKm,
    slabs,
    fee: slabs * NAIROBI_DELIVERY_RATE_PER_10KM,
  };
}

export function calculateNairobiDeliveryQuote(destination: string): {
  matchedZone: string | null;
  distanceKm: number;
  slabs: number;
  fee: number;
  source: 'zone_table' | 'keyword_fallback';
} {
  const cleaned = destination.trim().toLowerCase();
  if (!cleaned) {
    const base = calculateNairobiDeliveryFee(5);
    return { matchedZone: null, ...base, source: 'keyword_fallback' };
  }

  for (const zone of NAIROBI_DELIVERY_ZONES) {
    if (zone.aliases.some((alias) => cleaned.includes(alias))) {
      const calc = calculateNairobiDeliveryFee(zone.distanceKm);
      return {
        matchedZone: zone.name,
        ...calc,
        source: 'zone_table',
      };
    }
  }

  // Deterministic fallback within 6-18 km for unrecognized estate names when offline
  let hash = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) % 1000;
  }
  const fallbackKm = Math.round((6 + (hash % 120) / 10) * 10) / 10;
  const calc = calculateNairobiDeliveryFee(fallbackKm);
  return {
    matchedZone: null,
    ...calc,
    source: 'keyword_fallback',
  };
}

export function getPartImageGallery(
  part: { imageUrl: string; imageUrls?: string[] },
): string[] {
  const merged = [
    ...(Array.isArray(part.imageUrls) ? part.imageUrls : []),
    part.imageUrl,
  ]
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean);
  const unique: string[] = [];
  for (const url of merged) {
    if (!unique.includes(url)) {
      unique.push(url);
    }
    if (unique.length >= 3) break;
  }
  return unique;
}

export function getMatchingBargainForItems(
  items: VolumeComputableLine[] | undefined,
  bargain?: BargainOffer | null,
): {
  matched: boolean;
  bargainListedSubtotal: number;
  agreedTotal: number;
  bargainDiscountAmount: number;
  bargainedPartIds: Set<string>;
  mismatchReason: string | null;
} {
  if (!bargain || !items || items.length === 0) {
    return {
      matched: false,
      bargainListedSubtotal: 0,
      agreedTotal: 0,
      bargainDiscountAmount: 0,
      bargainedPartIds: new Set<string>(),
      mismatchReason: null,
    };
  }
  if (bargain.status !== 'accepted') {
    return {
      matched: false,
      bargainListedSubtotal: 0,
      agreedTotal: 0,
      bargainDiscountAmount: 0,
      bargainedPartIds: new Set<string>(),
      mismatchReason:
        bargain.status === 'redeemed'
          ? `Bargain ${bargain.bargainCode} has already been redeemed.`
          : `Bargain ${bargain.bargainCode} is not currently accepted.`,
    };
  }

  const byPartId = new Map<string, { quantity: number; lineSubtotal: number }>();
  for (const raw of items) {
    const isCartItem = 'part' in raw;
    const partId = isCartItem ? raw.part.id : raw.partId;
    const unitPrice = isCartItem ? raw.part.price : raw.unitPrice;
    const quantity = Math.max(0, Math.floor(raw.quantity));
    const prev = byPartId.get(partId);
    if (prev) {
      byPartId.set(partId, {
        quantity: prev.quantity + quantity,
        lineSubtotal: prev.lineSubtotal + unitPrice * quantity,
      });
    } else {
      byPartId.set(partId, {
        quantity,
        lineSubtotal: unitPrice * quantity,
      });
    }
  }

  let bargainListedSubtotal = 0;
  const bargainedPartIds = new Set<string>();
  for (const bItem of bargain.items) {
    const line = byPartId.get(bItem.partId);
    if (!line || line.quantity !== bItem.quantity) {
      return {
        matched: false,
        bargainListedSubtotal: 0,
        agreedTotal: 0,
        bargainDiscountAmount: 0,
        bargainedPartIds: new Set<string>(),
        mismatchReason: `Cart quantities differ from agreed bargain ${bargain.bargainCode}.`,
      };
    }
    bargainedPartIds.add(bItem.partId);
    bargainListedSubtotal += line.lineSubtotal;
  }

  const agreedTotal = Math.max(0, Math.round(bargain.agreedTotal ?? bargain.offeredTotal));
  const bargainDiscountAmount = Math.max(0, bargainListedSubtotal - agreedTotal);

  return {
    matched: true,
    bargainListedSubtotal,
    agreedTotal,
    bargainDiscountAmount,
    bargainedPartIds,
    mismatchReason: null,
  };
}

export function calculateCheckoutPricing(params: {
  subtotal: number;
  totalUnits: number;
  items?: VolumeComputableLine[];
  isProfessionalMechanicOrGarage?: boolean;
  partner?: {
    status: GaragePartnerStatus;
    ordersCount: number;
    itemsCount?: number;
    discountTierPercent: number;
    partnerType: 'mechanic' | 'garage';
    isProfessionalMechanicOrGarage?: boolean;
  } | null;
  referralValid?: { code: string; partnerName: string } | null;
  applyReferralCredit?: boolean;
  activeBargain?: BargainOffer | null;
  deliveryFee?: number;
}): {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountLabel: string | null;
  volumeDiscountAmount: number;
  volumeDiscountLabel: string | null;
  volumeLinesByPartId: Record<string, CartVolumeLineSummary>;
  partnerOrReferralDiscountAmount: number;
  partnerOrReferralDiscountLabel: string | null;
  partnerOrReferralDiscountPercent: number;
  referralCreditPercent: number;
  referralCreditAmount: number;
  referralCreditApplied: number;
  bargainDiscountAmount: number;
  bargainDiscountLabel: string | null;
  bargainMatched: boolean;
  bargainMismatchReason: string | null;
  qualifiesBulk: boolean;
  deliveryFee: number;
  total: number;
} {
  const {
    subtotal,
    totalUnits,
    items,
    isProfessionalMechanicOrGarage,
    partner,
    referralValid,
    applyReferralCredit,
    activeBargain,
    deliveryFee = 0,
  } = params;
  const bargainMatch = getMatchingBargainForItems(items, activeBargain);
  const bargainDiscountAmount = bargainMatch.matched
    ? Math.min(subtotal, bargainMatch.bargainDiscountAmount)
    : 0;
  const bargainDiscountLabel =
    bargainMatch.matched && activeBargain && bargainDiscountAmount > 0
      ? `Bargain ${activeBargain.bargainCode}`
      : null;

  const isActivePartner = Boolean(partner && partner.status === 'active');
  const excludeAutomatedTiers = Boolean(
    isJoinedPartnerProgram(partner) || isProfessionalMechanicOrGarage,
  );
  const qualifiesBulk =
    totalUnits >= PARTNER_BULK_MIN_QTY && subtotal >= PARTNER_BULK_MIN_SUBTOTAL;

  // Exclude bargained parts from retail same-part volume discounts so agreed bargain totals aren't double-discounted.
  const nonBargainedItems = items
    ? items.filter((raw) => {
        const partId = 'part' in raw ? raw.part.id : raw.partId;
        return !bargainMatch.bargainedPartIds.has(partId);
      })
    : undefined;

  // Mechanics and garages in the partner program are excluded from retail same-part tier discounts.
  const volumeSummary =
    !isActivePartner && !excludeAutomatedTiers && nonBargainedItems && nonBargainedItems.length > 0
      ? calculateCartVolumeDiscounts(nonBargainedItems)
      : {
          byPartId: {} as Record<string, CartVolumeLineSummary>,
          totalVolumeDiscountAmount: 0,
          volumeDiscountLabel: null,
        };

  const eligibleNonBargainSubtotal = Math.max(0, subtotal - bargainMatch.bargainListedSubtotal);
  const volumeDiscountAmount = Math.min(
    eligibleNonBargainSubtotal,
    volumeSummary.totalVolumeDiscountAmount,
  );
  const afterBargainAndVolumeSubtotal = Math.max(
    0,
    subtotal - bargainDiscountAmount - volumeDiscountAmount,
  );

  let partnerOrReferralDiscountAmount = 0;
  let partnerOrReferralDiscountLabel: string | null = null;
  let partnerOrReferralDiscountPercent = 0;
  let referralCreditPercent = 0;
  let referralCreditAmount = 0;
  let referralCreditApplied = 0;

  if (isActivePartner && partner) {
    const basePct = getPartnerTierDiscountPct(
      getPartnerLoyaltyItemsCount(partner),
      partner.discountTierPercent,
      excludeAutomatedTiers,
    );
    const bulkPct = qualifiesBulk ? PARTNER_BULK_BONUS_PCT : 0;
    const totalPct = Math.min(PARTNER_MAX_DISCOUNT_PCT, basePct + bulkPct);
    partnerOrReferralDiscountPercent = totalPct;
    partnerOrReferralDiscountAmount = Math.round((eligibleNonBargainSubtotal * totalPct) / 100);
    const parts: string[] = [];
    if (partnerOrReferralDiscountAmount > 0) {
      parts.push(
        `${partner.partnerType === 'garage' ? 'Garage' : 'Mechanic'} Partner (${basePct}%)`,
      );
      if (bulkPct > 0) {
        parts.push(`Bulk Bonus (+${bulkPct}%)`);
      }
    }
    if (applyReferralCredit) {
      const availableCredit = Math.max(
        0,
        Math.round((partner as { referralCreditBalance?: number }).referralCreditBalance || 0),
      );
      const remainingPayable = Math.max(
        0,
        subtotal - bargainDiscountAmount - partnerOrReferralDiscountAmount,
      );
      referralCreditApplied = Math.min(availableCredit, remainingPayable);
      if (referralCreditApplied > 0) {
        parts.push(`Referral Credit (-${formatCurrency(referralCreditApplied)})`);
      }
    }
    partnerOrReferralDiscountLabel = parts.length > 0 ? parts.join(' + ') : null;
  } else if (referralValid) {
    // Customer pays standard price (no customer referral discount); the referring active mechanic earns 1% credit after fitting & testing.
    referralCreditPercent = REFERRAL_MECHANIC_CREDIT_PCT;
    referralCreditAmount = Math.round(
      (afterBargainAndVolumeSubtotal * REFERRAL_MECHANIC_CREDIT_PCT) / 100,
    );
  }

  const discountAmount = Math.min(
    subtotal,
    bargainDiscountAmount +
      volumeDiscountAmount +
      partnerOrReferralDiscountAmount +
      referralCreditApplied,
  );
  const labelParts = [
    bargainDiscountLabel,
    volumeSummary.volumeDiscountLabel,
    partnerOrReferralDiscountLabel,
  ].filter((s): s is string => Boolean(s));
  const discountLabel = labelParts.length > 0 ? labelParts.join(' + ') : null;
  const discountPercent =
    subtotal > 0 ? Math.round((discountAmount / subtotal) * 1000) / 10 : 0;

  const resolvedDeliveryFee = Math.max(0, Math.round(deliveryFee || 0));

  return {
    subtotal,
    discountPercent,
    discountAmount,
    discountLabel,
    volumeDiscountAmount,
    volumeDiscountLabel: volumeSummary.volumeDiscountLabel,
    volumeLinesByPartId: volumeSummary.byPartId,
    partnerOrReferralDiscountAmount: partnerOrReferralDiscountAmount + referralCreditApplied,
    partnerOrReferralDiscountLabel,
    partnerOrReferralDiscountPercent,
    referralCreditPercent,
    referralCreditAmount,
    referralCreditApplied,
    bargainDiscountAmount,
    bargainDiscountLabel,
    bargainMatched: bargainMatch.matched,
    bargainMismatchReason: bargainMatch.mismatchReason,
    qualifiesBulk,
    deliveryFee: resolvedDeliveryFee,
    total: Math.max(0, subtotal - discountAmount) + resolvedDeliveryFee,
  };
}

export const TRUST_PICKUP_ASSURANCE_NOTICE =
  'Have trust concerns? Visit our physical shop at Seventies Plaza, Kirinyaga Rd (Shops LG9 & LG10) via Counter Pickup to inspect and collect your spare parts in person.';
export const RETURN_EXCHANGE_POLICY_NOTICE =
  "If an item does not fit or does not match, return it to the shop or cover the return trip rider fee for a refund or exchange — if you choose an exchange, delivery of the replacement item is FREE.";
export const GUARANTEE_NOTICE = 'Goods are guaranteed for upto 7 days since purchase';
export const GUARANTEE_POLICY_TERMS = [
  "Goods spoilt in customer's hands are not reaccepted.",
  'Returns should be made within 2 days.',
  'Misdiagnosis is not our fault.',
  'Tested electrical parts are not guaranteed.',
  'If an item does not fit or does not match, return it to our Kirinyaga Rd shop in person or pay the return trip fee to receive a refund or exchange.',
  'If you choose an exchange for a mismatched or non-fitting item, delivery of the replacement item is FREE.',
  'Customers with trust concerns can select Counter Pickup to collect and verify items in person at Seventies Plaza, Kirinyaga Rd (Shops LG9 & LG10).',
] as const;

export const ORDER_STATUSES: readonly OrderStatus[] = ['Pending', 'Shipped', 'Delivered'];

export function normalizeOrderStatus(status?: string): OrderStatus {
  if (status === 'Shipped' || status === 'Delivered' || status === 'Pending') {
    return status;
  }
  return 'Pending';
}

export const ORDER_TRACKING_STAGES: ReadonlyArray<{
  stage: OrderTrackingStage;
  label: string;
  defaultNote: string;
}> = [
  {
    stage: 'processing',
    label: 'Processing',
    defaultNote: 'Order confirmed and spare parts are being picked & verified at Kirinyaga Rd.',
  },
  {
    stage: 'dispatched',
    label: 'Dispatched',
    defaultNote: 'Parts packed and handed over for dispatch.',
  },
  {
    stage: 'out_for_delivery',
    label: 'Out for Delivery',
    defaultNote: 'Rider / courier is on the way to your delivery destination.',
  },
  {
    stage: 'delivered',
    label: 'Delivered',
    defaultNote: 'Order delivered and confirmed received.',
  },
] as const;

export function normalizeTrackingStage(
  stage?: string,
  orderStatus?: OrderStatus,
): OrderTrackingStage {
  if (
    stage === 'processing' ||
    stage === 'dispatched' ||
    stage === 'out_for_delivery' ||
    stage === 'delivered'
  ) {
    return stage;
  }
  const normalizedOrder = normalizeOrderStatus(orderStatus);
  if (normalizedOrder === 'Delivered') return 'delivered';
  if (normalizedOrder === 'Shipped') return 'dispatched';
  return 'processing';
}

export function trackingStageToOrderStatus(stage: OrderTrackingStage): OrderStatus {
  if (stage === 'delivered') return 'Delivered';
  if (stage === 'dispatched' || stage === 'out_for_delivery') return 'Shipped';
  return 'Pending';
}

export function getTrackingStageLabel(stage: OrderTrackingStage): string {
  return (
    ORDER_TRACKING_STAGES.find((entry) => entry.stage === stage)?.label ?? 'Processing'
  );
}

export function getTrackingStageContextNote(
  stage: OrderTrackingStage,
  receipt: Pick<VirtualReceipt, 'deliveryRegion' | 'deliveryDestination' | 'courierName' | 'pickupCode' | 'fittingDate' | 'fittingSlotLabel'>,
): string {
  if (receipt.deliveryRegion === 'pickup') {
    if (stage === 'processing') return 'Parts are being picked and tagged with your Counter Pickup code.';
    if (stage === 'dispatched') return `Ready at Seventies Plaza, Kirinyaga Rd counter${receipt.pickupCode ? ` (Code: ${receipt.pickupCode})` : ''}.`;
    if (stage === 'out_for_delivery') return 'Staged at counter desk awaiting customer inspection & collection.';
    return 'Collected and signed off at the Kirinyaga Rd counter.';
  }
  if (receipt.deliveryRegion === 'garage_fitting') {
    if (stage === 'processing') return 'Parts reserved for your booked Kirinyaga Rd fitting bay.';
    if (stage === 'dispatched') return `Parts staged for your bay${receipt.fittingDate ? ` (${receipt.fittingDate})` : ''}.`;
    if (stage === 'out_for_delivery') return 'Vehicle / parts queued in service bay for active installation.';
    return 'In-garage fitting completed and vehicle released.';
  }
  if (receipt.deliveryRegion === 'outside_nairobi') {
    if (stage === 'processing') return 'Parts verified and packed for inter-county courier handover.';
    if (stage === 'dispatched') return `Handed over to ${receipt.courierName || 'courier partner'} for transit.`;
    if (stage === 'out_for_delivery') return `In transit / out for collection via ${receipt.courierName || 'courier'}.`;
    return 'Delivered via courier and confirmed received.';
  }
  if (stage === 'processing') return 'Order confirmed; parts are being picked & packed at Kirinyaga Rd. After payment, our rider will send his live location from his WhatsApp to your WhatsApp, along with his picture and number plate number.';
  if (stage === 'dispatched') return `Handed over to Nairobi dispatch rider${receipt.deliveryDestination ? ` for ${receipt.deliveryDestination}` : ''} — live location is sent from the rider's WhatsApp to your WhatsApp, with rider picture and number plate number.`;
  if (stage === 'out_for_delivery') return `Rider is on the way${receipt.deliveryDestination ? ` to ${receipt.deliveryDestination}` : ''} — follow the live location sent from the rider's WhatsApp to your WhatsApp.`;
  return 'Delivered to customer destination and confirmed.';
}

export const GEARBOX_OIL_LITRES_NEEDED = 7;
export const GEARBOX_OIL_CAN_LITRES = 4;
export const GEARBOX_OIL_PAIR_CANS = 2;

export const CAR_BRANDS: readonly Exclude<CarBrand, 'Universal'>[] = [
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
];

export const PART_BRAND_OPTIONS: readonly CarBrand[] = [...CAR_BRANDS, 'Universal'];

export const PRIMARY_CATEGORIES: PrimaryCategory[] = [
  'Body parts',
  'Electricals',
  'Mechanical Parts',
  'Gearbox Oil',
  'Dashboard & Interior Parts',
];

export const BODY_PART_CONDITION_GRADES: ReadonlyArray<{
  grade: BodyPartConditionGrade;
  title: string;
  shortLabel: string;
  description: string;
}> = [
  {
    grade: 'A',
    title: 'Grade A',
    shortLabel: 'Grade A · Very clean',
    description: 'Very clean part',
  },
  {
    grade: 'B',
    title: 'Grade B',
    shortLabel: 'Grade B · Slightly scratched',
    description: 'Slightly scratched',
  },
  {
    grade: 'C',
    title: 'Grade C',
    shortLabel: 'Grade C · Little breakage',
    description: 'Little breakage but still functional',
  },
];

export function getBodyPartConditionInfo(grade?: BodyPartConditionGrade): {
  grade: BodyPartConditionGrade;
  title: string;
  shortLabel: string;
  description: string;
  label: string;
} | null {
  if (!grade) return null;
  const found = BODY_PART_CONDITION_GRADES.find((g) => g.grade === grade);
  if (!found) return null;
  return {
    ...found,
    label: `${found.title} — ${found.description}`,
  };
}

export interface CustomerVehicleProfile {
  brand?: CarBrand | 'All' | '';
  carModel?: string;
  yearOfMake?: string;
}

function extractYearTokens(raw?: string): number[] {
  if (!raw) return [];
  const matches = raw.match(/\b(19\d{2}|20\d{2})\b/g);
  if (!matches) return [];
  return matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
}

export function doesPartMatchCustomerVehicle(
  part: SparePart,
  vehicle: CustomerVehicleProfile | null | undefined,
): boolean {
  if (!vehicle) return false;
  const brandFilter = vehicle.brand && vehicle.brand !== 'All' ? vehicle.brand : '';
  const modelFilter = (vehicle.carModel || '').trim().toLowerCase();
  const yearFilter = (vehicle.yearOfMake || '').trim();

  if (!brandFilter && !modelFilter && !yearFilter) return false;

  const partText = `${part.name} ${part.description} ${part.carModel || ''}`.toLowerCase();
  const partBrand = part.brand || 'Universal';

  if (brandFilter) {
    const isUniversalOil = part.category === 'Gearbox Oil' && partBrand === 'Universal';
    if (partBrand !== brandFilter && !isUniversalOil && !partText.includes(brandFilter.toLowerCase())) {
      return false;
    }
  }

  if (modelFilter) {
    const tokens = modelFilter.split(/\s+/).filter((t) => t.length >= 2);
    const hasModelMatch =
      tokens.length > 0 ? tokens.every((tok) => partText.includes(tok)) : partText.includes(modelFilter);
    if (!hasModelMatch) return false;
  }

  if (yearFilter) {
    const partYearStr = `${part.yearOfMake || ''} ${part.name} ${part.description}`.trim();
    const targetYearNum = Number(yearFilter.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || '');
    const partYears = extractYearTokens(partYearStr);
    if (targetYearNum && partYears.length >= 2) {
      const minY = Math.min(...partYears);
      const maxY = Math.max(...partYears);
      if (targetYearNum < minY || targetYearNum > maxY) {
        return false;
      }
    } else if (partYears.length > 0 && targetYearNum) {
      if (!partYears.includes(targetYearNum)) return false;
    } else if (!partYearStr.toLowerCase().includes(yearFilter.toLowerCase())) {
      return false;
    }
  }

  return true;
}

export const CATEGORY_SUBCATEGORIES: Record<PrimaryCategory, string[]> = {
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

export function formatCurrency(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE')}`;
}

export function isGearboxOilPart(part: SparePart): boolean {
  if (part.category === 'Gearbox Oil' || part.subcategory === 'Gearbox Oil') return true;
  if (part.subcategory === 'Gearboxes' || part.category === 'Mechanical Parts') return false;
  const nameAndSub = `${part.name} ${part.subcategory}`.toLowerCase();
  return (
    /\b(?:gearbox|transmission)\s+(?:oil|fluid)\b/i.test(nameAndSub) ||
    /\b(?:cvt\s*(?:tc|fe)|atf\s*ws|75w-?90)\b/i.test(nameAndSub)
  );
}

export function isGearboxPart(part: SparePart): boolean {
  if (isGearboxOilPart(part)) return false;
  if (part.subcategory === 'Gearboxes') return true;
  return /\bgearbox(?:es)?\b/i.test(part.name);
}

export type GearboxTypeKey = 'cvt' | 'manual' | 'automatic' | 'general';

function detectFamilyFromText(text: string): GearboxTypeKey {
  if (/\bcvt\b/.test(text)) return 'cvt';
  if (/\bmanual\b|\bsynchromesh\b|\b75w-?90\b|\b80w-?90\b|\bgl-?[45]\b/.test(text)) {
    return 'manual';
  }
  if (/\bauto(?:matic)?\b|\batf\b|\bws\b|\bdexron\b|\btiptronic\b|\bdsg\b|\bdct\b|\bmercon\b/.test(text)) {
    return 'automatic';
  }
  return 'general';
}

export function detectGearboxType(part: SparePart): {
  type: GearboxTypeKey;
  label: string;
  oilSpecLabel: string;
} {
  const customOilType = part.gearboxOilType?.trim();
  const customFamily = customOilType
    ? detectFamilyFromText(customOilType.toLowerCase())
    : 'general';
  const fallbackFamily = detectFamilyFromText(`${part.name} ${part.description}`.toLowerCase());
  const detectedType = customFamily !== 'general' ? customFamily : fallbackFamily;

  if (detectedType === 'cvt') {
    return {
      type: 'cvt',
      label: 'CVT Gearbox',
      oilSpecLabel: customOilType || 'CVT TC or CVT FE Gearbox Oil',
    };
  }
  if (detectedType === 'manual') {
    return {
      type: 'manual',
      label: 'Manual Gearbox',
      oilSpecLabel: customOilType || 'SAE 75W-90 Manual Gearbox Oil',
    };
  }
  if (detectedType === 'automatic') {
    return {
      type: 'automatic',
      label: 'Automatic Gearbox',
      oilSpecLabel: customOilType || 'ATF WS / Automatic Gearbox Oil',
    };
  }
  return {
    type: 'general',
    label: 'Gearbox',
    oilSpecLabel: customOilType || 'Matching Gearbox Oil',
  };
}

const GENERIC_OIL_STOP_WORDS = new Set([
  'gearbox',
  'transmission',
  'oil',
  'fluid',
  'genuine',
  'synthetic',
  'high',
  'efficiency',
  'matching',
  'litre',
  'litres',
  'can',
  'the',
  'for',
  'and',
  'or',
  'type',
  'sae',
]);

function extractOilSpecTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/[\s/,|+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !GENERIC_OIL_STOP_WORDS.has(t));
}

function classifyOilFamily(text: string): GearboxTypeKey {
  if (/\bcvt\b/.test(text)) return 'cvt';
  if (/\bmanual\b|\b75w-?90\b|\b80w-?90\b|\bgl-?[45]\b/.test(text)) return 'manual';
  if (/\batf\b|\bauto(?:matic)?\b|\bws\b|\bdexron\b|\bdsg\b|\bdct\b|\bmercon\b/.test(text)) {
    return 'automatic';
  }
  return 'general';
}

export interface GearboxOilMatchResult {
  type: GearboxTypeKey;
  label: string;
  oilSpecLabel: string;
  primaryOil: SparePart | null;
  exactOilIds: string[];
  oils: SparePart[];
}

export function getMatchingGearboxOils(
  gearbox: SparePart,
  catalog: SparePart[],
): GearboxOilMatchResult {
  const info = detectGearboxType(gearbox);
  const allOils = catalog.filter((item) => item.id !== gearbox.id && isGearboxOilPart(item));
  const customLower = (gearbox.gearboxOilType || '').trim().toLowerCase();
  const gearboxText = `${customLower} ${gearbox.name} ${gearbox.description}`.toLowerCase();
  const specSegments = customLower
    ? customLower
        .split(/[\/,|]|\bor\b/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const primaryTokens = extractOilSpecTokens(specSegments[0] || customLower || gearboxText);

  const scoreOil = (oil: SparePart): number => {
    const text = `${oil.name} ${oil.description} ${oil.subcategory}`.toLowerCase();
    const oilFamily = classifyOilFamily(text);

    // Strictly prevent cross-contaminating incompatible transmission fluid families
    if (info.type !== 'general' && oilFamily !== 'general' && oilFamily !== info.type) {
      return 100;
    }

    let score = 20;

    // 1. Honor explicit custom gearboxOilType segments in priority order
    if (specSegments.length > 0) {
      const wantsCvtFe = /\bcvt\s*fe\b/.test(customLower);
      const wantsCvtTc = /\bcvt\s*tc\b/.test(customLower);

      if (wantsCvtFe && !wantsCvtTc) {
        if (/\bcvt\s*fe\b/.test(text)) {
          score = Math.min(score, -40);
        } else if (/\bcvt\s*tc\b/.test(text)) {
          return 100;
        }
      } else if (wantsCvtTc && !wantsCvtFe) {
        if (/\bcvt\s*tc\b/.test(text)) {
          score = Math.min(score, -40);
        } else if (/\bcvt\s*fe\b/.test(text)) {
          return 100;
        }
      }

      specSegments.forEach((seg, segIdx) => {
        const segTokens = extractOilSpecTokens(seg);
        if (segTokens.length === 0) return;
        const corePhrase = segTokens.join(' ');
        if (corePhrase && text.includes(corePhrase)) {
          score = Math.min(score, -30 + segIdx * 8);
        } else {
          const matchedCount = segTokens.filter((tok) => text.includes(tok)).length;
          if (matchedCount > 0) {
            const ratio = matchedCount / segTokens.length;
            score = Math.min(score, Math.round(-20 * ratio) + segIdx * 8);
          }
        }
      });
    }

    // 2. Specific transmission code matching when no exact custom segment matched yet
    if (score >= 0) {
      if (info.type === 'cvt') {
        const boxWantsFe = /\bcvt\s*fe\b/.test(gearboxText);
        const boxWantsTc = /\bcvt\s*tc\b/.test(gearboxText);
        if (boxWantsFe && /\bcvt\s*fe\b/.test(text)) score = Math.min(score, -15);
        else if (boxWantsTc && /\bcvt\s*tc\b/.test(text)) score = Math.min(score, -15);
        else if (/\bcvt\s*(?:tc|fe)\b/.test(text)) score = Math.min(score, 0);
        else if (/\bcvt\b/.test(text)) score = Math.min(score, 2);
      } else if (info.type === 'manual') {
        if (/\b75w-?90\b/.test(gearboxText) && /\b75w-?90\b/.test(text)) {
          score = Math.min(score, -25);
        } else if (/\bmanual\b|\b75w-?90\b|\b80w-?90\b|\bgl-?[45]\b/.test(text)) {
          score = Math.min(score, -10);
        }
      } else if (info.type === 'automatic') {
        if (/\batf\s*ws\b/.test(gearboxText) && /\batf\s*ws\b/.test(text)) {
          score = Math.min(score, -25);
        } else if (/\batf\b|\bautomatic\b|\bws\b|\bdexron\b|\bdsg\b|\bdct\b/.test(text)) {
          score = Math.min(score, -10);
        }
      } else if (primaryTokens.length > 0) {
        const tokenHits = primaryTokens.filter((tok) => text.includes(tok)).length;
        if (tokenHits > 0) {
          score = Math.min(score, -tokenHits * 4);
        }
      }
    }

    // 3. Vehicle brand affinity tie-breaker (e.g., Nissan-branded oil for Nissan gearbox)
    if (
      score < 50 &&
      gearbox.brand &&
      gearbox.brand !== 'Universal' &&
      (oil.brand === gearbox.brand || text.includes(gearbox.brand.toLowerCase()))
    ) {
      score -= 3;
    }

    return score;
  };

  const scored = allOils
    .map((oil) => ({ oil, score: scoreOil(oil) }))
    .sort((a, b) => a.score - b.score || b.oil.stock - a.oil.stock);

  const compatible = scored.filter((entry) => entry.score < 50);
  const effectiveList = compatible.length > 0 ? compatible : scored;
  const bestScore = effectiveList[0]?.score ?? 999;
  const exactOilIds = effectiveList
    .filter((entry) => entry.score === bestScore)
    .map((entry) => entry.oil.id);
  const oils = effectiveList.map((entry) => entry.oil);

  return {
    ...info,
    primaryOil: oils[0] ?? null,
    exactOilIds,
    oils,
  };
}

export interface CartGearboxOilCrossSellGroup {
  key: string;
  gearboxNames: string[];
  gearboxCount: number;
  type: GearboxTypeKey;
  label: string;
  oilSpecLabel: string;
  primaryOil: SparePart;
  exactOilIds: string[];
  oils: SparePart[];
  recommendedCans: number;
  cansInCart: number;
  cansStillNeeded: number;
}

export function getCartGearboxOilCrossSells(
  cartItems: CartItem[],
  catalog: SparePart[],
): CartGearboxOilCrossSellGroup[] {
  const gearboxesInCart = cartItems.filter((item) => isGearboxPart(item.part));
  if (gearboxesInCart.length === 0) return [];

  const groups = new Map<
    string,
    {
      gearboxNames: string[];
      gearboxCount: number;
      match: GearboxOilMatchResult;
      primaryOil: SparePart;
    }
  >();

  for (const item of gearboxesInCart) {
    const match = getMatchingGearboxOils(item.part, catalog);
    if (!match.primaryOil) continue;
    const key = match.primaryOil.id;
    const existing = groups.get(key);
    if (existing) {
      existing.gearboxCount += item.quantity;
      existing.gearboxNames.push(item.part.name);
    } else {
      groups.set(key, {
        gearboxNames: [item.part.name],
        gearboxCount: item.quantity,
        match,
        primaryOil: match.primaryOil,
      });
    }
  }

  const cartQtyById = new Map(cartItems.map((i) => [i.part.id, i.quantity]));

  return Array.from(groups.entries()).map(([key, group]) => {
    const recommendedCans = group.gearboxCount * GEARBOX_OIL_PAIR_CANS;
    // Count cans of the exact matched oil(s) (or compatible oils in this specific group)
    const exactSet = new Set(
      group.match.exactOilIds.length > 0 ? group.match.exactOilIds : [group.primaryOil.id],
    );
    const cansInCart = Array.from(exactSet).reduce(
      (sum, oilId) => sum + (cartQtyById.get(oilId) || 0),
      0,
    );
    const cansStillNeeded = Math.max(0, recommendedCans - cansInCart);

    return {
      key,
      gearboxNames: group.gearboxNames,
      gearboxCount: group.gearboxCount,
      type: group.match.type,
      label: group.match.label,
      oilSpecLabel: group.match.oilSpecLabel,
      primaryOil: group.primaryOil,
      exactOilIds: group.match.exactOilIds,
      oils: group.match.oils,
      recommendedCans,
      cansInCart,
      cansStillNeeded,
    };
  });
}
