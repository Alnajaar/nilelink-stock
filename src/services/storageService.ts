import {
  StockItem,
  StockOutLog,
  StockInLog,
  WasteLog,
  StockCountRecord,
  Employee,
  BranchTransfer,
  Supplier,
  CafeTenant,
  PendingSyncAction,
  SyncActionType
} from '../types/stock';
import {
  CALIBRATED_ITEMS,
  INITIAL_EMPLOYEES,
  INITIAL_SUPPLIERS,
  INITIAL_TENANTS,
  generateInitialStockOutLogs
} from '../data/initialData';
import { IndexedDBService } from './indexedDBService';

export interface SyncStatusInfo {
  isOnline: boolean;
  pendingCount: number;
  syncedCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
}

export class StorageService {
  private static prefix = 'barstock_v2_';
  private static syncListeners: ((status: SyncStatusInfo) => void)[] = [];
  private static isSyncingInProgress = false;
  private static lastSyncedTime: string | null = null;
  private static autoSyncInitialized = false;

  private static getKey(cafeId: string, sub: string): string {
    return `${this.prefix}${cafeId}_${sub}`;
  }

  // --- ONLINE / OFFLINE DETECTION & LISTENERS ---
  public static isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  public static initAutoSync(): void {
    if (this.autoSyncInitialized || typeof window === 'undefined') return;
    this.autoSyncInitialized = true;

    // Listen to network transitions
    window.addEventListener('online', () => {
      this.notifyListeners();
      // Auto-sync immediately upon reconnection
      setTimeout(() => {
        this.syncPendingQueue();
      }, 600);
    });

    window.addEventListener('offline', () => {
      this.notifyListeners();
    });

    // Listen to Service Worker Background Sync triggers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
          console.log('[StorageService] Background sync triggered by Service Worker');
          this.syncPendingQueue();
        }
      });
    }

    // Hydrate IndexedDB with initial active tenant items
    const activeCafe = this.getActiveTenantId();
    const currentItems = this.getItems(activeCafe);
    IndexedDBService.saveStockItems(activeCafe, currentItems).catch(() => {});

    // Periodic auto-sync daemon (every 20s when online)
    setInterval(() => {
      if (this.isOnline()) {
        const pending = this.getPendingQueue().filter(i => i.status === 'pending');
        if (pending.length > 0 && !this.isSyncingInProgress) {
          this.syncPendingQueue();
        }
      }
    }, 20000);
  }

  public static subscribeToSyncStatus(listener: (status: SyncStatusInfo) => void): () => void {
    this.initAutoSync();
    this.syncListeners.push(listener);
    // Send immediate status
    listener(this.getSyncStatus());

    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  public static getSyncStatus(): SyncStatusInfo {
    const queue = this.getPendingQueue();
    const pending = queue.filter(q => q.status === 'pending' || q.status === 'syncing').length;
    const synced = queue.filter(q => q.status === 'synced').length;

    return {
      isOnline: this.isOnline(),
      pendingCount: pending,
      syncedCount: synced,
      lastSyncedAt: this.lastSyncedTime,
      isSyncing: this.isSyncingInProgress
    };
  }

  private static notifyListeners(): void {
    const status = this.getSyncStatus();
    for (const listener of this.syncListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }

  // --- PENDING SYNC QUEUE MANAGEMENT ---
  public static getPendingQueue(): PendingSyncAction[] {
    const raw = localStorage.getItem(`${this.prefix}pending_sync_queue`);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static savePendingQueue(queue: PendingSyncAction[]): void {
    localStorage.setItem(`${this.prefix}pending_sync_queue`, JSON.stringify(queue));
    this.notifyListeners();
  }

  public static enqueueAction(
    cafeId: string,
    actionType: SyncActionType,
    payload: any,
    summary: string
  ): PendingSyncAction {
    const queue = this.getPendingQueue();
    const now = new Date().toISOString();
    const item: PendingSyncAction = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cafeId,
      actionType,
      payload,
      summary,
      timestamp: now,
      offlineTimestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    queue.push(item);
    this.savePendingQueue(queue);

    // Asynchronously commit to persistent IndexedDB queue
    IndexedDBService.enqueueSyncAction(item).catch(() => {});

    // Request Service Worker Background Sync registration if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg: any) => {
        if (reg.sync) {
          reg.sync.register('sync-stock-queue').catch(() => {});
        }
      }).catch(() => {});
    }

    // If online, trigger auto-sync in background after small debounce
    if (this.isOnline()) {
      setTimeout(() => {
        this.syncPendingQueue();
      }, 500);
    }

    return item;
  }

  /**
   * Syncs the pending offline queue to central database via /api/sync
   */
  public static async syncPendingQueue(cafeId?: string): Promise<{ syncedCount: number; errors: number }> {
    if (this.isSyncingInProgress) {
      return { syncedCount: 0, errors: 0 };
    }

    this.isSyncingInProgress = true;
    this.notifyListeners();

    try {
      const queue = this.getPendingQueue();
      let syncedCount = 0;
      let errors = 0;

      // Filter pending items
      const itemsToSync = queue.filter(
        i => (i.status === 'pending' || i.status === 'failed' || i.status === 'syncing') &&
          (!cafeId || i.cafeId === cafeId)
      );

      if (itemsToSync.length === 0) {
        return { syncedCount: 0, errors: 0 };
      }

      // Mark in-flight
      for (const action of itemsToSync) {
        action.status = 'syncing';
        IndexedDBService.updateSyncActionStatus(action.id, 'syncing').catch(() => {});
      }
      this.savePendingQueue(queue);

      const syncedTenantIds = new Set<string>();
      const actionsByTenant = new Map<string, PendingSyncAction[]>();
      for (const action of itemsToSync) {
        const tenantActions = actionsByTenant.get(action.cafeId) || [];
        tenantActions.push(action);
        actionsByTenant.set(action.cafeId, tenantActions);
      }

      for (const [tenantId, tenantActions] of actionsByTenant) {
        for (let offset = 0; offset < tenantActions.length; offset += 100) {
          const batch = tenantActions.slice(offset, offset + 100);
          try {
            const response = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ cafeId: tenantId, actions: batch })
            });
            if (!response.ok) throw new Error(`Sync server responded with ${response.status}`);
            const result = await response.json() as { success?: boolean; syncedCount?: number };
            if (result.success !== true || result.syncedCount !== batch.length) {
              throw new Error('Sync server did not confirm every queued operation.');
            }
            for (const action of batch) {
              action.status = 'synced';
              action.error = undefined;
              action.retryCount = (action.retryCount || 0) + 1;
              IndexedDBService.updateSyncActionStatus(action.id, 'synced').catch(() => {});
              syncedCount++;
            }
            syncedTenantIds.add(tenantId);
          } catch (syncError) {
            const isOffline = !this.isOnline();
            const message = syncError instanceof Error ? syncError.message : 'The sync request failed.';
            for (const action of batch) {
              action.status = isOffline ? 'pending' : 'failed';
              action.error = isOffline ? undefined : message;
              if (!isOffline) action.retryCount = (action.retryCount || 0) + 1;
              IndexedDBService.updateSyncActionStatus(action.id, action.status).catch(() => {});
              errors++;
            }
          }
        }
      }

      // Retain max 50 records for local audit trail
      const trimmedQueue = queue
        .filter(q => q.status === 'pending' || q.status === 'failed' || q.status === 'synced')
        .slice(-50);

      this.lastSyncedTime = new Date().toISOString();
      IndexedDBService.setMeta('lastSyncedAt', this.lastSyncedTime).catch(() => {});
      this.savePendingQueue(trimmedQueue);
      if (typeof window !== 'undefined') {
        const tenantIds = [...syncedTenantIds];
        window.dispatchEvent(new CustomEvent('nilelink:inventory-synced', { detail: { tenantIds } }));
      }

      return { syncedCount, errors };
    } catch (err: any) {
      console.error('Pending sync error:', err);
      return { syncedCount: 0, errors: 1 };
    } finally {
      this.isSyncingInProgress = false;
      this.notifyListeners();
    }
  }

  public static clearCompletedSync(): void {
    const queue = this.getPendingQueue().filter(i => i.status !== 'synced');
    this.savePendingQueue(queue);
  }

  public static retryFailedItem(actionId: string): void {
    const queue = this.getPendingQueue();
    const item = queue.find(q => q.id === actionId);
    if (item) {
      item.status = 'pending';
      item.retryCount = 0;
      item.error = undefined;
      this.savePendingQueue(queue);
      this.syncPendingQueue();
    }
  }

  // --- TENANTS ---
  public static getTenants(): CafeTenant[] {
    if (!import.meta.env.DEV) return [];
    const raw = localStorage.getItem(`${this.prefix}tenants`);
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      localStorage.setItem(`${this.prefix}tenants`, JSON.stringify(INITIAL_TENANTS));
      return INITIAL_TENANTS;
    }
    try {
      const parsed: CafeTenant[] = JSON.parse(raw);
      // Clean out any legacy forbidden test cafe names
      const cleaned = parsed.filter(
        t => !t.name.includes("Ahmad's") && !t.name.includes("BB TRIPOLI") && !t.name.includes("The Corner Brew")
      );
      if (cleaned.length === 0) {
        if (!import.meta.env.DEV) return [];
        localStorage.setItem(`${this.prefix}tenants`, JSON.stringify(INITIAL_TENANTS));
        return INITIAL_TENANTS;
      }
      return cleaned;
    } catch {
      return import.meta.env.DEV ? INITIAL_TENANTS : [];
    }
  }

  public static getActiveTenantId(): string {
    const stored = localStorage.getItem(`${this.prefix}active_tenant`);
    if (stored && stored !== 'ahmad-001' && stored !== 'BB' && stored !== 'CCRAZE') {
      return stored;
    }
    return import.meta.env.DEV ? 'nile-flagship' : '';
  }

  public static setActiveTenantId(tenantId: string): void {
    localStorage.setItem(`${this.prefix}active_tenant`, tenantId);
  }

  public static saveTenants(tenants: CafeTenant[]): void {
    localStorage.setItem(`${this.prefix}tenants`, JSON.stringify(tenants));
  }

  // --- STOCK ITEMS ---
  public static getItems(cafeId: string): StockItem[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'items'));
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      this.saveItems(cafeId, CALIBRATED_ITEMS);
      return CALIBRATED_ITEMS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return import.meta.env.DEV ? CALIBRATED_ITEMS : [];
    }
  }

  public static saveItems(cafeId: string, items: StockItem[]): void {
    localStorage.setItem(this.getKey(cafeId, 'items'), JSON.stringify(items));
    IndexedDBService.saveStockItems(cafeId, items).catch(() => {});
  }

  public static updateItem(cafeId: string, updated: StockItem): void {
    const items = this.getItems(cafeId);
    const index = items.findIndex(i => i.id === updated.id);
    if (index >= 0) {
      items[index] = { ...updated, lastUpdated: new Date().toISOString() };
    } else {
      items.push({ ...updated, lastUpdated: new Date().toISOString() });
    }
    this.saveItems(cafeId, items);

    // Enqueue pending sync change
    this.enqueueAction(
      cafeId,
      'UPDATE_ITEM',
      { item: updated },
      `Update Item: ${updated.name} (Stock: ${updated.currentStock} ${updated.unit})`
    );
  }

  // --- STOCK OUT (TAKE TO BAR / KITCHEN) ---
  public static recordStockOut(
    cafeId: string,
    cartItems: { name: string; qty: number }[],
    takenBy: string,
    destination: string = 'Bar / Espresso Station'
  ): { success: boolean; count: number; results: any[] } {
    const items = this.getItems(cafeId);
    const logs = this.getStockOutLogs(cafeId);
    const now = new Date().toISOString();
    const results = [];

    for (const cart of cartItems) {
      const item = items.find(i => i.name.toLowerCase() === cart.name.toLowerCase());
      if (item && cart.qty > 0) {
        item.totalOut = (item.totalOut || 0) + cart.qty;
        item.currentStock = Math.max(0, item.openingStock + item.totalIn - item.totalOut - item.totalWaste);
        item.lastUpdated = now;

        const newLog: StockOutLog = {
          id: 'out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          timestamp: now,
          itemName: item.name,
          category: item.category,
          qtyTaken: cart.qty,
          remainingAfter: item.currentStock,
          takenBy,
          destination,
          notes: `Dispensed to ${destination}`
        };
        logs.unshift(newLog);
        results.push(newLog);
      }
    }

    this.saveItems(cafeId, items);
    this.saveStockOutLogs(cafeId, logs.slice(0, 500));
    results.forEach(r => IndexedDBService.saveStockOutLog(cafeId, r).catch(() => {}));

    // Enqueue to Pending-Sync queue
    const summaryText = cartItems.map(c => `${c.qty}x ${c.name}`).join(', ');
    this.enqueueAction(
      cafeId,
      'STOCK_OUT',
      {
        cartItems: cartItems.map(cart => ({
          ...cart,
          itemId: items.find(item => item.name.toLowerCase() === cart.name.toLowerCase())?.id
        })),
        takenBy,
        destination
      },
      `Take to ${destination}: ${summaryText} by ${takenBy}`
    );

    return { success: true, count: results.length, results };
  }

  public static getStockOutLogs(cafeId: string): StockOutLog[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'logs_out'));
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      // Seed with rich 14-day logs so ML algorithm has rich consumption history immediately!
      const initialLogs = generateInitialStockOutLogs();
      this.saveStockOutLogs(cafeId, initialLogs);
      return initialLogs;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      if (!import.meta.env.DEV) return [];
      const initialLogs = generateInitialStockOutLogs();
      this.saveStockOutLogs(cafeId, initialLogs);
      return initialLogs;
    } catch {
      return [];
    }
  }

  public static saveStockOutLogs(cafeId: string, logs: StockOutLog[]): void {
    localStorage.setItem(this.getKey(cafeId, 'logs_out'), JSON.stringify(logs));
  }

  // --- STOCK IN (DELIVERIES RECEIVED) ---
  public static recordStockIn(
    cafeId: string,
    itemName: string,
    qty: number,
    supplier: string,
    receivedBy: string,
    invoiceNo?: string
  ): { success: boolean; newStock: number } {
    const items = this.getItems(cafeId);
    const logs = this.getStockInLogs(cafeId);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!item) return { success: false, newStock: 0 };

    item.totalIn = (item.totalIn || 0) + qty;
    item.currentStock = item.openingStock + item.totalIn - item.totalOut - item.totalWaste;
    item.lastUpdated = new Date().toISOString();

    const newLog: StockInLog = {
      id: 'in_' + Date.now(),
      timestamp: new Date().toISOString(),
      itemName: item.name,
      category: item.category,
      qtyReceived: qty,
      supplier: supplier || 'General Delivery',
      receivedBy,
      invoiceNo
    };
    logs.unshift(newLog);

    this.saveItems(cafeId, items);
    this.saveStockInLogs(cafeId, logs.slice(0, 300));
    IndexedDBService.saveStockInLog(cafeId, newLog).catch(() => {});

    // Enqueue to Pending-Sync queue
    this.enqueueAction(
      cafeId,
      'STOCK_IN',
      { itemId: item.id, itemName: item.name, qty, supplier, receivedBy, invoiceNo },
      `Stock In: +${qty} ${item.unit} ${item.name} (${supplier})`
    );

    return { success: true, newStock: item.currentStock };
  }

  public static getStockInLogs(cafeId: string): StockInLog[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'logs_in'));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveStockInLogs(cafeId: string, logs: StockInLog[]): void {
    localStorage.setItem(this.getKey(cafeId, 'logs_in'), JSON.stringify(logs));
  }

  // --- WASTE / SPOILAGE ---
  public static recordWaste(
    cafeId: string,
    itemName: string,
    qty: number,
    reason: string,
    recordedBy: string,
    shift?: 'Morning' | 'Afternoon' | 'Night'
  ): { success: boolean; newStock: number } {
    const items = this.getItems(cafeId);
    const logs = this.getWasteLogs(cafeId);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!item) return { success: false, newStock: 0 };

    item.totalWaste = (item.totalWaste || 0) + qty;
    item.currentStock = Math.max(0, item.openingStock + item.totalIn - item.totalOut - item.totalWaste);
    item.lastUpdated = new Date().toISOString();

    // Infer shift if not provided
    let finalShift = shift;
    if (!finalShift) {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 14) finalShift = 'Morning';
      else if (hour >= 14 && hour < 22) finalShift = 'Afternoon';
      else finalShift = 'Night';
    }

    const cost = item.unitCost ? item.unitCost * qty : 0;
    const newLog: WasteLog = {
      id: 'waste_' + Date.now(),
      timestamp: new Date().toISOString(),
      itemName: item.name,
      category: item.category,
      qtyWasted: qty,
      reason,
      recordedBy,
      estimatedLoss: cost,
      shift: finalShift
    };
    logs.unshift(newLog);

    this.saveItems(cafeId, items);
    this.saveWasteLogs(cafeId, logs.slice(0, 300));
    IndexedDBService.saveWasteLog(cafeId, newLog).catch(() => {});

    // Enqueue to Pending-Sync queue
    this.enqueueAction(
      cafeId,
      'WASTE',
      { itemId: item.id, itemName: item.name, qty, reason, recordedBy, shift: finalShift },
      `Waste Log: ${qty} ${item.unit} ${item.name} (${reason} · ${finalShift} Shift)`
    );

    return { success: true, newStock: item.currentStock };
  }

  // --- BRANCH TRANSFERS ---
  public static getBranchTransfers(cafeId: string): BranchTransfer[] {
    const raw = localStorage.getItem(`${this.prefix}transfers`);
    if (!raw) return [];
    try {
      const all: BranchTransfer[] = JSON.parse(raw);
      return all.filter(t => t.fromBranchId === cafeId || t.toBranchId === cafeId);
    } catch {
      return [];
    }
  }

  public static saveBranchTransfers(transfers: BranchTransfer[]): void {
    localStorage.setItem(`${this.prefix}transfers`, JSON.stringify(transfers));
  }

  public static executeBranchTransfer(
    fromBranchId: string,
    toBranchId: string,
    transferItems: { itemId: string; itemName: string; qty: number }[],
    initiatedBy: string,
    notes?: string
  ): { success: boolean; transfer?: BranchTransfer; error?: string } {
    if (fromBranchId === toBranchId) {
      return { success: false, error: 'Sender and receiver branches must be different.' };
    }

    const tenants = this.getTenants();
    const fromTenant = tenants.find(t => t.id === fromBranchId);
    const toTenant = tenants.find(t => t.id === toBranchId);

    if (!fromTenant || !toTenant) {
      return { success: false, error: 'Source or destination branch not found.' };
    }

    const fromItems = this.getItems(fromBranchId);
    const toItems = this.getItems(toBranchId);

    // Validate stock in sender branch
    for (const tItem of transferItems) {
      const senderItem = fromItems.find(i => i.id === tItem.itemId || i.name.toLowerCase() === tItem.itemName.toLowerCase());
      if (!senderItem) {
        return { success: false, error: `Item "${tItem.itemName}" does not exist in ${fromTenant.name}.` };
      }
      if (senderItem.currentStock < tItem.qty) {
        return {
          success: false,
          error: `Insufficient stock for "${senderItem.name}" in ${fromTenant.name} (Available: ${senderItem.currentStock} ${senderItem.unit}, Requested: ${tItem.qty}).`
        };
      }
    }

    // Prepare transfer record item details
    const finalizedItems: BranchTransfer['items'] = [];
    let totalUnits = 0;
    let totalValue = 0;

    for (const tItem of transferItems) {
      const senderItem = fromItems.find(i => i.id === tItem.itemId || i.name.toLowerCase() === tItem.itemName.toLowerCase())!;

      // Deduct from sender branch
      senderItem.totalOut = (senderItem.totalOut || 0) + tItem.qty;
      senderItem.currentStock = Math.max(0, senderItem.openingStock + (senderItem.totalIn || 0) - senderItem.totalOut - (senderItem.totalWaste || 0));
      senderItem.lastUpdated = new Date().toISOString();

      // Find or create in receiver branch
      let receiverItem = toItems.find(i => i.name.toLowerCase() === senderItem.name.toLowerCase());
      if (receiverItem) {
        receiverItem.totalIn = (receiverItem.totalIn || 0) + tItem.qty;
        receiverItem.currentStock = receiverItem.openingStock + receiverItem.totalIn - (receiverItem.totalOut || 0) - (receiverItem.totalWaste || 0);
        receiverItem.lastUpdated = new Date().toISOString();
      } else {
        // Create matching item in receiver branch catalog
        receiverItem = {
          ...senderItem,
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          openingStock: 0,
          currentStock: tItem.qty,
          totalIn: tItem.qty,
          totalOut: 0,
          totalWaste: 0,
          lastUpdated: new Date().toISOString()
        };
        toItems.push(receiverItem);
      }

      const itemCost = senderItem.unitCost || 0;
      totalUnits += tItem.qty;
      totalValue += itemCost * tItem.qty;

      finalizedItems.push({
        itemId: senderItem.id,
        itemName: senderItem.name,
        category: senderItem.category,
        unit: senderItem.unit,
        qtyTransferred: tItem.qty,
        unitCost: itemCost
      });
    }

    // Save items for both locations
    this.saveItems(fromBranchId, fromItems);
    this.saveItems(toBranchId, toItems);

    // Create Transfer Record
    const rawAll = localStorage.getItem(`${this.prefix}transfers`);
    let allTransfers: BranchTransfer[] = [];
    if (rawAll) {
      try { allTransfers = JSON.parse(rawAll); } catch {}
    }

    const transferNum = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTransfer: BranchTransfer = {
      id: 'tr_' + Date.now(),
      transferNumber: transferNum,
      timestamp: new Date().toISOString(),
      fromBranchId,
      fromBranchName: fromTenant.name,
      toBranchId,
      toBranchName: toTenant.name,
      items: finalizedItems,
      totalUnits,
      totalValue,
      status: 'COMPLETED',
      initiatedBy,
      notes
    };

    allTransfers.unshift(newTransfer);
    this.saveBranchTransfers(allTransfers);

    // Enqueue sync actions
    this.enqueueAction(
      fromBranchId,
      'BRANCH_TRANSFER',
      { newTransfer, role: 'sender' },
      `Branch Transfer Out: ${totalUnits} units transferred to ${toTenant.name} (${transferNum})`
    );

    this.enqueueAction(
      toBranchId,
      'BRANCH_TRANSFER',
      { newTransfer, role: 'receiver' },
      `Branch Transfer In: ${totalUnits} units received from ${fromTenant.name} (${transferNum})`
    );

    return { success: true, transfer: newTransfer };
  }

  public static getWasteLogs(cafeId: string): WasteLog[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'logs_waste'));
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      // Seed rich waste logs for realistic analytics & insights
      const sampleWaste: WasteLog[] = [
        {
          id: 'w-seed-1',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          itemName: 'Full Fat Fresh Milk',
          category: 'Dairy',
          qtyWasted: 3,
          reason: 'Expired / Past Best Before',
          recordedBy: 'Maya (Barista)',
          estimatedLoss: 5.10,
          shift: 'Morning'
        },
        {
          id: 'w-seed-2',
          timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
          itemName: 'Butter Croissant (Frozen Raw 40pc)',
          category: 'Bakery',
          qtyWasted: 2,
          reason: 'Burned / Overcooked Pastry',
          recordedBy: 'Tarek (Manager)',
          estimatedLoss: 14.40,
          shift: 'Morning'
        },
        {
          id: 'w-seed-3',
          timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
          itemName: 'Oat Milk Barista Edition',
          category: 'Dairy',
          qtyWasted: 2,
          reason: 'Spilled on Bar / Counter',
          recordedBy: 'Maya (Barista)',
          estimatedLoss: 6.40,
          shift: 'Afternoon'
        },
        {
          id: 'w-seed-4',
          timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
          itemName: 'House Espresso Blend (Beans)',
          category: 'Coffee Beans',
          qtyWasted: 1.5,
          reason: 'Grinder Calibration Purge',
          recordedBy: 'Ahmad (Admin)',
          estimatedLoss: 25.50,
          shift: 'Morning'
        },
        {
          id: 'w-seed-5',
          timestamp: new Date(Date.now() - 3600000 * 62).toISOString(),
          itemName: 'Takeaway Hot Cups 12oz (Double Wall)',
          category: 'Packaging',
          qtyWasted: 15,
          reason: 'Dropped / Packaging Damaged',
          recordedBy: 'Staff',
          estimatedLoss: 2.25,
          shift: 'Night'
        },
        {
          id: 'w-seed-6',
          timestamp: new Date(Date.now() - 3600000 * 80).toISOString(),
          itemName: 'Vanilla Artisan Syrup (750ml)',
          category: 'Syrups',
          qtyWasted: 1,
          reason: 'Dropped / Packaging Damaged',
          recordedBy: 'Staff',
          estimatedLoss: 12.00,
          shift: 'Night'
        },
        {
          id: 'w-seed-7',
          timestamp: new Date(Date.now() - 3600000 * 95).toISOString(),
          itemName: 'Almond Breeze Barista',
          category: 'Dairy',
          qtyWasted: 2,
          reason: 'Expired / Past Best Before',
          recordedBy: 'Tarek (Manager)',
          estimatedLoss: 6.80,
          shift: 'Afternoon'
        }
      ];
      this.saveWasteLogs(cafeId, sampleWaste);
      return sampleWaste;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveWasteLogs(cafeId: string, logs: WasteLog[]): void {
    localStorage.setItem(this.getKey(cafeId, 'logs_waste'), JSON.stringify(logs));
  }

  // --- COUNTS (NIGHT & WEEKLY AUDITS) ---
  public static recordCount(
    cafeId: string,
    type: 'night' | 'week',
    itemName: string,
    physicalQty: number,
    countedBy: string,
    notes?: string,
    dateVal?: string
  ): { success: boolean; systemQty: number; difference: number } {
    const items = this.getItems(cafeId);
    const counts = this.getStockCounts(cafeId);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!item) return { success: false, systemQty: 0, difference: 0 };

    const systemQty = item.currentStock;
    const diff = physicalQty - systemQty;

    const record: StockCountRecord = {
      id: 'cnt_' + Date.now(),
      type,
      date: dateVal || new Date().toISOString().slice(0, 10),
      itemName: item.name,
      systemQty,
      physicalQty,
      difference: diff,
      countedBy,
      notes
    };
    counts.unshift(record);

    this.saveStockCounts(cafeId, counts.slice(0, 300));
    IndexedDBService.saveStockCountRecord(cafeId, record).catch(() => {});

    // Enqueue to Pending-Sync queue
    this.enqueueAction(
      cafeId,
      'STOCK_COUNT',
      { itemId: item.id, type, itemName, physicalQty, countedBy, notes },
      `Audit Count: ${itemName} = ${physicalQty} (diff: ${diff >= 0 ? '+' : ''}${diff})`
    );

    return { success: true, systemQty, difference: diff };
  }

  public static getStockCounts(cafeId: string): StockCountRecord[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'counts'));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveStockCounts(cafeId: string, counts: StockCountRecord[]): void {
    localStorage.setItem(this.getKey(cafeId, 'counts'), JSON.stringify(counts));
  }

  // --- EMPLOYEES / PIN AUTH ---
  public static getEmployees(cafeId: string): Employee[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'employees'));
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      this.saveEmployees(cafeId, INITIAL_EMPLOYEES);
      return INITIAL_EMPLOYEES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return import.meta.env.DEV ? INITIAL_EMPLOYEES : [];
    }
  }

  public static saveEmployees(cafeId: string, employees: Employee[]): void {
    localStorage.setItem(this.getKey(cafeId, 'employees'), JSON.stringify(employees));
  }

  public static verifyPin(cafeId: string, pin: string): { success: boolean; user?: Employee; message?: string } {
    if (!import.meta.env.DEV) {
      return { success: false, message: 'Local PIN authentication is disabled.' };
    }
    const employees = this.getEmployees(cafeId);
    const match = employees.find(e => e.pin.trim() === pin.trim());

    if (!match) {
      return { success: false, message: 'Invalid PIN.' };
    }
    if (!match.active) {
      return { success: false, message: 'This staff PIN has been deactivated by the manager.' };
    }
    return { success: true, user: match };
  }

  // --- SUPPLIERS ---
  public static getSuppliers(cafeId: string): Supplier[] {
    const raw = localStorage.getItem(this.getKey(cafeId, 'suppliers'));
    if (!raw) {
      if (!import.meta.env.DEV) return [];
      this.saveSuppliers(cafeId, INITIAL_SUPPLIERS);
      return INITIAL_SUPPLIERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return import.meta.env.DEV ? INITIAL_SUPPLIERS : [];
    }
  }

  public static saveSuppliers(cafeId: string, suppliers: Supplier[]): void {
    localStorage.setItem(this.getKey(cafeId, 'suppliers'), JSON.stringify(suppliers));
  }

  // --- DASHBOARD METRICS ---
  public static getMetrics(cafeId: string) {
    const items = this.getItems(cafeId);
    let totalUnits = 0;
    let needToOrder = 0;
    let healthyCount = 0;
    let totalIn = 0;
    let totalOut = 0;
    let totalWaste = 0;
    let totalValue = 0;

    for (const it of items) {
      totalUnits += it.currentStock;
      totalIn += (it.totalIn || 0);
      totalOut += (it.totalOut || 0);
      totalWaste += (it.totalWaste || 0);
      if (it.unitCost) {
        totalValue += it.currentStock * it.unitCost;
      }
      if (it.currentStock <= it.minLevel) {
        needToOrder++;
      } else {
        healthyCount++;
      }
    }

    return {
      totalUnits,
      totalItems: items.length,
      needToOrder,
      healthyCount,
      totalReceived: totalIn,
      totalTaken: totalOut,
      totalWaste,
      totalValue
    };
  }
}
