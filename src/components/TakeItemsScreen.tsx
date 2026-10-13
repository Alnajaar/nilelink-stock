import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Camera,
  Tag,
  ScanLine,
  Utensils,
  Flame,
  Layers,
  Sparkles,
  Check
} from 'lucide-react';
import { StockItem } from '../types/stock';
import { CameraScannerModal } from './CameraScannerModal';
import { PrintLabelsModal } from './PrintLabelsModal';

export type DispenseDestination =
  | 'Bar / Espresso Station'
  | 'Kitchen / Cook Line'
  | 'Bakery & Pastry Prep'
  | 'Dining & Floor Service';

interface TakeItemsScreenProps {
  items: StockItem[];
  onConfirmTake: (cart: { name: string; qty: number }[], destination?: string) => void;
  staffName: string;
  cafeName?: string;
}

export const TakeItemsScreen: React.FC<TakeItemsScreenProps> = ({
  items,
  onConfirmTake,
  staffName,
  cafeName = 'Cafe'
}) => {
  const [destination, setDestination] = useState<DispenseDestination>('Bar / Espresso Station');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<{ [itemName: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);

  // Extract distinct categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(i => i.category || 'General')));
    return ['All', ...cats.filter(Boolean)];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter(it => {
      const matchCat = selectedCategory === 'All' || it.category === selectedCategory;
      const matchQuery =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [items, searchQuery, selectedCategory]);

  const handleUpdateQty = (name: string, delta: number) => {
    setCart(prev => {
      const current = prev[name] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      }
      return { ...prev, [name]: next };
    });
  };

  const handleItemScanned = (scannedItem: StockItem) => {
    handleUpdateQty(scannedItem.name, 1);
    setLastScannedFeedback(`Scanned ${scannedItem.name} (+1 to ${destination})`);
    setTimeout(() => {
      setLastScannedFeedback(null);
    }, 3000);
  };

  const cartLines = Object.keys(cart).length;
  const totalUnitsInCart = Object.values(cart).reduce((sum, q) => sum + q, 0);

  const handleSubmit = () => {
    if (cartLines === 0 || isSubmitting) return;
    setIsSubmitting(true);
    const cartArray = Object.keys(cart).map(name => ({
      name,
      qty: cart[name]
    }));
    onConfirmTake(cartArray, destination);
    setCart({});
    setIsSubmitting(false);
  };

  const destinationOptions: { id: DispenseDestination; label: string; icon: React.FC<any>; desc: string }[] = [
    { id: 'Bar / Espresso Station', label: 'Bar & Espresso', icon: Coffee, desc: 'Dairy, syrups, beans, cups' },
    { id: 'Kitchen / Cook Line', label: 'Kitchen & Cook Line', icon: Utensils, desc: 'Oils, butter, eggs, sauces' },
    { id: 'Bakery & Pastry Prep', label: 'Bakery Prep', icon: Flame, desc: 'Flour, chocolates, berries' },
    { id: 'Dining & Floor Service', label: 'Dining Service', icon: Layers, desc: 'Napkins, straws, condiments' }
  ];

  return (
    <div className="pb-32 space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <ScanLine className="w-4 h-4" />
            </span>
            <span>Take Stock to Bar or Kitchen</span>
          </h2>
          <div className="text-xs text-slate-500 mt-1">
            Signed in as <span className="font-semibold text-slate-800">{staffName}</span>
            <span className="mx-1.5">·</span>
            Select destination, scan shelf barcodes, or tap to transfer inventory from storage
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-900/20 active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 text-white" />
            <span>Scan Barcode / QR</span>
          </button>
          <button
            onClick={() => setIsLabelsOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Print Shelf Barcode Stickers"
          >
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Print Labels</span>
          </button>
        </div>
      </div>

      {/* Destination Zone Selector (Restaurant Bar vs Kitchen) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Transfer Destination:</span>
          <span className="text-amber-600 font-semibold">{destination}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {destinationOptions.map(opt => {
            const isSelected = destination === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDestination(opt.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 text-slate-900 ring-1 ring-amber-500 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 truncate hidden sm:block">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Last Scanned Feedback Toast */}
      {lastScannedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{lastScannedFeedback}</span>
        </div>
      )}

      {/* Search Input Bar with Scan Trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items by name, barcode, or SKU..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={() => setIsScannerOpen(true)}
          className="h-10.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shrink-0 shadow-xs text-xs font-semibold active:scale-95 transition-all"
          title="Open camera scanner"
        >
          <Camera className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Camera</span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No stock items found matching &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredItems.map(item => {
            const inCart = cart[item.name] || 0;
            const isLow = item.currentStock <= item.minLevel;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                  inCart > 0
                    ? 'border-amber-400/90 bg-amber-50/25 shadow-xs ring-1 ring-amber-400/30'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Item Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {item.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>{item.category || 'General'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.unit}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        isLow ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {isLow ? <AlertTriangle className="w-3 h-3" /> : null}
                      <span className="font-mono tabular-nums">{item.currentStock}</span> in storage
                    </span>
                    {item.barcode && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {item.barcode}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tactile Counter Buttons (>= 44px hitbox) with +5 fast increment */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleUpdateQty(item.name, -1)}
                    disabled={inCart <= 0}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                      inCart > 0
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    }`}
                    aria-label={`Decrease ${item.name}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="w-9 text-center font-mono font-bold text-base text-slate-900 tabular-nums">
                    {inCart}
                  </div>

                  <button
                    onClick={() => handleUpdateQty(item.name, 1)}
                    className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center active:scale-95 transition-all shadow-xs"
                    aria-label={`Increase ${item.name}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleUpdateQty(item.name, 5)}
                    className="h-11 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold hidden sm:flex items-center justify-center transition-colors active:scale-95"
                    title="Quick add +5 units"
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cartLines > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 z-40 px-4 max-w-lg mx-auto">
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-slate-700 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-sm shrink-0">
                {cartLines}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  Taking to {destination}
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {cartLines} {cartLines === 1 ? 'item' : 'items'} · Total: {totalUnitsInCart} units
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-11 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-amber-900/30 whitespace-nowrap shrink-0"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <span>Confirm Transfer</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Live Camera Barcode/QR Scanner */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanItem={handleItemScanned}
        items={items}
        title={`Scan to Take to ${destination}`}
        subtitle="Aim camera at shelf labels, bags, or barcodes"
      />

      {/* Print Shelf Stickers */}
      <PrintLabelsModal
        isOpen={isLabelsOpen}
        onClose={() => setIsLabelsOpen(false)}
        items={items}
        cafeName={cafeName}
      />
    </div>
  );
};
