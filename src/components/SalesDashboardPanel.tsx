import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Calendar,
  Layers,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, normalizeOrderStatus, PRIMARY_CATEGORIES } from '../constants/catalog';
import type { VirtualReceipt } from '../types';

interface SalesDashboardPanelProps {
  orders: VirtualReceipt[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onOpenSalesReports?: () => void;
  onOpenReceipts?: () => void;
}

interface DailyMonthPoint {
  day: number;
  dateKey: string;
  dayLabel: string;
  shortDayLabel: string;
  ordersCount: number;
  confirmedOrdersCount: number;
  pendingOrdersCount: number;
  unitsSold: number;
  revenue: number;
  cumulativeRevenue: number;
}

interface CategoryPerformancePoint {
  category: string;
  shortLabel: string;
  revenue: number;
  unitsSold: number;
  ordersCount: number;
  revenueSharePct: number;
  unitsSharePct: number;
  topPartName: string;
  color: string;
}

type OrderScopeFilter = 'all' | 'confirmed';
type RevenueSeriesMode = 'daily' | 'cumulative';
type VolumeChartMode = 'orders' | 'units';
type CategoryMetricMode = 'revenue' | 'units';

const CATEGORY_COLORS: Record<string, string> = {
  'Body parts': '#ea580c',
  'Mechanical Parts': '#0f172a',
  Electricals: '#0284c7',
  'Gearbox Oil': '#059669',
  'Dashboard & Interior Parts': '#7c3aed',
};

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  'Body parts': 'Body Parts',
  Electricals: 'Electricals',
  'Mechanical Parts': 'Mechanical',
  'Gearbox Oil': 'Gearbox Oil',
  'Dashboard & Interior Parts': 'Dashboard & Int.',
};

function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOrderLocalDateKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatLocalDateKey(parsed);
}

function isOrderConfirmed(order: VirtualReceipt): boolean {
  const normalizedStatus = normalizeOrderStatus(order.status);
  return Boolean(order.saleConfirmed) || normalizedStatus === 'Shipped' || normalizedStatus === 'Delivered';
}

function formatCompactKsh(value: number): string {
  if (value === 0) return 'KSh 0';
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `KSh ${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `KSh ${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `KSh ${value}`;
}

interface DailyVolumeTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailyMonthPoint }>;
}

function DailyVolumeTooltip({ active, payload }: DailyVolumeTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-white border-b border-slate-700 pb-1">
        {point.dayLabel}{' '}
        <span className="font-mono text-slate-400 font-normal">({point.dateKey})</span>
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Total Orders</span>
        <span className="font-mono tabular-nums font-bold text-white">{point.ordersCount}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-300">Confirmed</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.confirmedOrdersCount}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-amber-300">Pending</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.pendingOrdersCount}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
        <span className="text-sky-300">Units Sold</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.unitsSold} pcs
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-orange-300">Day Revenue</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {formatCurrency(point.revenue)}
        </span>
      </div>
    </div>
  );
}

interface RevenueTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailyMonthPoint }>;
}

function RevenueTooltip({ active, payload }: RevenueTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-white border-b border-slate-700 pb-1">
        {point.dayLabel}{' '}
        <span className="font-mono text-slate-400 font-normal">({point.dateKey})</span>
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-orange-300">Daily Revenue</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {formatCurrency(point.revenue)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Cumulative MTD</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {formatCurrency(point.cumulativeRevenue)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
        <span className="text-sky-300">Orders · Units</span>
        <span className="font-mono tabular-nums text-white">
          {point.ordersCount} · {point.unitsSold} pcs
        </span>
      </div>
    </div>
  );
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CategoryPerformancePoint }>;
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 max-w-xs">
      <p className="font-semibold text-white border-b border-slate-700 pb-1">{point.category}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-orange-300">Category Revenue</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {formatCurrency(point.revenue)} ({point.revenueSharePct}%)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sky-300">Units Sold</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.unitsSold} pcs ({point.unitsSharePct}%)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-300">Orders</span>
        <span className="font-mono tabular-nums text-white">{point.ordersCount}</span>
      </div>
      {point.topPartName && (
        <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-300">
          <span className="text-slate-400">Top part: </span>
          {point.topPartName}
        </div>
      )}
    </div>
  );
}

export function SalesDashboardPanel({
  orders,
  loading,
  onRefresh,
  onOpenSalesReports,
  onOpenReceipts,
}: SalesDashboardPanelProps) {
  const [scope, setScope] = useState<OrderScopeFilter>('all');
  const [revenueMode, setRevenueMode] = useState<RevenueSeriesMode>('daily');
  const [volumeMode, setVolumeMode] = useState<VolumeChartMode>('orders');
  const [categoryMetric, setCategoryMetric] = useState<CategoryMetricMode>('revenue');

  const dashboard = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const monthLabel = now.toLocaleDateString('en-KE', {
      month: 'long',
      year: 'numeric',
    });
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const todayDayOfMonth = now.getDate();

    const monthOrdersAll = orders.filter(
      (order) => getOrderLocalDateKey(order.issuedAt).slice(0, 7) === monthKey,
    );
    const scopedMonthOrders =
      scope === 'confirmed' ? monthOrdersAll.filter(isOrderConfirmed) : monthOrdersAll;

    const dailyPoints: DailyMonthPoint[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateObj = new Date(year, monthIndex, day);
      const dateKey = formatLocalDateKey(dateObj);
      dailyPoints.push({
        day,
        dateKey,
        dayLabel: dateObj.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
        shortDayLabel: `${day}`,
        ordersCount: 0,
        confirmedOrdersCount: 0,
        pendingOrdersCount: 0,
        unitsSold: 0,
        revenue: 0,
        cumulativeRevenue: 0,
      });
    }

    const dailyMap = new Map(dailyPoints.map((pt) => [pt.dateKey, pt]));

    const categoryBuckets = new Map<
      string,
      {
        revenue: number;
        unitsSold: number;
        orderIds: Set<string>;
        partStats: Map<string, { name: string; revenue: number; units: number }>;
      }
    >();
    for (const cat of PRIMARY_CATEGORIES) {
      categoryBuckets.set(cat, {
        revenue: 0,
        unitsSold: 0,
        orderIds: new Set(),
        partStats: new Map(),
      });
    }

    let totalRevenue = 0;
    let totalOrders = 0;
    let confirmedOrders = 0;
    let pendingOrders = 0;
    let totalUnitsSold = 0;

    for (const order of scopedMonthOrders) {
      const dk = getOrderLocalDateKey(order.issuedAt);
      const bucket = dailyMap.get(dk);
      const orderConfirmed = isOrderConfirmed(order);
      const orderUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

      totalOrders += 1;
      if (orderConfirmed) {
        confirmedOrders += 1;
      } else {
        pendingOrders += 1;
      }
      totalRevenue += order.total;
      totalUnitsSold += orderUnits;

      if (bucket) {
        bucket.ordersCount += 1;
        if (orderConfirmed) {
          bucket.confirmedOrdersCount += 1;
        } else {
          bucket.pendingOrdersCount += 1;
        }
        bucket.unitsSold += orderUnits;
        bucket.revenue += order.total;
      }

      // Attribute line-item sales to their categories (proportionally adjusted if order had referral/tier discount)
      const rawSubtotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountScale =
        rawSubtotal > 0 && order.total >= 0 ? order.total / rawSubtotal : 1;

      for (const item of order.items) {
        const categoryName = item.category || 'Body parts';
        if (!categoryBuckets.has(categoryName)) {
          categoryBuckets.set(categoryName, {
            revenue: 0,
            unitsSold: 0,
            orderIds: new Set(),
            partStats: new Map(),
          });
        }
        const catBucket = categoryBuckets.get(categoryName)!;
        const attributedRevenue = Math.round(item.lineTotal * discountScale);
        catBucket.revenue += attributedRevenue;
        catBucket.unitsSold += item.quantity;
        catBucket.orderIds.add(order.id);

        const existingPart = catBucket.partStats.get(item.partId);
        if (existingPart) {
          existingPart.revenue += attributedRevenue;
          existingPart.units += item.quantity;
        } else {
          catBucket.partStats.set(item.partId, {
            name: item.name,
            revenue: attributedRevenue,
            units: item.quantity,
          });
        }
      }
    }

    let runningRevenue = 0;
    let peakRevenueDay: DailyMonthPoint | null = null;
    let peakOrdersDay: DailyMonthPoint | null = null;
    let activeDaysCount = 0;

    for (const pt of dailyPoints) {
      runningRevenue += pt.revenue;
      pt.cumulativeRevenue = runningRevenue;
      if (pt.ordersCount > 0) activeDaysCount += 1;
      if (!peakRevenueDay || pt.revenue > peakRevenueDay.revenue) {
        peakRevenueDay = pt;
      }
      if (!peakOrdersDay || pt.ordersCount > peakOrdersDay.ordersCount) {
        peakOrdersDay = pt;
      }
    }

    const totalCategoryRevenue = Array.from(categoryBuckets.values()).reduce(
      (sum, entry) => sum + entry.revenue,
      0,
    );
    const totalCategoryUnits = Array.from(categoryBuckets.values()).reduce(
      (sum, entry) => sum + entry.unitsSold,
      0,
    );

    const categoryData: CategoryPerformancePoint[] = Array.from(categoryBuckets.entries())
      .map(([cat, entry]) => {
        const sortedParts = Array.from(entry.partStats.values()).sort(
          (a, b) => b.revenue - a.revenue || b.units - a.units,
        );
        return {
          category: cat,
          shortLabel: SHORT_CATEGORY_LABELS[cat] || cat,
          revenue: entry.revenue,
          unitsSold: entry.unitsSold,
          ordersCount: entry.orderIds.size,
          revenueSharePct:
            totalCategoryRevenue > 0
              ? Math.round((entry.revenue / totalCategoryRevenue) * 100)
              : 0,
          unitsSharePct:
            totalCategoryUnits > 0 ? Math.round((entry.unitsSold / totalCategoryUnits) * 100) : 0,
          topPartName: sortedParts[0]
            ? `${sortedParts[0].name} (${sortedParts[0].units} pcs)`
            : '',
          color: CATEGORY_COLORS[cat] || '#475569',
        };
      })
      .sort((a, b) =>
        categoryMetric === 'revenue'
          ? b.revenue - a.revenue || b.unitsSold - a.unitsSold
          : b.unitsSold - a.unitsSold || b.revenue - a.revenue,
      );

    const topCategory =
      categoryData.find((c) => (categoryMetric === 'revenue' ? c.revenue > 0 : c.unitsSold > 0)) ??
      null;

    const avgDailyRevenue =
      todayDayOfMonth > 0 ? Math.round(totalRevenue / todayDayOfMonth) : 0;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      monthKey,
      monthLabel,
      daysInMonth,
      todayDayOfMonth,
      monthOrdersAllCount: monthOrdersAll.length,
      totalRevenue,
      totalOrders,
      confirmedOrders,
      pendingOrders,
      totalUnitsSold,
      avgDailyRevenue,
      avgOrderValue,
      activeDaysCount,
      peakRevenueDay: peakRevenueDay && peakRevenueDay.revenue > 0 ? peakRevenueDay : null,
      peakOrdersDay: peakOrdersDay && peakOrdersDay.ordersCount > 0 ? peakOrdersDay : null,
      dailyPoints,
      categoryData,
      topCategory,
    };
  }, [orders, scope, categoryMetric]);

  const hasMonthlySales = dashboard.totalOrders > 0;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              <span>Current Month Analytics</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">{dashboard.monthLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Day {dashboard.todayDayOfMonth} of {dashboard.daysInMonth}
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1">
              Sales Dashboard — {dashboard.monthLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live visualization of daily order volume, revenue momentum, and top-selling spare parts categories for {dashboard.monthLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Order Scope Filter */}
            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              role="tablist"
              aria-label="Order status scope"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'all'}
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Orders ({dashboard.monthOrdersAllCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'confirmed'}
                onClick={() => setScope('confirmed')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scope === 'confirmed'
                    ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Confirmed Only
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {onOpenSalesReports && (
              <button
                type="button"
                onClick={onOpenSalesReports}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Detailed Reports</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Empty-month contextual notice */}
        {!loading && !hasMonthlySales && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-slate-600">
              No {scope === 'confirmed' ? 'confirmed ' : ''}orders recorded yet for{' '}
              <strong className="text-slate-900">{dashboard.monthLabel}</strong>. As storefront, mechanic, and card or M-Pesa checkouts complete, daily volume, revenue trends, and category rankings populate automatically.
            </p>
            {onOpenReceipts && (
              <button
                type="button"
                onClick={onOpenReceipts}
                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Open Receipts Ledger
              </button>
            )}
          </div>
        )}
      </section>

      {/* 4 KPI Summary Cards */}
      {loading && orders.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 animate-pulse"
            >
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-7 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Monthly Revenue</span>
              <TrendingUp className="w-4 h-4 text-orange-600" aria-hidden="true" />
            </div>
            <p className="font-display text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {formatCurrency(dashboard.totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              Avg{' '}
              <span className="font-mono font-semibold text-slate-700">
                {formatCurrency(dashboard.avgDailyRevenue)}
              </span>{' '}
              / day MTD
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Monthly Order Volume</span>
              <ShoppingBag className="w-4 h-4 text-sky-600" aria-hidden="true" />
            </div>
            <p className="font-display text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {dashboard.totalOrders}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              <span className="font-semibold text-emerald-700">
                {dashboard.confirmedOrders} confirmed
              </span>{' '}
              <span aria-hidden="true">·</span>{' '}
              <span className="font-semibold text-amber-700">
                {dashboard.pendingOrders} pending
              </span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Units Sold</span>
              <PackageCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
            <p className="font-display text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {dashboard.totalUnitsSold}{' '}
              <span className="text-xs font-sans font-medium text-slate-500">pcs</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              Avg order{' '}
              <span className="font-mono font-semibold text-slate-700">
                {formatCurrency(dashboard.avgOrderValue)}
              </span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Top Category ({dashboard.monthLabel.split(' ')[0]})</span>
              <Layers className="w-4 h-4 text-violet-600" aria-hidden="true" />
            </div>
            <p
              className="font-display text-lg font-bold text-slate-900 mt-1.5 truncate"
              title={dashboard.topCategory?.category ?? 'No sales yet'}
            >
              {dashboard.topCategory ? dashboard.topCategory.category : 'No sales yet'}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {dashboard.topCategory ? (
                <>
                  <span className="font-mono font-semibold text-orange-700">
                    {formatCurrency(dashboard.topCategory.revenue)}
                  </span>{' '}
                  <span aria-hidden="true">·</span>{' '}
                  <span>{dashboard.topCategory.revenueSharePct}% share</span>
                </>
              ) : (
                'Awaiting first order this month'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Row 1 Charts: Daily Order Volume + Daily Revenue Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Daily Order Volume (Current Month) */}
        <section
          aria-labelledby="dashboard-daily-volume-heading"
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3
                id="dashboard-daily-volume-heading"
                className="font-display text-base font-bold text-slate-900"
              >
                Daily Order Volume ({dashboard.monthLabel})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {dashboard.activeDaysCount} active sales{' '}
                {dashboard.activeDaysCount === 1 ? 'day' : 'days'}
                {dashboard.peakOrdersDay && (
                  <>
                    {' '}
                    <span aria-hidden="true">·</span> Peak: {dashboard.peakOrdersDay.dayLabel} (
                    <span className="font-mono font-semibold text-slate-800">
                      {dashboard.peakOrdersDay.ordersCount}{' '}
                      {dashboard.peakOrdersDay.ordersCount === 1 ? 'order' : 'orders'}
                    </span>
                    )
                  </>
                )}
              </p>
            </div>

            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
              role="tablist"
              aria-label="Daily volume chart mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={volumeMode === 'orders'}
                onClick={() => setVolumeMode('orders')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  volumeMode === 'orders'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={volumeMode === 'units'}
                onClick={() => setVolumeMode('units')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  volumeMode === 'units'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Units Sold
              </button>
            </div>
          </div>

          <div className="w-full h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.dailyPoints}
                margin={{ top: 8, right: 8, left: -12, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortDayLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={2}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<DailyVolumeTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} iconType="square" />
                {volumeMode === 'orders' ? (
                  <>
                    <Bar
                      dataKey="confirmedOrdersCount"
                      name="Confirmed Orders"
                      stackId="orders"
                      fill="#059669"
                      radius={scope === 'confirmed' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={18}
                    />
                    {scope === 'all' && (
                      <Bar
                        dataKey="pendingOrdersCount"
                        name="Pending Orders"
                        stackId="orders"
                        fill="#d97706"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                    )}
                  </>
                ) : (
                  <Bar
                    dataKey="unitsSold"
                    name="Units Sold (pcs)"
                    fill="#0284c7"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: Daily Revenue Trend (Current Month) */}
        <section
          aria-labelledby="dashboard-revenue-trend-heading"
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3
                id="dashboard-revenue-trend-heading"
                className="font-display text-base font-bold text-slate-900"
              >
                Revenue Trends ({dashboard.monthLabel})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Total:{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {formatCurrency(dashboard.totalRevenue)}
                </span>
                {dashboard.peakRevenueDay && (
                  <>
                    {' '}
                    <span aria-hidden="true">·</span> Peak: {dashboard.peakRevenueDay.dayLabel} (
                    <span className="font-mono font-semibold text-orange-700">
                      {formatCurrency(dashboard.peakRevenueDay.revenue)}
                    </span>
                    )
                  </>
                )}
              </p>
            </div>

            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
              role="tablist"
              aria-label="Revenue trend mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={revenueMode === 'daily'}
                onClick={() => setRevenueMode('daily')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  revenueMode === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Revenue
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={revenueMode === 'cumulative'}
                onClick={() => setRevenueMode('cumulative')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  revenueMode === 'cumulative'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cumulative MTD
              </button>
            </div>
          </div>

          <div className="w-full h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dashboard.dailyPoints}
                margin={{ top: 8, right: 12, left: 4, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="salesDashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortDayLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={2}
                />
                <YAxis
                  tickFormatter={formatCompactKsh}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey={revenueMode === 'daily' ? 'revenue' : 'cumulativeRevenue'}
                  name={revenueMode === 'daily' ? 'Daily Revenue (KSh)' : 'Cumulative MTD Revenue'}
                  stroke="#ea580c"
                  strokeWidth={2.5}
                  fill="url(#salesDashboardRevenueFill)"
                  dot={{ r: 2, fill: '#ea580c', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 2: Top-Selling Spare Parts Categories (Current Month) */}
      <section
        aria-labelledby="dashboard-categories-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3
              id="dashboard-categories-heading"
              className="font-display text-base sm:text-lg font-bold text-slate-900"
            >
              Top-Selling Spare Parts Categories ({dashboard.monthLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Category performance ranked by {categoryMetric === 'revenue' ? 'attributed revenue (KSh)' : 'units sold'} across all current-month line items.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
            role="tablist"
            aria-label="Category ranking metric"
          >
            <button
              type="button"
              role="tab"
              aria-selected={categoryMetric === 'revenue'}
              onClick={() => setCategoryMetric('revenue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                categoryMetric === 'revenue'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Revenue (KSh)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryMetric === 'units'}
              onClick={() => setCategoryMetric('units')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                categoryMetric === 'units'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Units Sold
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Horizontal Bar Chart */}
          <div className="lg:col-span-7 w-full h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.categoryData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(val) =>
                    categoryMetric === 'revenue' ? formatCompactKsh(Number(val)) : `${val}`
                  }
                  allowDecimals={categoryMetric === 'revenue'}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={108}
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CategoryTooltip />} />
                <Bar
                  dataKey={categoryMetric === 'revenue' ? 'revenue' : 'unitsSold'}
                  name={categoryMetric === 'revenue' ? 'Revenue (KSh)' : 'Units Sold'}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                >
                  {dashboard.categoryData.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranked Category Table */}
          <div className="lg:col-span-5 overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-3.5">Category</th>
                  <th className="py-2.5 px-2.5 text-right">Units</th>
                  <th className="py-2.5 px-2.5 text-right">Share</th>
                  <th className="py-2.5 px-3.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {dashboard.categoryData.map((cat, idx) => {
                  const sharePct =
                    categoryMetric === 'revenue' ? cat.revenueSharePct : cat.unitsSharePct;
                  return (
                    <tr key={cat.category} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: cat.color }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {idx + 1}. {cat.category}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {cat.topPartName || `${cat.ordersCount} orders`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {cat.unitsSold}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {sharePct}%
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(cat.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
