import React, { useState } from 'react';
import { Trash2, AlertOctagon, CheckCircle2, Camera, Clock } from 'lucide-react';
import { StockItem, WasteLog } from '../types/stock';
import { CameraScannerModal } from './CameraScannerModal';
import { WasteInsights } from './WasteInsights';

interface WasteScreenProps {
  items: StockItem[];
  wasteLogs: WasteLog[];
  onRecordWaste: (itemName: string, qty: number, reason: string, shift?: 'Morning' | 'Afternoon' | 'Night') => void;
  staffName: string;
  currency?: string;
}

export const WasteScreen: React.FC<WasteScreenProps> = ({
  items,
  wasteLogs,
  onRecordWaste,
  staffName,
  currency = '$'
}) => {
  const [selectedItemName, setSelectedItemName] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Expired / Curdled');
  const [shift, setShift] = useState<'Morning' | 'Afternoon' | 'Night'>(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'Morning';
    if (hour >= 14 && hour < 22) return 'Afternoon';
    return 'Night';
  });
  const [customReason, setCustomReason] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const selectedItem = items.find(i => i.name === selectedItemName);

  const handleItemScanned = (scannedItem: StockItem) => {
    setSelectedItemName(scannedItem.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(qty);
    if (!selectedItemName || isNaN(num) || num <= 0) return;

    const finalReason = reason === 'Other' ? customReason || 'Other Spoilage' : reason;
    onRecordWaste(selectedItemName, num, finalReason, shift);

    setQty('');
    setCustomReason('');
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <span>Waste &amp; Spoilage Log</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record spilled milk, broken glassware, or expired perishable stock to keep variance low
          </p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>Scan Wasted Item</span>
        </button>
      </div>

      {/* Waste Insights Visualization Component */}
      <WasteInsights wasteLogs={wasteLogs} items={items} currency={currency} />

      {/* Log Waste Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Select Wasted Item *
            </label>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="text-xs text-amber-600 hover:underline flex items-center gap-1 font-semibold"
            >
              <Camera className="w-3 h-3" />
              <span>Scan Barcode</span>
            </button>
          </div>
          <select
            value={selectedItemName}
            onChange={e => setSelectedItemName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
            required
          >
            <option value="">-- Choose item from catalog --</option>
            {items.map(it => (
              <option key={it.id} value={it.name}>
                {it.name} ({it.unit}) · In Stock: {it.currentStock}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quantity Wasted {selectedItem ? `(${selectedItem.unit})` : ''} *
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="e.g. 2"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Shift *
            </label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value="Morning">Morning (06:00 - 14:00)</option>
              <option value="Afternoon">Afternoon (14:00 - 22:00)</option>
              <option value="Night">Night (22:00 - 06:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason Code *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value="Expired / Past Best Before">Expired / Past Best Before</option>
              <option value="Spilled on Bar / Counter">Spilled on Bar / Counter</option>
              <option value="Dropped / Packaging Damaged">Dropped / Packaging Damaged</option>
              <option value="Grinder Calibration Purge">Grinder Calibration Purge</option>
              <option value="Burned / Overcooked Pastry">Burned / Overcooked Pastry</option>
              <option value="Defective / Bad Supplier Batch">Defective / Bad Supplier Batch</option>
              <option value="Other">Other (Specify below)</option>
            </select>
          </div>
        </div>

        {reason === 'Other' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Specific Reason Details
            </label>
            <input
              type="text"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Explain what happened..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedItemName || !qty}
          className="w-full h-11 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] mt-2"
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Confirm &amp; Log Waste</span>
        </button>
      </form>

      {/* Recent Waste Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Spoilage Records</h3>
        {wasteLogs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No waste incidents recorded for this location.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-2 font-medium">Time &amp; Shift</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium">Reason</th>
                  <th className="pb-2 font-medium text-right">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {wasteLogs.slice(0, 10).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 text-slate-500 font-sans text-[11px]">
                      <div>{new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {log.shift || 'Morning'}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-slate-800 font-sans">
                      {log.itemName}
                      <span className="block text-[10px] font-normal text-slate-400">{log.category}</span>
                    </td>
                    <td className="py-2.5 text-right text-red-600 font-bold tabular-nums">
                      {log.qtyWasted}
                    </td>
                    <td className="py-2.5 text-slate-600 font-sans text-[11px]">
                      {log.reason}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 font-sans text-[11px]">
                      {log.recordedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Camera Scanner */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanItem={handleItemScanned}
        items={items}
        title="Scan Spoilage Item Barcode"
        subtitle="Aim camera at packaging to quickly select item"
      />
    </div>
  );
};
