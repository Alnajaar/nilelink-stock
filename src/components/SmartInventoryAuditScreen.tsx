import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  UserCheck,
  FileText
} from 'lucide-react';
import {
  StockItem,
  StockOutLog,
  StockInLog,
  WasteLog,
  StockCountRecord,
  ShrinkageAuditItem,
  ShrinkageSeverity
} from '../types/stock';
import { SmartAuditService } from '../services/smartAuditService';
import { ExcelService } from '../services/excelService';
import { PDFReportService } from '../services/pdfReportService';

interface SmartInventoryAuditScreenProps {
  items: StockItem[];
  stockOutLogs: StockOutLog[];
  stockInLogs: StockInLog[];
  wasteLogs: WasteLog[];
  stockCounts: StockCountRecord[];
  cafeName: string;
  adminName: string;
  onReconcileItem: (itemName: string, newQty: number, notes: string) => void;
  onLogShrinkageAsWaste: (itemName: string, missingQty: number, reason: string) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const SmartInventoryAuditScreen: React.FC<SmartInventoryAuditScreenProps> = ({
  items,
  stockOutLogs,
  stockInLogs,
  wasteLogs,
  stockCounts,
  cafeName,
  adminName,
  onReconcileItem,
  onLogShrinkageAsWaste,
  onShowToast
}) => {
  const [filterSeverity, setFilterSeverity] = useState<ShrinkageSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ShrinkageAuditItem | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);

  // Run audit engine
  const { items: auditItems, summary } = useMemo(() => {
    return SmartAuditService.runAudit(items, stockOutLogs, stockInLogs, wasteLogs, stockCounts);
  }, [items, stockOutLogs, stockInLogs, wasteLogs, stockCounts]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return auditItems.filter(it => {
      const matchesSeverity = filterSeverity === 'all' || it.severity === filterSeverity;
      const matchesSearch =
        it.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [auditItems, filterSeverity, searchQuery]);

  const handleExportAuditReport = () => {
    try {
      const rows = auditItems.map(it => ({
        'Item Name': it.itemName,
        'Category': it.category,
        'Unit': it.unit,
        'Unit Cost ($)': it.unitCost,
        'Theoretical Expected': it.expectedStock,
        'Current Physical Count': it.currentStock,
        'Variance (Units)': it.varianceUnits,
        'Variance (%)': `${it.variancePercent}%`,
        'Dollar Loss/Surplus ($)': it.varianceUnits < 0 ? `-$${it.dollarImpact.toFixed(2)}` : `+$${it.dollarImpact.toFixed(2)}`,
        'Audit Status': it.severity.toUpperCase(),
        'Theft Suspected': it.suspectedTheft ? 'YES' : 'NO',
        'Probable Cause': it.probableCause,
        'Recommended Action': it.recommendedAction
      }));

      // Generate CSV/Excel download
      const csvHeader = Object.keys(rows[0] || {}).join(',');
      const csvBody = rows
        .map(r =>
          Object.values(r)
            .map(val => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + '\n' + csvBody);
      const downloadLink = document.createElement('a');
      downloadLink.setAttribute('href', csvContent);
      downloadLink.setAttribute('download', `${cafeName.replace(/\s+/g, '_')}_Inventory_Shrinkage_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      onShowToast('Exported Smart Inventory Shrinkage Report!', 'ok');
    } catch {
      onShowToast('Could not export audit file.', 'err');
    }
  };

  const handleExportAuditPDF = () => {
    try {
      PDFReportService.generateAuditPDF(auditItems, summary, {
        reportType: 'INVENTORY_AUDIT',
        cafeName,
        currency: '$',
        taxRegistrationNumber: 'CR-8820-994',
        auditorName: adminName,
        auditorRole: 'STORE OWNER / AUDITOR',
        includeSignatures: true
      });
      onShowToast('Exported Formatted Branded Tax & Audit PDF!', 'ok');
    } catch (err: any) {
      onShowToast('Failed to export PDF: ' + err?.message, 'err');
    }
  };

  const handleApplyReconcile = () => {
    if (!selectedItem) return;
    setIsReconciling(true);
    onReconcileItem(
      selectedItem.itemName,
      selectedItem.currentStock,
      reconcileNotes.trim() || `Smart Audit Reconciliation by ${adminName}`
    );
    setIsReconciling(false);
    setSelectedItem(null);
    setReconcileNotes('');
    onShowToast(`Reconciled ledger for ${selectedItem.itemName}.`, 'ok');
  };

  const handleApplyWasteLog = () => {
    if (!selectedItem || selectedItem.varianceUnits >= 0) return;
    const missingQty = Math.abs(selectedItem.varianceUnits);
    onLogShrinkageAsWaste(
      selectedItem.itemName,
      missingQty,
      `Audit Discrepancy / Unaccounted Shrinkage investigated by ${adminName}`
    );
    setSelectedItem(null);
    onShowToast(`Logged ${missingQty} ${selectedItem.unit} of ${selectedItem.itemName} to waste ledger.`, 'ok');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Banner / Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Security &amp; Loss Prevention</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Smart Inventory Audit
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
              Algorithmic pattern engine comparing physical stock against barista take logs, supplier deliveries, and shift consumption velocity. Instantly flags unrecorded drain, bar theft, and discrepancy loss.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleExportAuditPDF}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 shadow-md shadow-amber-900/30"
              title="Download formal branded PDF with loss calculation and management signatures"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>Export Branded Tax PDF</span>
            </button>

            <button
              onClick={handleExportAuditReport}
              className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-2 shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Potential Shrinkage Loss</span>
              <DollarSign className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-red-400">
              ${summary.totalShrinkageLoss.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Unaccounted stock deficit
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Theft &amp; Drain Flags</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400">
              {summary.criticalTheftRiskCount} items
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Severe unrecorded drain
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Inventory Accuracy</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {summary.inventoryAccuracyRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.reconciledCount} / {summary.totalItemsAudited} catalog items clean
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Overall Integrity Risk</span>
              <ShieldAlert className="w-4 h-4 text-slate-300" />
            </div>
            <div className={`text-xl sm:text-2xl font-black ${
              summary.overallRiskLevel === 'CRITICAL'
                ? 'text-red-400'
                : summary.overallRiskLevel === 'HIGH'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {summary.overallRiskLevel}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Audit score evaluation
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items or category..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filterSeverity === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({auditItems.length})
          </button>
          <button
            onClick={() => setFilterSeverity('critical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
              filterSeverity === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Theft / Critical ({summary.criticalTheftRiskCount})</span>
          </button>
          <button
            onClick={() => setFilterSeverity('warning')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
              filterSeverity === 'warning'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span>Warnings ({summary.warningDiscrepancyCount})</span>
          </button>
          <button
            onClick={() => setFilterSeverity('overage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filterSeverity === 'overage'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            Surplus
          </button>
          <button
            onClick={() => setFilterSeverity('normal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filterSeverity === 'normal'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Reconciled ({summary.reconciledCount})
          </button>
        </div>
      </div>

      {/* Audit Items List (Responsive Mobile Cards & Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No discrepancies found</h3>
            <p className="text-xs text-slate-500 mt-1">All items match the selected audit filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map(item => {
              const isCritical = item.severity === 'critical';
              const isWarning = item.severity === 'warning';
              const isOverage = item.severity === 'overage';
              const isNormal = item.severity === 'normal';

              return (
                <div
                  key={item.itemId}
                  className={`p-4 sm:p-5 transition-colors ${
                    isCritical
                      ? 'bg-red-50/40 hover:bg-red-50/70'
                      : isWarning
                      ? 'bg-amber-50/30 hover:bg-amber-50/60'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Item Information & Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-slate-900 tracking-tight">
                          {item.itemName}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>

                        {isCritical && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>🚨 HIGH THEFT / UNACCOUNTED DRAIN</span>
                          </span>
                        )}

                        {isWarning && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                            <span>⚠️ Unlogged Variance</span>
                          </span>
                        )}

                        {isOverage && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                            📦 Inventory Surplus
                          </span>
                        )}

                        {isNormal && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            ✅ 100% Reconciled
                          </span>
                        )}
                      </div>

                      {/* Probable Root Cause Analysis */}
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {item.probableCause}
                      </p>
                    </div>

                    {/* Stock Numbers Comparison Ribbon */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 bg-white/80 border border-slate-200 rounded-xl px-4 py-2.5 shrink-0">
                      <div className="text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Theoretical</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {item.expectedStock} {item.unit}
                        </span>
                      </div>

                      <div className="text-slate-300">→</div>

                      <div className="text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Current On Hand</span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.currentStock} {item.unit}
                        </span>
                      </div>

                      <div className="h-6 w-px bg-slate-200" />

                      <div className="text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Variance</span>
                        <span className={`text-xs font-extrabold ${
                          item.varianceUnits < 0 ? 'text-red-600' : item.varianceUnits > 0 ? 'text-blue-600' : 'text-emerald-600'
                        }`}>
                          {item.varianceUnits > 0 ? `+${item.varianceUnits}` : item.varianceUnits} {item.unit}
                        </span>
                      </div>

                      <div className="text-center min-w-[70px]">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Impact</span>
                        <span className={`text-xs font-black ${
                          item.varianceUnits < 0 ? 'text-red-600' : item.varianceUnits > 0 ? 'text-blue-600' : 'text-slate-400'
                        }`}>
                          {item.varianceUnits < 0 ? `-$${item.dollarImpact.toFixed(2)}` : item.varianceUnits > 0 ? `+$${item.dollarImpact.toFixed(2)}` : '$0.00'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                          title="Investigate discrepancy & reconcile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Investigate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deep Investigation & Reconciliation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedItem.severity === 'critical'
                    ? 'bg-red-100 text-red-600'
                    : selectedItem.severity === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedItem.itemName}</h3>
                  <p className="text-xs text-slate-500">Inventory Discrepancy Investigation</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2 my-4 p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Theoretical Ledger</span>
                <span className="text-xs font-bold text-slate-700">{selectedItem.expectedStock} {selectedItem.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Physical</span>
                <span className="text-xs font-bold text-slate-900">{selectedItem.currentStock} {selectedItem.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Dollar Impact</span>
                <span className={`text-xs font-black ${selectedItem.varianceUnits < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {selectedItem.varianceUnits < 0 ? `-$${selectedItem.dollarImpact.toFixed(2)}` : `+$${selectedItem.dollarImpact.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Cause & Recommended remediation */}
            <div className="space-y-3 mb-4 text-xs">
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900">
                <span className="font-bold block mb-1">Algorithmic Assessment:</span>
                {selectedItem.probableCause}
              </div>

              <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-blue-900">
                <span className="font-bold block mb-1">Recommended Remediation:</span>
                {selectedItem.recommendedAction}
              </div>
            </div>

            {/* Admin notes input */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Investigation / Resolution Notes
              </label>
              <textarea
                value={reconcileNotes}
                onChange={e => setReconcileNotes(e.target.value)}
                placeholder="e.g. Verified with shift barista. Missing units accounted for due to broken bottle during Friday rush."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {selectedItem.varianceUnits < 0 && (
                <button
                  onClick={handleApplyWasteLog}
                  className="w-full h-10 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-red-900/20"
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Log {Math.abs(selectedItem.varianceUnits)} {selectedItem.unit} as Official Waste / Shrinkage</span>
                </button>
              )}

              <button
                onClick={handleApplyReconcile}
                disabled={isReconciling}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Reconcile Ledger to Physical ({selectedItem.currentStock} {selectedItem.unit})</span>
              </button>

              <button
                onClick={() => setSelectedItem(null)}
                className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
