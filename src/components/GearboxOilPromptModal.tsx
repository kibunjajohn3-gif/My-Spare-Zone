import { useEffect, useState } from 'react';
import { X, Plus, Check, ShoppingBag, ArrowRight } from 'lucide-react';
import type { SparePart } from '../types';
import {
  formatCurrency,
  GEARBOX_OIL_CAN_LITRES,
  GEARBOX_OIL_LITRES_NEEDED,
  GEARBOX_OIL_PAIR_CANS,
  getMatchingGearboxOils,
} from '../constants/catalog';
import { PartImage } from './PartImage';

interface GearboxOilPromptModalProps {
  gearbox: SparePart | null;
  gearboxQuantity: number;
  allParts: SparePart[];
  cartQuantities: Record<string, number>;
  onClose: () => void;
  onSelectPart: (part: SparePart) => void;
  onAddOilPair: (oil: SparePart, cans: number) => void;
  onOpenCart: () => void;
}

export function GearboxOilPromptModal({
  gearbox,
  gearboxQuantity,
  allParts,
  cartQuantities,
  onClose,
  onSelectPart,
  onAddOilPair,
  onOpenCart,
}: GearboxOilPromptModalProps) {
  const [addedOilIds, setAddedOilIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAddedOilIds({});
  }, [gearbox?.id]);

  useEffect(() => {
    if (!gearbox) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gearbox, onClose]);

  if (!gearbox) return null;

  const matchingInfo = getMatchingGearboxOils(gearbox, allParts);
  if (matchingInfo.oils.length === 0) return null;

  const recommendedCans = Math.max(1, gearboxQuantity) * GEARBOX_OIL_PAIR_CANS;
  const recommendedLitres = recommendedCans * GEARBOX_OIL_CAN_LITRES;
  const anyOilAdded =
    Object.values(addedOilIds).some(Boolean) ||
    matchingInfo.oils.some((oil) => (cartQuantities[oil.id] || 0) >= recommendedCans);

  const handleAddOil = (oil: SparePart) => {
    onAddOilPair(oil, recommendedCans);
    setAddedOilIds((prev) => ({ ...prev, [oil.id]: true }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gearbox-oil-prompt-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-orange-50/80 border-b border-orange-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-orange-700">
              Added {gearboxQuantity} × {gearbox.name} to Cart
            </p>
            <h2
              id="gearbox-oil-prompt-title"
              className="font-display text-lg font-bold text-slate-900 mt-0.5"
            >
              Suggested Matching {matchingInfo.oilSpecLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/70 rounded-lg transition-colors"
            aria-label="Close oil suggestion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explanation */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-sm text-slate-700 leading-relaxed">
            Detected <strong>{matchingInfo.label}</strong>. A gearbox uses around{' '}
            <strong>{GEARBOX_OIL_LITRES_NEEDED} litres</strong> of oil while each can is{' '}
            <strong>{GEARBOX_OIL_CAN_LITRES} litres</strong>, so we suggest buying{' '}
            <strong>
              {recommendedCans} cans ({recommendedLitres} litres)
            </strong>{' '}
            in pairs for a complete fill.
          </p>
        </div>

        {/* Matching Oil Options */}
        <div className="px-6 py-4 space-y-3">
          {matchingInfo.oils.map((oil) => {
            const inCartQty = cartQuantities[oil.id] || 0;
            const isAdded = !!addedOilIds[oil.id] || inCartQty >= recommendedCans;
            const isExactMatch = matchingInfo.exactOilIds.includes(oil.id);
            const pairTotal = oil.price * recommendedCans;

            return (
              <div
                key={oil.id}
                className={`rounded-xl p-3.5 flex items-center gap-3.5 border ${
                  isExactMatch
                    ? 'bg-orange-50/70 border-orange-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectPart(oil);
                  }}
                  className="w-16 h-14 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                  aria-label={`Inspect ${oil.name}`}
                >
                  <PartImage
                    src={oil.imageUrl}
                    alt={oil.name}
                    className="w-full h-full object-cover"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-orange-700 truncate">
                    {isExactMatch ? 'Exact Match · ' : 'Compatible · '}
                    {oil.subcategory} · Pair ({recommendedCans} × {GEARBOX_OIL_CAN_LITRES}L)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectPart(oil);
                    }}
                    className="text-left block w-full"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 hover:text-orange-700 truncate">
                      {oil.name}
                    </h3>
                  </button>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                      {formatCurrency(pairTotal)}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      ({formatCurrency(oil.price)} / 4L can)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddOil(oil)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isAdded
                      ? 'bg-emerald-700 text-white'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Pair Added</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Pair ({recommendedCans})</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {anyOilAdded ? 'Continue Shopping' : 'Skip for Now'}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCart();
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>View Cart & Checkout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
