import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Search,
  Filter,
  Check,
  ArrowRight,
  ShieldAlert,
  Layers,
  FileText
} from 'lucide-react';
import { StockItem, CafeTenant, BranchTransfer } from '../types/stock';
import { StorageService } from '../services/storageService';

interface BranchTransferScreenProps {
  currentCafe: CafeTenant;
  availableBranches: CafeTenant[];
  currentItems: StockItem[];
  transfers: BranchTransfer[];
  adminName: string;
  currency?: string;
  onTransferComplete: () => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

interface TransferCartItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  availableStock: number;
  qty: number;
  unitCost: number;
}

export const BranchTransferScreen: React.FC<BranchTransferScreenProps> = ({
  currentCafe,
  availableBranches,
  currentItems,
  transfers,
  adminName,
  currency = '$',
  onTransferComplete,
  onShowToast
}) => {
  // Destination Branch Selection (defaults to the first other branch)
  const otherBranches = useMemo(() => {
    return availableBranches.filter(b => b.id !== currentCafe.id);
  }, [availableBranches, currentCafe]);

  const [toBranchId, setToBranchId] = useState<string>(() => {
    return otherBranches.length > 0 ? otherBranches[0].id : '';
  });

  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Transfer Cart
  const [cart, setCart] = useState<TransferCartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedTransferForPrint, setSelectedTransferForPrint] = useState<BranchTransfer | null>(null);

  // Categories in current store
  const categories = useMemo(() => {
    const set = new Set<string>();
    currentItems.forEach(i => set.add(i.category));
    return ['ALL', ...Array.from(set)];
  }, [currentItems]);

  // Filtered available items
  const filteredCatalog = useMemo(() => {
    return currentItems.filter(item => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [currentItems, selectedCategory, searchTerm]);

  // Add Item to Transfer Cart
  const handleAddItemToCart = (item: StockItem) => {
    if (item.currentStock <= 0) {
      onShowToast(`Cannot transfer ${item.name}: Stock is 0.`, 'err');
      return;
    }

    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        if (existing.qty >= item.currentStock) {
          onShowToast(`Cannot exceed available stock (${item.currentStock} ${item.unit}).`, 'err');
          return prev;
        }
        return prev.map(c => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }

      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          unit: item.unit,
          availableStock: item.currentStock,
          qty: 1,
          unitCost: item.unitCost || 0
        }
      ];
    });
  };

  const handleUpdateCartQty = (itemId: string, newQty: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.itemId === itemId) {
          const clamped = Math.max(1, Math.min(c.availableStock, newQty));
          return { ...c, qty: clamped };
        }
        return c;
      });
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  };

  // Submit and execute transfer
  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toBranchId) {
      onShowToast('Please select a destination receiving branch.', 'err');
      return;
    }
    if (cart.length === 0) {
      onShowToast('Please add at least one item to the transfer cart.', 'err');
      return;
    }

    const payload = cart.map(c => ({
      itemId: c.itemId,
      itemName: c.itemName,
      qty: c.qty
    }));

    const result = StorageService.executeBranchTransfer(
      currentCafe.id,
      toBranchId,
      payload,
      adminName,
      notes
    );

    if (result.success && result.transfer) {
      onShowToast(`Transferred ${result.transfer.totalUnits} units to ${result.transfer.toBranchName}!`, 'ok');
      setCart([]);
      setNotes('');
      onTransferComplete();
      setActiveTab('history');
    } else {
      onShowToast(result.error || 'Transfer failed. Check stock levels.', 'err');
    }
  };

  const totalTransferUnits = cart.reduce((acc, c) => acc + c.qty, 0);
  const totalTransferValue = cart.reduce((acc, c) => acc + c.qty * c.unitCost, 0);

  const targetBranchObj = availableBranches.find(b => b.id === toBranchId);

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-in fade-in">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/80 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
              <span>Multi-Branch Stock Synchronization</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <span>Inter-Branch Stock Transfer</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Transfer coffee beans, dairy, syrups, and packaging across locations. Automatically deducts from sender branch and replenishes receiver inventory in real time.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('create')}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Transfer</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Transfer Ledger ({transfers.length})</span>
            </button>
          </div>
        </div>

        {/* Sub branch path */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex items-center gap-2 text-xs text-slate-300">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white">Source Sender: {currentCafe.name}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300">
            Target Destination:{' '}
            <strong className="text-indigo-300 font-semibold">
              {targetBranchObj?.name || 'Select receiver below'}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Mode View */}
      {activeTab === 'create' ? (
        otherBranches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">Single Branch Account</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Your current subscription or profile currently only has one registered location. Inter-branch transfers require two or more registered branches (available on the Multi-Branch Enterprise tier).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Item Selection from Sender Catalog (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Select Items to Move from {currentCafe.name}</span>
                  </h3>
                  <div className="text-xs text-slate-400">
                    {filteredCatalog.length} items available
                  </div>
                </div>

                {/* Filter and search */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search items to transfer..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Catalog Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredCatalog.map(item => {
                    const inCart = cart.find(c => c.itemId === item.id);
                    const isOutOfStock = item.currentStock <= 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
                          isOutOfStock
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : inCart
                            ? 'bg-indigo-50/60 border-indigo-300'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-800 text-xs line-clamp-1">
                              {item.name}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.category}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">In Stock:</span>
                            <span className={`font-mono font-bold ${item.currentStock <= item.minLevel ? 'text-amber-600' : 'text-slate-900'}`}>
                              {item.currentStock} {item.unit}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500">
                            {currency}{(item.unitCost || 0).toFixed(2)}/unit
                          </span>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleAddItemToCart(item)}
                            className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : inCart
                                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{inCart ? `Add More (${inCart.qty})` : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Transfer Manifest & Confirmation (5 cols) */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleConfirmTransfer}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 sticky top-4"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                    <span>Transfer Manifest &amp; Routing</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Specify the receiving store location and verify items.
                  </p>
                </div>

                {/* Receiver Branch Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Destination Branch (Receiver) *
                  </label>
                  <select
                    value={toBranchId}
                    onChange={e => setToBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-600"
                    required
                  >
                    {otherBranches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.city || 'Branch'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Items to Transfer ({cart.length})
                    </label>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-[11px] text-red-600 hover:underline font-semibold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                      No items added to transfer manifest yet. Select items from the catalog on the left.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="py-2 px-2.5">Item</th>
                            <th className="py-2 px-2 text-center">Qty</th>
                            <th className="py-2 px-2 text-right">Value</th>
                            <th className="py-2 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {cart.map(item => (
                            <tr key={item.itemId}>
                              <td className="py-2 px-2.5 font-sans font-medium text-slate-900">
                                <div className="truncate max-w-[140px]">{item.itemName}</div>
                                <div className="text-[10px] text-slate-400">Max avail: {item.availableStock} {item.unit}</div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.availableStock}
                                  value={item.qty}
                                  onChange={e => handleUpdateCartQty(item.itemId, parseInt(e.target.value) || 1)}
                                  className="w-14 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                                />
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-slate-800">
                                {currency}{(item.qty * item.unitCost).toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(item.itemId)}
                                  className="text-slate-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Transfer Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Transfer Reason / Driver Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Emergency milk replenishment for weekend rush"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Total Summary */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Total Units to Dispatch:</span>
                    <div className="font-bold text-slate-900 font-mono text-sm">{totalTransferUnits} units</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Total Transfer Value:</span>
                    <div className="font-bold text-indigo-700 font-mono text-sm">{currency}{totalTransferValue.toFixed(2)}</div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={cart.length === 0 || !toBranchId}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Transfer &amp; Sync Both Branches</span>
                </button>
              </form>
            </div>
          </div>
        )
      ) : (
        /* Transfer History & Receipts */
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Branch Transfer Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Official movement records showing sender and receiver updates
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs">
              {transfers.length} Recorded Movements
            </span>
          </div>

          {transfers.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No branch transfers recorded yet for this location.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="pb-3 font-semibold">Transfer No. &amp; Date</th>
                    <th className="pb-3 font-semibold">From Branch</th>
                    <th className="pb-3 font-semibold">To Branch</th>
                    <th className="pb-3 font-semibold">Items Transferred</th>
                    <th className="pb-3 font-semibold text-right">Total Units</th>
                    <th className="pb-3 font-semibold text-right">Value</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {transfers.map(t => {
                    const isSender = t.fromBranchId === currentCafe.id;

                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 font-sans">
                          <div className="font-bold text-slate-900">{t.transferNumber}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isSender ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.fromBranchName}
                          </span>
                        </td>
                        <td className="py-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            !isSender ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.toBranchName}
                          </span>
                        </td>
                        <td className="py-3 font-sans text-slate-700">
                          <div className="max-w-xs truncate">
                            {t.items.map(i => `${i.qtyTransferred}x ${i.itemName}`).join(', ')}
                          </div>
                          {t.notes && <div className="text-[10px] text-slate-400 italic">"{t.notes}"</div>}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-900">
                          {t.totalUnits}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-700">
                          {currency}{t.totalValue.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-sans">
                          <button
                            onClick={() => setSelectedTransferForPrint(t)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <Printer className="w-3 h-3 text-slate-500" />
                            <span>Slip</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Printable Transfer Waybill Modal */}
      {selectedTransferForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-slate-900 text-sm">Official Stock Transfer Waybill</span>
              </div>
              <button
                onClick={() => setSelectedTransferForPrint(null)}
                className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">NileLink Inter-Branch Logistics</h2>
                  <div className="text-slate-500 text-[11px] mt-0.5">Transfer Ref: {selectedTransferForPrint.transferNumber}</div>
                  <div className="text-slate-500 text-[11px]">Authorized by: {selectedTransferForPrint.initiatedBy}</div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                    {selectedTransferForPrint.status}
                  </span>
                  <div className="text-slate-400 text-[11px] mt-1">
                    {new Date(selectedTransferForPrint.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Sender & Receiver Boxes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Dispatching Location</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedTransferForPrint.fromBranchName}</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="text-[10px] uppercase font-bold text-indigo-600">Receiving Location</div>
                  <div className="font-bold text-indigo-950 text-sm mt-0.5">{selectedTransferForPrint.toBranchName}</div>
                </div>
              </div>

              {/* Items List */}
              <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-900 text-white font-semibold">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3 text-right">Units Moved</th>
                    <th className="py-2 px-3 text-right">Unit Value</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {selectedTransferForPrint.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">{it.itemName} ({it.unit})</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{it.qtyTransferred}</td>
                      <td className="py-2 px-3 text-right">{currency}{(it.unitCost || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold">{currency}{((it.unitCost || 0) * it.qtyTransferred).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-sans font-bold">
                    <td colSpan={3} className="py-2 px-3 text-right text-slate-700">Total Goods Value:</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{currency}{selectedTransferForPrint.totalValue.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Sign-off signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-[11px] text-slate-500">
                <div>
                  <div className="h-10 border-b border-slate-300"></div>
                  <div className="mt-1">Dispatch Manager Signature</div>
                </div>
                <div>
                  <div className="h-10 border-b border-slate-300"></div>
                  <div className="mt-1">Receiving Manager Signature</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setSelectedTransferForPrint(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Waybill</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
