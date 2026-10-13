import {
  StockItem,
  StockOutLog,
  StockInLog,
  WasteLog,
  StockCountRecord,
  PendingSyncAction
} from '../types/stock';

const DB_NAME = 'BarStockPro_PWA_DB';
const DB_VERSION = 1;

export interface StoredStockItem extends StockItem {
  cafeId: string;
  compositeKey: string; // `${cafeId}_${id}`
  lastUpdated: string;
}

export interface StoredStockOutLog extends StockOutLog {
  cafeId: string;
}

export interface StoredStockInLog extends StockInLog {
  cafeId: string;
}

export interface StoredWasteLog extends WasteLog {
  cafeId: string;
}

export interface StoredStockCountRecord extends StockCountRecord {
  cafeId: string;
}

export class IndexedDBService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  public static getDB(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // 1. Stock items store
            if (!db.objectStoreNames.contains('stock_items')) {
              const itemStore = db.createObjectStore('stock_items', { keyPath: 'compositeKey' });
              itemStore.createIndex('cafeId', 'cafeId', { unique: false });
              itemStore.createIndex('name', 'name', { unique: false });
              itemStore.createIndex('category', 'category', { unique: false });
              itemStore.createIndex('barcode', 'barcode', { unique: false });
            }

            // 2. Stock out (Take to Bar / Kitchen) logs
            if (!db.objectStoreNames.contains('stock_logs')) {
              const logStore = db.createObjectStore('stock_logs', { keyPath: 'id' });
              logStore.createIndex('cafeId', 'cafeId', { unique: false });
              logStore.createIndex('timestamp', 'timestamp', { unique: false });
              logStore.createIndex('destination', 'destination', { unique: false });
            }

            // 3. Stock in logs (Restocking / Deliveries)
            if (!db.objectStoreNames.contains('stock_in_logs')) {
              const inStore = db.createObjectStore('stock_in_logs', { keyPath: 'id' });
              inStore.createIndex('cafeId', 'cafeId', { unique: false });
              inStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // 4. Waste logs
            if (!db.objectStoreNames.contains('waste_logs')) {
              const wasteStore = db.createObjectStore('waste_logs', { keyPath: 'id' });
              wasteStore.createIndex('cafeId', 'cafeId', { unique: false });
              wasteStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // 5. Stock count records (Physical Audits)
            if (!db.objectStoreNames.contains('stock_counts')) {
              const countStore = db.createObjectStore('stock_counts', { keyPath: 'id' });
              countStore.createIndex('cafeId', 'cafeId', { unique: false });
              countStore.createIndex('date', 'date', { unique: false });
            }

            // 6. Offline Pending Sync Queue
            if (!db.objectStoreNames.contains('pending_sync_queue')) {
              const queueStore = db.createObjectStore('pending_sync_queue', { keyPath: 'id' });
              queueStore.createIndex('cafeId', 'cafeId', { unique: false });
              queueStore.createIndex('status', 'status', { unique: false });
              queueStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // 7. Metadata / Key-Value config store
            if (!db.objectStoreNames.contains('meta_sync')) {
              db.createObjectStore('meta_sync', { keyPath: 'key' });
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
          };

          request.onblocked = () => {
            console.warn('IndexedDB upgrade blocked by open tab.');
          };
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  // --- STOCK ITEMS ---
  public static async saveStockItems(cafeId: string, items: StockItem[]): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('stock_items', 'readwrite');
      const store = tx.objectStore('stock_items');
      const now = new Date().toISOString();

      for (const item of items) {
        const record: StoredStockItem = {
          ...item,
          cafeId,
          compositeKey: `${cafeId}_${item.id}`,
          lastUpdated: now
        };
        store.put(record);
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB saveStockItems error:', err);
    }
  }

  public static async getStockItems(cafeId: string): Promise<StockItem[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      const tx = db.transaction('stock_items', 'readonly');
      const store = tx.objectStore('stock_items');
      const index = store.index('cafeId');
      const request = index.getAll(IDBKeyRange.only(cafeId));

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const records: StoredStockItem[] = request.result || [];
          resolve(records.map(({ compositeKey, cafeId: _, ...item }) => item));
        };
        request.onerror = () => {
          resolve([]);
        };
      });
    } catch {
      return [];
    }
  }

  // --- LOG STORES (StockOut, StockIn, Waste, Count) ---
  public static async saveStockOutLog(cafeId: string, log: StockOutLog): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('stock_logs', 'readwrite');
      const store = tx.objectStore('stock_logs');
      store.put({ ...log, cafeId });
    } catch (err) {
      console.warn('IndexedDB saveStockOutLog error:', err);
    }
  }

  public static async saveStockInLog(cafeId: string, log: StockInLog): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('stock_in_logs', 'readwrite');
      const store = tx.objectStore('stock_in_logs');
      store.put({ ...log, cafeId });
    } catch (err) {
      console.warn('IndexedDB saveStockInLog error:', err);
    }
  }

  public static async saveWasteLog(cafeId: string, log: WasteLog): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('waste_logs', 'readwrite');
      const store = tx.objectStore('waste_logs');
      store.put({ ...log, cafeId });
    } catch (err) {
      console.warn('IndexedDB saveWasteLog error:', err);
    }
  }

  public static async saveStockCountRecord(cafeId: string, record: StockCountRecord): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('stock_counts', 'readwrite');
      const store = tx.objectStore('stock_counts');
      store.put({ ...record, cafeId });
    } catch (err) {
      console.warn('IndexedDB saveStockCountRecord error:', err);
    }
  }

  // --- OFFLINE SYNC QUEUE IN INDEXEDDB ---
  public static async enqueueSyncAction(action: PendingSyncAction): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('pending_sync_queue', 'readwrite');
      const store = tx.objectStore('pending_sync_queue');
      store.put(action);
    } catch (err) {
      console.warn('IndexedDB enqueueSyncAction error:', err);
    }
  }

  public static async getPendingSyncQueue(cafeId?: string): Promise<PendingSyncAction[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      const tx = db.transaction('pending_sync_queue', 'readonly');
      const store = tx.objectStore('pending_sync_queue');

      return new Promise((resolve) => {
        let request: IDBRequest<PendingSyncAction[]>;
        if (cafeId) {
          const index = store.index('cafeId');
          request = index.getAll(IDBKeyRange.only(cafeId));
        } else {
          request = store.getAll();
        }

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public static async updateSyncActionStatus(
    id: string,
    status: 'pending' | 'syncing' | 'synced' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('pending_sync_queue', 'readwrite');
      const store = tx.objectStore('pending_sync_queue');
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          const updated: PendingSyncAction = {
            ...request.result,
            status,
            errorMessage,
            retryCount: status === 'failed' ? (request.result.retryCount || 0) + 1 : request.result.retryCount
          };
          store.put(updated);
        }
      };
    } catch (err) {
      console.warn('IndexedDB updateSyncActionStatus error:', err);
    }
  }

  public static async removeSyncAction(id: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('pending_sync_queue', 'readwrite');
      const store = tx.objectStore('pending_sync_queue');
      store.delete(id);
    } catch (err) {
      console.warn('IndexedDB removeSyncAction error:', err);
    }
  }

  // --- METADATA & PERSISTENT CONFIG ---
  public static async setMeta(key: string, value: any): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('meta_sync', 'readwrite');
      const store = tx.objectStore('meta_sync');
      store.put({ key, value, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('IndexedDB setMeta error:', err);
    }
  }

  public static async getMeta<T = any>(key: string): Promise<T | null> {
    if (!this.isSupported()) return null;
    try {
      const db = await this.getDB();
      const tx = db.transaction('meta_sync', 'readonly');
      const store = tx.objectStore('meta_sync');
      const req = store.get(key);

      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Diagnostic summary of local IndexedDB data for debugging & audit
   */
  public static async getStorageMetrics(): Promise<{
    itemCount: number;
    logCount: number;
    pendingSyncCount: number;
    dbSupported: boolean;
    quotaEstimatedMB?: number;
    usageEstimatedMB?: number;
  }> {
    if (!this.isSupported()) {
      return { itemCount: 0, logCount: 0, pendingSyncCount: 0, dbSupported: false };
    }

    try {
      const db = await this.getDB();
      const countStore = (storeName: string): Promise<number> => {
        return new Promise((resolve) => {
          try {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
          } catch {
            resolve(0);
          }
        });
      };

      const [itemCount, logCount, pendingSyncCount] = await Promise.all([
        countStore('stock_items'),
        countStore('stock_logs'),
        countStore('pending_sync_queue')
      ]);

      let quotaMB: number | undefined;
      let usageMB: number | undefined;

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) quotaMB = Math.round(estimate.quota / (1024 * 1024));
        if (estimate.usage) usageMB = Math.round((estimate.usage / (1024 * 1024)) * 100) / 100;
      }

      return {
        itemCount,
        logCount,
        pendingSyncCount,
        dbSupported: true,
        quotaEstimatedMB: quotaMB,
        usageEstimatedMB: usageMB
      };
    } catch {
      return { itemCount: 0, logCount: 0, pendingSyncCount: 0, dbSupported: true };
    }
  }
}
