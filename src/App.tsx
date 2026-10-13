import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StorageService } from './services/storageService';
import { LicenseManager } from './services/licenseService';
import {
  Employee,
  CafeTenant,
  StockItem,
  Supplier,
  StockOutLog,
  StockInLog,
  WasteLog,
  StockCountRecord,
  SubscriptionPlan,
  BranchTransfer
} from './types/stock';
import { DEFAULT_SUBSCRIPTION_PLANS } from './data/initialData';
import { PinLogin } from './components/PinLogin';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { TakeItemsScreen } from './components/TakeItemsScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { StockLevelsScreen } from './components/StockLevelsScreen';
import { StockInScreen } from './components/StockInScreen';
import { WasteScreen } from './components/WasteScreen';
import { StockCountScreen } from './components/StockCountScreen';
import { AutoOrderScreen } from './components/AutoOrderScreen';
import { SuppliersScreen } from './components/SuppliersScreen';
import { TeamScreen } from './components/TeamScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { LicenseScreen } from './components/LicenseScreen';
import { ExcelTemplateHub } from './components/ExcelTemplateHub';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import { AddItemModal } from './components/AddItemModal';
import { Toast } from './components/Toast';
import { MLStockPredictionScreen } from './components/MLStockPredictionScreen';
import { BranchTransferScreen } from './components/BranchTransferScreen';
import { PendingSyncModal } from './components/PendingSyncModal';
import { SmartInventoryAuditScreen } from './components/SmartInventoryAuditScreen';
import { LandingPage } from './components/LandingPage';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationService } from './services/notificationService';
import { SyncStatusInfo } from './services/storageService';

export default function App() {
  // Navigation Mode: 'landing' (public SaaS visitor) | 'store' (active POS/terminal) | 'superadmin' (platform owner)
  const [appMode, setAppMode] = useState<'landing' | 'store' | 'superadmin'>('landing');

  // Tenants & SaaS Plans
  const [tenants, setTenants] = useState<CafeTenant[]>([]);
  const [activeCafe, setActiveCafe] = useState<CafeTenant | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [license, setLicense] = useState(LicenseManager.getLicenseStatus('nile-flagship', 'Demo Specialty Roastery'));

  // Authenticated User
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  // Active Tab & Prefill
  const [currentTab, setCurrentTab] = useState<TabId>('take');
  const [prefillAutoOrderItems, setPrefillAutoOrderItems] = useState<string[] | undefined>(undefined);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(StorageService.getSyncStatus());

  useEffect(() => {
    const unsub = StorageService.subscribeToSyncStatus(status => {
      setSyncStatus(status);
    });
    return () => unsub();
  }, []);

  // Core Data
  const [items, setItems] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stockOutLogs, setStockOutLogs] = useState<StockOutLog[]>([]);
  const [stockInLogs, setStockInLogs] = useState<StockInLog[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCountRecord[]>([]);
  const [branchTransfers, setBranchTransfers] = useState<BranchTransfer[]>([]);

  // Modals & Notifications
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null);

  const showToast = useCallback((message: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  const loadTenantData = useCallback((cafeId: string) => {
    setItems(StorageService.getItems(cafeId));
    setSuppliers(StorageService.getSuppliers(cafeId));
    setEmployees(StorageService.getEmployees(cafeId));
    setStockOutLogs(StorageService.getStockOutLogs(cafeId));
    setStockInLogs(StorageService.getStockInLogs(cafeId));
    setWasteLogs(StorageService.getWasteLogs(cafeId));
    setStockCounts(StorageService.getStockCounts(cafeId));
    setBranchTransfers(StorageService.getBranchTransfers(cafeId));
  }, []);

  // Initialize tenants and load active tenant data (support URL access code)
  useEffect(() => {
    const loadedTenants = StorageService.getTenants();
    setTenants(loadedTenants);

    const storedPlans = localStorage.getItem('nilelink_plans');
    if (storedPlans) {
      try {
        setPlans(JSON.parse(storedPlans));
      } catch {
        // use default
      }
    }

    // Check URL parameters for special access code: ?code=NL-... or ?mode=store/superadmin
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    const modeParam = urlParams.get('mode');

    let initialTenant = loadedTenants[0];
    if (codeParam) {
      const matched = loadedTenants.find(
        t => t.accessCode.toUpperCase() === codeParam.trim().toUpperCase()
      );
      if (matched) {
        initialTenant = matched;
        StorageService.setActiveTenantId(matched.id);
        setAppMode('store');
      }
    } else if (modeParam === 'store') {
      const activeId = StorageService.getActiveTenantId();
      const found = loadedTenants.find(t => t.id === activeId);
      if (found) initialTenant = found;
      setAppMode('store');
    } else if (modeParam === 'superadmin') {
      setAppMode('superadmin');
    } else {
      const activeId = StorageService.getActiveTenantId();
      const found = loadedTenants.find(t => t.id === activeId);
      if (found) initialTenant = found;
      // Landing page is the default for first-time visitors!
    }

    setActiveCafe(initialTenant);
    const lic = LicenseManager.getLicenseStatus(initialTenant.id, initialTenant.name);
    setLicense(lic);
    loadTenantData(initialTenant.id);

    // Initialize Web Push Notification service & PWA Auto-Sync
    NotificationService.init();
    StorageService.initAutoSync();
  }, [loadTenantData]);

  // Background Web Push check when items update
  useEffect(() => {
    if (activeCafe && items.length > 0) {
      NotificationService.checkStockAndAlert(items, activeCafe.name);
    }
  }, [items, activeCafe]);

  const handleSelectCafe = (tenant: CafeTenant) => {
    StorageService.setActiveTenantId(tenant.id);
    setActiveCafe(tenant);
    const lic = LicenseManager.getLicenseStatus(tenant.id, tenant.name);
    setLicense(lic);
    setCurrentUser(null);
    loadTenantData(tenant.id);
    showToast(`Switched active cafe to ${tenant.name}`, 'ok');
  };

  const refreshLicense = useCallback(() => {
    if (!activeCafe) return;
    const lic = LicenseManager.getLicenseStatus(activeCafe.id, activeCafe.name);
    setLicense(lic);
  }, [activeCafe]);

  // Auth
  const handleVerifyPin = (pin: string) => {
    if (!activeCafe) return { success: false, message: 'No cafe selected' };
    return StorageService.verifyPin(activeCafe.id, pin);
  };

  const handleLoginSuccess = (user: Employee) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setCurrentTab('overview');
    } else {
      setCurrentTab('take');
    }
    showToast(`Welcome back, ${user.name}!`, 'ok');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentTab('take');
    setAppMode('landing');
    showToast('Signed out of terminal.', 'ok');
  };

  // Launch Super Admin directly
  const handleOpenSuperAdmin = () => {
    // Elevate to dedicated Platform Super Admin account with role: 'superadmin'
    const superAdminUser: Employee = {
      id: 'super-admin-01',
      name: 'Platform Super Admin',
      pin: '1111',
      role: 'superadmin',
      active: true
    };
    setCurrentUser(superAdminUser);
    setAppMode('superadmin');
    setCurrentTab('superadmin');
    showToast('Launched Super Admin SaaS Console.', 'ok');
  };

  // Strict multi-tenant security: store admin can NEVER see superadmin
  useEffect(() => {
    if (!currentUser) return;
    if (currentTab === 'superadmin' && currentUser.role !== 'superadmin') {
      setCurrentTab('overview');
    }
    if (currentTab === 'audit' && currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
      setCurrentTab('overview');
    }
    if (currentTab === 'team' && currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
      setCurrentTab('overview');
    }
    if (currentTab === 'license' && currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
      setCurrentTab('overview');
    }
  }, [currentTab, currentUser]);

  // Multi-branch calculation: Only multi-branch organizations can switch between their own branches
  const availableBranches = useMemo(() => {
    if (!activeCafe) return [];
    if (currentUser?.role === 'superadmin') return tenants;
    if (activeCafe.organizationId) {
      return tenants.filter(t => t.organizationId === activeCafe.organizationId);
    }
    if (activeCafe.isMultiBranch) {
      return tenants.filter(t => t.id.startsWith('nile-') && activeCafe.id.startsWith('nile-'));
    }
    return [activeCafe];
  }, [activeCafe, tenants, currentUser]);

  // Stock Actions
  const handleConfirmTake = (cart: { name: string; qty: number }[], destination?: string) => {
    if (!activeCafe || !currentUser) return;
    const targetDest = destination || 'Bar / Espresso Station';
    const res = StorageService.recordStockOut(activeCafe.id, cart, currentUser.name, targetDest);
    if (res.success) {
      showToast(`Recorded take: ${res.count} items replenished to ${targetDest}.`, 'ok');
      loadTenantData(activeCafe.id);
    }
  };

  const handleRecordStockIn = (itemName: string, qty: number, supplier: string, invoice?: string) => {
    if (!activeCafe || !currentUser) return;
    const res = StorageService.recordStockIn(activeCafe.id, itemName, qty, supplier, currentUser.name, invoice);
    if (res.success) {
      showToast(`Added ${qty} units of ${itemName}. New stock: ${res.newStock}.`, 'ok');
      loadTenantData(activeCafe.id);
      setCurrentTab('stock');
    }
  };

  const handleRecordWaste = (
    itemName: string,
    qty: number,
    reason: string,
    shift?: 'Morning' | 'Afternoon' | 'Night'
  ) => {
    if (!activeCafe || !currentUser) return;
    const res = StorageService.recordWaste(activeCafe.id, itemName, qty, reason, currentUser.name, shift);
    if (res.success) {
      showToast(`Waste recorded for ${itemName}. Remaining: ${res.newStock}.`, 'ok');
      loadTenantData(activeCafe.id);
    }
  };

  const handleRecordCount = (
    type: 'night' | 'week',
    itemName: string,
    physicalQty: number,
    notes?: string,
    dateVal?: string
  ) => {
    if (!activeCafe || !currentUser) return;
    const res = StorageService.recordCount(activeCafe.id, type, itemName, physicalQty, currentUser.name, notes, dateVal);
    if (res.success) {
      const diffSign = res.difference > 0 ? `+${res.difference}` : `${res.difference}`;
      showToast(`Stock count recorded for ${itemName}. Variance: ${diffSign}.`, 'ok');
      loadTenantData(activeCafe.id);
    }
  };

  const handleAddItem = (newItem: Partial<StockItem>) => {
    if (!activeCafe) return;
    const item: StockItem = {
      id: 'item-' + Date.now(),
      name: newItem.name || 'New Item',
      category: newItem.category || 'General',
      unit: newItem.unit || 'pcs',
      openingStock: newItem.openingStock || 0,
      currentStock: newItem.currentStock || 0,
      minLevel: newItem.minLevel || 0,
      maxLevel: newItem.maxLevel || 0,
      totalIn: 0,
      totalOut: 0,
      totalWaste: 0,
      unitCost: newItem.unitCost || 0,
      supplierId: newItem.supplierId,
      barcode: newItem.barcode || `NL-${newItem.name?.substring(0, 4).toUpperCase() || 'ITEM'}-${Math.floor(10 + Math.random() * 90)}`,
      sku: newItem.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`,
      lastUpdated: new Date().toISOString()
    };
    StorageService.updateItem(activeCafe.id, item);
    showToast(`Added ${item.name} to Master Stock catalog!`, 'ok');
    loadTenantData(activeCafe.id);
  };

  // Team Actions
  const handleAddEmployee = (name: string, pin: string, role: any) => {
    if (!activeCafe) return;
    const newEmp: Employee = {
      id: 'emp-' + Date.now(),
      name,
      pin,
      role,
      active: true
    };
    const updated = [...employees, newEmp];
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast(`Added ${name} as ${role}!`, 'ok');
  };

  const handleToggleActive = (id: string, active: boolean) => {
    if (!activeCafe) return;
    const updated = employees.map(e => (e.id === id ? { ...e, active } : e));
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast('Employee status updated.', 'ok');
  };

  const handleDeleteEmployee = (id: string) => {
    if (!activeCafe) return;
    const updated = employees.filter(e => e.id !== id);
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast('Employee removed.', 'ok');
  };

  // Bulk Catalog Import
  const handleImportItems = (importedItems: StockItem[]) => {
    if (!activeCafe) return;
    StorageService.saveItems(activeCafe.id, importedItems);
    setItems(importedItems);
    showToast(`Updated catalog with ${importedItems.length} items from spreadsheet!`, 'ok');
  };

  // Super Admin SaaS Actions
  const handleSaveTenants = (updatedTenants: CafeTenant[]) => {
    setTenants(updatedTenants);
    localStorage.setItem('barstock_v2_tenants', JSON.stringify(updatedTenants));
    // If active cafe was edited, sync
    if (activeCafe) {
      const found = updatedTenants.find(t => t.id === activeCafe.id);
      if (found) setActiveCafe(found);
    }
  };

  const handleSavePlans = (updatedPlans: SubscriptionPlan[]) => {
    setPlans(updatedPlans);
    localStorage.setItem('nilelink_plans', JSON.stringify(updatedPlans));
  };

  // Live Calculated Metrics
  const metrics = useMemo(() => {
    if (!activeCafe) {
      return {
        totalUnits: 0,
        totalItems: 0,
        needToOrder: 0,
        healthyCount: 0,
        totalReceived: 0,
        totalTaken: 0,
        totalWaste: 0,
        totalValue: 0
      };
    }
    return StorageService.getMetrics(activeCafe.id);
  }, [activeCafe, items]);

  const reorderCount = metrics.needToOrder;

  if (!activeCafe) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
        Loading NileLink Stock Platform...
      </div>
    );
  }

  // 1. PUBLIC VISITOR SAAS LANDING PAGE (First visit / home)
  if (appMode === 'landing') {
    return (
      <>
        <LandingPage
          tenants={tenants}
          plans={plans}
          onLaunchStore={(tenant, user) => {
            setActiveCafe(tenant);
            loadTenantData(tenant.id);
            if (user) {
              setCurrentUser(user);
              setCurrentTab(user.role === 'admin' ? 'overview' : 'take');
            } else {
              setCurrentUser(null);
            }
            setAppMode('store');
          }}
          onLaunchSuperAdmin={() => {
            handleOpenSuperAdmin();
          }}
          onNewTenantRegistered={newTenant => {
            const updated = [newTenant, ...tenants];
            setTenants(updated);
            StorageService.saveTenants(updated);
            setActiveCafe(newTenant);
            loadTenantData(newTenant.id);
            showToast(`Registered ${newTenant.name}! 14-day trial active.`, 'ok');
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // 2. DEDICATED SUPER ADMIN SAAS COMMAND CENTER
  if (appMode === 'superadmin') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6 text-slate-100 flex flex-col">
        <SuperAdminPortal
          tenants={tenants}
          plans={plans}
          onSaveTenants={handleSaveTenants}
          onSavePlans={handleSavePlans}
          onSelectCafe={tenant => {
            handleSelectCafe(tenant);
            setAppMode('store');
          }}
          onShowToast={showToast}
          onGoToLanding={() => setAppMode('landing')}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // 3. STORE TERMINAL: PIN LOGIN (when user is not yet authenticated with PIN)
  if (!currentUser) {
    return (
      <>
        <PinLogin
          cafe={activeCafe}
          tenants={tenants}
          onSelectCafe={handleSelectCafe}
          license={license}
          onVerifyPin={handleVerifyPin}
          onLoginSuccess={handleLoginSuccess}
          onLicenseRenewed={refreshLicense}
          onOpenSuperAdmin={handleOpenSuperAdmin}
          onGoToLanding={() => setAppMode('landing')}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // 4. AUTHENTICATED STORE WORKSPACE
  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${
      !syncStatus.isOnline
        ? 'bg-amber-50/40 text-slate-900'
        : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Bar Contract Header */}
      <Header
        user={currentUser}
        cafe={activeCafe}
        license={license}
        availableBranches={availableBranches}
        onSelectBranch={handleSelectCafe}
        onLogout={handleLogout}
        onOpenLicenseModal={() => setCurrentTab('license')}
        onOpenSuperAdmin={currentUser.role === 'superadmin' ? () => setAppMode('superadmin') : undefined}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onReturnToSuperAdmin={currentUser.role === 'superadmin' ? () => setAppMode('superadmin') : undefined}
        onOpenNotificationsModal={() => setIsNotificationModalOpen(true)}
        onGoToLanding={() => setAppMode('landing')}
      />

      {/* Navigation Bars */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        userRole={currentUser.role}
        reorderCount={reorderCount}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-16">
        {currentTab === 'take' && (
          <TakeItemsScreen
            items={items}
            onConfirmTake={handleConfirmTake}
            staffName={currentUser.name}
            cafeName={activeCafe.name}
          />
        )}

        {currentTab === 'overview' && (
          <DashboardScreen
            cafe={activeCafe}
            items={items}
            metrics={metrics}
            onNavigateTab={setCurrentTab}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'audit' && (
          <SmartInventoryAuditScreen
            items={items}
            stockOutLogs={stockOutLogs}
            stockInLogs={stockInLogs}
            wasteLogs={wasteLogs}
            stockCounts={stockCounts}
            cafeName={activeCafe.name}
            adminName={currentUser.name}
            onReconcileItem={(itemName, newQty, notes) => {
              handleRecordCount('night', itemName, newQty, notes);
            }}
            onLogShrinkageAsWaste={(itemName, missingQty, reason) => {
              handleRecordWaste(itemName, missingQty, reason);
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'stock' && (
          <StockLevelsScreen
            items={items}
            cafeName={activeCafe.name}
            stockOutLogs={stockOutLogs}
            onOpenAddItem={() => setIsAddItemOpen(true)}
            onOpenMLPredictions={() => setCurrentTab('prediction')}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'prediction' && (
          <MLStockPredictionScreen
            items={items}
            suppliers={suppliers}
            stockOutLogs={stockOutLogs}
            wasteLogs={wasteLogs}
            cafeName={activeCafe.name}
            currency={activeCafe.currency || '$'}
            onNavigateToAutoOrder={prefill => {
              setPrefillAutoOrderItems(prefill);
              setCurrentTab('autoorder');
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'transfer' && (
          <BranchTransferScreen
            currentCafe={activeCafe}
            availableBranches={availableBranches}
            currentItems={items}
            transfers={branchTransfers}
            adminName={currentUser.name}
            currency={activeCafe.currency || '$'}
            onTransferComplete={() => {
              loadTenantData(activeCafe.id);
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'excel' && (
          <ExcelTemplateHub
            cafe={activeCafe}
            items={items}
            suppliers={suppliers}
            onImportItems={handleImportItems}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'stockin' && (
          <StockInScreen
            items={items}
            suppliers={suppliers}
            onRecordStockIn={handleRecordStockIn}
            staffName={currentUser.name}
          />
        )}

        {currentTab === 'waste' && (
          <WasteScreen
            items={items}
            wasteLogs={wasteLogs}
            onRecordWaste={handleRecordWaste}
            staffName={currentUser.name}
            currency={activeCafe.currency || '$'}
          />
        )}

        {currentTab === 'autoorder' && (
          <AutoOrderScreen
            items={items}
            suppliers={suppliers}
            cafeName={activeCafe.name}
            stockOutLogs={stockOutLogs}
            wasteLogs={wasteLogs}
            prefillItemNames={prefillAutoOrderItems}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'count' && (
          <StockCountScreen
            items={items}
            counts={stockCounts}
            onRecordCount={handleRecordCount}
            staffName={currentUser.name}
          />
        )}

        {currentTab === 'history' && (
          <HistoryScreen
            logs={stockOutLogs}
            staffName={currentUser.name}
            items={items}
            cafeName={activeCafe.name}
            userRole={currentUser.role}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'suppliers' && (
          <SuppliersScreen suppliers={suppliers} />
        )}

        {currentTab === 'team' && (
          <TeamScreen
            employees={employees}
            onAddEmployee={handleAddEmployee}
            onToggleActive={handleToggleActive}
            onDeleteEmployee={handleDeleteEmployee}
          />
        )}

        {currentTab === 'superadmin' && (
          <SuperAdminPortal
            tenants={tenants}
            plans={plans}
            onSaveTenants={handleSaveTenants}
            onSavePlans={handleSavePlans}
            onSelectCafe={handleSelectCafe}
            onShowToast={showToast}
            onGoToLanding={() => setAppMode('landing')}
          />
        )}

        {currentTab === 'license' && (
          <LicenseScreen
            license={license}
            activeCafe={activeCafe}
            tenants={tenants}
            onRenewLicense={refreshLicense}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onAddItem={handleAddItem}
        suppliers={suppliers}
      />

      {/* Web Push Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        cafeName={activeCafe.name}
        onShowToast={showToast}
      />

      {/* Offline Pending Sync Modal */}
      <PendingSyncModal
        cafeId={activeCafe.id}
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => loadTenantData(activeCafe.id)}
        onShowToast={showToast}
      />

      {/* Floating Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
