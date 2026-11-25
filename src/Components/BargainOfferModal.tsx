import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Handshake,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  X,
  XCircle,
} from 'lucide-react';
import { formatCurrency } from '../constants/catalog';
import type { AuthUser, BargainOffer, CartItem } from '../types';

export interface BargainModalTarget {
  mode: 'part' | 'cart';
  items: CartItem[];
}

interface BargainOfferModalProps {
  target: BargainModalTarget | null;
  currentUser: AuthUser | null;
  authToken: string | null;
  sessionId: string;
  onClose: () => void;
  onSubmitted: (bargain: BargainOffer) => void;
  onApplyAcceptedToCart: (bargain: BargainOffer) => void;
}

export const BargainOfferModal: React.FC<BargainOfferModalProps> = ({
  target,
  currentUser,
  authToken,
  sessionId,
  onClose,
  onSubmitted,
  onApplyAcceptedToCart,
}) => {
  const [singleQty, setSingleQty] = useState(1);
  const [offeredPriceInput, setOfferedPriceInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedBargain, setSubmittedBargain] = useState<{
    bargain: BargainOffer;
    autoAccepted: boolean;
    autoDeclined: boolean;
  } | null>(null);

  const effectiveItems = useMemo<CartItem[]>(() => {
    if (!target) return [];
    if (target.mode === 'part' && target.items.length > 0) {
      return [{ part: target.items[0].part, quantity: singleQty }];
    }
    return target.items;
  }, [target, singleQty]);

  const listedSubtotal = useMemo(
    () =>
      effectiveItems.reduce(
        (sum, item) => sum + item.part.price * item.quantity,
        0,
      ),
    [effectiveItems],
  );

  useEffect(() => {
    if (!target) {
      setSubmittedBargain(null);
      setError(null);
      return;
    }
    const initQty =
      target.mode === 'part' && target.items[0] ? Math.max(1, target.items[0].quantity) : 1;
    setSingleQty(initQty);
    setOfferedPriceInput('');
    setCustomerName(currentUser?.name || '');
    setCustomerPhone(currentUser?.phone || '');
    setCustomerNote('');
    setError(null);
    setSubmittedBargain(null);
  }, [target, currentUser]);

  if (!target || target.items.length === 0) return null;

  const parsedOffer = Math.round(Number(offeredPriceInput) || 0);
  const savingsAmount = Math.max(0, listedSubtotal - parsedOffer);

  const handleManualPriceChange = (raw: string) => {
    setOfferedPriceInput(raw);
    setError(null);
  };

  const handleQtyChange = (delta: number) => {
    if (target.mode !== 'part') return;
    const part = target.items[0].part;
    const nextQty = Math.max(
      1,
      Math.min(part.stock > 0 ? part.stock : 99, singleQty + delta),
    );
    const nextSubtotal = part.price * nextQty;
    setSingleQty(nextQty);
    if (listedSubtotal > 0 && parsedOffer > 0) {
      const ratio = parsedOffer / listedSubtotal;
      const scaled = Math.max(1, Math.min(nextSubtotal, Math.round(nextSubtotal * ratio)));
      setOfferedPriceInput(String(scaled));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(parsedOffer) || parsedOffer < 1) {
      setError('Please enter a valid bargain price greater than KSh 0.');
      return;
    }
    if (parsedOffer > listedSubtotal) {
      setError(`Your bargain price cannot exceed the listed total of ${formatCurrency(listedSubtotal)}.`);
      return;
    }
    if (customerName.trim().length < 2) {
      setError('Please enter your name so our sales desk can address your offer.');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 9) {
      setError('Please enter a valid Kenyan phone number (e.g. 0712345678).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bargains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sessionId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerNote: customerNote.trim(),
          offeredTotal: parsedOffer,
          items: effectiveItems.map((it) => ({
            partId: it.part.id,
            quantity: it.quantity,
          })),
        }),
      });
      const data = (await res.json()) as {
        bargain?: BargainOffer;
        autoAccepted?: boolean;
        autoDeclined?: boolean;
        error?: string;
      };
      if (!res.ok || !data.bargain) {
        setError(data.error || 'Could not submit bargain offer.');
        return;
      }
      onSubmitted(data.bargain);
      setSubmittedBargain({
        bargain: data.bargain,
        autoAccepted: Boolean(data.autoAccepted),
        autoDeclined: Boolean(data.autoDeclined) || data.bargain.status === 'rejected',
      });
    } catch {
      setError('Network error submitting your bargain offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white">
              <Handshake className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {target.mode === 'cart' ? 'Bargain on Cart Total' : 'Make an Offer'}
              </h2>
              <p className="text-[11px] text-slate-300">
                Negotiate directly with My Spare Zone Kirinyaga Rd Desk
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close bargain modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {submittedBargain ? (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  submittedBargain.autoAccepted
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : submittedBargain.autoDeclined
                      ? 'border-red-200 bg-red-50/70'
                      : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  {submittedBargain.autoDeclined ? (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  ) : (
                    <CheckCircle2
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        submittedBargain.autoAccepted ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {submittedBargain.autoAccepted
                          ? 'Offer Instantly Accepted!'
                          : submittedBargain.autoDeclined
                            ? 'Offer Automatically Declined'
                            : 'Offer Sent to Sales Desk'}
                      </span>
                      <span className="rounded bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                        {submittedBargain.bargain.bargainCode}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {submittedBargain.autoAccepted
                        ? `Your offer of ${formatCurrency(submittedBargain.bargain.agreedTotal ?? submittedBargain.bargain.offeredTotal)} has been accepted and is ready to check out now.`
                        : submittedBargain.autoDeclined
                          ? `Your offer of ${formatCurrency(submittedBargain.bargain.offeredTotal)} was automatically declined because it is below our acceptable price for this item. Please submit a higher offer.`
                          : `We have received your offer of ${formatCurrency(submittedBargain.bargain.offeredTotal)} (listed ${formatCurrency(submittedBargain.bargain.listedSubtotal)}). Replies appear live in My Bargains.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Listed Subtotal</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(submittedBargain.bargain.listedSubtotal)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-slate-900 font-bold">
                  <span>
                    {submittedBargain.autoAccepted ? 'Agreed Bargain Total' : 'Your Offer'}
                  </span>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      submittedBargain.autoDeclined ? 'text-red-700' : 'text-orange-600'
                    }`}
                  >
                    {formatCurrency(
                      submittedBargain.bargain.agreedTotal ?? submittedBargain.bargain.offeredTotal,
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {submittedBargain.autoAccepted && (
                  <button
                    type="button"
                    onClick={() => onApplyAcceptedToCart(submittedBargain.bargain)}
                    className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    <span>Load Deal into Cart &amp; Checkout</span>
                  </button>
                )}
                {submittedBargain.autoDeclined && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedBargain(null);
                      setError(null);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-orange-700"
                  >
                    <Handshake className="h-4 w-4 shrink-0" />
                    <span>Try Higher Offer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Items Summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {effectiveItems.length === 1 ? 'Selected Spare Part' : `${effectiveItems.length} Cart Items`}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                    Listed: {formatCurrency(listedSubtotal)}
                  </span>
                </div>

                <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                  {effectiveItems.map((item) => (
                    <div
                      key={item.part.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200/80 bg-white px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {item.part.name}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {item.part.sku} · {formatCurrency(item.part.price)} × {item.quantity}
                        </p>
                      </div>
                      {target.mode === 'part' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(-1)}
                            disabled={singleQty <= 1}
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs font-bold tabular-nums">
                            {singleQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQtyChange(1)}
                            disabled={
                              target.items[0].part.stock > 0 &&
                              singleQty >= target.items[0].part.stock
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(item.part.price * item.quantity)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Bargain Price Input */}
              <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="bargain-manual-price-input"
                    className="text-xs font-bold text-slate-900"
                  >
                    Enter Your Bargain Price (KSh)
                  </label>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Listed: {formatCurrency(listedSubtotal)}
                  </span>
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                    KSh
                  </span>
                  <input
                    id="bargain-manual-price-input"
                    type="number"
                    min={1}
                    max={Math.max(1, listedSubtotal)}
                    step={1}
                    value={offeredPriceInput}
                    onChange={(e) => handleManualPriceChange(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-11 font-mono text-sm font-bold text-slate-900 tabular-nums focus:border-orange-500 focus:outline-none"
                    placeholder={`Enter amount (up to ${listedSubtotal.toLocaleString('en-KE')})`}
                  />
                </div>

                {parsedOffer > 0 && parsedOffer <= listedSubtotal && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <Tag className="h-3 w-3" />
                      {parsedOffer === listedSubtotal
                        ? 'Full listed price'
                        : `Saving ${formatCurrency(savingsAmount)} from listed price`}
                    </span>
                    <span className="text-slate-500">Excludes double partner/volume tiers</span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    placeholder="e.g. Brian Kamau"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    placeholder="e.g. 0712345678"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Note for Sales Desk <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={280}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="e.g. Buying both items today / pickup at Kirinyaga Rd..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Handshake className="h-3.5 w-3.5" />
                  )}
                  <span>{submitting ? 'Submitting...' : 'Submit Bargain Offer'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
