import React from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Trash2,
  DollarSign,
  ArrowRight,
  Download,
  ShoppingCart,
  Layers,
  Sparkles,
  FileSpreadsheet,
  ShieldAlert
} from 'lucide-react';
import { StockItem, CafeTenant } from '../types/stock';
import { ExcelService } from '../services/excelService';

interface DashboardScreenProps {
  cafe: CafeTenant;
  items: StockItem[];
  metrics: {
    totalUnits: number;
    totalItems: number;
    needToOrder: number;
    healthyCount: number;
    totalReceived: number;
    totalTaken: number;
    totalWaste: number;
    totalValue: number;
  };
  onNavigateTab: (tab: any) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  cafe,
  items,
  metrics,
  onNavigateTab,
  onShowToast
}) => {
  const lowStockItems = items
    .filter(i => i.currentStock <= i.minLevel)
    .sort((a, b) => (a.currentStock - a.minLevel) - (b.currentStock - b.minLevel));

  const handleExportCsv = () => {
    const csv = ExcelService.exportMasterStockCsv(items);
    ExcelService.downloadCsv(csv, `${cafe.name.replace(/\s+/g, '_')}_Stock_Master.csv`);
    onShowToast('Master Stock CSV exported successfully!', 'ok');
  };

  const handleExportExcel = () => {
    ExcelService.exportCompleteWorkbook(cafe.name, items);
    onShowToast('Multi-tab Microsoft Excel (.xlsx) workbook downloaded!', 'ok');
  };

  // Group items by category to calculate category unit totals
  const categorySummary = items.reduce((acc, it) => {
    const cat = it.category || 'General';
    if (!acc[cat]) acc[cat] = { units: 0, itemsCount: 0 };
    acc[cat].units += it.currentStock;
    acc[cat].itemsCount += 1;
    return acc;
  }, {} as { [cat: string]: { units: number; itemsCount: number } });

  const categoryEntries = Object.entries(categorySummary).sort((a, b) => b[1].units - a[1].units);

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Live Stock Dashboard
          </h2>
          <div className="text-xs text-slate-500 mt-0.5">
            Real-time multi-terminal inventory telemetry for <span className="font-semibold text-slate-700">{cafe.name}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('excel')}
            className="h-9 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Catalog Hub</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Download multi-tab Excel file (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export .xlsx</span>
          </button>
          <button
            onClick={() => onNavigateTab('autoorder')}
            className="h-9 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Reorder List</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Matching the exact cafe dashboard numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Units */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Stock Units</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
            {metrics.totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span>Across</span>
            <span className="font-semibold text-slate-700">{metrics.totalItems}</span>
            <span>tracked items</span>
          </div>
        </div>

        {/* Needs Order */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Needs Reorder</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-red-600 font-mono tabular-nums tracking-tight">
            {metrics.needToOrder}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span>At or below minimum limit</span>
          </div>
        </div>

        {/* Healthy OK */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Healthy Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-600 font-mono tabular-nums tracking-tight">
            {metrics.healthyCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span>Optimal stock levels</span>
          </div>
        </div>

        {/* Estimated Value */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Inventory Value</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
            ${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Valued at supplier unit costs
          </div>
        </div>
      </div>

      {/* Movement Velocity Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Received</span>
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-emerald-400 font-mono tabular-nums">
            +{metrics.totalReceived}
          </div>
          <div className="text-[10px] text-slate-400">Deliveries logged</div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Taken to Bar</span>
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-amber-400 font-mono tabular-nums">
            -{metrics.totalTaken}
          </div>
          <div className="text-[10px] text-slate-400">Barista replenishments</div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Total Waste</span>
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-red-400 font-mono tabular-nums">
            {metrics.totalWaste}
          </div>
          <div className="text-[10px] text-slate-400">Spoilage / damage</div>
        </div>
      </div>

      {/* Smart Inventory Audit & Loss Prevention Banner */}
      <div className="bg-gradient-to-r from-red-950/50 via-slate-900 to-slate-900 border border-red-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight">Smart Inventory Audit &amp; Theft Watch</h4>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                Admin Loss Prevention
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated pattern engine comparing physical stock vs barista logs. Identify potential theft and unaccounted drains.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab('audit')}
          className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm shadow-red-950/50"
        >
          <span>Open Smart Audit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Two-Column Layout: Low Stock Warning List + Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Low Stock Warning Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">Needs Immediate Reorder</h3>
              </div>
              <span className="text-xs font-semibold text-red-600 font-mono tabular-nums">
                {lowStockItems.length} items
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                All inventory items are currently above their safety thresholds.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lowStockItems.slice(0, 5).map(it => {
                  const toOrder = Math.max(0, it.maxLevel - it.currentStock);
                  return (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-slate-900 truncate">{it.name}</div>
                        <div className="text-slate-500 text-[11px]">
                          <span>{it.category}</span>
                          <span className="mx-1">·</span>
                          <span>Min: {it.minLevel} {it.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-red-600 font-mono tabular-nums">
                          {it.currentStock} {it.unit}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600">
                          Order +{toOrder}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigateTab('autoorder')}
              className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>View Full Order Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Breakdown Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Inventory by Category</h3>
            </div>
            <span className="text-xs text-slate-500">
              {categoryEntries.length} departments
            </span>
          </div>

          <div className="space-y-3">
            {categoryEntries.slice(0, 6).map(([cat, info]) => {
              const pct = metrics.totalUnits > 0 ? (info.units / metrics.totalUnits) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-800">{cat}</span>
                    <span className="font-mono tabular-nums text-slate-600 text-[11px]">
                      {info.units.toLocaleString()} units ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-5 flex items-center justify-between text-xs text-slate-500">
            <span>Fast-moving: Dairy & Coffee Beans</span>
            <button
              onClick={() => onNavigateTab('stock')}
              className="text-amber-600 font-semibold hover:underline"
            >
              Inspect Stock Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
