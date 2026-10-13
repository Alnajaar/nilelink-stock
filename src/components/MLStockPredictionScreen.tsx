import React, { useState, useMemo } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  ShoppingCart,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Zap,
  ArrowUpRight,
  FileText,
  Printer,
  MessageSquare,
  Copy,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';
import { StockItem, Supplier, StockOutLog, WasteLog, StockPrediction, RiskLevel } from '../types/stock';
import { MLStockPredictionService } from '../services/mlStockPredictionService';

interface MLStockPredictionScreenProps {
  items: StockItem[];
  suppliers?: Supplier[];
  stockOutLogs: StockOutLog[];
  wasteLogs: WasteLog[];
  cafeName?: string;
  currency?: string;
  onNavigateToAutoOrder?: (prefillItems?: string[]) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const MLStockPredictionScreen: React.FC<MLStockPredictionScreenProps> = ({
  items,
  suppliers = [],
  stockOutLogs,
  wasteLogs,
  cafeName = 'Demo Specialty Roastery',
  currency = '$',
  onNavigateToAutoOrder,
  onShowToast
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [selectedPrediction, setSelectedPrediction] = useState<StockPrediction | null>(null);

  // Draft Purchase Order Modal State
  const [isDraftPoOpen, setIsDraftPoOpen] = useState(false);
  const [selectedDraftItemIds, setSelectedDraftItemIds] = useState<string[]>([]);
  const [copiedDraftPo, setCopiedDraftPo] = useState(false);

  // Compute predictions
  const predictions = useMemo(() => {
    return MLStockPredictionService.analyzeStockPredictions(items, stockOutLogs, wasteLogs);
  }, [items, stockOutLogs, wasteLogs]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.category));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filtered predictions
  const filtered = useMemo(() => {
    return predictions.filter(p => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (filterRisk === 'PREDICTED_LOW' && !p.isPredictedLowBeforeMin && p.riskLevel !== 'CRITICAL_DEPLETION') return false;
      if (filterRisk === 'CRITICAL' && p.riskLevel !== 'CRITICAL_DEPLETION') return false;
      if (filterRisk === 'AT_MIN' && p.riskLevel !== 'AT_MINIMUM') return false;
      if (filterRisk === 'OPTIMAL' && p.riskLevel !== 'OPTIMAL') return false;
      if (filterRisk === 'OVERSTOCKED' && p.riskLevel !== 'OVERSTOCKED') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return p.itemName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [predictions, selectedCategory, filterRisk, search]);

  // Aggregate Metrics
  const preMinWarnings = predictions.filter(p => p.isPredictedLowBeforeMin).length;
  const criticalItems = predictions.filter(p => p.riskLevel === 'CRITICAL_DEPLETION').length;
  const atMinItems = predictions.filter(p => p.riskLevel === 'AT_MINIMUM').length;
  const avgConfidence = Math.round(
    predictions.reduce((acc, p) => acc + p.confidenceScore, 0) / (predictions.length || 1)
  );

  const handleOrderPredictedItems = () => {
    const needOrderNames = predictions
      .filter(p => p.isPredictedLowBeforeMin || p.riskLevel === 'CRITICAL_DEPLETION' || p.riskLevel === 'AT_MINIMUM')
      .map(p => p.itemName);

    if (needOrderNames.length === 0) {
      onShowToast('All stock levels have healthy runway.', 'ok');
      return;
    }

    if (onNavigateToAutoOrder) {
      onNavigateToAutoOrder(needOrderNames);
    } else {
      onShowToast(`Selected ${needOrderNames.length} items for auto-ordering.`, 'ok');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-4 animate-in fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Machine Learning Demand Forecaster · NileLink Core</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Smart Stock Prediction &amp; Pre-Minimum Alerts</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Analyzes historical consumption patterns, lead times, and weekend surges to suggest auto-restocking{' '}
              <strong className="text-amber-300 font-semibold">before items drop below minimum threshold</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                const autoOrderItems = predictions.filter(
                  p => p.suggestedRestockQty > 0 || p.isPredictedLowBeforeMin || p.riskLevel === 'CRITICAL_DEPLETION' || p.riskLevel === 'AT_MINIMUM'
                );
                setSelectedDraftItemIds(autoOrderItems.map(p => p.itemId));
                setIsDraftPoOpen(true);
              }}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Convert Predictions to Draft PO</span>
            </button>
            <button
              onClick={handleOrderPredictedItems}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-600/20 active:scale-[0.98] transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Auto-Order Hub ({preMinWarnings + criticalItems + atMinItems})</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Pre-Min Warnings</span>
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">{preMinWarnings}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Projected to hit min in &le; 3 days</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Critical Depletion</span>
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">{criticalItems}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Will reach zero in &le; 48 hours</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Items Analyzed</span>
            </div>
            <div className="text-2xl font-black text-white mt-1">{predictions.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">14-day EWMA velocity calibrated</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Model Confidence</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{avgConfidence}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">High variance &amp; trend certainty</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilterRisk('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterRisk === 'ALL'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Items ({predictions.length})
          </button>
          <button
            onClick={() => setFilterRisk('PREDICTED_LOW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              filterRisk === 'PREDICTED_LOW'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Pre-Minimum Risk ({preMinWarnings})</span>
          </button>
          <button
            onClick={() => setFilterRisk('CRITICAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              filterRisk === 'CRITICAL'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Zap className="w-3 h-3 text-rose-400" />
            <span>Critical (&le; 48h) ({criticalItems})</span>
          </button>
          <button
            onClick={() => setFilterRisk('AT_MIN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterRisk === 'AT_MIN'
                ? 'bg-amber-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            At Minimum ({atMinItems})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items or category..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Predictions Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Item &amp; Category</th>
                <th className="py-3.5 px-3">Current Stock</th>
                <th className="py-3.5 px-3">Min / Max</th>
                <th className="py-3.5 px-3">Daily Burn (Velocity)</th>
                <th className="py-3.5 px-3">Days to Minimum</th>
                <th className="py-3.5 px-3">Days to Depletion</th>
                <th className="py-3.5 px-3">ML Suggested Restock</th>
                <th className="py-3.5 px-3">Status &amp; Risk</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(p => {
                const isEarlyWarning = p.isPredictedLowBeforeMin;
                const isCritical = p.riskLevel === 'CRITICAL_DEPLETION';
                const isAtMin = p.riskLevel === 'AT_MINIMUM';

                return (
                  <tr
                    key={p.itemId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isCritical
                        ? 'bg-rose-950/15'
                        : isEarlyWarning
                        ? 'bg-amber-950/20'
                        : isAtMin
                        ? 'bg-amber-950/10'
                        : ''
                    }`}
                  >
                    {/* Item */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{p.itemName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.category}
                        </span>
                        <span>· {p.unit}</span>
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-3">
                      <span className="text-base font-black text-white">{p.currentStock}</span>
                      <span className="text-slate-400 text-[10px] ml-1">{p.unit}</span>
                    </td>

                    {/* Min / Max */}
                    <td className="py-3.5 px-3 text-slate-300">
                      <span className="text-amber-400 font-semibold">{p.minLevel}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-slate-400">{p.maxLevel}</span>
                    </td>

                    {/* Daily Burn Rate & Trend */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200">
                          {p.dailyBurnRate} {p.unit}/day
                        </span>
                        {p.burnRateTrend === 'rising' ? (
                          <span
                            className="flex items-center text-rose-400 font-semibold text-[10px]"
                            title="Surging consumption trend"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span className="ml-0.5">+{p.trendPercentage}%</span>
                          </span>
                        ) : p.burnRateTrend === 'declining' ? (
                          <span
                            className="flex items-center text-emerald-400 font-semibold text-[10px]"
                            title="Declining consumption"
                          >
                            <TrendingDown className="w-3 h-3" />
                            <span className="ml-0.5">{p.trendPercentage}%</span>
                          </span>
                        ) : (
                          <span className="text-slate-500" title="Stable burn rate">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Lead time: {p.supplierLeadTimeDays}d</div>
                    </td>

                    {/* Days to Min Threshold */}
                    <td className="py-3.5 px-3">
                      {p.currentStock <= p.minLevel ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] uppercase">
                          At / Below Min
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black text-sm ${
                              isEarlyWarning ? 'text-amber-400' : 'text-slate-200'
                            }`}
                          >
                            {p.daysUntilMinThreshold} days
                          </span>
                          {isEarlyWarning && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                              title="Projected to hit minimum before next delivery"
                            />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Days to Complete Depletion */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-black text-sm ${
                          p.daysUntilZero <= 2
                            ? 'text-rose-400'
                            : p.daysUntilZero <= 5
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {p.daysUntilZero} days
                      </span>
                    </td>

                    {/* Suggested Restock Qty */}
                    <td className="py-3.5 px-3">
                      {p.suggestedRestockQty > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs">
                          +{p.suggestedRestockQty} {p.unit}
                        </span>
                      ) : (
                        <span className="text-slate-500">None needed</span>
                      )}
                    </td>

                    {/* Status / Risk */}
                    <td className="py-3.5 px-3">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] uppercase tracking-wider">
                          <Zap className="w-3 h-3 text-rose-400" />
                          <span>Critical (&lt;48h)</span>
                        </span>
                      ) : isEarlyWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Pre-Min Alert</span>
                        </span>
                      ) : isAtMin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-600/20 border border-amber-600/40 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                          <span>Order Needed</span>
                        </span>
                      ) : p.riskLevel === 'OVERSTOCKED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-[10px] uppercase tracking-wider">
                          <span>Overstocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-[10px] uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Optimal Runway</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.suggestedRestockQty > 0 && (
                          <button
                            onClick={() => {
                              setSelectedDraftItemIds([p.itemId]);
                              setIsDraftPoOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-xs"
                            title="Instant Auto-Order PO"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Auto-Order</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPrediction(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1 transition-colors"
                        >
                          <span>Forecast</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Predictive Forecast Modal */}
      {selectedPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg">
                    {selectedPrediction.itemName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Category: {selectedPrediction.category} · Stock: {selectedPrediction.currentStock}{' '}
                    {selectedPrediction.unit} · Min Threshold: {selectedPrediction.minLevel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPrediction(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Algorithmic Reason Box */}
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  selectedPrediction.riskLevel === 'CRITICAL_DEPLETION'
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    : selectedPrediction.isPredictedLowBeforeMin
                    ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>ML Model Recommendation &amp; Logic</span>
                </div>
                <p className="mt-1">{selectedPrediction.recommendationReason}</p>
              </div>

              {/* 3 Metrics in Modal */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-[11px] text-slate-400">Daily Consumption</div>
                  <div className="text-lg font-black text-white mt-1">
                    {selectedPrediction.dailyBurnRate} {selectedPrediction.unit}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Trend: {selectedPrediction.burnRateTrend}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-[11px] text-slate-400">Days Until Minimum</div>
                  <div className="text-lg font-black text-amber-400 mt-1">
                    {selectedPrediction.daysUntilMinThreshold} days
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Lead time: {selectedPrediction.supplierLeadTimeDays} days
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-[11px] text-slate-400">Suggested Restock</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    +{selectedPrediction.suggestedRestockQty} {selectedPrediction.unit}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Safety cushion included</div>
                </div>
              </div>

              {/* 7-Day Projected Burn Curve */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>7-Day Forward Consumption Projection</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Includes weekend rush weighting (+35%)
                  </span>
                </h4>

                <div className="grid grid-cols-7 gap-2">
                  {selectedPrediction.forecasted7DayConsumption.map((burn, idx) => {
                    const dayDate = new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000);
                    const dayName = dayDate.toLocaleDateString([], { weekday: 'short' });
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl p-2.5 text-center border ${
                          isWeekend
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="text-[10px] font-semibold text-slate-400">{dayName}</div>
                        <div className="text-sm font-black text-white mt-1">{burn}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{selectedPrediction.unit}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Confidence: {selectedPrediction.confidenceScore}% (Calibrated with 14-day logs)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPrediction(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
                >
                  Close
                </button>
                {selectedPrediction.suggestedRestockQty > 0 && (
                  <button
                    onClick={() => {
                      const itemId = selectedPrediction.itemId;
                      setSelectedPrediction(null);
                      setSelectedDraftItemIds([itemId]);
                      setIsDraftPoOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Generate Draft PO (+{selectedPrediction.suggestedRestockQty} {selectedPrediction.unit})</span>
                  </button>
                )}
                {selectedPrediction.suggestedRestockQty > 0 && onNavigateToAutoOrder && (
                  <button
                    onClick={() => {
                      const item = selectedPrediction.itemName;
                      setSelectedPrediction(null);
                      onNavigateToAutoOrder([item]);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Auto-Order Hub</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAFT PURCHASE ORDER MODAL */}
      {isDraftPoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Draft Purchase Order · ML Auto-Order</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Predictive Restock
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quantities calculated from consumption velocity (EWMA) and supplier lead times
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDraftPoOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Selected items breakdown */}
              {(() => {
                const draftPredictions = predictions.filter(p => selectedDraftItemIds.includes(p.itemId));
                const totalCost = draftPredictions.reduce((acc, p) => {
                  const it = items.find(i => i.id === p.itemId);
                  const cost = it?.unitCost || 3.5;
                  return acc + (p.suggestedRestockQty * cost);
                }, 0);
                const totalUnits = draftPredictions.reduce((acc, p) => acc + p.suggestedRestockQty, 0);

                const poNumber = `PO-ML-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Purchase Order No.</div>
                        <div className="text-sm font-mono font-bold">{poNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Origin: {cafeName} · NileLink AI Forecaster</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Items</div>
                          <div className="text-base font-bold text-white font-mono">{draftPredictions.length} SKU ({totalUnits} units)</div>
                        </div>
                        <div className="text-right pl-3 border-l border-slate-700">
                          <div className="text-[10px] uppercase font-bold text-emerald-400">Est. Total</div>
                          <div className="text-base font-bold text-emerald-400 font-mono">{currency}{totalCost.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Table of draft items */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Item Name</th>
                            <th className="py-2.5 px-3">Daily Burn</th>
                            <th className="py-2.5 px-3">Current / Min</th>
                            <th className="py-2.5 px-3 font-bold text-emerald-700">Auto-Order Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit Cost</th>
                            <th className="py-2.5 px-3 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {draftPredictions.map(p => {
                            const it = items.find(i => i.id === p.itemId);
                            const cost = it?.unitCost || 3.5;
                            const lineTotal = cost * p.suggestedRestockQty;

                            return (
                              <tr key={p.itemId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                                  {p.itemName}
                                  <span className="block text-[10px] font-normal text-slate-400">{p.category}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {p.dailyBurnRate} {p.unit}/day
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  <span className={p.currentStock <= p.minLevel ? 'text-red-600 font-bold' : ''}>
                                    {p.currentStock}
                                  </span>
                                  <span className="text-slate-400"> / {p.minLevel}</span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-emerald-700 bg-emerald-50/50">
                                  +{p.suggestedRestockQty} {p.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-600">
                                  {currency}{cost.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                  {currency}{lineTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* WhatsApp Text Preview & Quick Export */}
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Vendor WhatsApp Order Dispatch</span>
                        </span>
                        <button
                          onClick={() => {
                            let text = `*PURCHASE ORDER: ${cafeName.toUpperCase()}*\n`;
                            text += `PO Number: ${poNumber}\n`;
                            text += `Date: ${new Date().toLocaleDateString()}\n\n`;
                            text += `*ML Velocity Restock Items:*\n`;
                            draftPredictions.forEach(p => {
                              text += `• ${p.itemName}: *${p.suggestedRestockQty} ${p.unit}* (Burn rate: ${p.dailyBurnRate}/d)\n`;
                            });
                            text += `\nEstimated Value: ${currency}${totalCost.toFixed(2)}\n`;
                            text += `Please reply to confirm delivery date. Thank you!`;

                            navigator.clipboard.writeText(text);
                            setCopiedDraftPo(true);
                            setTimeout(() => setCopiedDraftPo(false), 2500);
                            onShowToast('Draft PO copied to clipboard!', 'ok');
                          }}
                          className="px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-semibold text-xs flex items-center gap-1 hover:bg-emerald-100 transition-colors"
                        >
                          {copiedDraftPo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedDraftPo ? 'Copied!' : 'Copy Order Text'}</span>
                        </button>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-emerald-200/80 font-mono text-[11px] text-slate-700 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                        {`*PURCHASE ORDER: ${cafeName.toUpperCase()}*\nPO: ${poNumber}\nDate: ${new Date().toLocaleDateString()}\n\n` +
                          draftPredictions.map(p => `• ${p.itemName}: +${p.suggestedRestockQty} ${p.unit}`).join('\n') +
                          `\n\nTotal Estimated: ${currency}${totalCost.toFixed(2)}`}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setIsDraftPoOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print PO Sheet</span>
                </button>

                {onNavigateToAutoOrder && (
                  <button
                    onClick={() => {
                      const itemNames = predictions
                        .filter(p => selectedDraftItemIds.includes(p.itemId))
                        .map(p => p.itemName);
                      setIsDraftPoOpen(false);
                      onNavigateToAutoOrder(itemNames);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Open in Auto-Order Hub</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
