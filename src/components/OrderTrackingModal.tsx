import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  Receipt,
  RefreshCw,
  Truck,
  X,
  ExternalLink,
} from 'lucide-react';
import type { OrderTrackingStage, VirtualReceipt } from '../types';
import {
  CUSTOMER_CARE_NUMBER,
  formatCurrency,
  formatFittingDateLabel,
  getGarageSlotLabel,
  getTrackingStageContextNote,
  getTrackingStageLabel,
  getWhatsAppPhoneUrl,
  getWhatsAppSupportUrl,
  NAIROBI_RIDER_TRACKING_NOTICE,
  normalizeOrderStatus,
  normalizeTrackingStage,
  ORDER_TRACKING_STAGES,
} from '../constants/catalog';

interface OrderTrackingModalProps {
  receipt: VirtualReceipt | null;
  authToken?: string | null;
  onClose: () => void;
  onViewReceipt: (receipt: VirtualReceipt) => void;
  onOrderSynced?: (receipt: VirtualReceipt) => void;
}

const STAGE_STYLE_MAP: Record<
  OrderTrackingStage,
  { badge: string; dot: string; iconBg: string }
> = {
  processing: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    iconBg: 'bg-amber-500 text-white',
  },
  dispatched: {
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-600',
    iconBg: 'bg-sky-600 text-white',
  },
  out_for_delivery: {
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-600',
    iconBg: 'bg-orange-600 text-white',
  },
  delivered: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    iconBg: 'bg-emerald-600 text-white',
  },
};

function renderStageIcon(stage: OrderTrackingStage) {
  switch (stage) {
    case 'processing':
      return <Package className="w-4 h-4" />;
    case 'dispatched':
      return <Truck className="w-4 h-4" />;
    case 'out_for_delivery':
      return <Navigation className="w-4 h-4" />;
    case 'delivered':
      return <CheckCircle2 className="w-4 h-4" />;
  }
}

export function OrderTrackingModal({
  receipt,
  authToken,
  onClose,
  onViewReceipt,
  onOrderSynced,
}: OrderTrackingModalProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const fetchLatestTracking = useCallback(
    async (orderId: string) => {
      if (!authToken) return;
      setRefreshing(true);
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          receipt?: VirtualReceipt;
          serverTime?: string;
        };
        if (data.receipt) {
          onOrderSynced?.(data.receipt);
          setLastSyncedAt(data.serverTime || new Date().toISOString());
        }
      } catch {
        // Keep current receipt data on transient offline error
      } finally {
        setRefreshing(false);
      }
    },
    [authToken, onOrderSynced],
  );

  useEffect(() => {
    if (!receipt) return;
    setLastSyncedAt(receipt.statusUpdatedAt || receipt.issuedAt);
    void fetchLatestTracking(receipt.id);
  }, [receipt?.id, fetchLatestTracking]);

  useEffect(() => {
    if (!receipt) return;
    setLastSyncedAt(receipt.statusUpdatedAt || receipt.issuedAt);
  }, [receipt?.statusUpdatedAt, receipt?.trackingStage, receipt?.status]);

  if (!receipt) return null;

  const orderStatus = normalizeOrderStatus(receipt.status);
  const currentStage = normalizeTrackingStage(receipt.trackingStage, orderStatus);
  const currentStageIndex = ORDER_TRACKING_STAGES.findIndex(
    (item) => item.stage === currentStage,
  );
  const eventsByStage = new Map(
    (receipt.trackingEvents || []).map((ev) => [ev.stage, ev]),
  );
  const currentStyle = STAGE_STYLE_MAP[currentStage];
  const isActiveOrder = currentStage !== 'delivered';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-tracking-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="font-mono font-semibold text-white">
                {receipt.receiptNumber}
              </span>
              <span aria-hidden="true">·</span>
              {isActiveOrder ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Progress</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </span>
              )}
            </div>
            <h2
              id="order-tracking-modal-title"
              className="font-display text-lg font-bold text-white mt-0.5"
            >
              Order Tracking Timeline
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void fetchLatestTracking(receipt.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 rounded-md transition-colors"
              aria-label="Refresh tracking progress"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              aria-label="Close order tracking"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Current Stage & Destination Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md border ${currentStyle.badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${currentStyle.dot}`} />
                <span>Current Stage: {getTrackingStageLabel(currentStage)}</span>
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {formatCurrency(receipt.total)}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Destination:</strong>{' '}
                  {receipt.deliveryAddress}
                </span>
              </p>
              {receipt.trackingLocation && (
                <p className="flex items-start gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Latest Hub / Location:</strong>{' '}
                    {receipt.trackingLocation}
                  </span>
                </p>
              )}
              {receipt.courierName && (
                <p className="pl-5">
                  <strong className="text-slate-800">Courier:</strong> {receipt.courierName}
                </p>
              )}
              {receipt.pickupCode && (
                <p className="pl-5">
                  <strong className="text-slate-800">Counter Pickup Code:</strong>{' '}
                  <span className="font-mono font-bold text-orange-700">
                    {receipt.pickupCode}
                  </span>
                </p>
              )}
              {receipt.fittingDate && (
                <p className="pl-5">
                  <strong className="text-slate-800">Garage Slot:</strong>{' '}
                  {formatFittingDateLabel(receipt.fittingDate)} ·{' '}
                  {receipt.fittingSlotLabel || getGarageSlotLabel(receipt.fittingTimeSlot)}
                </p>
              )}
            </div>

            {lastSyncedAt && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-200/80">
                <Clock className="w-3 h-3" />
                <span>
                  Updated{' '}
                  {new Date(lastSyncedAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </p>
            )}
          </div>

          {receipt.deliveryRegion === 'nairobi' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Nairobi Rider Verification &amp; Live Tracking
                  </p>
                  <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                    {NAIROBI_RIDER_TRACKING_NOTICE}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-800 mt-1">
                    Sent from the rider&apos;s WhatsApp to your WhatsApp:{' '}
                    <span className="font-mono font-semibold">{receipt.customerPhone}</span>
                  </p>
                </div>
              </div>

              {(receipt.riderName ||
                receipt.riderPhone ||
                receipt.riderPlateNumber ||
                receipt.riderPhotoUrl ||
                receipt.riderLiveLocationUrl) && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {receipt.riderPhotoUrl && (
                      <img
                        src={receipt.riderPhotoUrl}
                        alt={receipt.riderName || 'Assigned dispatch rider'}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="min-w-0 space-y-0.5">
                      {receipt.riderName && (
                        <p className="font-semibold text-slate-900 truncate">
                          Rider: {receipt.riderName}
                        </p>
                      )}
                      {receipt.riderPlateNumber && (
                        <p className="font-mono font-bold text-orange-700">
                          Plate No: {receipt.riderPlateNumber}
                        </p>
                      )}
                      {receipt.riderPhone && (
                        <a
                          href={`tel:${receipt.riderPhone}`}
                          className="inline-flex items-center gap-1 font-mono text-slate-700 hover:text-orange-700"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{receipt.riderPhone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {receipt.riderPhone && (
                      <a
                        href={getWhatsAppPhoneUrl(
                          receipt.riderPhone,
                          `Hello${receipt.riderName ? ` ${receipt.riderName}` : ''}, I am ${receipt.customerName} tracking order ${receipt.receiptNumber}. Kindly share your WhatsApp live location.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp Rider</span>
                      </a>
                    )}
                    {receipt.riderLiveLocationUrl && (
                      <a
                        href={receipt.riderLiveLocationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md transition-colors whitespace-nowrap"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Open Live Location</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4-Stage Progress Timeline */}
          <div aria-label="Order progress steps" className="pl-1">
            {ORDER_TRACKING_STAGES.map((step, index) => {
              const isCompleted = index < currentStageIndex || currentStage === 'delivered';
              const isCurrent = index === currentStageIndex && currentStage !== 'delivered';
              const isReached = index <= currentStageIndex;
              const isLast = index === ORDER_TRACKING_STAGES.length - 1;
              const eventRecord = eventsByStage.get(step.stage);
              const stepStyle = STAGE_STYLE_MAP[step.stage];

              const noteText =
                eventRecord?.note ||
                getTrackingStageContextNote(step.stage, receipt) ||
                step.defaultNote;

              return (
                <div key={step.stage} className="relative flex gap-3.5 pb-6 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      aria-hidden="true"
                      className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                        index < currentStageIndex ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  {/* Step Node */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isCurrent
                          ? `${stepStyle.iconBg} border-white ring-4 ring-orange-100`
                          : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {renderStageIcon(step.stage)}
                  </div>

                  {/* Step Body */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm font-bold ${
                            isReached ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {step.label}
                        </h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-orange-100 text-orange-800 border border-orange-200">
                            In Progress
                          </span>
                        )}
                      </div>

                      {eventRecord?.updatedAt && isReached && (
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {new Date(eventRecord.updatedAt).toLocaleString('en-KE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isReached ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {noteText}
                    </p>

                    {eventRecord?.location && isReached && (
                      <p className="text-[11px] font-medium text-slate-500 mt-1 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{eventRecord.location}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ordered Parts Summary */}
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-slate-800">
              Items in this Order ({receipt.items.reduce((sum, i) => sum + i.quantity, 0)})
            </p>
            <ul className="space-y-1 text-slate-600">
              {receipt.items.map((item) => (
                <li key={item.partId} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-mono text-slate-700 shrink-0">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href={`tel:${receipt.customerCarePhone || CUSTOMER_CARE_NUMBER}`}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{receipt.customerCarePhone || CUSTOMER_CARE_NUMBER}</span>
            </a>
            <a
              href={getWhatsAppSupportUrl(
                `Hello My Spare Zone, I am tracking order ${receipt.receiptNumber}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Dispatch</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewReceipt(receipt);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>View Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
