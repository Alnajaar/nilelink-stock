import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Coffee,
  Building2,
  Wifi,
  WifiOff,
  RefreshCw,
  Crown,
  ChevronDown,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Home
} from 'lucide-react';
import { Employee, LicenseInfo, CafeTenant } from '../types/stock';
import { StorageService, SyncStatusInfo } from '../services/storageService';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  user: Employee;
  cafe: CafeTenant;
  license: LicenseInfo;
  availableBranches?: CafeTenant[];
  onSelectBranch?: (tenant: CafeTenant) => void;
  onLogout: () => void;
  onOpenLicenseModal?: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenSyncModal?: () => void;
  onReturnToSuperAdmin?: () => void;
  onOpenNotificationsModal?: () => void;
  onGoToLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  cafe,
  license,
  availableBranches = [],
  onSelectBranch,
  onLogout,
  onOpenLicenseModal,
  onOpenSuperAdmin,
  onOpenSyncModal,
  onReturnToSuperAdmin,
  onOpenNotificationsModal,
  onGoToLanding
}) => {
  const isExpiringSoon = license.status === 'warning';
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(StorageService.getSyncStatus());
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  useEffect(() => {
    const unsub = StorageService.subscribeToSyncStatus(status => {
      setSyncStatus(status);
    });
    return () => unsub();
  }, []);

  const isOffline = !syncStatus.isOnline;
  const isSuperAdmin = user.role === 'superadmin';

  return (
    <header
      className={`sticky top-0 z-40 text-white transition-colors duration-300 ${
        isOffline
          ? 'bg-gradient-to-r from-slate-900 via-amber-950/60 to-slate-900 border-b-2 border-amber-500 shadow-lg shadow-amber-950/30'
          : 'bg-slate-900 border-b border-slate-800'
      }`}
    >
      {/* Optional Top Expiry Notice Bar */}
      {isExpiringSoon && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-1.5 text-xs text-center flex items-center justify-center gap-2">
          <span>License expiring in {license.daysLeft} days.</span>
          {user.role === 'admin' && (
            <button
              onClick={onOpenLicenseModal}
              className="underline font-semibold hover:text-white ml-1"
            >
              Renew Now
            </button>
          )}
        </div>
      )}

      {/* Super Admin Inspection Banner */}
      {isSuperAdmin && onReturnToSuperAdmin && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-slate-950" />
            <span>PLATFORM SUPER ADMIN MODE: Inspecting Tenant Store &quot;{cafe.name}&quot;</span>
          </div>
          <button
            onClick={onReturnToSuperAdmin}
            className="px-2.5 py-0.5 rounded-md bg-slate-900 text-amber-400 hover:bg-slate-800 text-[11px] font-extrabold flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to SaaS Hub</span>
          </button>
        </div>
      )}

      {/* Top Bar Contract (1 Row, 3 Zones) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Wordmark & Cafe (with multi-branch selector if eligible) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            isOffline
              ? 'bg-amber-500/30 border-amber-500/60 text-amber-300'
              : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
          }`}>
            <Coffee className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
                NileLink Stock
              </span>
              {isSuperAdmin && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  SUPER ADMIN
                </span>
              )}
            </div>

            {/* Branch name & multi-branch dropdown */}
            <div className="relative">
              {availableBranches.length > 1 && onSelectBranch ? (
                <div className="relative">
                  <button
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium truncate max-w-[130px] sm:max-w-[220px] flex items-center gap-1 text-left"
                    title="Switch branch in your organization"
                  >
                    <span className="truncate">{cafe.name}</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>

                  {showBranchDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
                        Your Organization Branches
                      </div>
                      {availableBranches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => {
                            onSelectBranch(branch);
                            setShowBranchDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/70 transition-colors ${
                            branch.id === cafe.id ? 'bg-amber-500/15 text-amber-400 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <span className="truncate">{branch.name}</span>
                          {branch.city && <span className="text-[10px] text-slate-400 ml-2">{branch.city}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                  {cafe.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Zone 2: Middle Status (Clean Unboxed Metadata & Cloud Sync Status) */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* User metadata on desktop/tablet */}
          <div className="hidden md:flex items-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-200">{user.name}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize text-amber-400 font-medium">{user.role}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">{cafe.plan || `${license.tier} Plan`}</span>
          </div>

          {/* HIGH VISIBILITY ONLINE / OFFLINE INDICATOR (Visible on mobile & desktop) */}
          {onOpenSyncModal && (
            <button
              onClick={onOpenSyncModal}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                isOffline
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-2 ring-amber-500/30 animate-pulse hover:bg-amber-500/35'
                  : syncStatus.pendingCount > 0
                  ? 'bg-blue-500/20 border-blue-400 text-blue-300 hover:bg-blue-500/30'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
              }`}
              title="Click to view network sync status & pending offline changes"
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="font-extrabold tracking-wide">Offline</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-200 border border-amber-500/40 font-mono">
                    {syncStatus.pendingCount}
                  </span>
                </>
              ) : syncStatus.pendingCount > 0 ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin shrink-0" />
                  <span className="hidden sm:inline">Syncing</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/80 text-blue-200 border border-blue-500/40 font-mono">
                    {syncStatus.pendingCount}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-sm shadow-emerald-400/80" />
                  <span className="font-semibold text-emerald-300">Online</span>
                  <span className="hidden lg:inline text-[10px] text-emerald-400/80">· Synced</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Zone 3: Actions & User Sign Out */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Landing Home button */}
          {onGoToLanding && (
            <button
              onClick={onGoToLanding}
              className="h-8 sm:h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Return to Public SaaS Landing Page"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Landing</span>
            </button>
          )}

          {/* In-App PWA Install Prompt */}
          <PWAInstallButton variant="compact" />

          {/* Web Push Notification Bell (Admin & Manager) */}
          {onOpenNotificationsModal && (user.role === 'admin' || user.role === 'manager') && (
            <button
              onClick={onOpenNotificationsModal}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 flex items-center justify-center transition-colors relative"
              title="Web Push Stock Notifications & Alert Preferences"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </button>
          )}

          {/* ONLY Super Admin sees Super Admin SaaS console button! Store admin NEVER sees it! */}
          {isSuperAdmin && onOpenSuperAdmin && (
            <button
              onClick={onOpenSuperAdmin}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open SaaS Super Admin Portal"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SaaS Hub</span>
            </button>
          )}

          <div className="md:hidden text-right mr-1">
            <div className="text-[11px] font-semibold text-slate-200 truncate max-w-[80px]">{user.name}</div>
            <div className="text-[10px] text-amber-400 capitalize">{user.role}</div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out of terminal"
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-[0.97] border border-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* OFFLINE THEME WARNING STRIP (Alerts staff that changes are safely queued) */}
      {isOffline && (
        <div className="bg-amber-500/20 border-t border-amber-500/30 text-amber-200 px-3 sm:px-6 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-medium text-[11px] sm:text-xs">
              <strong className="font-bold text-amber-300">Offline Mode Active:</strong> Operating on local terminal storage. Staff can continue taking items, receiving stock, and counting — all changes are safely queued ({syncStatus.pendingCount} pending) and will auto-sync upon reconnection.
            </span>
          </div>
          {onOpenSyncModal && (
            <button
              onClick={onOpenSyncModal}
              className="text-[11px] font-bold text-amber-300 hover:text-white underline ml-auto shrink-0"
            >
              Review Sync Queue →
            </button>
          )}
        </div>
      )}
    </header>
  );
};
