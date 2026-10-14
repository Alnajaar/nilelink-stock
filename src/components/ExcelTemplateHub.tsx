import React, { useState } from 'react';
import * as XLSX from '@e965/xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import { StockItem, CafeTenant, Supplier } from '../types/stock';
import { ExcelService } from '../services/excelService';

interface ExcelTemplateHubProps {
  cafe: CafeTenant;
  items: StockItem[];
  suppliers: Supplier[];
  onImportItems: (items: StockItem[]) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const ExcelTemplateHub: React.FC<ExcelTemplateHubProps> = ({
  cafe,
  items,
  suppliers,
  onImportItems,
  onShowToast
}) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<StockItem[] | null>(null);

  // 1. Download Blank Cafe Stock Template (.xlsx)
  const handleDownloadBlankTemplate = () => {
    const wb = XLSX.utils.book_new();

    const templateData = [
      {
        'Item Name': 'Full Fat Fresh Milk (Example)',
        'Category': 'Dairy',
        'Unit': 'Liters',
        'Opening Stock': 50,
        'Min Level': 30,
        'Max Level': 100,
        'Unit Cost ($)': 1.65,
        'Barcode / SKU': 'NL-MILK-01'
      },
      {
        'Item Name': 'House Espresso Beans 1kg (Example)',
        'Category': 'Coffee Beans',
        'Unit': 'kg',
        'Opening Stock': 20,
        'Min Level': 10,
        'Max Level': 40,
        'Unit Cost ($)': 22.0,
        'Barcode / SKU': 'NL-BEAN-02'
      },
      {
        'Item Name': 'Vanilla Syrup 750ml (Example)',
        'Category': 'Syrups',
        'Unit': 'Bottles',
        'Opening Stock': 6,
        'Min Level': 3,
        'Max Level': 12,
        'Unit Cost ($)': 9.5,
        'Barcode / SKU': 'NL-VAN-03'
      },
      {
        'Item Name': 'Hot Takeaway Cups 12oz (Example)',
        'Category': 'Packaging',
        'Unit': 'Sleeves',
        'Opening Stock': 25,
        'Min Level': 10,
        'Max Level': 50,
        'Unit Cost ($)': 4.8,
        'Barcode / SKU': 'NL-CUP-04'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'ITEMS_TEMPLATE');

    XLSX.writeFile(wb, 'NileLink_Cafe_Inventory_Template.xlsx');
    onShowToast('Blank Excel template downloaded!', 'ok');
  };

  // 2. Download Pre-Filled Ready Catalog (34 items)
  const handleDownloadPreFilledCatalog = () => {
    ExcelService.exportCompleteWorkbook(cafe.name, items);
    onShowToast('Ready-made cafe catalog exported as Excel (.xlsx)!', 'ok');
  };

  // 3. File Upload & Parse
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const result = await ExcelService.parseUploadedFile(file);
    setIsParsing(false);

    if (result.success && result.items) {
      setParsedPreview(result.items);
      onShowToast(`Parsed ${result.items.length} items from spreadsheet. Review below!`, 'ok');
    } else {
      onShowToast(result.message || 'Failed to read spreadsheet file.', 'err');
    }
    e.target.value = '';
  };

  // 4. Confirm Import
  const handleConfirmImport = () => {
    if (!parsedPreview || !parsedPreview.length) return;
    onImportItems(parsedPreview);
    setParsedPreview(null);
    onShowToast(`Successfully imported ${parsedPreview.length} items into ${cafe.name}!`, 'ok');
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span>Excel Template &amp; Bulk Catalog Hub</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Download templates to fill in your cafe products, or import your existing Excel spreadsheets into NileLink Stock
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Blank Template */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Download Blank Excel Template
                </h3>
                <span className="text-[11px] text-slate-500">For new cafes starting from scratch</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-3 leading-relaxed">
              Clean spreadsheet with standard columns: Item Name, Category, Unit, Opening Stock, Min/Max thresholds, Unit Cost, and Barcode. Fill it in Microsoft Excel, Apple Numbers, or any office suite, then import back with 1 click.
            </p>
          </div>

          <button
            onClick={handleDownloadBlankTemplate}
            className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download Blank Template (.xlsx)</span>
          </button>
        </div>

        {/* Card 2: Ready Pre-Filled Catalog */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ready-Made Cafe &amp; Restaurant Catalog
                </h3>
                <span className="text-[11px] text-slate-500">34 pre-loaded industry standard items</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-3 leading-relaxed">
              Export the current 34 cafe items (Whole milk, Oatly barista, Ethiopian single-origin, Syrups, 12oz/16oz cups, lids, Cafiza cleaner, and pastries) as your baseline Excel file.
            </p>
          </div>

          <button
            onClick={handleDownloadPreFilledCatalog}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Pre-Filled Cafe Catalog (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Card 3: Import File Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Import Your Completed Excel (.xlsx) or CSV Spreadsheet
            </h3>
            <span className="text-[11px] text-slate-500">
              Instantly replaces or updates the active inventory catalog for {cafe.name}
            </span>
          </div>
        </div>

        <div className="p-8 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl bg-slate-50/60 text-center transition-colors">
          <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-800">
            {isParsing ? 'Parsing Excel sheet...' : 'Drag and drop your Excel (.xlsx) or CSV file here'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Compatible with Microsoft Excel, Apple Numbers, LibreOffice, and Google Sheets exports
          </p>

          <label className="inline-flex mt-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isParsing}
              className="hidden"
            />
            <span className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Select File from Device</span>
            </span>
          </label>
        </div>

        {/* Parsed Preview Table */}
        {parsedPreview && (
          <div className="pt-4 border-t border-slate-100 space-y-3 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Ready to Import: {parsedPreview.length} Items Detected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setParsedPreview(null)}
                  className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Apply &amp; Save to Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-sans">
                    <th className="py-2 px-3 font-semibold">Item Name</th>
                    <th className="py-2 px-2.5 font-semibold">Category</th>
                    <th className="py-2 px-2 font-semibold text-center">Unit</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Opening</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Min</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Max</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Cost</th>
                    <th className="py-2 px-3 font-semibold">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedPreview.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900 truncate max-w-[160px]">
                        {it.name}
                      </td>
                      <td className="py-2 px-2.5 font-sans text-slate-600 truncate">{it.category}</td>
                      <td className="py-2 px-2 text-center text-slate-500 font-sans">{it.unit}</td>
                      <td className="py-2 px-2.5 text-right text-slate-700 tabular-nums">{it.openingStock}</td>
                      <td className="py-2 px-2.5 text-right text-slate-500 tabular-nums">{it.minLevel}</td>
                      <td className="py-2 px-2.5 text-right text-slate-500 tabular-nums">{it.maxLevel}</td>
                      <td className="py-2 px-2.5 text-right text-slate-700 tabular-nums">${(it.unitCost || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{it.barcode || 'Auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
