import { ExcelService } from './excelService';
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

/**
 * Re-export wrapper for backward-compatibility with ExcelService
 */
export class SheetsSyncService {
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
    ExcelService.exportCompleteWorkbook(
      cafeName,
      items,
      stockOutLogs,
      stockInLogs,
      wasteLogs,
      employees,
      suppliers,
      stockCounts,
      tenants
    );
  }

  public static exportMasterStockCsv(items: StockItem[]): string {
    return ExcelService.exportMasterStockCsv(items);
  }

  public static parseUploadedFile(file: File) {
    return ExcelService.parseUploadedFile(file);
  }

  public static downloadCsv(csvContent: string, fileName: string): void {
    ExcelService.downloadCsv(csvContent, fileName);
  }
}
