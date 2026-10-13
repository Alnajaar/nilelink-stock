import React, { useState } from 'react';
import {
  ShoppingCart,
  MessageSquare,
  Copy,
  Check,
  Printer,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  Share2,
  Send,
  X,
  Download,
  ExternalLink,
  Phone,
  Sparkles,
  Brain
} from 'lucide-react';
import { StockItem, Supplier, StockOutLog, WasteLog } from '../types/stock';
import { ExcelService } from '../services/excelService';
import { MLStockPredictionService } from '../services/mlStockPredictionService';

interface AutoOrderScreenProps {
  items: StockItem[];
  suppliers: Supplier[];
  cafeName: string;
  stockOutLogs?: StockOutLog[];
  wasteLogs?: WasteLog[];
  prefillItemNames?: string[];
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const AutoOrderScreen: React.FC<AutoOrderScreenProps> = ({
  items,
  suppliers,
  cafeName,
  stockOutLogs = [],
  wasteLogs = [],
  prefillItemNames,
  onShowToast
}) => {
  const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null);
  const [activePoSupplierId, setActivePoSupplierId] = useState<string | null>(null);
  const [includeMLPreMinimum, setIncludeMLPreMinimum] = useState(true);
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    title: string;
    phone: string;
    message: string;
  } | null>(null);

  // Compute ML predictions for early pre-minimum restock
  const predictions = React.useMemo(() => {
    return MLStockPredictionService.analyzeStockPredictions(items, stockOutLogs, wasteLogs);
  }, [items, stockOutLogs, wasteLogs]);

  const predictionsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const p of predictions) {
      map.set(p.itemId, p);
    }
    return map;
  }, [predictions]);

  // Filter items needing reorder (at or below min OR flagged by ML pre-minimum forecast)
  const reorderItems = React.useMemo(() => {
    return items.filter(i => {
      const isBelowMin = i.currentStock <= i.minLevel;
      const pred = predictionsMap.get(i.id);
      const isEarlyMLWarning = includeMLPreMinimum && pred && (pred.isPredictedLowBeforeMin || pred.riskLevel === 'CRITICAL_DEPLETION');
      const isPrefilled = prefillItemNames && prefillItemNames.includes(i.name);
      return isBelowMin || isEarlyMLWarning || isPrefilled;
    });
  }, [items, includeMLPreMinimum, predictionsMap, prefillItemNames]);

  // Group by supplier
  const groupedBySupplier = reorderItems.reduce((acc, it) => {
    const sId = it.supplierId || 'unassigned';
    if (!acc[sId]) acc[sId] = [];
    acc[sId].push(it);
    return acc;
  }, {} as { [supplierId: string]: StockItem[] });

  const getSupplierInfo = (supplierId: string): Supplier => {
    return (
      suppliers.find(s => s.id === supplierId) || {
        id: 'unassigned',
        name: 'General / Unassigned Supplier',
        category: 'Miscellaneous',
        contactPerson: 'Vendor Representative',
        phone: '',
        email: 'orders@cafe.com',
        paymentTerms: 'COD',
        deliveryDays: 'Standard Schedule'
      }
    );
  };

  // 1. WhatsApp Message for ALL items in order list
  const handleSendAllViaWhatsApp = () => {
    let msg = `*PURCHASE ORDER: ${cafeName.toUpperCase()}*\n`;
    msg += `Date: ${new Date().toLocaleDateString()}\n`;
    msg += `Total Items to Restock: ${reorderItems.length}\n\n`;

    Object.entries(groupedBySupplier).forEach(([sId, sItems]) => {
      const sup = getSupplierInfo(sId);
      msg += `*VENDOR: ${sup.name}* ${sup.phone ? `(${sup.phone})` : ''}\n`;
      sItems.forEach(it => {
        const toOrder = Math.max(0, it.maxLevel - it.currentStock);
        msg += `• ${it.name}: *${toOrder} ${it.unit}* (Current stock: ${it.currentStock})\n`;
      });
      msg += `\n`;
    });

    msg += `Please reply with confirmation & delivery ETA.\nThank you! — ${cafeName}`;

    setWhatsAppModalData({
      title: 'Master Restock Order (All Vendors)',
      phone: '',
      message: msg
    });
  };

  // 2. WhatsApp Message for a single supplier group
  const generateSupplierWhatsApp = (supplier: Supplier, supItems: StockItem[]): string => {
    const lines = supItems.map(
      it => `• *${it.name}*: ${Math.max(0, it.maxLevel - it.currentStock)} ${it.unit} (Current on shelf: ${it.currentStock})`
    );
    return `Hello ${supplier.contactPerson || supplier.name},\nThis is *${cafeName}*.\nWe need the following restock items delivered:\n\n${lines.join(
      '\n'
    )}\n\nDelivery instructions: Standard morning delivery.\nPlease confirm ETA. Thank you!\n— ${cafeName}`;
  };

  // 3. WhatsApp Message for ONE single item
  const handleSendSingleItemWhatsApp = (supplier: Supplier, item: StockItem) => {
    const qty = Math.max(0, item.maxLevel - item.currentStock);
    const msg = `Hello ${supplier.contactPerson || supplier.name},\nFrom *${cafeName}*:\nPlease deliver *${qty} ${item.unit}* of *${item.name}* as soon as possible.\n(Current stock is critically low at ${item.currentStock} ${item.unit})\nPlease confirm receipt and ETA. Thank you!`;

    setWhatsAppModalData({
      title: `Order Single Item: ${item.name}`,
      phone: supplier.phone || '',
      message: msg
    });
  };

  const handleCopyOrder = (supplier: Supplier, supItems: StockItem[]) => {
    const msg = generateSupplierWhatsApp(supplier, supItems);
    navigator.clipboard.writeText(msg);
    setCopiedSupplierId(supplier.id);
    onShowToast(`Order for ${supplier.name} copied to clipboard!`, 'ok');
    setTimeout(() => setCopiedSupplierId(null), 2500);
  };

  const handleOpenWhatsAppGroup = (supplier: Supplier, supItems: StockItem[]) => {
    const msg = generateSupplierWhatsApp(supplier, supItems);
    setWhatsAppModalData({
      title: `Vendor Order: ${supplier.name}`,
      phone: supplier.phone || '',
      message: msg
    });
  };

  const executeWhatsAppDispatch = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

    // Attempt window open, and also copy to clipboard
    navigator.clipboard.writeText(message);
    onShowToast('Order text copied! Opening WhatsApp...', 'ok');

    const win = window.open(url, '_blank');
    if (!win) {
      // If popup blocker intervened, location href is fallback
      window.location.href = url;
    }
  };

  // Export PO Sheet as CSV for active supplier or master
  const handleDownloadPoCsv = (supplierId: string) => {
    const sup = getSupplierInfo(supplierId);
    const supItems = groupedBySupplier[supplierId] || [];

    const headers = ['PO Number', 'Date', 'Supplier', 'Item Name', 'Unit', 'Order Qty', 'Unit Cost', 'Line Total'];
    const poNum = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${supplierId.toUpperCase().slice(0, 3)}`;
    const dateStr = new Date().toLocaleDateString();

    const rows = supItems.map(it => {
      const qty = Math.max(0, it.maxLevel - it.currentStock);
      const cost = (it.unitCost || 0) * qty;
      return [
        poNum,
        dateStr,
        `"${sup.name}"`,
        `"${it.name}"`,
        `"${it.unit}"`,
        qty,
        (it.unitCost || 0).toFixed(2),
        cost.toFixed(2)
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    ExcelService.downloadCsv(csv, `${poNum}_${sup.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    onShowToast(`Purchase Order CSV downloaded for ${sup.name}!`, 'ok');
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* ML Forecast Control Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 text-white rounded-2xl p-4 text-xs border border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <span>ML Pre-Minimum Demand Forecasting</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Suggests auto-restocking before items hit minimum threshold based on 14-day velocity &amp; lead times
            </div>
          </div>
        </div>

        <button
          onClick={() => setIncludeMLPreMinimum(!includeMLPreMinimum)}
          className={`h-8 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 self-end sm:self-auto ${
            includeMLPreMinimum
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {includeMLPreMinimum ? '✨ Pre-Min Warnings Included' : 'Min-Level Only'}
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-600" />
            <span>NileLink Smart Auto-Order Engine</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculates replenishment quantities (<span className="font-mono text-slate-700">Max Level - Current</span>) with 1-click WhatsApp dispatch and printable PO sheets
          </p>
        </div>

        {reorderItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSendAllViaWhatsApp}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp All Vendors</span>
            </button>
            <button
              onClick={() => window.print()}
              className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print All PO Sheets</span>
            </button>
          </div>
        )}
      </div>

      {reorderItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">All Stock Levels Are Healthy</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Every tracked cafe product is above its safety minimum threshold. No vendor orders needed right now.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Alert Strip */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-900">
                  {reorderItems.length} items currently below minimum safety stock
                </div>
                <div className="text-[11px] text-amber-800">
                  Grouped into {Object.keys(groupedBySupplier).length} vendor purchase orders below. You can send all together or line-by-line via WhatsApp.
                </div>
              </div>
            </div>
            <button
              onClick={handleSendAllViaWhatsApp}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-xs active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send All via WhatsApp</span>
            </button>
          </div>

          {/* Grouped by Supplier Orders */}
          {Object.entries(groupedBySupplier).map(([supplierId, supItems]) => {
            const supplier = getSupplierInfo(supplierId);
            const isCopied = copiedSupplierId === supplier.id;

            const totalEstimatedOrderCost = supItems.reduce((sum, it) => {
              const qty = Math.max(0, it.maxLevel - it.currentStock);
              return sum + (it.unitCost || 0) * qty;
            }, 0);

            return (
              <div
                key={supplierId}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs"
              >
                {/* Supplier Card Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{supplier.name}</h3>
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                        {supplier.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                      {supplier.phone && (
                        <span>
                          Tel / WA: <strong className="text-slate-700">{supplier.phone}</strong>
                        </span>
                      )}
                      {supplier.deliveryDays && (
                        <span>
                          · Delivery: <strong className="text-slate-700">{supplier.deliveryDays}</strong>
                        </span>
                      )}
                      <span>
                        · Est. Cost: <strong className="text-slate-800 font-mono">${totalEstimatedOrderCost.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions for this Supplier */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActivePoSupplierId(supplierId)}
                      className="h-8 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      title="View formal Purchase Order sheet"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>PO Sheet</span>
                    </button>

                    <button
                      onClick={() => handleCopyOrder(supplier, supItems)}
                      className="h-8 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      title="Copy formatted purchase order"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenWhatsAppGroup(supplier, supItems)}
                      className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                      title="Send full vendor order via WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Order ({supItems.length})</span>
                    </button>
                  </div>
                </div>

                {/* Items in this Order Table with Line-By-Line Send Action */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-sans">
                        <th className="py-2.5 px-4 font-medium">Item &amp; SKU</th>
                        <th className="py-2.5 px-3 font-medium text-right">In Stock</th>
                        <th className="py-2.5 px-3 font-medium text-right">Min Level</th>
                        <th className="py-2.5 px-3 font-medium text-right">Max Level</th>
                        <th className="py-2.5 px-3 font-medium text-right font-sans">Order Qty</th>
                        <th className="py-2.5 px-3 font-medium text-right">Est. Cost</th>
                        <th className="py-2.5 px-4 font-medium text-right font-sans">1-by-1 Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supItems.map(it => {
                        const pred = predictionsMap.get(it.id);
                        const isPreMinAlert = it.currentStock > it.minLevel && pred?.isPredictedLowBeforeMin;
                        const orderQty = Math.max(pred?.suggestedRestockQty || 0, Math.max(0, it.maxLevel - it.currentStock));
                        const lineCost = (it.unitCost || 0) * orderQty;
                        return (
                          <tr key={it.id} className={`hover:bg-slate-50 ${isPreMinAlert ? 'bg-amber-50/50' : ''}`}>
                            <td className="py-2.5 px-4 font-sans">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-900">{it.name}</span>
                                {isPreMinAlert && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                    <span>Pre-Min Warning ({pred?.daysUntilMinThreshold}d to min)</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {it.barcode || it.sku || 'No Barcode'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                              <span className={it.currentStock <= it.minLevel ? 'text-red-600' : 'text-amber-700'}>
                                {it.currentStock} {it.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                              {it.minLevel}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                              {it.maxLevel}
                            </td>
                            <td className="py-2.5 px-3 text-right font-sans">
                              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md font-mono">
                                +{orderQty} {it.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                              ${lineCost.toFixed(2)}
                            </td>
                            {/* Line-by-line send action */}
                            <td className="py-2.5 px-4 text-right font-sans">
                              <button
                                onClick={() => handleSendSingleItemWhatsApp(supplier, it)}
                                className="h-7 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors border border-emerald-200/60 active:scale-95"
                                title="Send only this single product via WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-600" />
                                <span>Send Item</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: WHATSAPP DISPATCH & PREVIEW */}
      {whatsAppModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{whatsAppModalData.title}</h3>
                  <span className="text-[11px] text-slate-500">Preview and dispatch order</span>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModalData(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Phone Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Recipient WhatsApp Number</span>
              </label>
              <input
                type="text"
                value={whatsAppModalData.phone}
                onChange={e =>
                  setWhatsAppModalData(prev => (prev ? { ...prev, phone: e.target.value } : null))
                }
                placeholder="+1 555 123 4567 or leave blank to choose in WhatsApp"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Message Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Formatted WhatsApp Message
              </label>
              <textarea
                rows={7}
                value={whatsAppModalData.message}
                onChange={e =>
                  setWhatsAppModalData(prev => (prev ? { ...prev, message: e.target.value } : null))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 whitespace-pre-wrap"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(whatsAppModalData.message);
                  onShowToast('Message copied to clipboard!', 'ok');
                }}
                className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Text</span>
              </button>

              <button
                onClick={() => {
                  executeWhatsAppDispatch(whatsAppModalData.phone, whatsAppModalData.message);
                  setWhatsAppModalData(null);
                }}
                className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FORMAL PURCHASE ORDER (PO SHEET) VIEW */}
      {activePoSupplierId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Official Purchase Order Sheet
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPoCsv(activePoSupplierId)}
                  className="h-8 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PO</span>
                </button>
                <button
                  onClick={() => setActivePoSupplierId(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            {(() => {
              const sup = getSupplierInfo(activePoSupplierId);
              const supItems = groupedBySupplier[activePoSupplierId] || [];
              const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${activePoSupplierId.toUpperCase().slice(0, 3)}`;
              const grandTotal = supItems.reduce((acc, it) => {
                const qty = Math.max(0, it.maxLevel - it.currentStock);
                return acc + (it.unitCost || 0) * qty;
              }, 0);

              return (
                <div className="py-6 space-y-6 text-xs text-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{cafeName}</h2>
                      <div className="text-slate-500 mt-1">Specialty Hospitality &amp; Coffee</div>
                      <div className="text-slate-500">Contact: orders@{cafeName.toLowerCase().replace(/[^a-z]/g, '')}.com</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 font-mono">{poNumber}</div>
                      <div className="text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</div>
                      <div className="text-emerald-700 font-semibold">Status: RESTOCK APPROVED</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">VENDOR DETAILS</div>
                    <div className="font-semibold text-slate-800">{sup.name}</div>
                    <div>Representative: {sup.contactPerson}</div>
                    <div>Phone / WhatsApp: {sup.phone || 'N/A'}</div>
                    <div>Payment Terms: {sup.paymentTerms}</div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">#</th>
                        <th className="py-2.5 px-3 font-semibold">Description</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Order Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {supItems.map((it, idx) => {
                        const qty = Math.max(0, it.maxLevel - it.currentStock);
                        const cost = (it.unitCost || 0) * qty;
                        return (
                          <tr key={it.id}>
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900">{it.name}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">{qty} {it.unit}</td>
                            <td className="py-2 px-3 text-right">${(it.unitCost || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-bold">${cost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-sans font-bold text-slate-900">
                        <td colSpan={4} className="py-2.5 px-3 text-right">
                          Estimated PO Grand Total:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          ${grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* WhatsApp Quick Dispatch from PO Sheet */}
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl">
                    <div className="text-emerald-950 font-medium">
                      Ready to send this PO directly to vendor via WhatsApp?
                    </div>
                    <button
                      onClick={() => {
                        handleOpenWhatsAppGroup(sup, supItems);
                      }}
                      className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp This PO</span>
                    </button>
                  </div>

                  {/* Sign-off section */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-slate-500">
                    <div>
                      <div className="h-10 border-b border-slate-300" />
                      <div className="mt-1">Authorized Store Manager Signature</div>
                    </div>
                    <div>
                      <div className="h-10 border-b border-slate-300" />
                      <div className="mt-1">Vendor Delivery Receiver Signature</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
