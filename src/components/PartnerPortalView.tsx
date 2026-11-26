import { useEffect, useMemo, useState } from 'react';
import {
  Wrench,
  Building2,
  Percent,
  Phone,
  MessageCircle,
  MessageSquare,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Search,
  X,
  RefreshCw,
  ShoppingBag,
  Receipt,
  Clock,
  Truck,
  CheckCircle2,
  Plus,
  Users,
  ArrowRight,
  Lock,
} from 'lucide-react';
import type {
  AuthUser,
  CartItem,
  OrderStatus,
  PartnerReferralOrderSummary,
  PrimaryCategory,
  SparePart,
  VirtualReceipt,
} from '../types';
import {
  calculateCheckoutPricing,
  CUSTOMER_CARE_NUMBER,
  formatCurrency,
  getPartOfferDetails,
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  getWhatsAppSupportUrl,
  GUARANTEE_NOTICE,
  isJoinedPartnerProgram,
  normalizeOrderStatus,
  ORDER_STATUSES,
  PARTNER_BASE_DISCOUNT_PCT,
  PARTNER_BULK_BONUS_PCT,
  PARTNER_BULK_MIN_QTY,
  PARTNER_BULK_MIN_SUBTOTAL,
  PARTNER_MAX_DISCOUNT_PCT,
  PARTNER_REGULAR_3_DISCOUNT_PCT,
  PARTNER_REGULAR_6_DISCOUNT_PCT,
  PARTNER_REGULAR_MIN_ITEMS,
  PARTNER_STARTER_MAX_ITEMS,
  PARTNER_TOP_TIER_MIN_ITEMS,
  PHYSICAL_STORE_ADDRESS,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  PRIMARY_CATEGORIES,
  REFERRAL_MECHANIC_CREDIT_PCT,
  SHOP_NAME,
} from '../constants/catalog';
import { BulkDiscountCalculator } from './BulkDiscountCalculator';

interface PartnerPortalViewProps {
  currentUser: AuthUser | null;
  authToken?: string | null;
  allParts: SparePart[];
  cart: CartItem[];
  cartQuantities: Record<string, number>;
  receipts: VirtualReceipt[];
  syncingData?: boolean;
  onRefreshPartnerData: () => Promise<void>;
  onAddToCart: (part: SparePart, quantity?: number) => void;
  onOpenCart: () => void;
  onViewReceipt: (receipt: VirtualReceipt) => void;
  onOpenSupport: () => void;
  onOpenAuth: () => void;
  onOpenPartnerModal: () => void;
  onBrowseCatalog: () => void;
}

const STATUS_BADGE_STYLES: Record<OrderStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Shipped: 'bg-sky-50 text-sky-800 border-sky-200',
  Delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function renderStatusIcon(status: OrderStatus) {
  if (status === 'Delivered') return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === 'Shipped') return <Truck className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
}

export function PartnerPortalView({
  currentUser,
  authToken = null,
  allParts,
  cart,
  cartQuantities,
  receipts,
  syncingData = false,
  onRefreshPartnerData,
  onAddToCart,
  onOpenCart,
  onViewReceipt,
  onOpenSupport,
  onOpenAuth,
  onOpenPartnerModal,
  onBrowseCatalog,
}: PartnerPortalViewProps) {
  const partner = currentUser?.partnerProfile ?? null;

  const [partSearch, setPartSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | PrimaryCategory>('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [copiedCode, setCopiedCode] = useState(false);
  const [recentlyAddedKey, setRecentlyAddedKey] = useState<string | null>(null);
  const [referralOrders, setReferralOrders] = useState<PartnerReferralOrderSummary[]>([]);

  const loadReferralOrders = async () => {
    if (!authToken || !partner) {
      setReferralOrders([]);
      return;
    }
    try {
      const res = await fetch('/api/partners/me/referrals', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { referrals?: PartnerReferralOrderSummary[] };
      if (Array.isArray(data.referrals)) {
        setReferralOrders(data.referrals);
      }
    } catch {
      // ignore transient network errors
    }
  };

  useEffect(() => {
    if (currentUser && partner) {
      void onRefreshPartnerData();
      void loadReferralOrders();
    } else {
      setReferralOrders([]);
    }
  }, [currentUser?.id, partner?.id, authToken, onRefreshPartnerData]);

  const isProFlagged = isJoinedPartnerProgram(partner);
  const loyaltyItemsCount = getPartnerLoyaltyItemsCount(partner);
  const baseTierPct = partner
    ? getPartnerTierDiscountPct(loyaltyItemsCount, partner.discountTierPercent, isProFlagged)
    : PARTNER_BASE_DISCOUNT_PCT;
  const maxBulkTierPct = Math.min(PARTNER_MAX_DISCOUNT_PCT, baseTierPct + PARTNER_BULK_BONUS_PCT);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.part.price * item.quantity, 0);
    const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
    const pricing = calculateCheckoutPricing({
      subtotal,
      totalUnits,
      items: cart.map((item) => ({
        partId: item.part.id,
        name: item.part.name,
        category: item.part.category,
        unitPrice: item.part.price,
        quantity: item.quantity,
        stock: item.part.stock,
      })),
      isProfessionalMechanicOrGarage: isProFlagged,
      partner: partner
        ? {
            status: partner.status,
            ordersCount: partner.ordersCount,
            itemsCount: partner.itemsCount,
            discountTierPercent: partner.discountTierPercent,
            partnerType: partner.partnerType,
            isProfessionalMechanicOrGarage: isProFlagged,
          }
        : null,
      referralValid: null,
    });
    return { subtotal, totalUnits, pricing };
  }, [cart, partner, isProFlagged]);

  const filteredParts = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    return allParts.filter((part) => {
      if (selectedCategory !== 'All' && part.category !== selectedCategory) return false;
      if (!q) return true;
      const hay = `${part.name} ${part.sku} ${part.brand ?? ''} ${part.category} ${part.subcategory}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allParts, partSearch, selectedCategory]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return receipts.filter((receipt) => {
      const status = normalizeOrderStatus(receipt.status);
      if (orderStatusFilter !== 'All' && status !== orderStatusFilter) return false;
      if (!q) return true;
      const itemsText = receipt.items.map((i) => `${i.name} ${i.sku}`).join(' ');
      const hay = `${receipt.receiptNumber} ${status} ${receipt.discountLabel ?? ''} ${itemsText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [receipts, orderSearch, orderStatusFilter]);

  const orderTotals = useMemo(() => {
    const totalSaved = receipts.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const totalNet = receipts.reduce((sum, r) => sum + r.total, 0);
    return { totalSaved, totalNet };
  }, [receipts]);

  const handleCopyReferral = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const triggerQuickAdd = (part: SparePart, qty: number, key: string) => {
    onAddToCart(part, qty);
    setRecentlyAddedKey(key);
    window.setTimeout(() => {
      setRecentlyAddedKey((curr) => (curr === key ? null : curr));
    }, 1000);
  };

  const bulkWhatsAppMessage = partner
    ? `Hello ${SHOP_NAME} Trade Desk, this is ${partner.businessName} (${partner.partnerType === 'garage' ? 'Garage' : 'Mechanic'} Partner · Code: ${partner.referralCode} · Tier: ${baseTierPct}%). I would like a bulk spare parts inquiry / stock confirmation.`
    : `Hello ${SHOP_NAME} Trade Desk, I would like to inquire about Garage / Mechanic Partner bulk pricing and stock availability.`;

  const tierMilestones = [
    {
      label: 'Starter Partner',
      requirement: `0–${PARTNER_STARTER_MAX_ITEMS} items`,
      rate: PARTNER_BASE_DISCOUNT_PCT,
      active: loyaltyItemsCount < PARTNER_REGULAR_MIN_ITEMS,
    },
    {
      label: 'Regular Buyer',
      requirement: `${PARTNER_REGULAR_MIN_ITEMS}–${PARTNER_TOP_TIER_MIN_ITEMS - 1} items`,
      rate: PARTNER_REGULAR_3_DISCOUNT_PCT,
      active:
        loyaltyItemsCount >= PARTNER_REGULAR_MIN_ITEMS &&
        loyaltyItemsCount < PARTNER_TOP_TIER_MIN_ITEMS,
    },
    {
      label: 'Top Loyalty Tier',
      requirement: `${PARTNER_TOP_TIER_MIN_ITEMS}+ items`,
      rate: PARTNER_REGULAR_6_DISCOUNT_PCT,
      active: loyaltyItemsCount >= PARTNER_TOP_TIER_MIN_ITEMS,
    },
  ];

  const itemsToNextTier =
    !partner || loyaltyItemsCount >= PARTNER_TOP_TIER_MIN_ITEMS
      ? 0
      : loyaltyItemsCount >= PARTNER_REGULAR_MIN_ITEMS
        ? PARTNER_TOP_TIER_MIN_ITEMS - loyaltyItemsCount
        : PARTNER_REGULAR_MIN_ITEMS - loyaltyItemsCount;

  if (!currentUser || !partner) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {SHOP_NAME} Trade Desk · Garage & Mobile Mechanic Program
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
              Garage & Mechanic Partner Portal
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Track exclusive trade & bulk pricing (up to {PARTNER_MAX_DISCOUNT_PCT}% off), manage partner order history, and connect directly with our bulk dispatch team.
            </p>
          </div>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Back to Catalog</span>
          </button>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 max-w-3xl mx-auto space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
              {currentUser ? <Wrench className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {currentUser
                  ? 'Activate your Garage or Mechanic Partner account'
                  : 'Sign in or register as a Garage / Mechanic Partner'}
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                {currentUser
                  ? `You are signed in as ${currentUser.name} (${currentUser.phone}). Link your workshop or mobile mechanic profile to unlock instant wholesale pricing, bulk bonuses, and a ${REFERRAL_MECHANIC_CREDIT_PCT}% mechanic referral credit released after fitting & testing.`
                  : 'Sign in with your registered partner phone and email, or activate a new Garage / Mobile Mechanic partner account in seconds.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">Trade & Regular Tiers</p>
              <p className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-0.5">
                {PARTNER_BASE_DISCOUNT_PCT}% – {PARTNER_REGULAR_6_DISCOUNT_PCT}% off
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Automatically climbs as you buy more items
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Bulk Order Bonus</p>
              <p className="font-mono tabular-nums text-lg font-bold text-orange-600 mt-0.5">
                +{PARTNER_BULK_BONUS_PCT}% extra
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                On {PARTNER_BULK_MIN_QTY}+ units &amp; ≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Mechanic Referral Credit</p>
              <p className="font-mono tabular-nums text-lg font-bold text-emerald-700 mt-0.5">
                {REFERRAL_MECHANIC_CREDIT_PCT}% mechanic credit
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Credited after fitting &amp; testing (no customer discount)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenPartnerModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Wrench className="w-4 h-4" />
              <span>Register Garage / Mechanic Partner</span>
            </button>
            {!currentUser && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Sign In to Existing Account</span>
              </button>
            )}
          </div>

          <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">Direct bulk inquiries:</span>
            <a
              href={`tel:${CUSTOMER_CARE_NUMBER}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-mono">{CUSTOMER_CARE_NUMBER}</span>
            </a>
            <a
              href={getWhatsAppSupportUrl(bulkWhatsAppMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Bulk Desk</span>
            </a>
            <button
              type="button"
              onClick={onOpenSupport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Support Chat</span>
            </button>
          </div>
        </section>

        <BulkDiscountCalculator
          allParts={allParts}
          cart={cart}
          onAddToCart={onAddToCart}
          onOpenCart={onOpenCart}
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Partner Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              {partner.partnerType === 'garage' ? (
                <Building2 className="w-3.5 h-3.5 text-orange-600" />
              ) : (
                <Wrench className="w-3.5 h-3.5 text-orange-600" />
              )}
              <span>
                {partner.partnerType === 'garage'
                  ? 'Independent Garage Partner'
                  : 'Mobile Mechanic Partner'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{partner.location}</span>
            {partner.specialty && (
              <>
                <span aria-hidden="true">·</span>
                <span>{partner.specialty}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                partner.status === 'active'
                  ? 'text-emerald-700'
                  : partner.status === 'pending'
                    ? 'text-blue-700'
                    : partner.status === 'rejected'
                      ? 'text-red-700'
                      : 'text-amber-700'
              }`}
            >
              {partner.status === 'active'
                ? 'Verified Active Partner'
                : partner.status === 'pending'
                  ? 'Pending Admin Verification'
                  : partner.status === 'rejected'
                    ? 'Application Rejected'
                    : 'Account Paused'}
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            {partner.businessName}
          </h1>

          <p className="text-sm text-slate-600">
            Lead Contact: <span className="font-medium text-slate-900">{partner.contactName}</span>{' '}
            <span className="font-mono text-xs text-slate-500">({partner.phone})</span>
            <span aria-hidden="true" className="mx-2 text-slate-300">
              ·
            </span>
            <span>{GUARANTEE_NOTICE}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {partner.status === 'active' && (
            <button
              type="button"
              onClick={() => void handleCopyReferral(partner.referralCode)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span className="text-slate-500 font-normal">Code:</span>
              <span className="font-mono font-bold text-slate-900">{partner.referralCode}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void onRefreshPartnerData();
              void loadReferralOrders();
            }}
            disabled={syncingData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingData ? 'animate-spin' : ''}`} />
            <span>{syncingData ? 'Syncing...' : 'Refresh Data'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="tabular-nums">Cart ({cartSummary.totalUnits})</span>
          </button>
        </div>
      </div>

      {partner.status === 'pending' && (
        <div
          role="status"
          className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-xs sm:text-sm text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-1">
            <p className="font-bold">
              Your mechanic/garage verification proof is currently under admin review.
            </p>
            <p className="text-xs text-blue-900">
              Trade discounts and your customer referral code will activate automatically upon approval, and you will receive an automated SMS confirmation at{' '}
              <span className="font-mono font-semibold">{partner.phone}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {partner.proofUrl && (
              <a
                href={partner.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-blue-300 text-blue-900 rounded-lg hover:bg-blue-100"
              >
                <span>Submitted Proof</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <a
              href={`tel:${CUSTOMER_CARE_NUMBER}`}
              className="font-semibold underline underline-offset-2 text-blue-950 whitespace-nowrap text-xs"
            >
              Call Trade Desk ({CUSTOMER_CARE_NUMBER})
            </a>
          </div>
        </div>
      )}

      {partner.status === 'rejected' && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-xs sm:text-sm text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-1">
            <p className="font-bold text-red-900">
              Verification Application Needs Updated Proof
            </p>
            <p className="text-xs text-red-800">
              {partner.rejectionReason ||
                'Your previous proof document could not be verified. Please upload a clearer garage photo, NITA certificate, or business permit.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPartnerModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Upload New Proof &amp; Reapply
          </button>
        </div>
      )}

      {partner.status === 'paused' && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-xs sm:text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            This partner account is currently paused by store administration. Wholesale trade discounts will resume once reactivated.
          </span>
          <a
            href={`tel:${CUSTOMER_CARE_NUMBER}`}
            className="font-semibold underline underline-offset-2 text-amber-950 whitespace-nowrap"
          >
            Call Trade Desk ({CUSTOMER_CARE_NUMBER})
          </a>
        </div>
      )}

      {/* 4-Column Partner KPI Strip */}
      <section aria-label="Partner account metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            {partner.status === 'active' ? 'Active Trade Tier' : 'Approved Trade Tier'}
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {partner.status === 'active' ? `${baseTierPct}% off` : 'Pending'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {partner.status !== 'active'
              ? `${baseTierPct}% base tier unlocks on approval`
              : isProFlagged
                ? 'Automated loyalty tiers excluded (Professional Mechanic/Garage)'
                : itemsToNextTier === 0
                  ? 'Top loyalty tier unlocked'
                  : `${itemsToNextTier} more ${itemsToNextTier === 1 ? 'item' : 'items'} to next tier`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Maximum Bulk Rate</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-orange-600 mt-1">
            {maxBulkTierPct}% off
          </p>
          <p className="text-xs text-slate-600 mt-1">
            +{PARTNER_BULK_BONUS_PCT}% bulk bonus on {PARTNER_BULK_MIN_QTY}+ units &amp; ≥{' '}
            {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Partner Items &amp; Orders</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {loyaltyItemsCount}{' '}
            <span className="text-sm font-sans font-semibold text-slate-500">
              {loyaltyItemsCount === 1 ? 'item' : 'items'}
            </span>{' '}
            <span className="text-xs font-sans font-medium text-slate-400">
              ({partner.ordersCount} {partner.ordersCount === 1 ? 'order' : 'orders'})
            </span>
          </p>
          <p className="text-xs text-emerald-700 font-medium tabular-nums mt-1">
            {formatCurrency(orderTotals.totalSaved)} saved · {formatCurrency(partner.totalSpent)} spent
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            {REFERRAL_MECHANIC_CREDIT_PCT}% Referral Credit Balance
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
            {formatCurrency(partner.referralCreditBalance || 0)}
          </p>
          <p className="text-xs text-slate-600 tabular-nums mt-1">
            <span className="font-semibold text-amber-700">
              {formatCurrency(partner.referralCreditPending || 0)} pending fit
            </span>{' '}
            · {partner.referralsCount} {partner.referralsCount === 1 ? 'ref' : 'refs'} ({formatCurrency(partner.referredRevenue)})
          </p>
        </div>
      </section>

      {/* Direct Contact Buttons for Bulk Order Inquiries */}
      <section
        aria-label="Direct bulk order inquiry channels"
        className="bg-slate-900 text-white rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
      >
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-orange-400">
            Dedicated Trade & Bulk Inquiry Desk
          </p>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white">
            Need multi-vehicle stock, custom gearbox lots, or urgent garage dispatch?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Reach our Kirinyaga Road wholesale counter directly for fast stock holds, bulk pricing quotes, and same-day rider or upcountry courier dispatch.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              <span>{PHYSICAL_STORE_ADDRESS}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{PHYSICAL_STORE_HOURS}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={getWhatsAppSupportUrl(bulkWhatsAppMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Bulk Inquiry</span>
          </a>

          <a
            href={`tel:${CUSTOMER_CARE_NUMBER}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Phone className="w-4 h-4 text-orange-600" />
            <span className="font-mono">Call {CUSTOMER_CARE_NUMBER}</span>
          </a>

          <button
            type="button"
            onClick={onOpenSupport}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live Trade Chat</span>
          </button>

          <a
            href={PHYSICAL_STORE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-orange-400" />
            <span>Directions</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Section 1: Exclusive Bulk Pricing & Tier Schedule */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Exclusive Partner & Bulk Pricing Schedule
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Your {baseTierPct}% base trade discount applies to every item automatically. Ordering {PARTNER_BULK_MIN_QTY}+ units &amp; ≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)} unlocks an extra +{PARTNER_BULK_BONUS_PCT}% bulk bonus ({maxBulkTierPct}% total off). Retail same-part tier discounts do not stack on partner accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPartnerModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Users className="w-3.5 h-3.5 text-orange-600" />
            <span>Referral Code & Details</span>
          </button>
        </div>

        {/* Tier Qualification Strip */}
        <div className="bg-white border border-slate-200 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200 grid grid-cols-1 md:grid-cols-4">
          {tierMilestones.map((tier) => (
            <div key={tier.label} className={`p-4 ${tier.active ? 'bg-orange-50/70' : ''}`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-900">{tier.label}</span>
                {tier.active && (
                  <span className="font-semibold text-orange-700">Your Tier</span>
                )}
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                {tier.rate}% off
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{tier.requirement}</p>
            </div>
          ))}
          <div className="p-4 bg-slate-50/80">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">Bulk Order Bonus</span>
              <span className="font-semibold text-emerald-700">Stackable</span>
            </div>
            <p className="font-mono tabular-nums text-lg font-bold text-emerald-700 mt-1">
              +{PARTNER_BULK_BONUS_PCT}% (up to {PARTNER_MAX_DISCOUNT_PCT}%)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {PARTNER_BULK_MIN_QTY}+ units &amp; ≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
            </p>
          </div>
        </div>

        {/* Live Cart Bulk Progress */}
        {cartSummary.totalUnits > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-orange-600" />
                <span>
                  Current Cart: {cartSummary.totalUnits}{' '}
                  {cartSummary.totalUnits === 1 ? 'unit' : 'units'} · Subtotal{' '}
                  <span className="font-mono tabular-nums">{formatCurrency(cartSummary.subtotal)}</span>
                </span>
              </p>
              <p className="text-xs text-slate-600">
                {cartSummary.pricing.qualifiesBulk ? (
                  <span className="text-emerald-700 font-medium">
                    Bulk bonus unlocked: saving {formatCurrency(cartSummary.pricing.discountAmount)} ({cartSummary.pricing.discountPercent}% total off) → Net{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      {formatCurrency(cartSummary.pricing.total)}
                    </span>
                  </span>
                ) : (
                  <span>
                    Currently saving {formatCurrency(cartSummary.pricing.discountAmount)} ({cartSummary.pricing.discountPercent}%).{' '}
                    {cartSummary.totalUnits < PARTNER_BULK_MIN_QTY
                      ? `Need ${PARTNER_BULK_MIN_QTY - cartSummary.totalUnits} more ${PARTNER_BULK_MIN_QTY - cartSummary.totalUnits === 1 ? 'unit' : 'units'} and `
                      : 'Need '}
                    {cartSummary.subtotal < PARTNER_BULK_MIN_SUBTOTAL
                      ? `${formatCurrency(PARTNER_BULK_MIN_SUBTOTAL - cartSummary.subtotal)} more (≥ ${formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}) `
                      : ''}
                    to unlock <strong>{maxBulkTierPct}% bulk off</strong>.
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <span>Review Cart & Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Interactive Bulk Discount Calculator */}
        <BulkDiscountCalculator
          allParts={allParts}
          partner={partner}
          cart={cart}
          onAddToCart={onAddToCart}
          onOpenCart={onOpenCart}
        />

        {/* Wholesale Price List Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Search part name, SKU, or brand..."
                aria-label="Search wholesale catalog"
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              {partSearch && (
                <button
                  type="button"
                  onClick={() => setPartSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Clear wholesale search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', ...PRIMARY_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredParts.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700">
                No spare parts match your current wholesale filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPartSearch('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Show All Parts
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Part & SKU</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Retail Price</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      Partner ({baseTierPct}% off)
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      Bulk ({maxBulkTierPct}% off)
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Stock</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Quick Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredParts.map((part) => {
                    const partnerPrice = Math.round(part.price * (1 - baseTierPct / 100));
                    const bulkPrice = Math.round(part.price * (1 - maxBulkTierPct / 100));
                    const inCartQty = cartQuantities[part.id] || 0;
                    const singleKey = `${part.id}-1`;
                    const bulkKey = `${part.id}-${PARTNER_BULK_MIN_QTY}`;
                    const canAddBulk = part.stock >= PARTNER_BULK_MIN_QTY;
                    const canAdd1 = part.stock >= 1;
                    const partInquiryUrl = getWhatsAppSupportUrl(
                      `Hello ${SHOP_NAME} Trade Desk, this is ${partner.businessName} (${partner.referralCode}). Please confirm bulk availability & pricing for ${part.name} (SKU: ${part.sku}).`,
                    );

                    return (
                      <tr key={part.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 min-w-[230px]">
                          <p className="font-semibold text-slate-900">{part.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{part.sku}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{part.brand || 'Universal'}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{part.subcategory}</span>
                            {inCartQty > 0 && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-semibold text-orange-700 font-mono tabular-nums">
                                  {inCartQty} in cart
                                </span>
                              </>
                            )}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          <span className="line-through block">{formatCurrency(part.price)}</span>
                          {(() => {
                            const offer = getPartOfferDetails(part);
                            return offer.hasOffer && offer.previousPrice !== null ? (
                              <span className="text-[10px] font-sans font-semibold text-orange-700">
                                Offer · Was {formatCurrency(offer.previousPrice)}
                              </span>
                            ) : null;
                          })()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(partnerPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(bulkPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                          <span
                            className={
                              part.stock === 0
                                ? 'text-red-700 font-semibold'
                                : part.stock <= 3
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-slate-700'
                            }
                          >
                            {part.stock === 0 ? 'Out' : `${part.stock} pcs`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {canAdd1 ? (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => triggerQuickAdd(part, 1, singleKey)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{recentlyAddedKey === singleKey ? 'Added' : '1 pc'}</span>
                              </button>
                              {canAddBulk ? (
                                <button
                                  type="button"
                                  onClick={() => triggerQuickAdd(part, PARTNER_BULK_MIN_QTY, bulkKey)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>
                                    {recentlyAddedKey === bulkKey
                                      ? `Added ×${PARTNER_BULK_MIN_QTY}`
                                      : `${PARTNER_BULK_MIN_QTY} Bulk`}
                                  </span>
                                </button>
                              ) : (
                                <a
                                  href={partInquiryUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Ask Bulk</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <a
                              href={partInquiryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Request Restock</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Partner Order History & Savings Tracker */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Partner Order History
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Every order linked to {partner.businessName}, showing bulk discounts applied, net totals, and live dispatch status.
            </p>
          </div>
          {receipts.length > 0 && (
            <p className="text-xs font-mono tabular-nums text-slate-600">
              {receipts.length} {receipts.length === 1 ? 'order' : 'orders'} · Net{' '}
              <strong className="text-slate-900">{formatCurrency(orderTotals.totalNet)}</strong> · Saved{' '}
              <strong className="text-emerald-700">{formatCurrency(orderTotals.totalSaved)}</strong>
            </p>
          )}
        </div>

        {receipts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              No partner orders placed yet
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Add parts from your wholesale price table above ({PARTNER_BULK_MIN_QTY}+ items &amp; ≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)} for {maxBulkTierPct}% bulk savings) to log your first partner order.
            </p>
            <button
              type="button"
              onClick={onBrowseCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Full Catalog</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search receipt no. or item..."
                    aria-label="Filter partner orders"
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  {orderSearch && (
                    <button
                      type="button"
                      onClick={() => setOrderSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label="Clear order search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div
                  className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start"
                  role="tablist"
                  aria-label="Filter partner orders by status"
                >
                  {(['All', ...ORDER_STATUSES] as const).map((statusOption) => {
                    const active = orderStatusFilter === statusOption;
                    return (
                      <button
                        key={statusOption}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setOrderStatusFilter(statusOption)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {statusOption === 'All' ? 'All Statuses' : statusOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              <span className="text-xs font-mono tabular-nums text-slate-500">
                {filteredOrders.length} of {receipts.length}{' '}
                {receipts.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No partner orders match the selected filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOrderSearch('');
                    setOrderStatusFilter('All');
                  }}
                  className="mt-3 px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Reset Order Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((receipt) => {
                  const status = normalizeOrderStatus(receipt.status);
                  const totalUnits = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
                  const issuedDate = new Date(receipt.issuedAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <article
                      key={receipt.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-900">
                            {receipt.receiptNumber}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{issuedDate}</span>
                          <span aria-hidden="true">·</span>
                          <span>{receipt.paymentMethod}</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border ${STATUS_BADGE_STYLES[status]}`}
                          >
                            {renderStatusIcon(status)}
                            <span>{status}</span>
                          </span>
                        </div>

                        <p className="text-sm font-medium text-slate-900">
                          {receipt.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                        </p>

                        <p className="text-xs text-slate-500">
                          Delivery: {receipt.deliveryAddress}
                          {receipt.courierName ? ` · Courier: ${receipt.courierName}` : ''}
                          {receipt.discountLabel ? ` · ${receipt.discountLabel}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                        <div className="lg:text-right">
                          <p className="text-xs text-slate-500 tabular-nums">
                            {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                            {Boolean(receipt.discountAmount && receipt.discountAmount > 0) && (
                              <span className="ml-2 text-emerald-700 font-semibold">
                                · Saved {formatCurrency(receipt.discountAmount || 0)}
                              </span>
                            )}
                          </p>
                          <p className="font-mono tabular-nums text-lg font-bold text-slate-900">
                            {formatCurrency(receipt.total)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onViewReceipt(receipt)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Section 3: Referred Client Orders & 1% Credit Tracker */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Referred Client Sales &amp; {REFERRAL_MECHANIC_CREDIT_PCT}% Fitting Credit
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Clients referred with code <strong className="font-mono text-slate-900">{partner.referralCode}</strong> pay standard pricing (no customer discount). Your {REFERRAL_MECHANIC_CREDIT_PCT}% credit is released to your available balance once the spare part is fitted and tested.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
              Pending Fit: {formatCurrency(partner.referralCreditPending || 0)}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              Available Credit: {formatCurrency(partner.referralCreditBalance || 0)}
            </span>
          </div>
        </div>

        {referralOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              No client orders have used your referral code yet
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Share <strong className="font-mono text-slate-800">{partner.referralCode}</strong> with vehicle owners purchasing parts. When fitting &amp; testing is confirmed, {REFERRAL_MECHANIC_CREDIT_PCT}% credit unlocks on your account.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Receipt &amp; Date</th>
                    <th className="py-3 px-4">Customer &amp; Parts</th>
                    <th className="py-3 px-4 text-right">Order Total</th>
                    <th className="py-3 px-4 text-right">{REFERRAL_MECHANIC_CREDIT_PCT}% Mechanic Credit</th>
                    <th className="py-3 px-4 text-right">Credit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {referralOrders.map((refOrder) => {
                    const issuedDate = new Date(refOrder.issuedAt).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });
                    const isCredited = refOrder.referralCreditStatus === 'credited';
                    return (
                      <tr key={refOrder.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-mono text-xs font-bold text-slate-900">
                            {refOrder.receiptNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">{issuedDate}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-semibold text-slate-900">
                            {refOrder.customerName}
                          </p>
                          <p className="text-xs text-slate-600 line-clamp-1">
                            {refOrder.itemsSummary}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(refOrder.total)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-bold text-emerald-700 whitespace-nowrap">
                          +{formatCurrency(refOrder.referralCreditAmount)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                              isCredited
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isCredited ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Credited (Fitted &amp; Tested)</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Pending Fitting &amp; Testing</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
