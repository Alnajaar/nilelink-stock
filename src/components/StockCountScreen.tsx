import React, { useState } from 'react';
import { ClipboardCheck, Calendar, CheckCircle2, AlertCircle, Camera, ScanLine } from 'lucide-react';
import { StockItem, StockCountRecord } from '../types/stock';
import { CameraScannerModal } from './CameraScannerModal';

interface StockCountScreenProps {
  items: StockItem[];
  counts: StockCountRecord[];
  onRecordCount: (
    type: 'night' | 'week',
    itemName: string,
    physicalQty: number,
    notes?: string,
    dateVal?: string
  ) => void;
  staffName: string;
}

export const StockCountScreen: React.FC<StockCountScreenProps> = ({
  items,
  counts,
  onRecordCount,
  staffName
}) => {
  const [countType, setCountType] = useState<'night' | 'week'>('night');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));
  const [physicalQty, setPhysicalQty] = useState('');
  const [notes, setNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const selectedItem = items.find(i => i.name === selectedItemName);
  const sysQty = selectedItem ? selectedItem.currentStock : 0;
  const numPhys = parseFloat(physicalQty);
  const hasPhys = !isNaN(numPhys);
  const difference = hasPhys ? numPhys - sysQty : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName || isNaN(numPhys)) return;

    onRecordCount(countType, selectedItemName, numPhys, notes, countDate);

    setPhysicalQty('');
    setNotes('');
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-600" />
          <span>Stock Count & Physical Auditing</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Perform daily night closing counts or weekly management audits to discover discrepancies
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Count Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setCountType('night')}
            className={`py-2 rounded-lg transition-colors ${
              countType === 'night'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Night Closing Count
          </button>
          <button
            type="button"
            onClick={() => setCountType('week')}
            className={`py-2 rounded-lg transition-colors ${
              countType === 'week'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekly Management Audit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Count Date *
            </label>
            <div className="relative">
              <input
                type="date"
                value={countDate}
                onChange={e => setCountDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Select Item to Count *
              </label>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-amber-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>
            </div>
            <select
              value={selectedItemName}
              onChange={e => setSelectedItemName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              required
            >
              <option value="">-- Choose item or scan shelf tag --</option>
              {items.map(it => (
                <option key={it.id} value={it.name}>
                  {it.name} ({it.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedItem && (
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center font-mono">
            <div>
              <div className="text-[11px] font-sans text-slate-500">System Live Stock</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                {sysQty} <span className="text-xs font-normal">{selectedItem.unit}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-500">Physical Counted</div>
              <div className="text-base font-bold text-amber-600 tabular-nums">
                {hasPhys ? numPhys : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-500">Variance / Difference</div>
              <div
                className={`text-base font-bold tabular-nums ${
                  difference < 0 ? 'text-red-600' : difference > 0 ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                {hasPhys ? (difference > 0 ? `+${difference}` : difference) : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Physical Count Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Physical Count (What you actually counted on the shelf) *
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={physicalQty}
            onChange={e => setPhysicalQty(e.target.value)}
            placeholder="e.g. 18"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Auditor Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Unopened case in back dry storage"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedItemName || !physicalQty}
          className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
        >
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>Save Physical Stock Count</span>
        </button>
      </form>

      {/* Past Audits List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Past Audit Records</h3>
        {counts.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No physical counts submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium text-right">System</th>
                  <th className="pb-2 font-medium text-right">Counted</th>
                  <th className="pb-2 font-medium text-right">Variance</th>
                  <th className="pb-2 font-medium text-right">Counted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {counts.slice(0, 10).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 text-slate-600 font-sans text-[11px]">{c.date}</td>
                    <td className="py-2.5 font-sans capitalize text-[11px] text-slate-500">
                      {c.type}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-900 font-sans">{c.itemName}</td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums">{c.systemQty}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      {c.physicalQty}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold tabular-nums ${
                        c.difference < 0 ? 'text-red-600' : c.difference > 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {c.difference > 0 ? `+${c.difference}` : c.difference}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 font-sans text-[11px]">
                      {c.countedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanItem={scanned => {
          setSelectedItemName(scanned.name);
          setIsScannerOpen(false);
        }}
        items={items}
        title="Scan Item to Count"
        subtitle="Aim camera at shelf QR label or product barcode"
      />
    </div>
  );
};
