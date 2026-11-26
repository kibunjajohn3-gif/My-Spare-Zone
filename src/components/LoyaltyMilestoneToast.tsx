import { useEffect, useState } from 'react';
import { Award, ArrowRight, X, Sparkles } from 'lucide-react';
import type { LoyaltyMilestoneToastInfo } from '../constants/catalog';
import { PARTNER_REGULAR_6_DISCOUNT_PCT, PARTNER_TOP_TIER_MIN_ITEMS } from '../constants/catalog';

interface LoyaltyMilestoneToastProps {
  toast: LoyaltyMilestoneToastInfo | null;
  onDismiss: () => void;
  onOpenPartnerPortal: () => void;
}

const AUTO_DISMISS_MS = 10000;

export function LoyaltyMilestoneToast({
  toast,
  onDismiss,
  onOpenPartnerPortal,
}: LoyaltyMilestoneToastProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  if (!toast) return null;

  const progressPct = Math.min(
    100,
    Math.round((toast.currentItemsCount / PARTNER_TOP_TIER_MIN_ITEMS) * 100),
  );

  return (
    <div
      className="fixed top-5 right-5 z-[70] w-[calc(100%-2.5rem)] max-w-md bg-slate-900 text-white border border-orange-500/60 rounded-xl shadow-2xl p-4 no-print"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400 truncate">
                {toast.badgeLabel}
              </p>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5 leading-snug">
              {toast.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {toast.message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss loyalty milestone notification"
          className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress toward Top Tier (10 items -> 5% off) */}
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
          <span className="text-slate-300">
            Progress: <strong className="text-white">{toast.currentItemsCount}</strong> /{' '}
            {PARTNER_TOP_TIER_MIN_ITEMS} items
          </span>
          <span className="text-emerald-400 font-semibold">
            {toast.itemsRemaining} {toast.itemsRemaining === 1 ? 'item' : 'items'} to{' '}
            {PARTNER_REGULAR_6_DISCOUNT_PCT}% Top Tier
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-mono truncate">
            Order #{toast.receiptNumber}
          </span>
          <button
            type="button"
            onClick={() => {
              onDismiss();
              onOpenPartnerPortal();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>View Loyalty Tiers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
