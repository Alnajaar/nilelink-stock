import React, { useState, useMemo } from 'react';
import { Search, Plus, Download, AlertTriangle, CheckCircle2, Filter, Layers, FileSpreadsheet, Sparkles, Brain } from 'lucide-react';
import { StockItem, StockOutLog } from '../types/stock';
import { ExcelService } from '../services/excelService';
import { MLStockPredictionService } from '../services/mlStockPredictionService';

interface StockLevelsScreenProps {
  items: StockItem[];
  cafeName: string;
  stockOutLogs?: StockOutLog[];
  onOpenAddItem: () => void;
  onOpenMLPredictions?: () => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const StockLevelsScreen: React.FC<StockLevelsScreenProps> = ({
  items,
  cafeName,
  stockOutLogs = [],
  onOpenAddItem,
  onOpenMLPredictions,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Compute predictions map
  const predictionsMap = useMemo(() => {
    const predictions = MLStockPredictionService.analyzeStockPredictions(items, stockOutLogs, []);
    const map = new Map<string, any>();
    for (const p of predictions) {
      map.set(p.itemId, p);
    }
    return map;
  }, [items, stockOutLogs]);

  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category || 'General'));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter(it => {
      const isLow = it.currentStock <= it.minLevel;
      if (statusFilter === 'low' && !isLow) return false;
      if (statusFilter === 'ok' && isLow) return false;
      if (selectedCategory !== 'All' && it.category !== selectedCategory) return false;
      if (q) {
        return (
          it.name.toLowerCase().includes(q) ||
          (it.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, searchQuery, statusFilter, selectedCategory]);

  const handleExportCsv = () => {
    const csv = ExcelService.exportMasterStockCsv(items);
    ExcelService.downloadCsv(csv, `${cafeName}_Master_Stock.csv`);
    onShowToast('Master Stock CSV downloaded.', 'ok');
  };

  const handleExportWorkbook = () => {
    ExcelService.exportCompleteWorkbook(cafeName, items);
    onShowToast('Complete multi-tab Excel (.xlsx) workbook downloaded!', 'ok');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <span>Master Stock Levels</span>
          </h2>
          <div className="text-xs text-slate-500 mt-0.5">
            Formula: <span className="font-mono text-slate-700 font-semibold">Current = Opening + In - Out - Waste</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenMLPredictions && (
            <button
              onClick={onOpenMLPredictions}
              className="h-9 px-3.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title="View machine learning consumption velocity and burn-down forecast"
            >
              <Brain className="w-3.5 h-3.5 text-amber-600" />
              <span>✨ ML Prediction Hub</span>
            </button>
          )}
          <button
            onClick={handleExportWorkbook}
            className="h-9 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Download multi-tab Excel workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export .xlsx</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onOpenAddItem}
            className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name or department..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800"
            />
          </div>

          {/* Status Segmented Control */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                statusFilter === 'low'
                  ? 'bg-white text-red-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low ({items.filter(i => i.currentStock <= i.minLevel).length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('ok')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                statusFilter === 'ok'
                  ? 'bg-white text-emerald-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Healthy ({items.filter(i => i.currentStock > i.minLevel).length})</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar text-xs">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1 text-[11px] mr-1">
            <Filter className="w-3 h-3" /> Dept:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-200 border-b border-slate-800">
                <th className="py-3 px-3.5 font-semibold">Item & Category</th>
                <th className="py-3 px-3 font-semibold text-center">Unit</th>
                <th className="py-3 px-3 font-semibold text-right">Open</th>
                <th className="py-3 px-3 font-semibold text-right text-emerald-300">+In</th>
                <th className="py-3 px-3 font-semibold text-right text-amber-300">-Out</th>
                <th className="py-3 px-3 font-semibold text-right text-red-300">-Waste</th>
                <th className="py-3 px-3 font-semibold text-right">Current Stock</th>
                <th className="py-3 px-3 font-semibold text-right">Min / Max</th>
                <th className="py-3 px-3.5 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    No items match the current filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map(it => {
                  const isLow = it.currentStock <= it.minLevel;
                  const toOrder = isLow ? Math.max(0, it.maxLevel - it.currentStock) : 0;

                  return (
                    <tr
                      key={it.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isLow ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 font-sans">
                        <div className="font-semibold text-slate-900">{it.name}</div>
                        <div className="text-[11px] text-slate-500 font-sans">
                          {it.category || 'General'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 font-sans">
                        {it.unit}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                        {it.openingStock}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700 font-semibold tabular-nums">
                        {it.totalIn || 0}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-700 font-semibold tabular-nums">
                        {it.totalOut || 0}
                      </td>
                      <td className="py-3 px-3 text-right text-red-600 font-semibold tabular-nums">
                        {it.totalWaste || 0}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span
                          className={`font-bold text-sm ${
                            isLow ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {it.currentStock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 text-[11px] tabular-nums">
                        {it.minLevel} / {it.maxLevel}
                      </td>
                      <td className="py-3 px-3.5 text-center font-sans">
                        {isLow ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-md">
                            <span>ORDER +{toOrder}</span>
                          </div>
                        ) : predictionsMap.get(it.id)?.isPredictedLowBeforeMin ? (
                          <div
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md cursor-pointer hover:bg-amber-200 transition-colors"
                            onClick={onOpenMLPredictions}
                            title="ML forecast projects item will breach minimum before next delivery"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                            <span>PRE-MIN ({predictionsMap.get(it.id)?.daysUntilMinThreshold}d)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            <span>OK</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
