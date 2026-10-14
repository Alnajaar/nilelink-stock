import * as XLSX from '@e965/xlsx';
import {
  StockItem,
  StockOutLog,
  StockInLog,
  WasteLog,
  StockCountRecord,
  Employee,
  Supplier,
  CafeTenant
} from '../types/stock';

export class ExcelService {
  /**
   * Generates a complete, multi-tab Microsoft Excel (.xlsx) workbook
   */
  public static exportCompleteWorkbook(
    cafeName: string,
    items: StockItem[],
    stockOutLogs: StockOutLog[] = [],
    stockInLogs: StockInLog[] = [],
    wasteLogs: WasteLog[] = [],
    employees: Employee[] = [],
    suppliers: Supplier[] = [],
    stockCounts: StockCountRecord[] = [],
    tenants: CafeTenant[] = []
  ): void {
    const wb = XLSX.utils.book_new();

    // 1. MASTER STOCK SHEET
    const masterData = items.map((it, idx) => {
      const need = it.currentStock <= it.minLevel ? 'YES' : 'NO';
      const toOrder = need === 'YES' ? Math.max(0, it.maxLevel - it.currentStock) : 0;
      const val = (it.unitCost || 0) * it.currentStock;

      return {
        '#': idx + 1,
        'Item Name': it.name,
        'Category': it.category || 'General',
        'Unit': it.unit,
        'Opening Stock': it.openingStock,
        'Total In': it.totalIn || 0,
        'Total Out': it.totalOut || 0,
        'Total Waste': it.totalWaste || 0,
        'Current Stock': it.currentStock,
        'Min Level': it.minLevel,
        'Max Level': it.maxLevel,
        'Need Order': need,
        'Qty To Order': toOrder,
        'Unit Cost ($)': it.unitCost ? Number(it.unitCost.toFixed(2)) : 0,
        'Total Value ($)': Number(val.toFixed(2)),
        'Barcode / SKU': it.barcode || it.sku || ''
      };
    });
    const wsMaster = XLSX.utils.json_to_sheet(masterData);
    XLSX.utils.book_append_sheet(wb, wsMaster, 'MASTER STOCK');

    // 2. STOCK OUT LOG SHEET
    const outData = stockOutLogs.map((log, idx) => ({
      '#': idx + 1,
      'DateTime': log.timestamp,
      'Item Name': log.itemName,
      'Category': log.category,
      'Qty Taken': log.qtyTaken,
      'Remaining Stock': log.remainingAfter,
      'Taken By Staff': log.takenBy,
      'Notes': log.notes || ''
    }));
    const wsOut = XLSX.utils.json_to_sheet(
      outData.length ? outData : [{ '#': '-', 'Message': 'No Stock-Out records yet.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsOut, 'STOCK OUT LOG');

    // 3. STOCK IN LOG SHEET
    const inData = stockInLogs.map((log, idx) => ({
      '#': idx + 1,
      'DateTime': log.timestamp,
      'Item Name': log.itemName,
      'Category': log.category,
      'Qty Received': log.qtyReceived,
      'Supplier / Vendor': log.supplier,
      'Invoice / PO #': log.invoiceNo || '',
      'Received By': log.receivedBy
    }));
    const wsIn = XLSX.utils.json_to_sheet(
      inData.length ? inData : [{ '#': '-', 'Message': 'No Delivery records yet.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsIn, 'STOCK IN LOG');

    // 4. WASTE LOG SHEET
    const wasteData = wasteLogs.map((log, idx) => ({
      '#': idx + 1,
      'DateTime': log.timestamp,
      'Item Name': log.itemName,
      'Category': log.category,
      'Qty Wasted': log.qtyWasted,
      'Reason Code': log.reason,
      'Logged By': log.recordedBy,
      'Estimated Loss ($)': log.estimatedLoss ? Number(log.estimatedLoss.toFixed(2)) : 0
    }));
    const wsWaste = XLSX.utils.json_to_sheet(
      wasteData.length ? wasteData : [{ '#': '-', 'Message': 'No Waste records yet.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsWaste, 'WASTE LOG');

    // 5. AUTO ORDER REORDER SHEET
    const reorderData = items
      .filter(it => it.currentStock <= it.minLevel)
      .map((it, idx) => {
        const toOrder = Math.max(0, it.maxLevel - it.currentStock);
        const cost = (it.unitCost || 0) * toOrder;
        const sup = suppliers.find(s => s.id === it.supplierId);
        return {
          '#': idx + 1,
          'Item Name': it.name,
          'Category': it.category,
          'In Stock': it.currentStock,
          'Safety Min': it.minLevel,
          'Target Max': it.maxLevel,
          'Suggested Order Qty': `${toOrder} ${it.unit}`,
          'Est. Unit Price ($)': it.unitCost ? Number(it.unitCost.toFixed(2)) : 0,
          'Est. Line Total ($)': Number(cost.toFixed(2)),
          'Preferred Supplier': sup ? sup.name : 'Unassigned',
          'Supplier WhatsApp/Phone': sup ? sup.phone : ''
        };
      });
    const wsReorder = XLSX.utils.json_to_sheet(
      reorderData.length ? reorderData : [{ '#': '-', 'Status': 'All items currently healthy (no restock needed).' }]
    );
    XLSX.utils.book_append_sheet(wb, wsReorder, 'AUTO REORDER');

    // 6. SUPPLIERS DIRECTORY
    const supData = suppliers.map((s, idx) => ({
      '#': idx + 1,
      'Vendor Name': s.name,
      'Category': s.category,
      'Contact Person': s.contactPerson,
      'WhatsApp / Phone': s.phone,
      'Email': s.email,
      'Delivery Schedule': s.deliveryDays,
      'Payment Terms': s.paymentTerms,
      'Min Order': s.minimumOrder || 'None'
    }));
    const wsSup = XLSX.utils.json_to_sheet(
      supData.length ? supData : [{ '#': '-', 'Message': 'No suppliers registered.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsSup, 'SUPPLIERS');

    // 7. AUDIT COUNTS
    const countData = stockCounts.map((c, idx) => ({
      '#': idx + 1,
      'Type': c.type === 'night' ? 'Night Count' : 'Weekly Audit',
      'Date': c.date,
      'Item Name': c.itemName,
      'System Stock': c.systemQty,
      'Physical Count': c.physicalQty,
      'Variance': c.difference,
      'Audited By': c.countedBy,
      'Notes': c.notes || ''
    }));
    const wsCount = XLSX.utils.json_to_sheet(
      countData.length ? countData : [{ '#': '-', 'Message': 'No physical audits recorded yet.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsCount, 'STOCK AUDITS');

    // Trigger File Download
    const cleanFileName = `NileLink_Stock_${cafeName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  }

  /**
   * Generates CSV for direct Master Stock export
   */
  public static exportMasterStockCsv(items: StockItem[]): string {
    const headers = [
      'Item Name',
      'Category',
      'Unit',
      'Opening Stock',
      'Total In',
      'Total Out',
      'Total Waste',
      'Current Stock',
      'Min Level',
      'Max Level',
      'Need Order',
      'Qty To Order',
      'Unit Cost',
      'Barcode SKU'
    ];

    const rows = items.map(it => {
      const need = it.currentStock <= it.minLevel ? 'YES' : 'NO';
      const toOrder = need === 'YES' ? Math.max(0, it.maxLevel - it.currentStock) : 0;
      return [
        `"${it.name.replace(/"/g, '""')}"`,
        `"${(it.category || '').replace(/"/g, '""')}"`,
        `"${it.unit}"`,
        it.openingStock,
        it.totalIn,
        it.totalOut,
        it.totalWaste,
        it.currentStock,
        it.minLevel,
        it.maxLevel,
        need,
        toOrder,
        it.unitCost || 0,
        `"${(it.barcode || it.sku || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Parses an uploaded .xlsx, .xls, or .csv file and converts rows into NileLink StockItem format
   */
  public static async parseUploadedFile(
    file: File
  ): Promise<{ success: boolean; items?: StockItem[]; message?: string }> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      // Find best matching sheet
      const sheetNames = workbook.SheetNames;
      if (!sheetNames || sheetNames.length === 0) {
        return { success: false, message: 'Spreadsheet contains no readable sheets.' };
      }

      const targetSheetName =
        sheetNames.find(s => s.toUpperCase().includes('ITEM') || s.toUpperCase().includes('STOCK')) ||
        sheetNames[0];

      const worksheet = workbook.Sheets[targetSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        return { success: false, message: 'Selected sheet is empty.' };
      }

      // Map raw rows to StockItem
      const items: StockItem[] = [];
      const now = new Date().toISOString();

      rawRows.forEach((row, index) => {
        // Find item name
        const nameKey = Object.keys(row).find(k => {
          const l = k.toLowerCase();
          return l.includes('item') || l.includes('name') || l.includes('product') || l.includes('description');
        });

        const itemName = nameKey && row[nameKey] ? String(row[nameKey]).trim() : '';
        if (!itemName || itemName.toLowerCase().includes('(example)')) return;

        // Category
        const catKey = Object.keys(row).find(k => k.toLowerCase().includes('cat') || k.toLowerCase().includes('group'));
        const category = catKey && row[catKey] ? String(row[catKey]).trim() : 'General';

        // Unit
        const unitKey = Object.keys(row).find(k => k.toLowerCase().includes('unit'));
        const unit = unitKey && row[unitKey] ? String(row[unitKey]).trim() : 'Units';

        // Numbers
        const openingStock = this.parseNumericField(row, ['opening', 'initial', 'start']);
        const currentStock = this.parseNumericField(row, ['current', 'qty', 'on hand', 'stock', 'balance'], openingStock);
        const minLevel = this.parseNumericField(row, ['min', 'safety', 'threshold'], 5);
        const maxLevel = this.parseNumericField(row, ['max', 'target', 'par', 'ceiling'], Math.max(minLevel * 2, 20));
        const unitCost = this.parseNumericField(row, ['cost', 'price', 'rate'], 0);

        // Barcode / SKU
        const barcodeKey = Object.keys(row).find(k => {
          const l = k.toLowerCase();
          return l.includes('bar') || l.includes('sku') || l.includes('code') || l.includes('qr');
        });
        const barcode = barcodeKey && row[barcodeKey] ? String(row[barcodeKey]).trim() : `NL-ITEM-${String(index + 1).padStart(3, '0')}`;

        items.push({
          id: `item-${Date.now()}-${index}`,
          name: itemName,
          category,
          unit,
          openingStock,
          currentStock,
          minLevel,
          maxLevel,
          totalIn: 0,
          totalOut: 0,
          totalWaste: 0,
          unitCost: unitCost > 0 ? unitCost : undefined,
          barcode,
          sku: barcode,
          lastUpdated: now
        });
      });

      if (items.length === 0) {
        return {
          success: false,
          message: 'No valid products found. Ensure the file has an "Item Name" column.'
        };
      }

      return {
        success: true,
        items,
        message: `Successfully parsed ${items.length} items from ${file.name}.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Error processing spreadsheet: ' + (err.message || 'Invalid format.')
      };
    }
  }

  private static parseNumericField(row: any, keywords: string[], defaultValue = 0): number {
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase();
      if (keywords.some(kw => lower.includes(kw))) {
        const val = row[key];
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    return defaultValue;
  }

  /**
   * Helper to trigger CSV file download in the browser
   */
  public static downloadCsv(csvContent: string, fileName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
