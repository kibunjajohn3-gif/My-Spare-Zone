import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../constants/catalog';

export interface DailySalesTrendPoint {
  dateKey: string;
  dayLabel: string;
  ordersCount: number;
  confirmedOrdersCount: number;
  unitsSold: number;
  revenue: number;
}

interface SalesTrendChartProps {
  data: DailySalesTrendPoint[];
  confirmedOnly: boolean;
}

type VolumeMetric = 'ordersCount' | 'unitsSold';

function formatCompactRevenueAxis(value: number): string {
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

interface TrendTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailySalesTrendPoint }>;
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-white border-b border-slate-700 pb-1">
        {point.dayLabel}{' '}
        <span className="font-mono text-slate-400 font-normal">({point.dateKey})</span>
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-orange-300">Revenue</span>
        <span className="font-mono tabular-nums font-bold text-white">
          {formatCurrency(point.revenue)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sky-300">Sales Orders</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.ordersCount} ({point.confirmedOrdersCount} confirmed)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-300">Units Sold</span>
        <span className="font-mono tabular-nums font-semibold text-white">
          {point.unitsSold} pcs
        </span>
      </div>
    </div>
  );
}

export function SalesTrendChart({ data, confirmedOnly }: SalesTrendChartProps) {
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('ordersCount');
  const [showRevenueLine, setShowRevenueLine] = useState(true);
  const [showVolumeLine, setShowVolumeLine] = useState(true);

  const summary30 = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalUnits = 0;
    let peakDay: DailySalesTrendPoint | null = null;

    for (const point of data) {
      totalRevenue += point.revenue;
      totalOrders += point.ordersCount;
      totalUnits += point.unitsSold;
      if (!peakDay || point.revenue > peakDay.revenue) {
        peakDay = point;
      }
    }

    return {
      totalRevenue,
      totalOrders,
      totalUnits,
      peakDay: peakDay && peakDay.revenue > 0 ? peakDay : null,
      startDate: data[0]?.dayLabel ?? '',
      endDate: data[data.length - 1]?.dayLabel ?? '',
    };
  }, [data]);

  const handleToggleRevenue = () => {
    if (showRevenueLine && !showVolumeLine) return;
    setShowRevenueLine((prev) => !prev);
  };

  const handleToggleVolume = () => {
    if (showVolumeLine && !showRevenueLine) return;
    setShowVolumeLine((prev) => !prev);
  };

  return (
    <section
      aria-labelledby="thirty-day-trend-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3
            id="thirty-day-trend-heading"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            30-Day Daily Sales Volume & Revenue Trend
          </h3>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {summary30.startDate && summary30.endDate
              ? `${summary30.startDate} – ${summary30.endDate}`
              : 'Last 30 days'}{' '}
            ·{' '}
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(summary30.totalRevenue)}
            </span>{' '}
            revenue ·{' '}
            <span className="font-mono font-semibold text-slate-900">
              {summary30.totalOrders}
            </span>{' '}
            orders ·{' '}
            <span className="font-mono font-semibold text-slate-900">
              {summary30.totalUnits}
            </span>{' '}
            units
            {confirmedOnly ? ' · Confirmed sales only' : ''}
            {summary30.peakDay && (
              <>
                {' '}
                · Peak: {summary30.peakDay.dayLabel} (
                <span className="font-mono font-semibold text-orange-700">
                  {formatCurrency(summary30.peakDay.revenue)}
                </span>
                )
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Volume series selector */}
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="Daily sales volume metric"
          >
            <button
              type="button"
              role="tab"
              aria-selected={volumeMetric === 'ordersCount'}
              onClick={() => setVolumeMetric('ordersCount')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                volumeMetric === 'ordersCount'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders Volume
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={volumeMetric === 'unitsSold'}
              onClick={() => setVolumeMetric('unitsSold')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                volumeMetric === 'unitsSold'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Units Volume
            </button>
          </div>

          {/* Series toggles */}
          <button
            type="button"
            onClick={handleToggleRevenue}
            aria-pressed={showRevenueLine}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showRevenueLine
                ? 'bg-orange-50 text-orange-900 border-orange-300'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-orange-600 rounded-full" aria-hidden="true" />
            <span>Revenue</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVolume}
            aria-pressed={showVolumeLine}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showVolumeLine
                ? 'bg-sky-50 text-sky-900 border-sky-300'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-sky-600 rounded-full" aria-hidden="true" />
            <span>{volumeMetric === 'ordersCount' ? 'Orders' : 'Units'}</span>
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
          No 30-day sales trend data available yet.
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={24}
              />
              {showRevenueLine && (
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  tickFormatter={formatCompactRevenueAxis}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
              )}
              {showVolumeLine && (
                <YAxis
                  yAxisId="volume"
                  orientation={showRevenueLine ? 'right' : 'left'}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
              )}
              <Tooltip content={<TrendTooltip />} />
              {showRevenueLine && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue (KSh)"
                  stroke="#ea580c"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: '#ea580c', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
              {showVolumeLine && (
                <Line
                  yAxisId="volume"
                  type="monotone"
                  dataKey={volumeMetric}
                  name={volumeMetric === 'ordersCount' ? 'Sales Orders' : 'Units Sold'}
                  stroke="#0284c7"
                  strokeWidth={2.25}
                  dot={{ r: 2.5, fill: '#0284c7', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {summary30.totalOrders === 0 && (
        <p className="text-xs text-slate-500">
          No completed orders recorded in the last 30 days. New storefront and partner checkouts appear automatically on the chart.
        </p>
      )}
    </section>
  );
}
