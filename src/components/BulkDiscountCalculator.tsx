import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  MessageCircle,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { CartItem, GaragePartnerProfile, SparePart } from '../types';
import {
  calculateCheckoutPricing,
  formatCurrency,
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  getWhatsAppSupportUrl,
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
  SHOP_NAME,
} from '../constants/catalog';

interface CalculatorLineItem {
  part: SparePart;
  quantity: number;
}

interface BulkDiscountCalculatorProps {
  allParts: SparePart[];
  partner?: GaragePartnerProfile | null;
  cart?: CartItem[];
  onAddToCart?: (part: SparePart, quantity?: number) => void;
  onOpenCart?: () => void;
}

type CalculatorMode = 'catalog' | 'custom';
type TierPresetKey = 'starter' | 'regular3' | 'regular6';

function getDefaultTierKey(partner?: GaragePartnerProfile | null): TierPresetKey {
  if (!partner) return 'starter';
  const count = getPartnerLoyaltyItemsCount(partner);
  if (count >= PARTNER_TOP_TIER_MIN_ITEMS) return 'regular6';
  if (count >= PARTNER_REGULAR_MIN_ITEMS) return 'regular3';
  return 'starter';
}

export function BulkDiscountCalculator({
  allParts,
  partner = null,
  cart = [],
  onAddToCart,
  onOpenCart,
}: BulkDiscountCalculatorProps) {
  const [mode, setMode] = useState<CalculatorMode>('catalog');
  const [tierKey, setTierKey] = useState<TierPresetKey>(() => getDefaultTierKey(partner));

  // Catalog Batch Mode state
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [addQuantity, setAddQuantity] = useState<number>(PARTNER_BULK_MIN_QTY);
  const [lines, setLines] = useState<CalculatorLineItem[]>([]);
  const [initializedDefault, setInitializedDefault] = useState(false);

  // Custom Amount Mode state
  const [customUnitPrice, setCustomUnitPrice] = useState<number>(15000);
  const [customQuantity, setCustomQuantity] = useState<number>(PARTNER_BULK_MIN_QTY);

  const [copiedSummary, setCopiedSummary] = useState(false);
  const [addedBatchFeedback, setAddedBatchFeedback] = useState(false);

  useEffect(() => {
    setTierKey(getDefaultTierKey(partner));
  }, [partner?.id, partner?.ordersCount, partner?.itemsCount]);

  useEffect(() => {
    if (allParts.length === 0) return;
    if (!selectedPartId || !allParts.some((p) => p.id === selectedPartId)) {
      const preferred = allParts.find((p) => p.stock > 0) ?? allParts[0];
      setSelectedPartId(preferred.id);
    }
    if (!initializedDefault && lines.length === 0) {
      const preferred =
        allParts.find((p) => p.stock >= PARTNER_BULK_MIN_QTY) ??
        allParts.find((p) => p.stock > 0) ??
        allParts[0];
      if (preferred) {
        setLines([{ part: preferred, quantity: PARTNER_BULK_MIN_QTY }]);
        setInitializedDefault(true);
      }
    }
  }, [allParts, selectedPartId, initializedDefault, lines.length]);

  const partnerDefaultKey = getDefaultTierKey(partner);

  const simulatedTier = useMemo(() => {
    const presetLoyaltyItemsCount =
      tierKey === 'regular6'
        ? PARTNER_TOP_TIER_MIN_ITEMS
        : tierKey === 'regular3'
          ? PARTNER_REGULAR_MIN_ITEMS
          : 0;
    const customBase =
      partner && tierKey === partnerDefaultKey ? partner.discountTierPercent : undefined;
    const basePct = getPartnerTierDiscountPct(presetLoyaltyItemsCount, customBase);
    return {
      presetLoyaltyItemsCount,
      customBase: basePct,
      basePct,
    };
  }, [tierKey, partner, partnerDefaultKey]);

  const totals = useMemo(() => {
    const subtotal =
      mode === 'catalog'
        ? lines.reduce((sum, item) => sum + item.part.price * item.quantity, 0)
        : Math.max(0, customUnitPrice) * Math.max(0, customQuantity);
    const totalUnits =
      mode === 'catalog'
        ? lines.reduce((sum, item) => sum + item.quantity, 0)
        : Math.max(0, customQuantity);

    const volumeComputableItems =
      mode === 'catalog'
        ? lines.map((item) => ({
            partId: item.part.id,
            name: item.part.name,
            category: item.part.category,
            unitPrice: item.part.price,
            quantity: item.quantity,
            stock: item.part.stock,
          }))
        : customQuantity > 0
          ? [
              {
                partId: 'custom-batch',
                name: 'Custom Spare Part',
                unitPrice: Math.max(0, customUnitPrice),
                quantity: Math.max(0, customQuantity),
              },
            ]
          : [];

    const pricing = calculateCheckoutPricing({
      subtotal,
      totalUnits,
      items: volumeComputableItems,
      partner: {
        status: 'active',
        ordersCount: simulatedTier.presetLoyaltyItemsCount,
        itemsCount: simulatedTier.presetLoyaltyItemsCount,
        discountTierPercent: simulatedTier.customBase,
        partnerType: partner?.partnerType ?? 'garage',
      },
      referralValid: null,
    });

    const afterVolumeSubtotal = Math.max(0, subtotal - pricing.volumeDiscountAmount);
    const baseAmount = Math.round((afterVolumeSubtotal * simulatedTier.basePct) / 100);
    const bulkBonusPct = Math.max(
      0,
      pricing.partnerOrReferralDiscountPercent - simulatedTier.basePct,
    );
    const bulkBonusAmount = Math.max(
      0,
      pricing.partnerOrReferralDiscountAmount - baseAmount,
    );
    const unitsRemainingForBulk = Math.max(0, PARTNER_BULK_MIN_QTY - totalUnits);
    const amountRemainingForBulk = Math.max(0, PARTNER_BULK_MIN_SUBTOTAL - subtotal);
    const effectiveUnitCost = totalUnits > 0 ? Math.round(pricing.total / totalUnits) : 0;

    return {
      subtotal,
      totalUnits,
      pricing,
      baseAmount,
      bulkBonusPct,
      bulkBonusAmount,
      unitsRemainingForBulk,
      amountRemainingForBulk,
      effectiveUnitCost,
    };
  }, [mode, lines, customUnitPrice, customQuantity, simulatedTier, partner?.partnerType]);

  const handleAddCatalogLine = () => {
    const part = allParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const qty = Math.max(1, Math.min(999, Math.floor(addQuantity) || 1));
    setLines((prev) => {
      const idx = prev.findIndex((item) => item.part.id === part.id);
      if (idx === -1) {
        return [...prev, { part, quantity: qty }];
      }
      return prev.map((item, i) =>
        i === idx ? { ...item, quantity: Math.min(999, item.quantity + qty) } : item,
      );
    });
  };

  const handleUpdateLineQty = (partId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setLines((prev) => prev.filter((item) => item.part.id !== partId));
      return;
    }
    const clamped = Math.min(999, Math.floor(nextQty));
    setLines((prev) =>
      prev.map((item) => (item.part.id === partId ? { ...item, quantity: clamped } : item)),
    );
  };

  const handleLoadFromCart = () => {
    if (cart.length === 0) return;
    setMode('catalog');
    setLines(cart.map((item) => ({ part: item.part, quantity: item.quantity })));
  };

  const handleReset = () => {
    if (mode === 'catalog') {
      const preferred =
        allParts.find((p) => p.stock >= PARTNER_BULK_MIN_QTY) ??
        allParts.find((p) => p.stock > 0) ??
        allParts[0];
      setLines(preferred ? [{ part: preferred, quantity: PARTNER_BULK_MIN_QTY }] : []);
      setAddQuantity(PARTNER_BULK_MIN_QTY);
    } else {
      setCustomUnitPrice(15000);
      setCustomQuantity(PARTNER_BULK_MIN_QTY);
    }
  };

  const handleAddBatchToCart = () => {
    if (!onAddToCart || mode !== 'catalog' || lines.length === 0) return;
    for (const item of lines) {
      onAddToCart(item.part, item.quantity);
    }
    setAddedBatchFeedback(true);
    window.setTimeout(() => setAddedBatchFeedback(false), 1800);
  };

  const quoteSummaryText = useMemo(() => {
    const header = partner
      ? `${SHOP_NAME} Bulk Estimate · ${partner.businessName} (${partner.referralCode})`
      : `${SHOP_NAME} Garage & Mechanic Bulk Estimate`;
    const tierLabel = `${simulatedTier.basePct}% Base Trade${totals.bulkBonusPct > 0 ? ` + ${totals.bulkBonusPct}% Bulk Bonus` : ''} (${totals.pricing.discountPercent}% Total Off)`;
    const itemLines =
      mode === 'catalog'
        ? lines
            .map(
              (item) =>
                `- ${item.quantity}x ${item.part.name} (${item.part.sku}) @ ${formatCurrency(item.part.price)} = ${formatCurrency(item.part.price * item.quantity)}`,
            )
            .join('\n')
        : `- ${Math.max(0, customQuantity)}x Custom Spare Parts @ ${formatCurrency(Math.max(0, customUnitPrice))}`;

    return [
      header,
      itemLines || '- No items selected',
      `Units: ${totals.totalUnits} | Retail Subtotal: ${formatCurrency(totals.subtotal)}`,
      `Tier Applied: ${tierLabel}`,
      `Total Discount Saved: -${formatCurrency(totals.pricing.discountAmount)}`,
      `Net Payable Total: ${formatCurrency(totals.pricing.total)}`,
    ].join('\n');
  }, [partner, simulatedTier.basePct, totals, mode, lines, customQuantity, customUnitPrice]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(quoteSummaryText);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <section
      id="bulk-discount-calculator"
      aria-labelledby="bulk-calculator-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Calculator Header */}
      <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="bulk-calculator-heading"
              className="font-display text-lg sm:text-xl font-bold text-slate-900"
            >
              Bulk Discount Calculator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Estimate exact wholesale savings across spare parts or custom batch totals ({PARTNER_BASE_DISCOUNT_PCT}%–{PARTNER_REGULAR_6_DISCOUNT_PCT}% trade tier + {PARTNER_BULK_BONUS_PCT}% bulk bonus up to {PARTNER_MAX_DISCOUNT_PCT}% off).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {cart.length > 0 && onAddToCart && (
            <button
              type="button"
              onClick={handleLoadFromCart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Load Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </button>
          )}
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="Calculator input mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'catalog'}
              onClick={() => setMode('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Catalog Parts Batch
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'custom'}
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Order Amount
            </button>
          </div>
        </div>
      </div>

      {/* Calculator Body: Inputs (Left) + Live Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left Column: Tier & Batch Builder */}
        <div className="lg:col-span-7 p-5 sm:p-6 space-y-5">
          {/* Trade Tier Selector */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Select Trade Loyalty Tier to Preview
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    key: 'starter' as const,
                    title: `Starter (0–${PARTNER_STARTER_MAX_ITEMS} items)`,
                    pct: PARTNER_BASE_DISCOUNT_PCT,
                  },
                  {
                    key: 'regular3' as const,
                    title: `Regular (${PARTNER_REGULAR_MIN_ITEMS}–${PARTNER_TOP_TIER_MIN_ITEMS - 1} items)`,
                    pct: PARTNER_REGULAR_3_DISCOUNT_PCT,
                  },
                  {
                    key: 'regular6' as const,
                    title: `Top Tier (${PARTNER_TOP_TIER_MIN_ITEMS}+ items)`,
                    pct: PARTNER_REGULAR_6_DISCOUNT_PCT,
                  },
                ] as const
              ).map((option) => {
                const selected = tierKey === option.key;
                const isPartnerActual = partner && partnerDefaultKey === option.key;
                const effectivePct =
                  isPartnerActual && partner
                    ? getPartnerTierDiscountPct(
                        getPartnerLoyaltyItemsCount(partner),
                        partner.discountTierPercent,
                        Boolean(partner.isProfessionalMechanicOrGarage),
                      )
                    : option.pct;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTierKey(option.key)}
                    className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-orange-50 border-orange-500 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                        {effectivePct}% off
                      </span>
                      {isPartnerActual && (
                        <span className="text-[11px] font-semibold text-orange-700">
                          Your Tier
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{option.title}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'catalog' ? (
            <div className="space-y-4">
              {/* Part Selector Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-7">
                  <label
                    htmlFor="calc-part-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Spare Part from Catalog
                  </label>
                  <select
                    id="calc-part-select"
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  >
                    {allParts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.name} ({part.sku}) — {formatCurrency(part.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="calc-add-qty"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Qty
                  </label>
                  <input
                    id="calc-add-qty"
                    type="number"
                    min={1}
                    max={999}
                    value={addQuantity}
                    onChange={(e) =>
                      setAddQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddCatalogLine}
                    disabled={!selectedPartId}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Part</span>
                  </button>
                </div>
              </div>

              {/* Line Items Table */}
              {lines.length === 0 ? (
                <div className="py-8 px-4 text-center border border-dashed border-slate-300 rounded-lg">
                  <p className="text-sm text-slate-600">
                    No parts in the batch estimator yet. Pick a part above and click Add Part.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="divide-y divide-slate-200">
                    {lines.map(({ part, quantity }) => (
                      <div
                        key={part.id}
                        className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {part.name}
                          </p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            {part.sku} · {formatCurrency(part.price)} each
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(part.id, quantity - 1)}
                              aria-label={`Decrease quantity for ${part.name}`}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={quantity}
                              onChange={(e) =>
                                handleUpdateLineQty(
                                  part.id,
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                              aria-label={`Quantity for ${part.name}`}
                              className="w-12 text-center text-xs font-mono tabular-nums font-semibold text-slate-900 py-1 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(part.id, quantity + 1)}
                              aria-label={`Increase quantity for ${part.name}`}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 min-w-[92px] text-right">
                            {formatCurrency(part.price * quantity)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleUpdateLineQty(part.id, 0)}
                            aria-label={`Remove ${part.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label
                  htmlFor="calc-custom-unit-price"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Average Unit Price (KSh)
                </label>
                <input
                  id="calc-custom-unit-price"
                  type="number"
                  min={0}
                  step={500}
                  value={customUnitPrice}
                  onChange={(e) => setCustomUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter any spare part price or bulk lot unit cost
                </p>
              </div>

              <div>
                <label
                  htmlFor="calc-custom-qty"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Total Units in Batch
                </label>
                <input
                  id="calc-custom-qty"
                  type="number"
                  min={1}
                  max={999}
                  value={customQuantity}
                  onChange={(e) =>
                    setCustomQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
                <div className="flex items-center gap-1.5 mt-2">
                  {[1, 3, 5, 10].map((presetQty) => (
                    <button
                      key={presetQty}
                      type="button"
                      onClick={() => setCustomQuantity(presetQty)}
                      className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded border transition-colors ${
                        customQuantity === presetQty
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ×{presetQty}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Pricing Output & Actions */}
        <div className="lg:col-span-5 p-5 sm:p-6 bg-slate-50/70 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Calculated Bulk Pricing
              </span>
              <span
                className={`text-xs font-semibold ${
                  totals.pricing.qualifiesBulk ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {totals.pricing.qualifiesBulk
                  ? `+${totals.bulkBonusPct}% Bulk Bonus Unlocked`
                  : 'Standard Trade Rate'}
              </span>
            </div>

            {!totals.pricing.qualifiesBulk && totals.totalUnits > 0 && (
              <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5">
                {totals.unitsRemainingForBulk > 0 ? (
                  <>
                    Add{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {totals.unitsRemainingForBulk}
                    </strong>{' '}
                    more {totals.unitsRemainingForBulk === 1 ? 'unit' : 'units'} ({PARTNER_BULK_MIN_QTY}+ total) and{' '}
                  </>
                ) : (
                  'Reach '
                )}
                {totals.amountRemainingForBulk > 0 ? (
                  <>
                    spend{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatCurrency(totals.amountRemainingForBulk)}
                    </strong>{' '}
                    more (≥{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
                    </strong>
                    ){' '}
                  </>
                ) : (
                  <>
                    reach ≥{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
                    </strong>{' '}
                  </>
                )}
                to unlock an extra +{PARTNER_BULK_BONUS_PCT}% bulk discount.
              </p>
            )}

            <dl className="space-y-2.5 text-sm border-t border-slate-200 pt-3.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600">
                  Retail Subtotal ({totals.totalUnits}{' '}
                  {totals.totalUnits === 1 ? 'unit' : 'units'})
                </dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">
                  {formatCurrency(totals.subtotal)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600">
                  Trade Tier Discount ({simulatedTier.basePct}%)
                </dt>
                <dd className="font-mono tabular-nums font-medium text-emerald-700">
                  -{formatCurrency(totals.baseAmount)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600">
                  Bulk Order Bonus (+{totals.bulkBonusPct}%)
                </dt>
                <dd
                  className={`font-mono tabular-nums font-medium ${
                    totals.bulkBonusAmount > 0 ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  -{formatCurrency(totals.bulkBonusAmount)}
                </dd>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between gap-2">
                <div>
                  <dt className="font-semibold text-slate-900">Net Bulk Total</dt>
                  <p className="text-xs text-emerald-700 font-medium font-mono tabular-nums">
                    Total saved: {formatCurrency(totals.pricing.discountAmount)} (
                    {totals.pricing.discountPercent}% off)
                  </p>
                </div>
                <div className="text-right">
                  <dd className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                    {formatCurrency(totals.pricing.total)}
                  </dd>
                  {totals.totalUnits > 0 && (
                    <p className="text-xs font-mono tabular-nums text-slate-500">
                      ~{formatCurrency(totals.effectiveUnitCost)} / unit
                    </p>
                  )}
                </div>
              </div>
            </dl>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            {mode === 'catalog' && onAddToCart && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBatchToCart}
                  disabled={lines.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {addedBatchFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Batch Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add Batch to Cart</span>
                    </>
                  )}
                </button>
                {onOpenCart && addedBatchFeedback && (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    className="px-3.5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Open Cart
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <a
                href={getWhatsAppSupportUrl(quoteSummaryText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Quote</span>
              </a>

              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Copied Quote</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Estimate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
