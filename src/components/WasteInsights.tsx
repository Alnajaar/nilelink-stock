import React, { useMemo } from 'react';
import { PieChart, TrendingDown, DollarSign, Clock, Layers, AlertTriangle } from 'lucide-react';
import { WasteLog, StockItem } from '../types/stock';

interface WasteInsightsProps {
  wasteLogs: WasteLog[];
  items: StockItem[];
  currency?: string;
}

interface ChartSlice {
  label: string;
  value: number; // cost or units
  percentage: number;
  color: string;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  Dairy: '#3b82f6', // blue
  'Coffee Beans': '#d97706', // amber
  Bakery: '#f59e0b', // warm amber
  Packaging: '#64748b', // slate
  Syrups: '#ec4899', // pink
  Powders: '#8b5cf6', // purple
  Condiments: '#10b981', // emerald
  Tea: '#14b8a6', // teal
  Other: '#94a3b8'
};

const SHIFT_COLORS: { [key: string]: string } = {
  Morning: '#f59e0b', // amber sunrise
  Afternoon: '#3b82f6', // blue daylight
  Night: '#6366f1', // indigo dusk
  Unknown: '#94a3b8'
};

export const WasteInsights: React.FC<WasteInsightsProps> = ({
  wasteLogs,
  items,
  currency = '$'
}) => {
  // Map of item name to unit cost for accurate financial waste valuation
  const costMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.unitCost) {
        map.set(item.name.toLowerCase(), item.unitCost);
      }
    }
    return map;
  }, [items]);

  // Aggregate by Category
  const { categoryData, totalCategoryCost, totalUnitsWasted } = useMemo(() => {
    const costByCategory: { [cat: string]: number } = {};
    let totalCost = 0;
    let totalUnits = 0;

    for (const log of wasteLogs) {
      const unitCost = log.estimatedLoss && log.qtyWasted > 0
        ? log.estimatedLoss / log.qtyWasted
        : (costMap.get(log.itemName.toLowerCase()) || 2.5);

      const cost = log.estimatedLoss ?? (unitCost * log.qtyWasted);
      const cat = log.category || 'General';

      costByCategory[cat] = (costByCategory[cat] || 0) + cost;
      totalCost += cost;
      totalUnits += log.qtyWasted;
    }

    const sorted = Object.entries(costByCategory).sort((a, b) => b[1] - a[1]);
    const slices: ChartSlice[] = sorted.map(([cat, cost]) => {
      const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
      return {
        label: cat,
        value: cost,
        percentage: pct,
        color: CATEGORY_COLORS[cat] || '#8b5cf6'
      };
    });

    return { categoryData: slices, totalCategoryCost: totalCost, totalUnitsWasted: totalUnits };
  }, [wasteLogs, costMap]);

  // Aggregate by Shift
  const shiftData = useMemo(() => {
    const costByShift: { [shift: string]: number } = {
      Morning: 0,
      Afternoon: 0,
      Night: 0
    };

    let totalShiftCost = 0;

    for (const log of wasteLogs) {
      // Determine shift
      let s = log.shift;
      if (!s) {
        const hour = new Date(log.timestamp).getHours();
        if (hour >= 6 && hour < 14) s = 'Morning';
        else if (hour >= 14 && hour < 22) s = 'Afternoon';
        else s = 'Night';
      }

      const unitCost = log.estimatedLoss && log.qtyWasted > 0
        ? log.estimatedLoss / log.qtyWasted
        : (costMap.get(log.itemName.toLowerCase()) || 2.5);

      const cost = log.estimatedLoss ?? (unitCost * log.qtyWasted);
      costByShift[s] = (costByShift[s] || 0) + cost;
      totalShiftCost += cost;
    }

    const slices: ChartSlice[] = [
      {
        label: 'Morning (06:00 - 14:00)',
        value: costByShift['Morning'] || 0,
        percentage: totalShiftCost > 0 ? ((costByShift['Morning'] || 0) / totalShiftCost) * 100 : 0,
        color: SHIFT_COLORS['Morning']
      },
      {
        label: 'Afternoon (14:00 - 22:00)',
        value: costByShift['Afternoon'] || 0,
        percentage: totalShiftCost > 0 ? ((costByShift['Afternoon'] || 0) / totalShiftCost) * 100 : 0,
        color: SHIFT_COLORS['Afternoon']
      },
      {
        label: 'Night (22:00 - 06:00)',
        value: costByShift['Night'] || 0,
        percentage: totalShiftCost > 0 ? ((costByShift['Night'] || 0) / totalShiftCost) * 100 : 0,
        color: SHIFT_COLORS['Night']
      }
    ].filter(s => s.value > 0);

    return { slices, totalShiftCost };
  }, [wasteLogs, costMap]);

  // Helper SVG Donut generator
  const renderSvgDonut = (slices: ChartSlice[], centerLabel: string, centerSub: string) => {
    if (slices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
          <PieChart className="w-8 h-8 mb-1.5 opacity-40" />
          <span>No waste incidents logged yet</span>
        </div>
      );
    }

    // Cumulative angles
    let cumulativeAngle = 0;
    const paths = slices.map((slice, i) => {
      const angle = (slice.percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      // Handle 100% case cleanly
      if (slice.percentage >= 99.9) {
        return (
          <circle
            key={i}
            cx="100"
            cy="100"
            r="70"
            fill="none"
            stroke={slice.color}
            strokeWidth="34"
          />
        );
      }

      // Convert angles to polar coords
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const r = 70;
      const cx = 100;
      const cy = 100;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;
      const pathData = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

      return (
        <path
          key={i}
          d={pathData}
          fill="none"
          stroke={slice.color}
          strokeWidth="32"
          strokeLinecap="round"
          className="transition-all duration-300 hover:opacity-85"
        />
      );
    });

    return (
      <div className="relative w-44 h-44 mx-auto shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
          {paths}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-lg font-black text-slate-900 tracking-tight leading-none">{centerLabel}</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{centerSub}</span>
        </div>
      </div>
    );
  };

  // Top single waste contributor
  const topContributor = categoryData[0];

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header with KPI chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Waste Insights &amp; Food Cost Reduction</span>
              </h3>
              <p className="text-xs text-slate-500">
                Visualizing top cost bleed contributors to help managers optimize prep &amp; order sizes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200/60 text-right">
            <div className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Est. Spoilage Loss</div>
            <div className="text-sm font-black text-red-700 font-mono">
              {currency}{totalCategoryCost.toFixed(2)}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Units</div>
            <div className="text-sm font-black text-slate-800 font-mono">
              {totalUnitsWasted.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Two Pie / Donut Charts Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Category Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Top Spoilage by Category</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">By Cost Share</span>
            </div>

            <div className="my-2">
              {renderSvgDonut(
                categoryData,
                `${currency}${totalCategoryCost.toFixed(0)}`,
                'Total Loss'
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            {categoryData.slice(0, 4).map((slice, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-medium text-slate-700 truncate">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-slate-500 font-semibold">{slice.percentage.toFixed(0)}%</span>
                  <span className="font-bold text-slate-900">{currency}{slice.value.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Shift Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Waste Distribution by Shift</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Shift Accountability</span>
            </div>

            <div className="my-2">
              {renderSvgDonut(
                shiftData.slices,
                `${shiftData.slices.length > 0 ? shiftData.slices.reduce((max, s) => s.value > max.value ? s : max, shiftData.slices[0]).label.split(' ')[0] : 'N/A'}`,
                'Peak Shift'
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            {shiftData.slices.map((slice, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-medium text-slate-700 truncate">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-slate-500 font-semibold">{slice.percentage.toFixed(0)}%</span>
                  <span className="font-bold text-slate-900">{currency}{slice.value.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manager Cost Reduction Action Card */}
      {topContributor && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed">
            <strong className="font-semibold text-amber-900">Manager Recommendation: </strong>
            <span className="font-bold text-amber-800">{topContributor.label}</span> accounts for{' '}
            <strong className="font-mono">{topContributor.percentage.toFixed(0)}%</strong> of overall food waste cost ({currency}{topContributor.value.toFixed(2)}). Consider lowering par levels on perishable dairy or scheduling smaller, more frequent deliveries to curb expiration loss.
          </div>
        </div>
      )}
    </div>
  );
};
