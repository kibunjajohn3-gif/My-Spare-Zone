import { useEffect, useState } from 'react';
import {
  Receipt,
  ShoppingBag,
  Search,
  Phone,
  X,
  Clock,
  Truck,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  Lock,
  Percent,
  MapPin,
  ExternalLink,
  Wrench,
  Calendar,
  Navigation,
} from 'lucide-react';
import type { AuthUser, OrderStatus, VirtualReceipt } from '../types';
import {
  CUSTOMER_CARE_NUMBER,
  CUSTOMER_CARE_WHATSAPP_URL,
  formatCurrency,
  formatFittingDateLabel,
  getGarageSlotLabel,
  GUARANTEE_NOTICE,
  normalizeOrderStatus,
  normalizeTrackingStage,
  ORDER_STATUSES,
  ORDER_TRACKING_STAGES,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  PICKUP_RESERVATION_HOURS,
  RETURN_EXCHANGE_POLICY_NOTICE,
} from '../constants/catalog';
import { OrderTrackingModal } from './OrderTrackingModal';

interface OrderHistoryViewProps {
  currentUser: AuthUser | null;
  authToken?: string | null;
  receipts: VirtualReceipt[];
  syncingStatuses?: boolean;
  onRefreshStatuses: () => Promise<void>;
  onOrderSynced?: (receipt: VirtualReceipt) => void;
  onViewReceipt: (receipt: VirtualReceipt) => void;
  onBrowseCatalog: () => void;
  onOpenAuth: () => void;
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

export function OrderHistoryView({
  currentUser,
  authToken,
  receipts,
  syncingStatuses = false,
  onRefreshStatuses,
  onOrderSynced,
  onViewReceipt,
  onBrowseCatalog,
  onOpenAuth,
}: OrderHistoryViewProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);

  const trackedReceipt = trackedOrderId
    ? receipts.find((r) => r.id === trackedOrderId) ?? null
    : null;

  useEffect(() => {
    if (currentUser) {
      void onRefreshStatuses();
    }
  }, [currentUser, onRefreshStatuses]);

  const normalizedQuery = filterQuery.trim().toLowerCase();
  const filteredReceipts = receipts.filter((receipt) => {
    const status = normalizeOrderStatus(receipt.status);
    if (statusFilter !== 'All' && status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    const itemNames = receipt.items.map((i) => `${i.name} ${i.sku}`).join(' ');
    const haystack =
      `${receipt.receiptNumber} ${receipt.pickupCode || ''} ${status} ${receipt.customerName} ${receipt.customerPhone} ${itemNames}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {currentUser
              ? `Signed in as ${currentUser.name} (${currentUser.phone}) · ${GUARANTEE_NOTICE}`
              : `Live order status & receipts · ${GUARANTEE_NOTICE}`}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
            Order History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your order fulfillment status (Pending, Shipped, Delivered) and print or download your virtual receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUser && (
            <button
              type="button"
              onClick={() => void onRefreshStatuses()}
              disabled={syncingStatuses}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingStatuses ? 'animate-spin' : ''}`} />
              <span>{syncingStatuses ? 'Refreshing...' : 'Refresh Status'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Spare Parts</span>
          </button>
        </div>
      </div>

      {/* Sign-In Required State */}
      {!currentUser ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Sign in to view your order history
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Your order history is private and only shows orders placed by your signed-in account. Sign in with the mobile number and email you use at My Spare Zone.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
            >
              Sign In to View Orders
            </button>
            <button
              type="button"
              onClick={onBrowseCatalog}
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Shop Spare Parts
            </button>
          </div>
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            No orders found for this account
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Once you complete an order while signed in as {currentUser.name} ({currentUser.phone}), your virtual receipt and live status tracker will appear here.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="mt-5 px-5 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
          >
            Shop Spare Parts
          </button>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search receipt no., status, or item..."
                  aria-label="Filter order history"
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start"
                role="tablist"
                aria-label="Filter orders by status"
              >
                {(['All', ...ORDER_STATUSES] as const).map((statusOption) => {
                  const active = statusFilter === statusOption;
                  return (
                    <button
                      key={statusOption}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusFilter(statusOption)}
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
              {filteredReceipts.length} of {receipts.length}{' '}
              {receipts.length === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>

          {/* Receipts List */}
          {filteredReceipts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No matching orders found for the current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setStatusFilter('All');
                }}
                className="mt-3 px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReceipts.map((receipt) => {
                const status = normalizeOrderStatus(receipt.status);
                const trackingStage = normalizeTrackingStage(receipt.trackingStage, status);
                const trackingIndex = ORDER_TRACKING_STAGES.findIndex(
                  (s) => s.stage === trackingStage,
                );
                const isActiveOrder = trackingStage !== 'delivered';
                const totalUnits = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
                const formattedDate = new Date(receipt.issuedAt).toLocaleString('en-KE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                const updatedDate = receipt.statusUpdatedAt
                  ? new Date(receipt.statusUpdatedAt).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : null;

                return (
                  <article
                    key={receipt.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-2.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">
                          {receipt.receiptNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formattedDate}</span>
                        <span aria-hidden="true">·</span>
                        <span>{receipt.paymentMethod}</span>
                        {receipt.mpesaReceiptNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid ({receipt.mpesaReceiptNumber})</span>
                          </span>
                        )}
                        {receipt.cardTransactionRef && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid ({receipt.cardTransactionRef})</span>
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${STATUS_BADGE_STYLES[status]}`}
                        >
                          {renderStatusIcon(status)}
                          <span>{status}</span>
                        </span>
                      </div>

                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                        {receipt.customerName}
                        <span className="font-mono text-xs font-normal text-slate-500 ml-2.5">
                          {receipt.customerPhone}
                        </span>
                      </h2>

                      <p className="text-sm text-slate-600 line-clamp-2">
                        {receipt.items
                          .map((item) => `${item.quantity}× ${item.name}`)
                          .join(', ')}
                      </p>

                      {/* 4-Stage Real-Time Progress Strip */}
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                        {ORDER_TRACKING_STAGES.map((step, idx) => {
                          const reached = idx <= trackingIndex;
                          const isCurrent = idx === trackingIndex;
                          return (
                            <div key={step.stage} className="inline-flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isCurrent
                                    ? 'text-slate-900 font-semibold'
                                    : reached
                                      ? 'text-emerald-700'
                                      : 'text-slate-400'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isCurrent
                                      ? trackingStage === 'delivered'
                                        ? 'bg-emerald-600'
                                        : trackingStage === 'out_for_delivery'
                                          ? 'bg-orange-600'
                                          : trackingStage === 'dispatched'
                                            ? 'bg-sky-600'
                                            : 'bg-amber-500'
                                      : reached
                                        ? 'bg-emerald-600'
                                        : 'bg-slate-300'
                                  }`}
                                />
                                <span>{step.label}</span>
                              </span>
                              {idx < ORDER_TRACKING_STAGES.length - 1 && (
                                <span
                                  aria-hidden="true"
                                  className={`w-4 h-px ${
                                    idx < trackingIndex ? 'bg-emerald-500' : 'bg-slate-200'
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                        {updatedDate && (
                          <span className="text-[11px] text-slate-400 ml-1">
                            · Updated {updatedDate}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">
                        Delivery: {receipt.deliveryAddress}
                        {receipt.courierName ? ` · Courier: ${receipt.courierName}` : ''}
                        {receipt.deliveryRegion === 'nairobi' && receipt.deliveryFee
                          ? ` · Rider Fee (Included): ${formatCurrency(receipt.deliveryFee)}${typeof receipt.deliveryDistanceKm === 'number' ? ` (${receipt.deliveryDistanceKm.toFixed(1)} km)` : ''}`
                          : ''}
                      </p>
                      {receipt.deliveryRegion === 'nairobi' && (
                        <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 inline-flex flex-wrap items-center gap-1.5">
                          <Navigation className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>
                            {receipt.riderPlateNumber
                              ? `Rider ${receipt.riderName ? `${receipt.riderName} · ` : ''}Plate ${receipt.riderPlateNumber} assigned — live location sent from rider's WhatsApp to your WhatsApp (${receipt.customerPhone}).`
                              : `After payment, the rider sends his live location from his WhatsApp to your WhatsApp (${receipt.customerPhone}), plus his picture & number plate number.`}
                          </span>
                        </p>
                      )}

                      {receipt.deliveryRegion === 'pickup' && receipt.pickupCode && (
                        <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-slate-800 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              Pickup Code:{' '}
                              <span className="font-mono text-sm font-extrabold text-orange-800 tracking-wider">
                                {receipt.pickupCode}
                              </span>
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                                receipt.pickupStatus === 'claimed'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : receipt.pickupStatus === 'expired_restocked'
                                    ? 'bg-red-100 text-red-800 border-red-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {receipt.pickupStatus === 'claimed'
                                ? 'Claimed'
                                : receipt.pickupStatus === 'expired_restocked'
                                  ? 'Expired & Restocked'
                                  : `Reserved ${PICKUP_RESERVATION_HOURS}h`}
                            </span>
                          </div>
                          <p className="text-[11px] text-orange-950">
                            Reserved for {PICKUP_RESERVATION_HOURS}hrs. Unclaimed parts after {PICKUP_RESERVATION_HOURS} hours automatically return to stock.
                            {receipt.pickupReservedUntil
                              ? ` Hold until ${new Date(receipt.pickupReservedUntil).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}.`
                              : ''}
                          </p>
                        </div>
                      )}

                      {receipt.fittingDate && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-0.5">
                            <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span>
                              Appointment: {formatFittingDateLabel(receipt.fittingDate)} ·{' '}
                              {receipt.fittingSlotLabel || getGarageSlotLabel(receipt.fittingTimeSlot)}
                            </span>
                            <span className="font-bold text-emerald-700">
                              · {receipt.fittingStatus || 'Scheduled'}
                            </span>
                          </span>
                        </div>
                      )}

                      {receipt.vehicleDetails && (
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-800 bg-orange-50 border border-orange-200 rounded-md px-2 py-0.5">
                          <Wrench className="w-3 h-3 text-orange-600 shrink-0" />
                          <span>Vehicle / Fitting Note: {receipt.vehicleDetails}</span>
                        </p>
                      )}

                      {(receipt.deliveryRegion === 'pickup' ||
                        receipt.deliveryRegion === 'garage_fitting') && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span>
                              {receipt.deliveryRegion === 'garage_fitting'
                                ? 'Garage fitting hours'
                                : 'Pickup hours'}
                              : {PHYSICAL_STORE_HOURS}
                            </span>
                          </span>
                          <a
                            href={PHYSICAL_STORE_MAPS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:text-orange-800 underline underline-offset-2"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Google Maps Directions</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                      <div className="lg:text-right">
                        <p className="text-xs text-slate-500 tabular-nums">
                          {totalUnits} {totalUnits === 1 ? 'item' : 'items'}
                        </p>
                        {Boolean(receipt.discountAmount && receipt.discountAmount > 0) && (
                          <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-0.5">
                            <Percent className="w-3 h-3" />
                            <span>Saved {formatCurrency(receipt.discountAmount || 0)}</span>
                          </p>
                        )}
                        <p className="text-lg font-mono tabular-nums font-bold text-slate-900">
                          {formatCurrency(receipt.total)}
                        </p>
                      </div>

                      <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTrackedOrderId(receipt.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            isActiveOrder
                              ? 'text-white bg-slate-900 hover:bg-slate-800'
                              : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {isActiveOrder ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5" />
                          )}
                          <span>Track Order</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewReceipt(receipt)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Guarantee Support Note */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-2 text-xs text-slate-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>{GUARANTEE_NOTICE}</span>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${CUSTOMER_CARE_NUMBER}`}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:text-orange-700"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Guarantee &amp; Support: {CUSTOMER_CARE_NUMBER}</span>
                </a>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <a
                  href={CUSTOMER_CARE_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <strong className="text-slate-700">Return &amp; Free Exchange:</strong>{' '}
              {RETURN_EXCHANGE_POLICY_NOTICE}
            </p>
          </div>
        </>
      )}

      <OrderTrackingModal
        receipt={trackedReceipt}
        authToken={authToken}
        onClose={() => setTrackedOrderId(null)}
        onViewReceipt={onViewReceipt}
        onOrderSynced={onOrderSynced}
      />
    </main>
  );
}
