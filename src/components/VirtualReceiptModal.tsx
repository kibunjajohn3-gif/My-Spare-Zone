import {
  Printer,
  Download,
  X,
  Phone,
  Clock,
  Truck,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  MapPin,
  Percent,
  Wrench,
  Calendar,
  Navigation,
} from 'lucide-react';
import type { OrderStatus, VirtualReceipt } from '../types';
import {
  CUSTOMER_CARE_WHATSAPP_URL,
  formatCurrency,
  formatFittingDateLabel,
  getGarageSlotLabel,
  getWhatsAppPhoneUrl,
  getWhatsAppSupportUrl,
  GUARANTEE_POLICY_TERMS,
  NAIROBI_RIDER_TRACKING_NOTICE,
  normalizeOrderStatus,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  PICKUP_RESERVATION_HOURS,
} from '../constants/catalog';
import { BrandWordmark } from './BrandWordmark';

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

interface VirtualReceiptModalProps {
  receipt: VirtualReceipt | null;
  onClose: () => void;
}

export function VirtualReceiptModal({ receipt, onClose }: VirtualReceiptModalProps) {
  if (!receipt) return null;

  const orderStatus = normalizeOrderStatus(receipt.status);
  const issuedDate = new Date(receipt.issuedAt);
  const formattedDate = issuedDate.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleDownloadText = () => {
    const lines = [
      '====================================================',
      `                   ${receipt.shopName.toUpperCase()}`,
      `  ${receipt.guaranteeText}`,
      '====================================================',
      `Receipt No:    ${receipt.receiptNumber}`,
      `Order Status:  ${orderStatus}`,
      `Date Issued:   ${formattedDate}`,
      `Customer Care: ${receipt.customerCarePhone} (WhatsApp: ${CUSTOMER_CARE_WHATSAPP_URL})`,
      '----------------------------------------------------',
      `Customer:      ${receipt.customerName}`,
      `Phone:         ${receipt.customerPhone}`,
      `Delivery:      ${receipt.deliveryAddress}`,
      ...(receipt.fittingDate
        ? [
            `Appointment:   ${formatFittingDateLabel(receipt.fittingDate)} · ${receipt.fittingSlotLabel || getGarageSlotLabel(receipt.fittingTimeSlot)} (${receipt.fittingStatus || 'Scheduled'})`,
          ]
        : []),
      ...(receipt.vehicleDetails ? [`Vehicle/Fit:   ${receipt.vehicleDetails}`] : []),
      ...(receipt.courierName ? [`Courier:       ${receipt.courierName}`] : []),
      `Payment:       ${receipt.paymentMethod}`,
      ...(receipt.mpesaReceiptNumber ? [`M-Pesa Ref:    ${receipt.mpesaReceiptNumber}`] : []),
      ...(receipt.cardTransactionRef
        ? [
            `Card Ref:      ${receipt.cardTransactionRef}${receipt.cardAuthCode ? ` (Auth: ${receipt.cardAuthCode})` : ''}`,
          ]
        : []),
      ...(receipt.paymentStatus ? [`Pay Status:    ${receipt.paymentStatus}`] : []),
      '----------------------------------------------------',
      'ITEMS:',
      ...receipt.items.map(
        (item) =>
          `${item.quantity}x ${item.name} (${item.sku})\n   @ ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.lineTotal)}`,
      ),
      '----------------------------------------------------',
      `SUBTOTAL:      ${formatCurrency(receipt.subtotal)}`,
      ...(receipt.discountAmount && receipt.discountAmount > 0
        ? [
            `DISCOUNT:      -${formatCurrency(receipt.discountAmount)}${receipt.discountLabel ? ` (${receipt.discountLabel})` : ''}`,
          ]
        : []),
      ...(receipt.referralCodeUsed
        ? [
            `REFERRAL CODE: ${receipt.referralCodeUsed} (Mechanic ${receipt.referralCreditPercent ?? 1}% credit: ${formatCurrency(receipt.referralCreditAmount ?? Math.round((receipt.total * 1) / 100))} — ${receipt.referralCreditStatus === 'credited' ? 'Credited after fitting & testing' : 'Pending fitting & testing'})`,
          ]
        : []),
      ...(receipt.deliveryFee && receipt.deliveryFee > 0
        ? [
            `RIDER DELIVERY FEE (INCLUDED): ${formatCurrency(receipt.deliveryFee)}${typeof receipt.deliveryDistanceKm === 'number' ? ` (${receipt.deliveryDistanceKm.toFixed(1)} km · KSh 500/10km)` : ''}`,
          ]
        : []),
      `TOTAL PAID:    ${formatCurrency(receipt.total)}`,
      ...(receipt.deliveryRegion === 'nairobi'
        ? [
            '----------------------------------------------------',
            'NAIROBI RIDER LIVE TRACKING:',
            NAIROBI_RIDER_TRACKING_NOTICE,
            `Customer WhatsApp: ${receipt.customerPhone}`,
            ...(receipt.riderName ? [`Rider Name:    ${receipt.riderName}`] : []),
            ...(receipt.riderPhone ? [`Rider Phone:   ${receipt.riderPhone}`] : []),
            ...(receipt.riderPlateNumber ? [`Plate Number:  ${receipt.riderPlateNumber}`] : []),
            ...(receipt.riderLiveLocationUrl
              ? [`Live Location: ${receipt.riderLiveLocationUrl}`]
              : []),
          ]
        : []),
      ...(receipt.deliveryRegion === 'pickup' && receipt.pickupCode
        ? [
            '----------------------------------------------------',
            'COUNTER PICKUP RESERVATION & BOOKING AGREEMENT:',
            `Pickup Code:   ${receipt.pickupCode}`,
            `Status:        ${receipt.pickupStatus === 'claimed' ? 'Claimed at Counter' : receipt.pickupStatus === 'expired_restocked' ? 'Expired (Auto-Restocked after 24hrs)' : `Reserved (${PICKUP_RESERVATION_HOURS}h Hold)`}`,
            ...(receipt.pickupReservedUntil
              ? [
                  `Hold Expires:  ${new Date(receipt.pickupReservedUntil).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`,
                ]
              : []),
            `Notice:        Reserved for ${PICKUP_RESERVATION_HOURS}hrs. Unclaimed parts after ${PICKUP_RESERVATION_HOURS} hours automatically go back to stock.`,
            ...(receipt.pickupBookingAgreement ? [`Agreement:     ${receipt.pickupBookingAgreement}`] : []),
          ]
        : []),
      ...(receipt.deliveryRegion === 'pickup' || receipt.deliveryRegion === 'garage_fitting'
        ? [
            `${receipt.deliveryRegion === 'garage_fitting' ? 'GARAGE HOURS' : 'PICKUP HOURS'}:  ${PHYSICAL_STORE_HOURS}`,
            `DIRECTIONS:    ${PHYSICAL_STORE_MAPS_URL}`,
          ]
        : []),
      '----------------------------------------------------',
      'GUARANTEE POLICY:',
      ...GUARANTEE_POLICY_TERMS.map((term, index) => `${index + 1}. ${term}`),
      '====================================================',
      'Thank you for shopping with My Spare Zone.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-shop-header"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-8 print-only-container">
        {/* Top utility bar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200 no-print">
          <span className="text-xs font-medium text-slate-600">
            Virtual Purchase Receipt · {receipt.receiptNumber}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-200/70 transition-colors"
            aria-label="Close receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Receipt Header: Shop Name + Guarantee Imprint directly below */}
          <div className="text-center border-b border-slate-200 pb-5">
            <h2 id="receipt-shop-header" className="flex justify-center">
              <BrandWordmark size="receipt" name={receipt.shopName} />
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md py-1.5 px-3 inline-block">
              {receipt.guaranteeText}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="font-mono">{receipt.receiptNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{formattedDate}</span>
              <span aria-hidden="true">·</span>
              <a
                href={`tel:${receipt.customerCarePhone}`}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-orange-700 font-medium"
              >
                <Phone className="w-3 h-3" />
                {receipt.customerCarePhone}
              </a>
              <span aria-hidden="true">·</span>
              <a
                href={getWhatsAppSupportUrl(
                  `Hello My Spare Zone, I have a question about receipt ${receipt.receiptNumber}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <MessageCircle className="w-3 h-3" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs text-slate-500">Billed To</p>
              <p className="font-semibold text-slate-900 mt-0.5">{receipt.customerName}</p>
              <p className="text-slate-600 font-mono text-xs mt-0.5">{receipt.customerPhone}</p>
              <div className="mt-2.5">
                <p className="text-xs text-slate-500 mb-1">Order Status</p>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${STATUS_BADGE_STYLES[orderStatus]}`}
                >
                  {renderStatusIcon(orderStatus)}
                  <span>{orderStatus}</span>
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fulfillment & Payment</p>
              <p className="font-medium text-slate-900 mt-0.5">{receipt.deliveryAddress}</p>
              {receipt.fittingDate && (
                <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>
                    Booked Slot: {formatFittingDateLabel(receipt.fittingDate)} ·{' '}
                    {receipt.fittingSlotLabel || getGarageSlotLabel(receipt.fittingTimeSlot)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    ({receipt.fittingStatus || 'Scheduled'})
                  </span>
                </p>
              )}
              {receipt.vehicleDetails && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-orange-800 bg-orange-50 border border-orange-200 rounded-md px-2 py-0.5">
                  <Wrench className="w-3 h-3 text-orange-600 shrink-0" />
                  <span>Vehicle / Fitting Note: {receipt.vehicleDetails}</span>
                </p>
              )}
              {(receipt.deliveryRegion === 'pickup' ||
                receipt.deliveryRegion === 'garage_fitting') && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-orange-600" />
                    <span>{PHYSICAL_STORE_HOURS}</span>
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
              {receipt.courierName && (
                <p className="text-xs font-medium text-slate-700 mt-0.5">
                  Courier Service: {receipt.courierName}
                </p>
              )}
              <p className="text-slate-600 text-xs mt-0.5">{receipt.paymentMethod}</p>
              {receipt.mpesaReceiptNumber && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Paid · M-Pesa Ref {receipt.mpesaReceiptNumber}</span>
                </p>
              )}
              {receipt.cardTransactionRef && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    Paid · {receipt.cardBrand || 'Card'} •••• {receipt.cardLast4 || '****'} · Ref{' '}
                    {receipt.cardTransactionRef}
                  </span>
                </p>
              )}
              {receipt.bargainCode && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded-md">
                  <span>Agreed Bargain Deal · {receipt.bargainCode}</span>
                </p>
              )}
            </div>
          </div>

          {receipt.deliveryRegion === 'nairobi' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Navigation className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Nairobi Rider Dispatch &amp; Live Tracking
                  </p>
                  <p className="text-xs text-emerald-950 leading-relaxed">
                    {NAIROBI_RIDER_TRACKING_NOTICE}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-800">
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

          {receipt.deliveryRegion === 'pickup' && receipt.pickupCode && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-800">
                    Counter Pickup Code · {PICKUP_RESERVATION_HOURS}-Hour Reservation
                  </p>
                  <p className="font-mono text-2xl font-extrabold tracking-widest text-slate-900 mt-0.5">
                    {receipt.pickupCode}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded border ${
                    receipt.pickupStatus === 'claimed'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : receipt.pickupStatus === 'expired_restocked'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  {receipt.pickupStatus === 'claimed'
                    ? 'Claimed at Counter'
                    : receipt.pickupStatus === 'expired_restocked'
                      ? 'Expired & Restocked'
                      : 'Reserved (24h Hold)'}
                </span>
              </div>
              {receipt.pickupReservedUntil && (
                <p className="text-xs font-medium text-slate-800">
                  Hold Expires:{' '}
                  <span className="font-mono font-semibold">
                    {new Date(receipt.pickupReservedUntil).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </p>
              )}
              <p className="text-xs font-semibold text-orange-950 bg-white border border-orange-200 rounded-md px-3 py-2 leading-relaxed">
                Notice: Your spare part is reserved for {PICKUP_RESERVATION_HOURS}hrs. Any unclaimed part after {PICKUP_RESERVATION_HOURS} hours automatically goes back to store stock.
              </p>
              {receipt.pickupBookingAgreement && (
                <p className="text-[11px] text-slate-700 leading-relaxed pt-1 border-t border-orange-200/80">
                  <strong className="text-slate-900">Booking Agreement:</strong>{' '}
                  {receipt.pickupBookingAgreement}
                </p>
              )}
            </div>
          )}

          {/* Itemized Line Items */}
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Spare Part</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Unit</th>
                  <th className="py-2 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {receipt.items.map((item) => (
                  <tr key={item.partId}>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category} · {item.subcategory} · <span className="font-mono">{item.sku}</span>
                      </p>
                      {Boolean(item.volumeDiscountPct && item.volumeDiscountAmount) && (
                        <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                          Same-Part Volume ({item.volumeDiscountPct}% off · -{formatCurrency(item.volumeDiscountAmount!)})
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-3 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(receipt.subtotal)}</span>
            </div>
            {Boolean(receipt.discountAmount && receipt.discountAmount > 0) && (
              <div className="flex items-center justify-between text-sm text-emerald-700">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Percent className="w-3.5 h-3.5" />
                  <span>{receipt.discountLabel || 'Partner / Referral Discount'}</span>
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  -{formatCurrency(receipt.discountAmount || 0)}
                </span>
              </div>
            )}
            {Boolean(receipt.deliveryFee && receipt.deliveryFee > 0) && (
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-orange-600" />
                  <span>
                    Rider Delivery Fee (Included)
                    {typeof receipt.deliveryDistanceKm === 'number'
                      ? ` (${receipt.deliveryDistanceKm.toFixed(1)} km · KSh 500/10km)`
                      : ''}
                  </span>
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  {formatCurrency(receipt.deliveryFee || 0)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-1">
              <span>Total Amount</span>
              <span className="font-mono tabular-nums text-lg text-orange-700">
                {formatCurrency(receipt.total)}
              </span>
            </div>
            {receipt.referralCodeUsed && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700">
                <span>
                  Mechanic Referral (<strong className="font-mono">{receipt.referralCodeUsed}</strong>):{' '}
                  {receipt.referralCreditPercent ?? 1}% mechanic credit (
                  <strong className="font-mono">
                    {formatCurrency(
                      receipt.referralCreditAmount ?? Math.round((receipt.total * 1) / 100),
                    )}
                  </strong>
                  )
                </span>
                <span
                  className={`font-semibold ${
                    receipt.referralCreditStatus === 'credited'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {receipt.referralCreditStatus === 'credited'
                    ? 'Credited after fitting & testing'
                    : 'Pending fitting & testing'}
                </span>
              </div>
            )}
          </div>

          {/* Footer Note & Guarantee Policy */}
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>Customer Care: {receipt.customerCarePhone}</span>
                <span aria-hidden="true">·</span>
                <a
                  href={getWhatsAppSupportUrl(
                    `Hello My Spare Zone, I need assistance with order ${receipt.receiptNumber}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                >
                  Chat on WhatsApp
                </a>
              </div>
              <span>Retain this virtual receipt for 7-day guarantee claims.</span>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Guarantee Policy
              </p>
              <ol className="mt-1.5 list-decimal list-inside space-y-1 text-xs text-slate-700 leading-relaxed">
                {GUARANTEE_POLICY_TERMS.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3 no-print">
          <button
            type="button"
            onClick={handleDownloadText}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download Copy
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
