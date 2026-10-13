import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Database,
  ArrowRight
} from 'lucide-react';
import { PendingSyncAction } from '../types/stock';
import { StorageService, SyncStatusInfo } from '../services/storageService';
import { IndexedDBService } from '../services/indexedDBService';
import { PWAInstallButton } from './PWAInstallButton';

interface PendingSyncModalProps {
  cafeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const PendingSyncModal: React.FC<PendingSyncModalProps> = ({
  cafeId,
  isOpen,
  onClose,
  onSyncComplete,
  onShowToast
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(StorageService.getSyncStatus());
  const [queue, setQueue] = useState<PendingSyncAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshData = () => {
    setSyncStatus(StorageService.getSyncStatus());
    setQueue(StorageService.getPendingQueue());
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshData();

    const unsubscribe = StorageService.subscribeToSyncStatus(status => {
      setSyncStatus(status);
      setQueue(StorageService.getPendingQueue());
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) {
      onShowToast('Device is currently offline. Will automatically sync when reconnected.', 'err');
      return;
    }

    setIsSyncing(true);
    const res = await StorageService.syncPendingQueue(cafeId);
    setIsSyncing(false);
    refreshData();

    if (res.syncedCount > 0) {
      onShowToast(`Successfully synced ${res.syncedCount} queued change(s) to cloud database!`, 'ok');
      onSyncComplete?.();
    } else if (res.errors > 0) {
      onShowToast('Sync encountered errors. Will retry automatically.', 'err');
    } else {
      onShowToast('Queue is already up to date.', 'ok');
    }
  };

  const handleClearCompleted = () => {
    StorageService.clearCompletedSync();
    refreshData();
    onShowToast('Cleared completed sync history.', 'ok');
  };

  const pendingItems = queue.filter(i => i.status === 'pending' || i.status === 'syncing');
  const completedItems = queue.filter(i => i.status === 'synced');
  const failedItems = queue.filter(i => i.status === 'failed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                syncStatus.isOnline
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}
            >
              {syncStatus.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">Offline &amp; Pending Sync Engine</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    syncStatus.isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {syncStatus.isOnline ? 'Network Connected' : 'Offline Mode Active'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero-downtime offline queue for basements, walk-ins, and spotty Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending:</span>
              <span className="font-bold text-amber-400">{pendingItems.length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Synced History:</span>
              <span className="font-bold text-emerald-400">{completedItems.length}</span>
            </div>
            {failedItems.length > 0 && (
              <div className="flex items-center gap-1.5 text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Failed:</span>
                <span className="font-bold text-rose-400">{failedItems.length}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {completedItems.length > 0 && (
              <button
                onClick={handleClearCompleted}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 text-[11px] flex items-center gap-1 transition-colors"
                title="Clear completed logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !syncStatus.isOnline || (pendingItems.length === 0 && failedItems.length === 0)}
              className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Informative Banner with IndexedDB & PWA Status */}
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Staff can take stock, accept stock-in deliveries, record waste, or perform night audits completely
              without internet. All changes persist securely in local <strong className="text-white">IndexedDB</strong> and sync automatically when connectivity is restored.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
              IndexedDB Active
            </span>
            <PWAInstallButton variant="compact" />
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-80" />
              <p className="font-semibold text-white">All Changes Fully Synced</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No pending offline transactions. All stock logs match the central Cloudflare database.
              </p>
            </div>
          ) : (
            queue.map(item => {
              const isPending = item.status === 'pending';
              const isItemSyncing = item.status === 'syncing';
              const isSuccess = item.status === 'synced';
              const isFailed = item.status === 'failed';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 text-xs ${
                    isPending
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : isItemSyncing
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : isFailed
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono shrink-0 ${
                        item.actionType === 'STOCK_OUT'
                          ? 'bg-amber-500/20 text-amber-300'
                          : item.actionType === 'STOCK_IN'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.actionType === 'WASTE'
                          ? 'bg-rose-500/20 text-rose-300'
                          : item.actionType === 'STOCK_COUNT'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-sky-500/20 text-sky-300'
                      }`}
                    >
                      {item.actionType.replace('_', ' ')}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{item.summary}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}{' '}
                        ·{' '}
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isPending && (
                      <span className="flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Queued</span>
                      </span>
                    )}
                    {isItemSyncing && (
                      <span className="flex items-center gap-1 text-blue-400 font-medium text-[11px]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Syncing</span>
                      </span>
                    )}
                    {isSuccess && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Synced</span>
                      </span>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => StorageService.retryFailedItem(item.id)}
                        className="px-2 py-1 rounded bg-rose-600/40 hover:bg-rose-600/60 text-rose-200 text-[10px] font-bold"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {syncStatus.lastSyncedAt
              ? `Last synced: ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}`
              : 'Auto-sync active'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
