import { CafeTenant, Employee, StockItem, SubscriptionPlan, UserRole } from '../types/stock';
import { StorageService } from './storageService';
import { PublicSiteContent } from '../types/content';

export interface WorkforceTimeEntry {
  id: string;
  employeeId?: string;
  employeeName?: string;
  clockIn: string;
  clockOut?: string | null;
  breakMinutes: number;
  breakStartedAt?: string | null;
  status: 'open' | 'submitted' | 'approved' | 'rejected';
  hours?: number | null;
  grossPayMinor?: number | null;
  currency?: string;
}

export class ApiService {
  private static baseUrl = '/api';

  public static async getEmployees(tenantId: string): Promise<Employee[]> {
    const response = await fetch(`${this.baseUrl}/workforce/employees?tenantId=${encodeURIComponent(tenantId)}`, {
      credentials: 'same-origin'
    });
    const data = await this.readResponse<{ employees: Array<Employee & {
      payType?: 'hourly' | 'salary';
      payRateMinor?: number;
      payPeriod?: string;
      currency?: string;
    }> }>(response);
    return data.employees.map(employee => ({ ...employee, pin: '' }));
  }

  public static async createEmployee(input: {
    tenantId: string;
    name: string;
    role: Exclude<UserRole, 'admin' | 'superadmin'>;
    pin: string;
    payType: 'hourly' | 'salary';
    payRateMinor: number;
    payPeriod: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual';
    currency: string;
  }): Promise<Employee> {
    const response = await fetch(`${this.baseUrl}/workforce/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input)
    });
    const data = await this.readResponse<{ employee: Employee }>(response);
    return { ...data.employee, pin: '' };
  }

  public static async updateEmployee(
    tenantId: string,
    employeeId: string,
    updates: { name?: string; active?: boolean; payType?: 'hourly' | 'salary'; payRateMinor?: number; payPeriod?: string; currency?: string }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workforce/employees/${encodeURIComponent(employeeId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...updates, tenantId })
    });
    await this.readResponse(response);
  }

  public static async getMyTime(): Promise<WorkforceTimeEntry | null> {
    const response = await fetch(`${this.baseUrl}/workforce/my-time`, { credentials: 'same-origin' });
    const data = await this.readResponse<{ entry: WorkforceTimeEntry | null }>(response);
    return data.entry;
  }

  public static async recordClockAction(input: {
    tenantId: string;
    action: 'clock_in' | 'clock_out' | 'start_break' | 'end_break';
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workforce/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input)
    });
    await this.readResponse(response);
  }

  public static async getTimeEntries(tenantId: string, from: string, to: string): Promise<WorkforceTimeEntry[]> {
    const query = new URLSearchParams({ tenantId, from, to });
    const response = await fetch(`${this.baseUrl}/workforce/time-entries?${query}`, { credentials: 'same-origin' });
    const data = await this.readResponse<{ entries: WorkforceTimeEntry[] }>(response);
    return data.entries;
  }

  public static async approveTimeEntry(
    tenantId: string,
    entryId: string,
    decision: 'approved' | 'rejected'
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workforce/timesheets/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ tenantId, entryId, decision })
    });
    await this.readResponse(response);
  }

  public static async exportPayroll(tenantId: string, from: string, to: string): Promise<string> {
    const query = new URLSearchParams({ tenantId, from, to });
    const response = await fetch(`${this.baseUrl}/workforce/payroll/export?${query}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return response.text();
  }

  public static async signIn(
    email: string,
    password: string,
    totp?: string
  ): Promise<{ id: string; email: string; name: string; role: string; tenantId: string | null }> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password, totp })
    });
    const data = await this.readResponse<{ user: { id: string; email: string; name: string; role: string; tenantId: string | null } }>(response);
    return data.user;
  }

  public static async signInWithPin(
    tenantId: string,
    pin: string
  ): Promise<{ id: string; email: string; name: string; role: string; tenantId: string | null }> {
    const response = await fetch(`${this.baseUrl}/auth/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ tenantId, pin })
    });
    const data = await this.readResponse<{ user: { id: string; email: string; name: string; role: string; tenantId: string | null } }>(response);
    return data.user;
  }

  public static async getSession(): Promise<{ id: string; email: string; name: string; role: string; tenantId: string | null } | null> {
    const response = await fetch(`${this.baseUrl}/auth/me`, { credentials: 'same-origin' });
    if (response.status === 401) return null;
    const data = await this.readResponse<{ user: { id: string; email: string; name: string; role: string; tenantId: string | null } }>(response);
    return data.user;
  }

  public static async signOut(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: '{}'
    });
    await this.readResponse(response);
  }

  public static async changePassword(currentPassword: string, newPassword: string, totp: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: currentPassword, newPassword, totp })
    });
    await this.readResponse(response);
  }

  public static async getTurnstileSiteKey(): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/auth/config`);
    const data = await this.readResponse<{ turnstileSiteKey: string | null }>(response);
    return data.turnstileSiteKey;
  }

  public static async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${this.baseUrl}/plans`);
    const data = await this.readResponse<{ plans: SubscriptionPlan[] }>(response);
    if (!Array.isArray(data.plans)) throw new Error('The server returned an invalid subscription plan list.');
    return data.plans;
  }

  public static async getPublicContent(): Promise<PublicSiteContent> {
    const response = await fetch(`${this.baseUrl}/content`);
    const data = await this.readResponse<{ content: PublicSiteContent }>(response);
    return this.validatePublicSiteContent(data.content);
  }

  public static async getAdminContentDraft(): Promise<PublicSiteContent> {
    const response = await fetch(`${this.baseUrl}/content/draft`, { credentials: 'same-origin' });
    const data = await this.readResponse<{ content: PublicSiteContent }>(response);
    return this.validatePublicSiteContent(data.content);
  }

  private static validatePublicSiteContent(content: PublicSiteContent): PublicSiteContent {
    if (!content || typeof content.brandName !== 'string' || typeof content.logoUrl !== 'string' ||
        typeof content.tagline !== 'string' || typeof content.heroEyebrow !== 'string' ||
        typeof content.headline !== 'string' || typeof content.description !== 'string' ||
        !Array.isArray(content.features) || !content.features.every(feature => typeof feature === 'string') ||
        typeof content.primaryCta !== 'string' || typeof content.pricingEyebrow !== 'string' ||
        typeof content.pricingHeadline !== 'string' || typeof content.pricingDescription !== 'string' ||
        typeof content.multiBranchEyebrow !== 'string' || typeof content.multiBranchHeadline !== 'string' ||
        typeof content.multiBranchDescription !== 'string' || typeof content.featuresEyebrow !== 'string' ||
        typeof content.featuresHeadline !== 'string' || typeof content.featuresDescription !== 'string' ||
        !Array.isArray(content.featureCards) ||
        !content.featureCards.every(card => card && typeof card.title === 'string' && typeof card.description === 'string') ||
        !Array.isArray(content.marketingMetrics) ||
        !content.marketingMetrics.every(metric => metric && typeof metric.value === 'string' && typeof metric.label === 'string') ||
        !Array.isArray(content.multiBranchBenefits) ||
        !content.multiBranchBenefits.every(benefit => benefit && typeof benefit.title === 'string' && typeof benefit.description === 'string') ||
        !content.branchPreview || typeof content.branchPreview !== 'object' ||
        !Object.values(content.branchPreview).every(value => typeof value === 'string') ||
        typeof content.footerTagline !== 'string' || typeof content.trustBadge !== 'string') {
      throw new Error('The server returned invalid public website content.');
    }
    return content;
  }

  public static async getInventory(tenantId: string): Promise<StockItem[]> {
    const query = new URLSearchParams({ tenantId });
    const response = await fetch(`${this.baseUrl}/inventory?${query}`, { credentials: 'same-origin' });
    const data = await this.readResponse<{ items: StockItem[] }>(response);
    if (!Array.isArray(data.items)) throw new Error('The server returned an invalid inventory list.');
    return data.items;
  }

  public static async saveInventory(
    tenantId: string,
    items: StockItem[],
    includedOperationIds: string[] = []
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ tenantId, items, operationIds: includedOperationIds })
    });
    await this.readResponse(response);
  }

  public static async updatePlan(plan: SubscriptionPlan, published = true): Promise<SubscriptionPlan> {
    const response = await fetch(`${this.baseUrl}/plans/${encodeURIComponent(plan.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...plan, published })
    });
    const data = await this.readResponse<{ plan: SubscriptionPlan }>(response);
    return data.plan;
  }

  public static async createPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    const response = await fetch(`${this.baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(plan)
    });
    const data = await this.readResponse<{ plan: SubscriptionPlan }>(response);
    return data.plan;
  }

  public static async savePublicContent(content: PublicSiteContent, publish: boolean): Promise<void> {
    const response = await fetch(`${this.baseUrl}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ content, publish })
    });
    await this.readResponse(response);
  }

  private static async readResponse<T = unknown>(response: Response): Promise<T> {
    let data: { error?: string } & T;
    try {
      data = await response.json() as { error?: string } & T;
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`);
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  public static async getTenants(): Promise<CafeTenant[]> {
    const response = await fetch(`${this.baseUrl}/tenants`, { credentials: 'same-origin' });
    const data = await this.readResponse<{ tenants: CafeTenant[] }>(response);
    if (!Array.isArray(data.tenants)) throw new Error('The server returned an invalid tenant list.');
    StorageService.saveTenants(data.tenants);
    return data.tenants;
  }

  public static async lookupTenant(tenantId: string): Promise<CafeTenant> {
    const query = new URLSearchParams({ tenantId });
    const response = await fetch(`${this.baseUrl}/tenant/lookup?${query}`);
    const data = await this.readResponse<{ tenant: Omit<CafeTenant, 'adminEmail' | 'accessCode'> }>(response);
    return { ...data.tenant, adminEmail: '', accessCode: '' };
  }

  public static async registerTenant(payload: {
    name: string;
    ownerName: string;
    adminEmail: string;
    password: string;
    pin: string;
    turnstileToken: string;
    adminPhone?: string;
    city?: string;
    planId: string;
    currency?: string;
  }): Promise<{
    success: true;
    tenant: CafeTenant;
    user: { id: string; email: string; name: string; role: string; tenantId: string };
  }> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...payload, email: payload.adminEmail })
    });
    const data = await this.readResponse<{
      tenant: CafeTenant;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>(response);
    if (!data.tenant || !data.user) throw new Error('The server returned an incomplete registration response.');
    StorageService.saveTenants([data.tenant]);
    return { success: true, tenant: data.tenant, user: data.user };
  }

  public static async updateTenant(
    id: string,
    updates: Partial<CafeTenant>
  ): Promise<CafeTenant | null> {
    try {
      const res = await fetch(`${this.baseUrl}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          const tenants = StorageService.getTenants().map(t => (t.id === id ? data.tenant : t));
          StorageService.saveTenants(tenants);
          return data.tenant;
        }
        await this.readResponse(res);
      }
    } catch (error) {
      if (!import.meta.env.DEV) throw error;
    }

    if (!import.meta.env.DEV) throw new Error('Local tenant updates are disabled outside development.');

    // Development-only preview update.
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
