import React, { useState } from 'react';
import { Clock, Coffee, Calendar, Download, FileText, Filter, Users, CheckCircle2 } from 'lucide-react';
import { StockOutLog, StockItem, UserRole } from '../types/stock';
import { PDFReportService } from '../services/pdfReportService';

interface HistoryScreenProps {
  logs: StockOutLog[];
  staffName: string;
  items?: StockItem[];
  cafeName?: string;
  userRole?: UserRole;
  onShowToast?: (msg: string, type?: 'ok' | 'err') => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  logs,
  staffName,
  items = [],
  cafeName = 'Demo Specialty Roastery',
  userRole = 'staff',
  onShowToast
}) => {
  const [filterStaff, setFilterStaff] = useState<'me' | 'all'>(userRole === 'admin' || userRole === 'manager' ? 'all' : 'me');
  const [isExporting, setIsExporting] = useState(false);

  const displayedLogs = logs.filter(l => {
    if (filterStaff === 'me' && staffName) {
      return l.takenBy.toLowerCase() === staffName.toLowerCase();
    }
    return true;
  });

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      PDFReportService.generateHistoryPDF(displayedLogs, items, {
        reportType: 'PAYROLL_USAGE',
        cafeName,
        currency: '$',
        taxRegistrationNumber: 'CR-9042-881',
        auditorName: staffName || 'Store Manager',
        auditorRole: userRole.toUpperCase(),
        includeSignatures: true
      });
      if (onShowToast) onShowToast('Branded Shift Replenishment PDF exported successfully!', 'ok');
    } catch (err: any) {
      if (onShowToast) onShowToast('Failed to export PDF: ' + err?.message, 'err');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>Shift Replenishment &amp; Usage History</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log of all stock taken to the espresso bar, kitchen, and service stations
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <button
                onClick={() => setFilterStaff('me')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStaff === 'me' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                My Takes
              </button>
              <button
                onClick={() => setFilterStaff('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStaff === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                All Team ({logs.length})
              </button>
            </div>
          )}

          <button
            onClick={handleExportPDF}
            disabled={isExporting || displayedLogs.length === 0}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export official branded PDF for payroll shift documentation"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExporting ? 'Generating...' : 'Export Payroll/Tax PDF'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {displayedLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p>No replenishment logs found for the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-3 font-semibold">Product Name</th>
                  <th className="py-3 px-3 font-semibold">Destination</th>
                  <th className="py-3 px-3 font-semibold">Staff Member</th>
                  <th className="py-3 px-3 font-semibold text-right">Qty Taken</th>
                  <th className="py-3 px-4 font-semibold text-right">Left on Shelf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLogs.slice(0, 50).map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px] whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                      {l.itemName}
                      <span className="text-[11px] text-slate-400 font-normal ml-1">
                        ({l.category})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-xs">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {l.destination || 'Bar Station'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 font-medium">
                      {l.takenBy}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-700 tabular-nums">
                      -{l.qtyTaken}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700 font-medium tabular-nums">
                      {l.remainingAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
