import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { PRIMARY_CATEGORIES } from '../constants/catalog';
import type { PartSourcingLog, PrimaryCategory, SparePart, VirtualReceipt } from '../types';

export type SourcingCategoryLabel = PrimaryCategory | 'Other / Custom';

export interface CategorySourcingDatum {
  category: SourcingCategoryLabel;
  shortLabel: string;
  inStoreRows: number;
  outsideRows: number;
  inStoreQty: number;
  outsideQty: number;
  totalRows: number;
  totalQty: number;
  outsideSharePct: number;
  topOutsideShops: string[];
  outsidePartExamples: string[];
}

interface PartSourcingChartProps {
  logs: PartSourcingLog[];
  allLogsCount: number;
  parts: SparePart[];
  orders: VirtualReceipt[];
  onFilterByPartName?: (term: string) => void;
}

type ChartMetric = 'quantity' | 'records';

const SHORT_CATEGORY_LABELS: Record<SourcingCategoryLabel, string> = {
  'Body parts': 'Body Parts',
  Electricals: 'Electricals',
  'Mechanical Parts': 'Mechanical',
  'Gearbox Oil': 'Gearbox Oil',
  'Dashboard & Interior Parts': 'Dashboard & Int.',
  'Other / Custom': 'Other / Custom',
};

function inferCategoryFromKeywords(partName: string): SourcingCategoryLabel {
  const text = partName.trim().toLowerCase();
  if (!text) return 'Other / Custom';

  if (/\b(gearbox\s*oil|cvt\s*(tc|fe)|atf|75w-?90|transmission\s*fluid|gear\s*oil)\b/i.test(text)) {
    return 'Gearbox Oil';
  }
  if (
    /\b(alternator|starter|sensor|relay|battery|batteries|wiring|harness|ignition|coil|fuse|ecu|switch|horn|wiper\s*motor)\b/i.test(
      text,
    )
  ) {
    return 'Electricals';
  }
  if (
    /\b(dashboard|cluster|speedometer|console|seat|upholstery|door\s*trim|steering\s*wheel|airbag|ac\s*vent|climate\s*control|glove\s*box)\b/i.test(
      text,
    )
  ) {
    return 'Dashboard & Interior Parts';
  }
  if (
    /\b(engine|gearbox|transmission|suspension|shock|strut|control\s*arm|ball\s*joint|tie\s*rod|steering\s*rack|brake|caliper|rotor|clutch|flywheel|axle|bearing|radiator|water\s*pump|oil\s*filter|spark\s*plug|timing|belt|mount|hub)\b/i.test(
      text,
    )
  ) {
    return 'Mechanical Parts';
  }
  if (
    /\b(door|headlight|headlamp|rearlight|tail\s*light|taillight|bumper|bonnet|hood|boot|trunk|wing|fender|grille|mirror|windscreen|windshield)\b/i.test(
      text,
    )
  ) {
    return 'Body parts';
  }
  return 'Other / Custom';
}

interface SourcingTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CategorySourcingDatum }>;
  metric: ChartMetric;
}

function SourcingTooltip({ active, payload, metric }: SourcingTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const inStoreVal = metric === 'quantity' ? point.inStoreQty : point.inStoreRows;
  const outsideVal = metric === 'quantity' ? point.outsideQty : point.outsideRows;
  const totalVal = inStoreVal + outsideVal;
  const unitLabel = metric === 'quantity' ? 'pcs' : 'records';

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-xl text-xs space-y-1.5 max-w-xs">
      <p className="font-semibold text-white border-b border-slate-700 pb-1">
        {point.category}
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-300">In Store (My Spare Zone)</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {inStoreVal} {unitLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-amber-300">Outside Suppliers</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {outsideVal} {unitLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
        <span className="text-slate-300">Outside Gap Share</span>
        <span
          className={`font-mono tabular-nums font-bold ${
            point.outsideSharePct >= 40
              ? 'text-orange-400'
              : point.outsideSharePct > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
          }`}
        >
          {totalVal > 0 ? `${point.outsideSharePct}%` : '0%'}
        </span>
      </div>
      {point.topOutsideShops.length > 0 && (
        <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-300">
          <span className="text-slate-400">Outside shops: </span>
          {point.topOutsideShops.join(', ')}
        </div>
      )}
    </div>
  );
}

export function PartSourcingChart({
  logs,
  allLogsCount,
  parts,
  orders,
  onFilterByPartName,
}: PartSourcingChartProps) {
  const [metric, setMetric] = useState<ChartMetric>('quantity');

  const { chartData, gapSummary } = useMemo(() => {
    const partById = new Map<string, SparePart>();
    const partBySku = new Map<string, SparePart>();
    const partByName = new Map<string, SparePart>();

    for (const part of parts) {
      partById.set(part.id, part);
      if (part.sku) partBySku.set(part.sku.trim().toLowerCase(), part);
      if (part.name) partByName.set(part.name.trim().toLowerCase(), part);
    }

    const orderById = new Map<string, VirtualReceipt>();
    for (const order of orders) {
      orderById.set(order.id, order);
    }

    const resolveCategory = (log: PartSourcingLog): SourcingCategoryLabel => {
      if (log.category?.trim()) {
        const rawCat = log.category.trim().toLowerCase();
        const explicitMatch = PRIMARY_CATEGORIES.find(
          (cat) => cat.toLowerCase() === rawCat,
        );
        if (explicitMatch) return explicitMatch;
        if (rawCat === 'other / custom' || rawCat === 'other') {
          return 'Other / Custom';
        }
      }

      if (log.orderId) {
        const order = orderById.get(log.orderId);
        if (order) {
          const partIdFromKey = log.orderPartKey?.split(':')[1];
          const matchedItem = order.items.find(
            (item) =>
              (partIdFromKey && item.partId === partIdFromKey) ||
              (log.sku && item.sku.toLowerCase() === log.sku.trim().toLowerCase()) ||
              item.name.trim().toLowerCase() === log.partName.trim().toLowerCase(),
          );
          if (matchedItem?.category) return matchedItem.category;
        }
      }

      if (log.orderPartKey) {
        const partIdFromKey = log.orderPartKey.split(':')[1];
        const partMatch = partIdFromKey ? partById.get(partIdFromKey) : undefined;
        if (partMatch) return partMatch.category;
      }

      if (log.sku?.trim()) {
        const skuMatch = partBySku.get(log.sku.trim().toLowerCase());
        if (skuMatch) return skuMatch.category;
      }

      const normalizedName = log.partName.trim().toLowerCase();
      if (normalizedName) {
        const exactMatch = partByName.get(normalizedName);
        if (exactMatch) return exactMatch.category;

        for (const p of parts) {
          const pName = p.name.toLowerCase();
          if (pName.includes(normalizedName) || normalizedName.includes(pName)) {
            return p.category;
          }
        }
      }

      return inferCategoryFromKeywords(log.partName);
    };

    const categoriesOrder: SourcingCategoryLabel[] = [
      ...PRIMARY_CATEGORIES,
      'Other / Custom',
    ];

    const buckets = new Map<
      SourcingCategoryLabel,
      {
        inStoreRows: number;
        outsideRows: number;
        inStoreQty: number;
        outsideQty: number;
        shopCounts: Map<string, number>;
        outsideParts: Map<string, number>;
      }
    >();

    for (const cat of categoriesOrder) {
      buckets.set(cat, {
        inStoreRows: 0,
        outsideRows: 0,
        inStoreQty: 0,
        outsideQty: 0,
        shopCounts: new Map(),
        outsideParts: new Map(),
      });
    }

    for (const log of logs) {
      const cat = resolveCategory(log);
      const bucket = buckets.get(cat)!;
      const qty = Math.max(1, Number(log.quantity) || 1);

      if (log.sourceType === 'outside_shop') {
        bucket.outsideRows += 1;
        bucket.outsideQty += qty;
        const shop = (log.sourceShopName || '').trim();
        if (shop) {
          bucket.shopCounts.set(shop, (bucket.shopCounts.get(shop) || 0) + qty);
        }
        const partLabel = (log.partName || '').trim();
        if (partLabel) {
          bucket.outsideParts.set(partLabel, (bucket.outsideParts.get(partLabel) || 0) + qty);
        }
      } else {
        bucket.inStoreRows += 1;
        bucket.inStoreQty += qty;
      }
    }

    const data: CategorySourcingDatum[] = [];
    for (const cat of categoriesOrder) {
      const b = buckets.get(cat)!;
      const totalRows = b.inStoreRows + b.outsideRows;
      const totalQty = b.inStoreQty + b.outsideQty;
      if (cat === 'Other / Custom' && totalRows === 0) continue;

      const denominator = metric === 'quantity' ? totalQty : totalRows;
      const outsideVal = metric === 'quantity' ? b.outsideQty : b.outsideRows;
      const outsideSharePct =
        denominator > 0 ? Math.round((outsideVal / denominator) * 100) : 0;

      const topOutsideShops = Array.from(b.shopCounts.entries())
        .sort((a, b2) => b2[1] - a[1])
        .slice(0, 3)
        .map(([shop, count]) => `${shop} (${count})`);

      const outsidePartExamples = Array.from(b.outsideParts.entries())
        .sort((a, b2) => b2[1] - a[1])
        .slice(0, 3)
        .map(([partName]) => partName);

      data.push({
        category: cat,
        shortLabel: SHORT_CATEGORY_LABELS[cat],
        inStoreRows: b.inStoreRows,
        outsideRows: b.outsideRows,
        inStoreQty: b.inStoreQty,
        outsideQty: b.outsideQty,
        totalRows,
        totalQty,
        outsideSharePct,
        topOutsideShops,
        outsidePartExamples,
      });
    }

    const totalInStore = data.reduce(
      (sum, d) => sum + (metric === 'quantity' ? d.inStoreQty : d.inStoreRows),
      0,
    );
    const totalOutside = data.reduce(
      (sum, d) => sum + (metric === 'quantity' ? d.outsideQty : d.outsideRows),
      0,
    );
    const totalAll = totalInStore + totalOutside;
    const overallOutsidePct =
      totalAll > 0 ? Math.round((totalOutside / totalAll) * 100) : 0;

    const categoriesWithOutside = data
      .filter((d) => (metric === 'quantity' ? d.outsideQty : d.outsideRows) > 0)
      .sort((a, b) => {
        const aVal = metric === 'quantity' ? a.outsideQty : a.outsideRows;
        const bVal = metric === 'quantity' ? b.outsideQty : b.outsideRows;
        return bVal - aVal || b.outsideSharePct - a.outsideSharePct;
      });

    return {
      chartData: data,
      gapSummary: {
        totalInStore,
        totalOutside,
        overallOutsidePct,
        topGapCategory: categoriesWithOutside[0] ?? null,
        categoriesWithOutside,
      },
    };
  }, [logs, parts, orders, metric]);

  const inStoreKey = metric === 'quantity' ? 'inStoreQty' : 'inStoreRows';
  const outsideKey = metric === 'quantity' ? 'outsideQty' : 'outsideRows';
  const unitLabel = metric === 'quantity' ? 'units' : 'records';

  return (
    <section
      aria-labelledby="sourcing-gap-chart-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-600" />
            <h3
              id="sourcing-gap-chart-heading"
              className="font-display text-base sm:text-lg font-bold text-slate-900"
            >
              In-Store vs. Outside Supplier Sourcing by Category
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualizes parts fulfilled from My Spare Zone stock versus external shops per category to highlight inventory restocking gaps
            {logs.length !== allLogsCount ? ` (filtered: ${logs.length} of ${allLogsCount} records)` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="Sourcing chart metric"
          >
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'quantity'}
              onClick={() => setMetric('quantity')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                metric === 'quantity'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Quantity (pcs)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'records'}
              onClick={() => setMetric('records')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                metric === 'records'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Log Entries
            </button>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
          No sourcing records to visualize yet. Add rows or sync orders below to track category supply chain gaps.
        </div>
      ) : (
        <>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<SourcingTooltip metric={metric} />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }}
                  iconType="square"
                />
                <Bar
                  dataKey={inStoreKey}
                  name="In Store (My Spare Zone)"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
                <Bar
                  dataKey={outsideKey}
                  name="Outside Suppliers (Gap)"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Supply Chain Gap Diagnostics Strip */}
          {gapSummary.topGapCategory ? (
            <div className="rounded-lg bg-amber-50/80 border border-amber-200 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950">
                    Biggest Supply Chain Gap: {gapSummary.topGapCategory.category} (
                    {metric === 'quantity'
                      ? gapSummary.topGapCategory.outsideQty
                      : gapSummary.topGapCategory.outsideRows}{' '}
                    {unitLabel} sourced outside · {gapSummary.topGapCategory.outsideSharePct}% of category)
                  </p>
                  <p className="text-amber-900/90">
                    Overall outside reliance: <strong className="font-mono">{gapSummary.overallOutsidePct}%</strong> ({gapSummary.totalOutside} of {gapSummary.totalInStore + gapSummary.totalOutside} {unitLabel}).
                    {gapSummary.topGapCategory.topOutsideShops.length > 0 && (
                      <> Suppliers used: {gapSummary.topGapCategory.topOutsideShops.join(', ')}.</>
                    )}
                  </p>
                </div>
              </div>

              {gapSummary.topGapCategory.outsidePartExamples.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium text-amber-900">Restock candidates:</span>
                  {gapSummary.topGapCategory.outsidePartExamples.map((partName) => (
                    <button
                      key={partName}
                      type="button"
                      onClick={() => onFilterByPartName?.(partName)}
                      title={`Filter table by "${partName}"`}
                      className="px-2 py-0.5 text-[11px] font-semibold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 rounded transition-colors"
                    >
                      {partName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                100% of {gapSummary.totalInStore} {unitLabel} in this view were fulfilled directly from My Spare Zone in-store inventory (no outside sourcing gaps).
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
