import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { ApiService } from './services/apiService';
import { SuperAdminLogin } from './components/SuperAdminLogin';
import { DEFAULT_PUBLIC_SITE_CONTENT, PublicSiteContent } from './types/content';
import { OwnerLogin } from './components/OwnerLogin';
import { WorkforceScreen } from './components/WorkforceScreen';

export default function App() {
  // Navigation Mode: 'landing' (public SaaS visitor) | 'store' (active POS/terminal) | 'superadmin' (platform owner)
  const [appMode, setAppMode] = useState<'landing' | 'store' | 'superadmin' | 'ownerLogin'>('landing');

  // Tenants & SaaS Plans
  const [tenants, setTenants] = useState<CafeTenant[]>([]);
  const [activeCafe, setActiveCafe] = useState<CafeTenant | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [publicContent, setPublicContent] = useState<PublicSiteContent>(DEFAULT_PUBLIC_SITE_CONTENT);
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
  const inventoryLoadVersion = useRef(0);

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
    inventoryLoadVersion.current++;
    setItems(StorageService.getItems(cafeId));
    setSuppliers(StorageService.getSuppliers(cafeId));
    setEmployees(StorageService.getEmployees(cafeId));
    setStockOutLogs(StorageService.getStockOutLogs(cafeId));
    setStockInLogs(StorageService.getStockInLogs(cafeId));
    setWasteLogs(StorageService.getWasteLogs(cafeId));
    setStockCounts(StorageService.getStockCounts(cafeId));
    setBranchTransfers(StorageService.getBranchTransfers(cafeId));
  }, []);

  const loadInventoryFromServer = useCallback(async (tenantId: string) => {
    const requestVersion = ++inventoryLoadVersion.current;
    try {
      const serverItems = await ApiService.getInventory(tenantId);
      if (requestVersion !== inventoryLoadVersion.current) return;
      if (serverItems.length === 0) {
        const cachedItems = StorageService.getItems(tenantId);
        if (cachedItems.length > 0) {
          const includedOperationIds = StorageService.getPendingQueue()
            .filter(action => action.cafeId === tenantId &&
              (action.status === 'pending' || action.status === 'failed' || action.status === 'syncing'))
            .map(action => action.id);
          await ApiService.saveInventory(tenantId, cachedItems, [...new Set(includedOperationIds)]);
          if (requestVersion !== inventoryLoadVersion.current) return;
          return;
        }
      }
      StorageService.saveItems(tenantId, serverItems);
      setItems(serverItems);
    } catch (error) {
      console.error('Could not load authoritative inventory:', error);
    }
  }, []);

  // Initialize tenants and load active tenant data (support URL access code)
  useEffect(() => {
    const loadedTenants = StorageService.getTenants();
    setTenants(loadedTenants);

    ApiService.getPlans().then(setPlans).catch(error => {
      if (!import.meta.env.DEV) console.error('Could not load published plans:', error);
    });
    ApiService.getPublicContent().then(setPublicContent).catch(error => {
      if (!import.meta.env.DEV) console.error('Could not load published site content:', error);
    });

    // Production Super Admin sign-in has no public button; open the private ?mode=superadmin URL directly.
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    const tenantParam = urlParams.get('tenant');
    const modeParam = urlParams.get('mode');

    let initialTenant = loadedTenants[0] || null;
    if (import.meta.env.DEV && codeParam) {
      const matched = loadedTenants.find(
        t => t.accessCode?.toUpperCase() === codeParam.trim().toUpperCase()
      );
      if (matched) {
        initialTenant = matched;
        StorageService.setActiveTenantId(matched.id);
        setAppMode('store');
      }
    } else if (import.meta.env.DEV && modeParam === 'store') {
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

    if (!import.meta.env.DEV && tenantParam) {
      ApiService.lookupTenant(tenantParam).then(tenant => {
        setActiveCafe(tenant);
        setLicense(LicenseManager.getLicenseStatus(tenant.id, tenant.name));
        loadTenantData(tenant.id);
        setAppMode('store');
      }).catch(error => {
        console.error('Could not open the requested terminal workspace:', error);
      });
    }

    setActiveCafe(initialTenant);
    if (initialTenant) {
      const lic = LicenseManager.getLicenseStatus(initialTenant.id, initialTenant.name);
      setLicense(lic);
      loadTenantData(initialTenant.id);
    }

    // Initialize Web Push Notification service & PWA Auto-Sync
    NotificationService.init();
    StorageService.initAutoSync();

    ApiService.getSession().then(user => {
      if (user?.role === 'platform_admin') {
        setCurrentUser({
          id: user.id,
          name: user.name,
          pin: '',
          role: 'superadmin',
          active: true
        });
        setAppMode('superadmin');
        ApiService.getTenants().then(setTenants).catch(error => {
          console.error('Could not load managed tenants:', error);
        });
      } else if (user?.tenantId && ['owner', 'admin', 'manager', 'teamlead', 'staff'].includes(user.role)) {
        ApiService.getTenants().then(accountTenants => {
          const tenant = accountTenants.find(entry => entry.id === user.tenantId);
          if (!tenant) throw new Error('The signed-in account has no accessible business.');
          setTenants(accountTenants);
          setActiveCafe(tenant);
          setLicense(LicenseManager.getLicenseStatus(tenant.id, tenant.name));
          loadTenantData(tenant.id);
          void loadInventoryFromServer(tenant.id);
          setCurrentUser({
            id: user.id,
            name: user.name,
            pin: '',
            role: user.role === 'owner' ? 'admin' : user.role as Employee['role'],
            active: true
          });
          setCurrentTab(user.role === 'staff' || user.role === 'teamlead' ? 'take' : 'overview');
          if (user.role === 'owner' || user.role === 'admin' || user.role === 'manager') {
            ApiService.getEmployees(tenant.id).then(setEmployees).catch(error => {
              console.error('Could not load team members:', error);
            });
          }
          setAppMode('store');
        }).catch(error => {
          console.error('Could not restore owner session:', error);
        });
      }
    }).catch(error => {
      if (!import.meta.env.DEV) console.error('Could not restore authenticated session:', error);
    });
  }, [loadInventoryFromServer, loadTenantData]);

  // Background Web Push check when items update
  useEffect(() => {
    if (activeCafe && items.length > 0) {
      NotificationService.checkStockAndAlert(items, activeCafe.name);
    }
  }, [items, activeCafe]);

  useEffect(() => {
    const handleInventorySync = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantIds?: string[] }>).detail;
      if (activeCafe && detail?.tenantIds?.includes(activeCafe.id)) {
        void loadInventoryFromServer(activeCafe.id);
      }
    };
    window.addEventListener('nilelink:inventory-synced', handleInventorySync);
    return () => window.removeEventListener('nilelink:inventory-synced', handleInventorySync);
  }, [activeCafe, loadInventoryFromServer]);

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
  const handleVerifyPin = async (pin: string) => {
    if (!activeCafe) return { success: false, message: 'No cafe selected' };
    if (import.meta.env.DEV) return StorageService.verifyPin(activeCafe.id, pin);
    try {
      const user = await ApiService.signInWithPin(activeCafe.id, pin);
      if (!['owner', 'admin', 'manager', 'teamlead', 'staff'].includes(user.role)) {
        await ApiService.signOut();
        return { success: false, message: 'This account cannot access terminal sign-in.' };
      }
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          pin: '',
          role: user.role === 'owner' ? 'admin' : user.role as Employee['role'],
          active: true
        }
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Sign-in failed.' };
    }
  };

  const handleLoginSuccess = (user: Employee) => {
    setCurrentUser(user);
    if (!import.meta.env.DEV && activeCafe) void loadInventoryFromServer(activeCafe.id);
    if (!import.meta.env.DEV && activeCafe && ['admin', 'manager'].includes(user.role)) {
      ApiService.getEmployees(activeCafe.id).then(setEmployees).catch(error => {
        showToast(error instanceof Error ? error.message : 'Could not load team members.', 'err');
      });
    }
    if (user.role === 'admin') {
      setCurrentTab('overview');
    } else {
      setCurrentTab('take');
    }
    showToast(`Welcome back, ${user.name}!`, 'ok');
  };

  const handleLogout = () => {
    ApiService.signOut().catch(error => showToast(error.message, 'err'));
    setCurrentUser(null);
    setCurrentTab('take');
    setAppMode('landing');
    showToast('Signed out of terminal.', 'ok');
  };

  const handleSuperAdminLogin = async (email: string, password: string, totp: string) => {
    const user = await ApiService.signIn(email, password, totp);
    if (user.role !== 'platform_admin') {
      await ApiService.signOut();
      throw new Error('This account is not authorized for platform administration.');
    }
    const managedTenants = await ApiService.getTenants();
    setTenants(managedTenants);
    setCurrentUser({
      id: user.id,
      name: user.name,
      pin: '',
      role: 'superadmin',
      active: true
    });
    setAppMode('superadmin');
    setCurrentTab('superadmin');
  };

  const handleOwnerLogin = async (email: string, password: string) => {
    const user = await ApiService.signIn(email, password);
    if (!user.tenantId || !['owner', 'admin'].includes(user.role)) {
      await ApiService.signOut();
      throw new Error('This account cannot access a business workspace.');
    }
    const accountTenants = await ApiService.getTenants();
    const tenant = accountTenants.find(entry => entry.id === user.tenantId);
    if (!tenant) {
      await ApiService.signOut();
      throw new Error('No business workspace is available for this account.');
    }
    setTenants(accountTenants);
    setActiveCafe(tenant);
    setLicense(LicenseManager.getLicenseStatus(tenant.id, tenant.name));
    loadTenantData(tenant.id);
    void loadInventoryFromServer(tenant.id);
    ApiService.getEmployees(tenant.id).then(setEmployees).catch(error => {
      showToast(error instanceof Error ? error.message : 'Could not load team members.', 'err');
    });
    setCurrentUser({ id: user.id, name: user.name, pin: '', role: 'admin', active: true });
    setCurrentTab('overview');
    setAppMode('store');
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
  const handleAddEmployee = async (
    name: string,
    pin: string,
    role: Exclude<Employee['role'], 'admin' | 'superadmin'>,
    compensation: {
      payType: 'hourly' | 'salary';
      payRateMinor: number;
      payPeriod: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual';
      currency: string;
    }
  ) => {
    if (!activeCafe) return;
    if (!import.meta.env.DEV) {
      try {
        const created = await ApiService.createEmployee({
          tenantId: activeCafe.id,
          name,
          pin,
          role,
          ...compensation
        });
        setEmployees(current => [...current, created]);
        showToast(`Added ${name} as ${role}.`, 'ok');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not add this team member.', 'err');
        throw error;
      }
      return;
    }
    const newEmp: Employee = {
      id: 'emp-' + Date.now(),
      name,
      pin,
      role,
      active: true,
      ...compensation
    };
    const updated = [...employees, newEmp];
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast(`Added ${name} as ${role}!`, 'ok');
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    if (!activeCafe) return;
    if (!import.meta.env.DEV) {
      try {
        await ApiService.updateEmployee(activeCafe.id, id, { active });
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not update this team member.', 'err');
        return;
      }
    }
    const updated = employees.map(e => (e.id === id ? { ...e, active } : e));
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast('Employee status updated.', 'ok');
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!activeCafe) return;
    if (!import.meta.env.DEV) {
      try {
        await ApiService.updateEmployee(activeCafe.id, id, { active: false });
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not deactivate this team member.', 'err');
        return;
      }
    }
    const updated = employees.filter(e => e.id !== id);
    StorageService.saveEmployees(activeCafe.id, updated);
    setEmployees(updated);
    showToast('Employee removed.', 'ok');
  };

  // Bulk Catalog Import
  const handleImportItems = async (importedItems: StockItem[]) => {
    if (!activeCafe) return;
    if (!import.meta.env.DEV) {
      try {
        await ApiService.saveInventory(activeCafe.id, importedItems);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save inventory to the server.', 'err');
        return;
      }
    }
    StorageService.saveItems(activeCafe.id, importedItems);
    setItems(importedItems);
    showToast(`Updated catalog with ${importedItems.length} items from spreadsheet!`, 'ok');
  };

  // Super Admin SaaS Actions
  const handleSaveTenants = async (updatedTenants: CafeTenant[]) => {
    const previousById = new Map(tenants.map(tenant => [tenant.id, tenant]));
    const updatedById = new Map(updatedTenants.map(tenant => [tenant.id, tenant]));
    for (const tenant of updatedTenants) {
      const previous = previousById.get(tenant.id);
      if (!previous) {
        throw new Error('Creating client accounts requires the secure owner-invitation flow, which is not configured yet.');
      }
      const changes: Partial<CafeTenant> = {};
      for (const field of ['name', 'adminEmail', 'adminPhone', 'city', 'planId', 'paidUntil', 'status', 'currency'] as const) {
        if (previous[field] !== tenant[field]) Object.assign(changes, { [field]: tenant[field] });
      }
      if (Object.keys(changes).length) {
        await ApiService.updateTenant(tenant.id, changes);
      }
    }
    for (const previous of tenants) {
      if (!updatedById.has(previous.id)) {
        await ApiService.updateTenant(previous.id, { status: 'SUSPENDED' });
      }
    }
    const savedTenants = await ApiService.getTenants();
    setTenants(savedTenants);
    if (activeCafe) {
      const found = savedTenants.find(tenant => tenant.id === activeCafe.id);
      if (found) setActiveCafe(found);
    }
  };

  const handleSavePlans = async (updatedPlans: SubscriptionPlan[]) => {
    const previousById = new Map(plans.map(plan => [plan.id, plan]));
    const updatedById = new Map(updatedPlans.map(plan => [plan.id, plan]));
    for (const plan of updatedPlans) {
      const previous = previousById.get(plan.id);
      if (!previous) {
        await ApiService.createPlan(plan);
      } else if (JSON.stringify(previous) !== JSON.stringify(plan)) {
        await ApiService.updatePlan(plan);
      }
    }
    for (const previous of plans) {
      if (!updatedById.has(previous.id)) {
        await ApiService.updatePlan(previous, false);
      }
    }
    setPlans(await ApiService.getPlans());
  };

  // Live Calculated Metrics
  const metrics = useMemo(() => {
    if (!activeCafe && appMode === 'store') {
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
    return activeCafe ? StorageService.getMetrics(activeCafe.id) : {
      totalUnits: 0,
      totalItems: 0,
      needToOrder: 0,
      healthyCount: 0,
      totalReceived: 0,
      totalTaken: 0,
      totalWaste: 0,
      totalValue: 0
    };
  }, [activeCafe, items]);

  const reorderCount = metrics.needToOrder;

  // 1. PUBLIC VISITOR SAAS LANDING PAGE (First visit / home)
  if (appMode === 'landing') {
    return (
      <>
        <LandingPage
          tenants={tenants}
          plans={plans}
          publicContent={publicContent}
          onLaunchStore={(tenant, user) => {
            setActiveCafe(tenant);
            loadTenantData(tenant.id);
            if (user) {
              setCurrentUser(user);
              if (!import.meta.env.DEV) void loadInventoryFromServer(tenant.id);
              setCurrentTab(user.role === 'admin' ? 'overview' : 'take');
            } else {
              setCurrentUser(null);
            }
            setAppMode('store');
          }}
          onOwnerLogin={() => setAppMode('ownerLogin')}
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

  if (appMode === 'ownerLogin') {
    return <OwnerLogin onSubmit={handleOwnerLogin} onBack={() => setAppMode('landing')} />;
  }

  // 2. Super Admin authentication precedes the private console.
  if (appMode === 'superadmin') {
    if (currentUser?.role !== 'superadmin') {
      return <SuperAdminLogin onSubmit={handleSuperAdminLogin} onBack={() => setAppMode('landing')} />;
    }
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6 text-slate-100 flex flex-col">
        <SuperAdminPortal
          tenants={tenants}
          plans={plans}
          publicContent={publicContent}
          onSavePublicContent={async (content, publish) => {
            await ApiService.savePublicContent(content, publish);
            if (publish) setPublicContent(content);
          }}
          onChangePassword={(currentPassword, newPassword, totp) =>
            ApiService.changePassword(currentPassword, newPassword, totp)}
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

  if (!activeCafe) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
        Loading NileLink Stock Platform...
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

        {currentTab === 'transfer' && import.meta.env.DEV && (
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

        {currentTab === 'transfer' && !import.meta.env.DEV && (
          <div className="m-6 rounded-2xl border border-amber-700/60 bg-amber-950/40 p-6 text-amber-100">
            <h2 className="text-lg font-bold">Branch transfers are not available yet</h2>
            <p className="mt-2 text-sm text-amber-200/80">
              Cross-branch inventory and branch setup are not yet stored in the cloud. Transfers are disabled
              here so stock cannot appear to move without being saved centrally.
            </p>
          </div>
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
            currency={activeCafe.currency || 'USD'}
            onAddEmployee={handleAddEmployee}
            onToggleActive={handleToggleActive}
            onDeleteEmployee={handleDeleteEmployee}
          />
        )}

        {currentTab === 'workforce' && (
          <WorkforceScreen tenantId={activeCafe.id} user={currentUser} onShowToast={showToast} />
        )}

        {currentTab === 'superadmin' && (
          <SuperAdminPortal
            tenants={tenants}
            plans={plans}
            publicContent={publicContent}
            onSavePublicContent={async (content, publish) => {
              await ApiService.savePublicContent(content, publish);
              if (publish) setPublicContent(content);
            }}
            onChangePassword={(currentPassword, newPassword, totp) =>
              ApiService.changePassword(currentPassword, newPassword, totp)}
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
