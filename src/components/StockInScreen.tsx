import React, { useState } from 'react';
import {
  PackagePlus,
  Truck,
  ArrowRight,
  CheckCircle2,
  Camera,
  ScanLine,
  Layers,
  Plus,
  Trash2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { StockItem, Supplier } from '../types/stock';
import { CameraScannerModal } from './CameraScannerModal';

interface StockInScreenProps {
  items: StockItem[];
  suppliers: Supplier[];
  onRecordStockIn: (itemName: string, qty: number, supplier: string, invoice?: string) => void;
  staffName: string;
}

interface BatchRestockItem {
  item: StockItem;
  qty: number;
  supplier: string;
}

export const StockInScreen: React.FC<StockInScreenProps> = ({
  items,
  suppliers,
  onRecordStockIn,
  staffName
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single Restock Form State
  const [selectedItemName, setSelectedItemName] = useState('');
  const [qty, setQty] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastScannedNotice, setLastScannedNotice] = useState<string | null>(null);

  // Batch Restock State
  const [batchItems, setBatchItems] = useState<BatchRestockItem[]>([]);
  const [batchInvoiceNo, setBatchInvoiceNo] = useState('');
  const [batchSupplier, setBatchSupplier] = useState('');

  const selectedItem = items.find(i => i.name === selectedItemName);

  const handleItemScanned = (scannedItem: StockItem) => {
    if (mode === 'single') {
      setSelectedItemName(scannedItem.name);
      if (scannedItem.supplierId) {
        const sup = suppliers.find(s => s.id === scannedItem.supplierId);
        if (sup) setSelectedSupplier(sup.name);
      }
      setLastScannedNotice(`Identified: ${scannedItem.name} (${scannedItem.unit})`);
      setTimeout(() => setLastScannedNotice(null), 3000);
    } else {
      // In batch mode, append or increment
      setBatchItems(prev => {
        const existingIdx = prev.findIndex(b => b.item.id === scannedItem.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx].qty += 1;
          return updated;
        } else {
          let supName = batchSupplier;
          if (!supName && scannedItem.supplierId) {
            const foundSup = suppliers.find(s => s.id === scannedItem.supplierId);
            if (foundSup) supName = foundSup.name;
          }
          return [...prev, { item: scannedItem, qty: 1, supplier: supName || 'Direct Delivery' }];
        }
      });
      setLastScannedNotice(`Added ${scannedItem.name} to delivery batch!`);
      setTimeout(() => setLastScannedNotice(null), 3000);
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(qty);
    if (!selectedItemName || isNaN(num) || num <= 0) return;

    onRecordStockIn(
      selectedItemName,
      num,
      selectedSupplier || (selectedItem ? 'General Delivery' : ''),
      invoiceNo
    );

    setQty('');
    setInvoiceNo('');
    setLastScannedNotice(`Replenished +${num} ${selectedItemName} into inventory!`);
    setTimeout(() => setLastScannedNotice(null), 3500);
  };

  const handleBatchSubmit = () => {
    if (batchItems.length === 0) return;
    for (const b of batchItems) {
      if (b.qty > 0) {
        onRecordStockIn(
          b.item.name,
          b.qty,
          b.supplier || batchSupplier || 'Delivery Batch',
          batchInvoiceNo
        );
      }
    }
    setBatchItems([]);
    setBatchInvoiceNo('');
    setLastScannedNotice(`Batch restock complete: ${batchItems.length} items replenished!`);
    setTimeout(() => setLastScannedNotice(null), 3500);
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-4">
      {/* Title & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-600" />
            <span>Restock Inventory (Delivery In)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Signed in as <span className="font-semibold text-slate-700">{staffName}</span> · Scan barcodes on incoming delivery boxes or manually record supplier restocks
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'single'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'batch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Batch Scan</span>
              {batchItems.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">
                  {batchItems.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Scan Delivery</span>
          </button>
        </div>
      </div>

      {lastScannedNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{lastScannedNotice}</span>
        </div>
      )}

      {/* MODE 1: SINGLE ITEM RESTOCK */}
      {mode === 'single' && (
        <form onSubmit={handleSingleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {/* Item Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Select Product Received *
              </label>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-amber-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Delivery Barcode</span>
              </button>
            </div>
            <select
              value={selectedItemName}
              onChange={e => {
                setSelectedItemName(e.target.value);
                const found = items.find(i => i.name === e.target.value);
                if (found && found.supplierId) {
                  const sup = suppliers.find(s => s.id === found.supplierId);
                  if (sup) setSelectedSupplier(sup.name);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              required
            >
              <option value="">-- Choose item from catalog or scan packaging --</option>
              {items.map(it => (
                <option key={it.id} value={it.name}>
                  {it.name} ({it.unit}) · In Storage: {it.currentStock}
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600">Current live storage level:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums">
                {selectedItem.currentStock} {selectedItem.unit}
              </span>
            </div>
          )}

          {/* Quantity Received & Quick Add presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quantity Received {selectedItem ? `(${selectedItem.unit})` : ''} *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0.1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="e.g. 12"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
              {/* Quick Case Quantity Pills */}
              <div className="flex items-center gap-1">
                {[6, 12, 24, 48].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-semibold transition-colors"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vendor / Supplier Name
              </label>
              <input
                type="text"
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
                placeholder="e.g. Red Sea Bean Imports"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice / Delivery PO # (Optional)
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-993"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors active:scale-95"
            >
              <span>Add to Inventory</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: MULTI-ITEM BATCH RESTOCK (SCAN MULTIPLE BOXES) */}
      {mode === 'batch' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Multi-Item Delivery Shipment Scanner</h3>
              <p className="text-xs text-slate-500">
                Point your camera and continuously scan all arriving boxes from the delivery truck
              </p>
            </div>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
            >
              <Camera className="w-4 h-4" />
              <span>Launch Continuous Scanner</span>
            </button>
          </div>

          {/* Delivery Batch Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor / Distributor Name
              </label>
              <input
                type="text"
                value={batchSupplier}
                onChange={e => setBatchSupplier(e.target.value)}
                placeholder="e.g. Coastal Food & Roasteries Supply"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Master Invoice / Bill of Lading #
              </label>
              <input
                type="text"
                value={batchInvoiceNo}
                onChange={e => setBatchInvoiceNo(e.target.value)}
                placeholder="e.g. BL-88219"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>
          </div>

          {/* Scanned Items Table */}
          {batchItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs space-y-2">
              <ScanLine className="w-8 h-8 mx-auto text-slate-300" />
              <p>No delivery items scanned yet in this batch.</p>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="text-amber-600 font-semibold underline text-xs"
              >
                Open camera scanner to start scanning boxes
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Scanned Delivery Items ({batchItems.length}):
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {batchItems.map((b, idx) => (
                  <div key={b.item.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {b.item.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Storage now: {b.item.currentStock} {b.item.unit} · New total: {b.item.currentStock + b.qty} {b.item.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setBatchItems(prev =>
                              prev
                                .map((item, i) => (i === idx ? { ...item, qty: Math.max(0, item.qty - 1) } : item))
                                .filter(item => item.qty > 0)
                            );
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={b.qty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setBatchItems(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, qty: val } : item))
                            );
                          }}
                          className="w-12 h-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                        />
                        <button
                          onClick={() => {
                            setBatchItems(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, qty: item.qty + 1 } : item))
                            );
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setBatchItems(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 flex items-center justify-center"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setBatchItems([])}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Clear Batch
                </button>
                <button
                  type="button"
                  onClick={handleBatchSubmit}
                  className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <span>Confirm Restock ({batchItems.reduce((acc, c) => acc + c.qty, 0)} Units)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Camera Barcode/QR Scanner */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanItem={handleItemScanned}
        items={items}
        title="Scan Arriving Delivery Package"
        subtitle="Aim camera at barcode on vendor packaging, boxes, or shelf tags"
      />
    </div>
  );
};
