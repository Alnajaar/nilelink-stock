import React, { useState } from 'react';
import { X, Printer, QrCode, CheckSquare, Square, Tag } from 'lucide-react';
import { StockItem } from '../types/stock';

interface PrintLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StockItem[];
  cafeName: string;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({
  isOpen,
  onClose,
  items,
  cafeName
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(items.map(i => i.id));

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedItems = items.filter(i => selectedIds.includes(i.id));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Print QR & Barcode Shelf Stickers
              </h3>
              <p className="text-xs text-slate-500">
                Adhesive labels for espresso bars, dry storage, and milk racks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={selectedItems.length === 0}
              className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {selectedItems.length} Labels</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selection toolbar */}
        <div className="py-3 flex items-center justify-between text-xs border-b border-slate-100 shrink-0">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-slate-700 font-semibold hover:text-slate-900"
          >
            {selectedIds.length === items.length ? (
              <CheckSquare className="w-4 h-4 text-amber-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({items.length})</span>
          </button>
          <span className="text-slate-400">
            {selectedItems.length} selected for printing
          </span>
        </div>

        {/* Labels Preview Grid */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
            {items.map(it => {
              const isSelected = selectedIds.includes(it.id);

              return (
                <div
                  key={it.id}
                  onClick={() => toggleItem(it.id)}
                  className={`border rounded-2xl p-3.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-slate-800 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 opacity-40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 truncate">
                        {it.category}
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                        {it.name}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5 text-slate-800" />
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between font-mono text-[10px]">
                    <span className="font-bold text-slate-800">{it.barcode || it.id}</span>
                    <span className="text-slate-500">{it.unit}</span>
                  </div>

                  <div className="text-[9px] text-slate-400 font-sans mt-1">
                    {cafeName} · Min {it.minLevel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
