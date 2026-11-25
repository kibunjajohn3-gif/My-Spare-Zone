import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Handshake,
  Loader2,
  RefreshCw,
  ShoppingCart,
  X,
  XCircle,
} from 'lucide-react';
import { formatCurrency } from '../constants/catalog';
import type { BargainOffer, BargainStatus, SparePart } from '../types';

type BargainFilterTab = 'all' | 'action_needed' | 'pending' | 'completed';

interface MyBargainsDrawerProps {
  isOpen: boolean;
  bargains: BargainOffer[];
  loading?: boolean;
  allParts?: SparePart[];
  authToken: string | null;
  sessionId: string;
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
  onBargainUpdated: (bargain: BargainOffer) => void;
  onLoadBargainIntoCart: (bargain: BargainOffer) => void;
}

const STATUS_BADGE: Record<
  BargainStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Awaiting Desk',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  countered: {
    label: 'Counter-Offer',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  accepted: {
    label: 'Accepted · Ready',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  redeemed: {
    label: 'Redeemed',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  rejected: {
    label: 'Declined',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  expired: {
    label: 'Expired',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

export const MyBargainsDrawer: React.FC<MyBargainsDrawerProps> = ({
  isOpen,
  bargains,
  loading = false,
  allParts = [],
  authToken,
  sessionId,
  onClose,
  onRefresh,
  onBargainUpdated,
  onLoadBargainIntoCart,
}) => {
  const [filterTab, setFilterTab] = useState<BargainFilterTab>('all');
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});
  const [reofferTargetId, setReofferTargetId] = useState<string | null>(null);
  const [reofferAmount, setReofferAmount] = useState('');
  const [reofferNote, setReofferNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const partsById = useMemo(
    () => new Map(allParts.map((p) => [p.id, p])),
    [allParts],
  );

  const counts = useMemo(() => {
    const actionNeeded = bargains.filter(
      (b) => b.status === 'countered' || b.status === 'accepted',
    ).length;
    const pending = bargains.filter((b) => b.status === 'pending').length;
    const completed = bargains.filter(
      (b) => b.status === 'redeemed' || b.status === 'rejected' || b.status === 'expired',
    ).length;
    return {
      all: bargains.length,
      actionNeeded,
      pending,
      completed,
    };
  }, [bargains]);

  const filteredBargains = useMemo(() => {
    if (filterTab === 'action_needed') {
      return bargains.filter((b) => b.status === 'countered' || b.status === 'accepted');
    }
    if (filterTab === 'pending') {
      return bargains.filter((b) => b.status === 'pending');
    }
    if (filterTab === 'completed') {
      return bargains.filter(
        (b) => b.status === 'redeemed' || b.status === 'rejected' || b.status === 'expired',
      );
    }
    return bargains;
  }, [bargains, filterTab]);

  if (!isOpen) return null;

  const toggleHistory = (id: string) => {
    setExpandedHistoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const respondToBargain = async (
    bargain: BargainOffer,
    action: 'accept_counter' | 're_offer' | 'withdraw',
    offeredTotal?: number,
    note?: string,
  ) => {
    setActionError(null);
    setBusyId(bargain.id);
    try {
      const res = await fetch(`/api/bargains/${encodeURIComponent(bargain.id)}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sessionId,
          action,
          ...(offeredTotal !== undefined ? { offeredTotal } : {}),
          ...(note ? { note } : {}),
        }),
      });
      const data = (await res.json()) as { bargain?: BargainOffer; error?: string };
      if (!res.ok || !data.bargain) {
        setActionError(data.error || 'Could not update bargain offer.');
        return;
      }
      onBargainUpdated(data.bargain);
      if (action === 're_offer') {
        setReofferTargetId(null);
        setReofferAmount('');
        setReofferNote('');
      }
    } catch {
      setActionError('Network error while updating your bargain. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const openReofferBox = (bargain: BargainOffer) => {
    const ceiling =
      typeof bargain.counterTotal === 'number' && bargain.counterTotal < bargain.listedSubtotal
        ? bargain.counterTotal
        : bargain.listedSubtotal;
    const midpoint = Math.max(
      1,
      Math.min(ceiling - 1, Math.round((bargain.offeredTotal + ceiling) / 2)),
    );
    setReofferTargetId(bargain.id);
    setReofferAmount(String(midpoint));
    setReofferNote('');
    setActionError(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-slate-900/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white">
              <Handshake className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">My Bargains</h2>
              <p className="text-[11px] text-slate-300">
                Track offers, respond to counter-offers &amp; apply accepted deals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Refresh bargains"
              title="Refresh bargains"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close My Bargains"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'action_needed', label: `Ready / Countered (${counts.actionNeeded})` },
              { id: 'pending', label: `Pending (${counts.pending})` },
              { id: 'completed', label: `History (${counts.completed})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`whitespace-nowrap shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                filterTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {actionError}
            </div>
          )}

          {loading && bargains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
              <p className="mt-2 text-xs font-medium">Loading your bargain offers...</p>
            </div>
          ) : filteredBargains.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Handshake className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                No bargain offers {filterTab === 'all' ? 'yet' : 'in this view'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Click <span className="font-semibold text-slate-800">Bargain</span> on any spare
                part or inside your cart to propose a target price to our sales desk.
              </p>
            </div>
          ) : (
            filteredBargains.map((bargain) => {
              const badge = STATUS_BADGE[bargain.status];
              const isBusy = busyId === bargain.id;
              const isExpanded = Boolean(expandedHistoryIds[bargain.id]);
              const isReoffering = reofferTargetId === bargain.id;
              const agreedOrCurrent =
                bargain.agreedTotal ?? bargain.counterTotal ?? bargain.offeredTotal;
              const ceiling =
                typeof bargain.counterTotal === 'number' &&
                bargain.counterTotal < bargain.listedSubtotal
                  ? bargain.counterTotal
                  : bargain.listedSubtotal;
              const allItemsAvailable = bargain.items.every((it) =>
                allParts.length > 0 ? partsById.has(it.partId) : true,
              );

              return (
                <div
                  key={bargain.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {bargain.bargainCode}
                        </span>
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Updated {new Date(bargain.updatedAt).toLocaleString('en-KE')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Listed
                      </div>
                      <div className="font-mono text-xs text-slate-500 line-through tabular-nums">
                        {formatCurrency(bargain.listedSubtotal)}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-2.5">
                    {bargain.items.map((it) => (
                      <div
                        key={`${bargain.id}-${it.partId}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium text-slate-800">
                          {it.quantity}× {it.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatCurrency(it.lineSubtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Your Offer
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatCurrency(bargain.offeredTotal)}
                      </div>
                    </div>

                    <div
                      className={`rounded-lg border px-3 py-2 ${
                        bargain.status === 'accepted' || bargain.status === 'redeemed'
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : bargain.status === 'countered'
                            ? 'border-blue-200 bg-blue-50/70'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {bargain.status === 'accepted' || bargain.status === 'redeemed'
                          ? 'Agreed Total'
                          : bargain.status === 'countered'
                            ? 'Desk Counter-Offer'
                            : 'Current Target'}
                      </div>
                      <div
                        className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                          bargain.status === 'accepted' || bargain.status === 'redeemed'
                            ? 'text-emerald-700'
                            : bargain.status === 'countered'
                              ? 'text-blue-700'
                              : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(agreedOrCurrent)}
                      </div>
                    </div>
                  </div>

                  {bargain.adminNote && (
                    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Desk Note:</span>{' '}
                      {bargain.adminNote}
                    </div>
                  )}

                  {bargain.status === 'redeemed' && bargain.redeemedReceiptNumber && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Redeemed on receipt{' '}
                        <span className="font-mono font-bold">
                          {bargain.redeemedReceiptNumber}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Re-offer Inline Box */}
                  {isReoffering && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          Enter Your New Bargain Price (KSh)
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          Up to {formatCurrency(Math.max(1, ceiling - 1))}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, ceiling - 1)}
                        value={reofferAmount}
                        onChange={(e) => setReofferAmount(e.target.value)}
                        placeholder="Enter your price in KSh"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        maxLength={280}
                        value={reofferNote}
                        onChange={(e) => setReofferNote(e.target.value)}
                        placeholder="Optional message to desk..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReofferTargetId(null)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            respondToBargain(
                              bargain,
                              're_offer',
                              Math.round(Number(reofferAmount) || 0),
                              reofferNote.trim(),
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                          <span>Send Re-offer</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {bargain.status === 'accepted' && (
                      <button
                        type="button"
                        disabled={!allItemsAvailable}
                        onClick={() => onLoadBargainIntoCart(bargain)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {allItemsAvailable
                            ? 'Load into Cart & Checkout'
                            : 'Item Unavailable'}
                        </span>
                      </button>
                    )}

                    {bargain.status === 'countered' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => respondToBargain(bargain, 'accept_counter')}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>
                            Accept {formatCurrency(bargain.counterTotal ?? bargain.offeredTotal)}
                          </span>
                        </button>
                        {!isReoffering && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openReofferBox(bargain)}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Counter Back
                          </button>
                        )}
                      </>
                    )}

                    {(bargain.status === 'pending' || bargain.status === 'countered') && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => respondToBargain(bargain, 'withdraw')}
                        className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 hover:border-red-200 hover:text-red-600"
                        title="Withdraw offer"
                      >
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Withdraw</span>
                      </button>
                    )}
                  </div>

                  {/* Negotiation History Accordion */}
                  {bargain.history.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => toggleHistory(bargain.id)}
                        className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Negotiation Timeline ({bargain.history.length})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3">
                          {bargain.history.map((h, idx) => (
                            <div key={`${bargain.id}-hist-${idx}`} className="text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800 capitalize">
                                  {h.actor === 'admin' ? 'Sales Desk' : 'You'} ·{' '}
                                  {h.action.replace('_', ' ')}
                                  {typeof h.amount === 'number'
                                    ? ` (${formatCurrency(h.amount)})`
                                    : ''}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {new Date(h.createdAt).toLocaleTimeString('en-KE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              {h.note && <p className="text-slate-600">{h.note}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
