import { CafeTenant, SubscriptionPlan } from '../types/stock';
import { StorageService } from './storageService';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../data/initialData';

export class ApiService {
  private static baseUrl = '/api';

  public static async getTenants(): Promise<CafeTenant[]> {
    try {
      const res = await fetch(`${this.baseUrl}/tenants`);
      if (res.ok) {
        const data = await res.json();
        if (data.tenants && Array.isArray(data.tenants)) {
          // Merge with local storage
          StorageService.saveTenants(data.tenants);
          return data.tenants;
        }
      }
    } catch {
      // Offline fallback
    }
    return StorageService.getTenants();
  }

  public static async registerTenant(payload: {
    name: string;
    adminEmail: string;
    adminPhone?: string;
    city?: string;
    planId: string;
    branchesCount?: number;
    currency?: string;
  }): Promise<{ success: boolean; tenant?: CafeTenant; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/tenants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          const current = StorageService.getTenants();
          StorageService.saveTenants([data.tenant, ...current]);
          return { success: true, tenant: data.tenant };
        }
      }
    } catch {
      // Local fallback provisioning
    }

    // Offline / Local provisioning fallback
    const plans = DEFAULT_SUBSCRIPTION_PLANS;
    const plan = plans.find(p => p.id === payload.planId) || plans[0];
    const slug = payload.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const code = `NL-${Math.floor(1000 + Math.random() * 9000)}-${slug}`;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 14);

    const localTenant: CafeTenant = {
      id: `tenant-${Date.now()}`,
      name: payload.name,
      adminEmail: payload.adminEmail,
      adminPhone: payload.adminPhone,
      city: payload.city,
      plan: plan.name,
      planId: plan.id,
      accessCode: code,
      paidUntil: expiry.toISOString().slice(0, 10),
      status: 'TRIAL',
      currency: payload.currency || '$',
      created: new Date().toISOString().slice(0, 10),
      organizationId: `org-${Date.now()}`,
      isMultiBranch: (payload.branchesCount || 1) > 1
    };

    const existing = StorageService.getTenants();
    StorageService.saveTenants([localTenant, ...existing]);
    return { success: true, tenant: localTenant };
  }

  public static async updateTenant(
    id: string,
    updates: Partial<CafeTenant>
  ): Promise<CafeTenant | null> {
    try {
      const res = await fetch(`${this.baseUrl}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          const tenants = StorageService.getTenants().map(t => (t.id === id ? data.tenant : t));
          StorageService.saveTenants(tenants);
          return data.tenant;
        }
      }
    } catch {
      // Fallback
    }

    // Local fallback
    const tenants = StorageService.getTenants().map(t => {
      if (t.id === id) {
        return { ...t, ...updates };
      }
      return t;
    });
    StorageService.saveTenants(tenants);
    return tenants.find(t => t.id === id) || null;
  }
}
