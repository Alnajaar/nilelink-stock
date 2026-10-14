import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  Building2,
  CreditCard,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Search,
  KeyRound,
  Sparkles,
  Link2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Pencil
} from 'lucide-react';
import { CafeTenant, SubscriptionPlan } from '../types/stock';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../data/initialData';
import { PublicSiteContent } from '../types/content';

interface SuperAdminPortalProps {
  tenants: CafeTenant[];
  plans: SubscriptionPlan[];
  onSaveTenants: (tenants: CafeTenant[]) => Promise<void>;
  onSavePlans: (plans: SubscriptionPlan[]) => Promise<void>;
  publicContent: PublicSiteContent;
  onLoadPublicContentDraft: () => Promise<PublicSiteContent>;
  onSavePublicContent: (content: PublicSiteContent, publish: boolean) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string, totp: string) => Promise<void>;
  onSelectCafe: (tenant: CafeTenant) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
  onGoToLanding?: () => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  tenants,
  plans,
  onSaveTenants,
  onSavePlans,
  publicContent,
  onLoadPublicContentDraft,
  onSavePublicContent,
  onChangePassword,
  onSelectCafe,
  onShowToast,
  onGoToLanding
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'plans' | 'content' | 'security' | 'deploy'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Edit Client Modal
  const [editingTenant, setEditingTenant] = useState<CafeTenant | null>(null);

  // New Client Modal
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientPlanId, setNewClientPlanId] = useState(plans[1]?.id || 'plan-pro');
  const [newClientDays, setNewClientDays] = useState('30');
  const [newClientCurrency, setNewClientCurrency] = useState('$');

  // New Plan Modal
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('49');
  const [planPeriod, setPlanPeriod] = useState<'monthly' | 'quarterly' | 'annual' | 'lifetime'>('monthly');
  const [planTerminals, setPlanTerminals] = useState('2');
  const [planMaxItems, setPlanMaxItems] = useState('150');
  const [planDesc, setPlanDesc] = useState('');
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [contentDraft, setContentDraft] = useState(publicContent);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isLoadingContentDraft, setIsLoadingContentDraft] = useState(true);
  const [contentDraftError, setContentDraftError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordTotp, setPasswordTotp] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const loadContentDraft = useCallback(async () => {
    setIsLoadingContentDraft(true);
    setContentDraftError('');
    try {
      setContentDraft(await onLoadPublicContentDraft());
    } catch (error) {
      setContentDraftError(error instanceof Error ? error.message : 'Could not load the saved website draft.');
    } finally {
      setIsLoadingContentDraft(false);
    }
  }, [onLoadPublicContentDraft]);

  useEffect(() => {
    void loadContentDraft();
  }, [loadContentDraft]);

  const updateContentField = <K extends keyof PublicSiteContent>(key: K, value: PublicSiteContent[K]) => {
    setContentDraft(current => ({ ...current, [key]: value }));
  };

  // Calculate platform financial stats
  const activeTenants = tenants.filter(t => t.status === 'ACTIVE');
  const totalMrr = activeTenants.reduce((sum, t) => {
    const plan = plans.find(p => p.id === t.planId || p.name === t.plan);
    return sum + (plan ? plan.price : 49);
  }, 0);

  const expiringSoon = tenants.filter(t => {
    const ms = new Date(t.paidUntil).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return days <= 7 && days >= 0;
  });

  // Filter clients
  const filteredTenants = tenants.filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientEmail.trim()) return;

    const slug = newClientName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const code = `NL-${Math.floor(1000 + Math.random() * 9000)}-${slug}`;
    const selectedPlan = plans.find(p => p.id === newClientPlanId) || plans[0];

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(newClientDays, 10));

    const specialLink = `${window.location.origin}?code=${code}`;

    const newTenant: CafeTenant = {
      id: 'tenant-' + Date.now(),
      name: newClientName.trim(),
      adminEmail: newClientEmail.trim(),
      adminPhone: newClientPhone.trim() || undefined,
      city: newClientCity.trim() || undefined,
      plan: selectedPlan.name,
      planId: selectedPlan.id,
      accessCode: code,
      specialLink,
      paidUntil: expiryDate.toISOString().slice(0, 10),
      status: 'ACTIVE',
      currency: newClientCurrency,
      created: new Date().toISOString().slice(0, 10)
    };

    const updated = [newTenant, ...tenants];
    void onSaveTenants(updated).then(() => {
      onShowToast(`Client ${newTenant.name} created with Access Code: ${code}`, 'ok');
      setIsAddingClient(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientCity('');
    }).catch(error => {
      onShowToast(error instanceof Error ? error.message : 'Client creation is not available.', 'err');
    });
  };

  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete customer "${tenantName}"? This action cannot be undone.`)) {
      const updated = tenants.filter(t => t.id !== tenantId);
      void onSaveTenants(updated).then(() => {
        onShowToast(`Client ${tenantName} suspended.`, 'ok');
      }).catch(error => {
        onShowToast(error instanceof Error ? error.message : 'Could not update this client.', 'err');
      });
    }
  };

  const handleSaveEditTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const selectedPlan = plans.find(p => p.id === editingTenant.planId);
    const updatedTenant: CafeTenant = {
      ...editingTenant,
      plan: selectedPlan ? selectedPlan.name : editingTenant.plan,
      planId: selectedPlan ? selectedPlan.id : editingTenant.planId
    };

    const updated = tenants.map(t => (t.id === updatedTenant.id ? updatedTenant : t));
    void onSaveTenants(updated).then(() => {
      onShowToast(`Updated details for ${updatedTenant.name}.`, 'ok');
      setEditingTenant(null);
    }).catch(error => {
      onShowToast(error instanceof Error ? error.message : 'Could not update this client.', 'err');
    });
  };

  const handleToggleStatus = (tenantId: string) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        const nextStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...t, status: nextStatus as any };
      }
      return t;
    });
    void onSaveTenants(updated).then(() => onShowToast('Client status updated.', 'ok'))
      .catch(error => onShowToast(error instanceof Error ? error.message : 'Could not update this client.', 'err'));
  };

  const handleExtendExpiry = (tenantId: string, extraDays: number) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        const base = new Date(t.paidUntil > new Date().toISOString() ? t.paidUntil : new Date());
        base.setDate(base.getDate() + extraDays);
        return { ...t, paidUntil: base.toISOString().slice(0, 10), status: 'ACTIVE' as const };
      }
      return t;
    });
    void onSaveTenants(updated).then(() => onShowToast(`Extended subscription by ${extraDays} days!`, 'ok'))
      .catch(error => onShowToast(error instanceof Error ? error.message : 'Could not update this subscription.', 'err'));
  };

  const handleSetLifetime = (tenantId: string) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        return { ...t, paidUntil: '2036-12-31', status: 'ACTIVE' as const };
      }
      return t;
    });
    void onSaveTenants(updated).then(() => onShowToast('Granted 10-year access.', 'ok'))
      .catch(error => onShowToast(error instanceof Error ? error.message : 'Could not update this subscription.', 'err'));
  };

  const handleCopySpecialLink = (tenantId: string) => {
    const link = `${window.location.origin}?tenant=${encodeURIComponent(tenantId)}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(tenantId);
      onShowToast('Terminal link copied.', 'ok');
      setTimeout(() => setCopiedLink(null), 2500);
    }).catch(() => onShowToast('Could not copy the terminal link. Copy it from the address bar instead.', 'err'));
  };

  const handleSaveContent = async (publish: boolean) => {
    setIsSavingContent(true);
    try {
      await onSavePublicContent(contentDraft, publish);
      onShowToast(publish ? 'Public content published.' : 'Draft saved privately.', 'ok');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not save public content.', 'err');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;

    const newPlan: SubscriptionPlan = {
      id: 'plan-' + Date.now(),
      name: planName.trim(),
      price: parseFloat(planPrice) || 0,
      billingPeriod: planPeriod,
      maxTerminals: parseInt(planTerminals, 10) || 1,
      maxItems: parseInt(planMaxItems, 10) || 100,
      maxBranches: 1,
      features: ['Take Screen', 'QR Scanner', 'Auto Order', 'WhatsApp Dispatch'],
      description: planDesc.trim() || 'Custom commercial subscription plan.'
    };

    try {
      await onSavePlans([...plans, newPlan]);
      onShowToast(`Plan ${newPlan.name} created!`, 'ok');
      setIsAddingPlan(false);
      setPlanName('');
      setPlanDesc('');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not save the plan.', 'err');
    }
  };

  const handleUpdatePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPlan) return;
    try {
      await onSavePlans(plans.map(plan => plan.id === editingPlan.id ? editingPlan : plan));
      onShowToast(`Plan ${editingPlan.name} updated.`, 'ok');
      setEditingPlan(null);
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not update the plan.', 'err');
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmNewPassword) {
      onShowToast('New passwords do not match.', 'err');
      return;
    }
    setIsSavingPassword(true);
    try {
      await onChangePassword(currentPassword, newPassword, passwordTotp);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordTotp('');
      onShowToast('Password updated. Other administrator sessions were signed out.', 'ok');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not change the password.', 'err');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>NileLink Stock SaaS Platform Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Super Admin SaaS Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Manage registered businesses, subscriptions, plan pricing, and published website content. New customer invitations are unavailable until secure email delivery is configured.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onGoToLanding && (
              <button
                onClick={onGoToLanding}
                className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Return to Public SaaS Landing Page"
              >
                <span>← Home / Landing</span>
              </button>
            )}

            <button
              disabled
              title="Secure owner invitations are not configured. Customers can use public self-registration."
              className="h-10 px-4 rounded-xl bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Client Invitations Not Configured</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800 text-slate-300">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Active Cafe Clients</div>
            <div className="text-2xl font-bold text-white font-mono mt-0.5">
              {activeTenants.length} <span className="text-xs text-slate-500 font-sans">/ {tenants.length}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Monthly Recurring Rev (MRR)</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">
              ${totalMrr.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Expiring This Week</div>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${expiringSoon.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {expiringSoon.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Cloud Platform</div>
            <div className="text-2xl font-bold text-blue-400 font-mono mt-0.5 flex items-center gap-1.5 text-base sm:text-xl">
              <Globe className="w-4 h-4" />
              <span>Cloudflare Edge</span>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'clients'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Client Cafes &amp; Restaurants ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'plans'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Subscription Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'deploy'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Cloudflare Deployment Guide
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'content'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Public Content
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'security'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Security
          </button>
        </div>
      </div>

      {/* TAB 1: CLIENT TENANTS */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search business name, email, or workspace ID..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 shadow-xs"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredTenants.length} customer locations
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {filteredTenants.map(tenant => {
              const msLeft = new Date(tenant.paidUntil).getTime() - Date.now();
              const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft <= 0;
              const isCopied = copiedLink === tenant.id;

              return (
                <div
                  key={tenant.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
                    tenant.status === 'SUSPENDED'
                      ? 'border-red-200 bg-red-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Cafe Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {tenant.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tenant.status}
                        </span>
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                          {tenant.plan}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5 font-sans">
                        <span>Email: <strong className="text-slate-700">{tenant.adminEmail}</strong></span>
                        {tenant.adminPhone && <span>· Tel: <strong className="text-slate-700">{tenant.adminPhone}</strong></span>}
                        {tenant.city && <span>· Location: <strong className="text-slate-700">{tenant.city}</strong></span>}
                      </div>

                      {/* Access Credentials Strip */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-400 font-medium">Terminal workspace ID:</span>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          {tenant.id}
                        </span>

                        <button
                          onClick={() => handleCopySpecialLink(tenant.id)}
                          className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors ml-1"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          <span>{isCopied ? 'Link Copied' : 'Copy Client Login Link'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Expiry & Management Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-[11px] text-slate-400">Subscription Expiry</div>
                        <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {tenant.paidUntil}
                        </div>
                        <div className={`text-[11px] font-semibold ${isExpired ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {isExpired ? 'Expired' : `${daysLeft} days remaining`}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => handleExtendExpiry(tenant.id, 30)}
                          className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          title="Add 30 days"
                        >
                          +30d
                        </button>

                        <button
                          onClick={() => handleExtendExpiry(tenant.id, 365)}
                          className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          title="Grant 1 Year"
                        >
                          +1yr
                        </button>

                        <button
                          onClick={() => handleSetLifetime(tenant.id)}
                          className="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors border border-amber-200/60"
                          title="Grant 10-year Lifetime founder license"
                        >
                          Lifetime
                        </button>

                        <button
                          onClick={() => setEditingTenant(tenant)}
                          className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          title="Edit client parameters"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleToggleStatus(tenant.id)}
                          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-red-50 hover:bg-red-100 text-red-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                          title={tenant.status === 'ACTIVE' ? 'Suspend terminal' : 'Unsuspend terminal'}
                        >
                          {tenant.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          <span>{tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors"
                          title="Delete client permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onSelectCafe(tenant)}
                          className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                          title="Open cafe terminal directly"
                        >
                          <span>Open Terminal</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Public website content and branding</h3>
            <p className="text-xs text-slate-500 mt-1">Manage the public home page, pricing copy, feature cards, brand, and logo. Plan names, prices, limits, and included features are managed in Subscription Plans. Drafts stay private until published.</p>
          </div>
          {isLoadingContentDraft && (
            <p role="status" className="text-xs text-slate-500">Loading saved private draft…</p>
          )}
          {contentDraftError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {contentDraftError}{' '}
              <button type="button" onClick={() => void loadContentDraft()} className="font-bold underline">
                Retry
              </button>
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-xs font-semibold text-slate-700">
              Brand name
              <input value={contentDraft.brandName} maxLength={80} onChange={event => updateContentField('brandName', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Logo URL (HTTPS or same-origin path)
              <input value={contentDraft.logoUrl} maxLength={2048} placeholder="https://... or /images/logo.png"
                onChange={event => updateContentField('logoUrl', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Brand tagline
              <input value={contentDraft.tagline} maxLength={160} onChange={event => updateContentField('tagline', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Footer tagline
              <input value={contentDraft.footerTagline} maxLength={160} onChange={event => updateContentField('footerTagline', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Home page hero</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-slate-700">
                Intro label
                <input value={contentDraft.heroEyebrow} maxLength={180} onChange={event => updateContentField('heroEyebrow', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Main headline
                <input value={contentDraft.headline} maxLength={180} onChange={event => updateContentField('headline', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                Main description
                <textarea value={contentDraft.description} maxLength={1000} rows={3} onChange={event => updateContentField('description', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Primary button label
                <input value={contentDraft.primaryCta} maxLength={80} onChange={event => updateContentField('primaryCta', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Home page highlight chips (one per line)
                <textarea value={contentDraft.features.join('\n')} maxLength={2400} rows={3}
                  onChange={event => updateContentField('features', event.target.value.split('\n').slice(0, 20))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Pricing page introduction</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-slate-700">
                Section label
                <input value={contentDraft.pricingEyebrow} maxLength={120} onChange={event => updateContentField('pricingEyebrow', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Section headline
                <input value={contentDraft.pricingHeadline} maxLength={180} onChange={event => updateContentField('pricingHeadline', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                Section description
                <textarea value={contentDraft.pricingDescription} maxLength={1000} rows={3}
                  onChange={event => updateContentField('pricingDescription', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Multi-branch section</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-slate-700">
                Section label
                <input value={contentDraft.multiBranchEyebrow} maxLength={120}
                  onChange={event => updateContentField('multiBranchEyebrow', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Section headline
                <input value={contentDraft.multiBranchHeadline} maxLength={180}
                  onChange={event => updateContentField('multiBranchHeadline', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                Section description
                <textarea value={contentDraft.multiBranchDescription} maxLength={1000} rows={3}
                  onChange={event => updateContentField('multiBranchDescription', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Features section</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-slate-700">
                Section label
                <input value={contentDraft.featuresEyebrow} maxLength={120}
                  onChange={event => updateContentField('featuresEyebrow', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Section headline
                <input value={contentDraft.featuresHeadline} maxLength={180}
                  onChange={event => updateContentField('featuresHeadline', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                Section description
                <textarea value={contentDraft.featuresDescription} maxLength={1000} rows={3}
                  onChange={event => updateContentField('featuresDescription', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
            </div>
            <div className="space-y-3">
              {contentDraft.featureCards.map((card, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="md:col-span-2 flex justify-end">
                    <button type="button"
                      onClick={() => updateContentField('featureCards', contentDraft.featureCards.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove feature
                    </button>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Feature title
                    <input value={card.title} maxLength={120}
                      onChange={event => updateContentField('featureCards', contentDraft.featureCards.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Feature description
                    <textarea value={card.description} maxLength={500} rows={2}
                      onChange={event => updateContentField('featureCards', contentDraft.featureCards.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                </div>
              ))}
              <button type="button" disabled={contentDraft.featureCards.length >= 12}
                onClick={() => updateContentField('featureCards', [...contentDraft.featureCards, { title: '', description: '' }])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add feature card
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Home page metrics</h4>
              {contentDraft.marketingMetrics.map((metric, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Metric value
                    <input value={metric.value} maxLength={40}
                      onChange={event => updateContentField('marketingMetrics', contentDraft.marketingMetrics.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Metric label
                    <input value={metric.label} maxLength={120}
                      onChange={event => updateContentField('marketingMetrics', contentDraft.marketingMetrics.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="button"
                      onClick={() => updateContentField('marketingMetrics', contentDraft.marketingMetrics.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove metric
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" disabled={contentDraft.marketingMetrics.length >= 6}
                onClick={() => updateContentField('marketingMetrics', [...contentDraft.marketingMetrics, { value: '', label: '' }])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add metric
              </button>
            </div>
            <div className="md:col-span-2 space-y-3 border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-900">Multi-branch benefits</h4>
              {contentDraft.multiBranchBenefits.map((benefit, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Benefit title
                    <input value={benefit.title} maxLength={120}
                      onChange={event => updateContentField('multiBranchBenefits', contentDraft.multiBranchBenefits.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Benefit description
                    <textarea value={benefit.description} maxLength={500} rows={2}
                      onChange={event => updateContentField('multiBranchBenefits', contentDraft.multiBranchBenefits.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item))}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                  </label>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="button"
                      onClick={() => updateContentField('multiBranchBenefits', contentDraft.multiBranchBenefits.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove benefit
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" disabled={contentDraft.multiBranchBenefits.length >= 8}
                onClick={() => updateContentField('multiBranchBenefits', [...contentDraft.multiBranchBenefits, { title: '', description: '' }])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add benefit
              </button>
            </div>
            <div className="md:col-span-2 space-y-3 border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-900">Multi-branch preview card</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['organizationName', 'Organization name'],
                  ['activeBranchesLabel', 'Active branches label'],
                  ['flagshipName', 'Flagship branch name'],
                  ['flagshipDetails', 'Flagship branch details'],
                  ['secondBranchName', 'Second branch name'],
                  ['secondBranchDetails', 'Second branch details'],
                  ['singleBranchNotice', 'Single-branch notice'],
                  ['singleBranchName', 'Single business name'],
                  ['singleBranchDetails', 'Single business details']
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-xs font-semibold text-slate-700">
                    {label}
                    <input value={contentDraft.branchPreview[key]} maxLength={180}
                      onChange={event => updateContentField('branchPreview', {
                        ...contentDraft.branchPreview,
                        [key]: event.target.value
                      })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold text-slate-700">
              Footer brand tagline
              <input value={contentDraft.footerTagline} maxLength={160} onChange={event => updateContentField('footerTagline', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Footer trust label
              <input value={contentDraft.trustBadge} maxLength={80} onChange={event => updateContentField('trustBadge', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button disabled={isSavingContent || isLoadingContentDraft || Boolean(contentDraftError)} onClick={() => handleSaveContent(false)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">
              Save draft
            </button>
            <button disabled={isSavingContent || isLoadingContentDraft || Boolean(contentDraftError)} onClick={() => handleSaveContent(true)}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              Publish changes
            </button>
          </div>
        </section>
      )}

      {activeTab === 'security' && (
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900">Administrator password</h3>
            <p className="text-xs text-slate-500 mt-1">Set or rotate your platform administrator password. Your authenticator code is required and other active sessions will be revoked.</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Current password
              <input required minLength={14} maxLength={256} type="password" autoComplete="current-password"
                value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              New password (14–256 characters)
              <input required minLength={14} maxLength={256} type="password" autoComplete="new-password"
                value={newPassword} onChange={event => setNewPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Confirm new password
              <input required minLength={14} maxLength={256} type="password" autoComplete="new-password"
                value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Six-digit authenticator code
              <input required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6}
                value={passwordTotp} onChange={event => setPasswordTotp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono tracking-[0.3em]" />
            </label>
            <button disabled={isSavingPassword}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {isSavingPassword ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        </section>
      )}

      {/* TAB 2: SUBSCRIPTION PLANS */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Commercial Subscription Tiers
            </h3>
            <button
              onClick={() => setIsAddingPlan(true)}
              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Create New Tier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(p => (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between ${
                  p.popular ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-slate-200'
                }`}
              >
                <div>
                  {p.popular && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block mb-2">
                      Most Popular Plan
                    </span>
                  )}
                  <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{p.description}</p>

                  <div className="mt-4 mb-4">
                    <span className="text-3xl font-bold font-mono text-slate-900">${p.price}</span>
                    <span className="text-xs text-slate-400 font-sans"> / {p.billingPeriod}</span>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Max Terminals:</span>
                      <strong className="text-slate-800 font-mono">{p.maxTerminals}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Catalog Items:</span>
                      <strong className="text-slate-800 font-mono">{p.maxItems}</strong>
                    </div>

                    <div className="pt-2 text-slate-600">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Included Modules:</span>
                      <ul className="space-y-1 text-[11px] text-slate-700">
                        {p.features.map(f => (
                          <li key={f} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">Ready to sell</span>
                    <button onClick={() => setEditingPlan({ ...p })}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  {p.id.startsWith('plan-') && !['plan-starter', 'plan-pro', 'plan-enterprise'].includes(p.id) && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete plan "${p.name}"?`)) {
                          const updated = plans.filter(pl => pl.id !== p.id);
                          void onSavePlans(updated).then(() => {
                            onShowToast(`Plan ${p.name} deleted.`, 'ok');
                          }).catch(error => {
                            onShowToast(error instanceof Error ? error.message : 'Could not delete the plan.', 'err');
                          });
                        }
                      }}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CLOUDFLARE DEPLOYMENT GUIDE */}
      {activeTab === 'deploy' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cloudflare Pre-deployment Checklist
              </h3>
              <p className="text-xs text-slate-500">
                This checkout is not ready for production deployment.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-200 space-y-2 text-red-900">
              <h4 className="font-bold text-red-950 text-sm">Launch blockers</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Production and staging D1 databases are bound and migrated, but required Cloudflare auth and Turnstile secrets are not configured. The preview health check reports degraded.</li>
                <li>Branch/zone onboarding and durable cross-branch transfers, secure owner invitations/email verification, and automated billing are not implemented.</li>
                <li>Salary-period calculations and statutory payroll, authenticated live end-to-end tests, backups, and restore tests remain outstanding.</li>
              </ul>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Required before any production release</h4>
              <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                <li>Configure separate preview and production Turnstile keys, employee PIN pepper, and one-time Super Admin bootstrap email/token/TOTP secrets in Cloudflare Pages. Never put these in source control.</li>
                <li>Bootstrap the platform administrator once, then verify Super Admin MFA, tenant isolation, and the full account/workforce workflows against staging.</li>
                <li>Complete the remaining product gaps, then validate database backups and restore, monitoring, rollback, and production smoke tests.</li>
                <li>Keep customer registration and production traffic disabled until <code>/api/health</code> reports ready and release checks pass.</li>
              </ol>
              <p className="pt-2">
                Build locally with <code>npm run build</code>. A static-only upload of <code>dist/</code> omits the Pages Functions backend and D1 configuration; do not use it for a live deployment.
              </p>
              <p>
                Manage Pages environment variables and deployments through the <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-amber-700 font-semibold underline">Cloudflare Dashboard</a>. The feature branch is preview-only; do not promote it to production until all gates pass.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CLIENT */}
      {isAddingClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Onboard New Cafe / Restaurant</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter customer business details to create their account and access credentials
            </p>

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cafe / Restaurant Business Name *</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="e.g. Roasters Haven Cafe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Contact Email *</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    placeholder="owner@cafe.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner Phone (WhatsApp)</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="+961 70 000 000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Branch Location</label>
                  <input
                    type="text"
                    value={newClientCity}
                    onChange={e => setNewClientCity(e.target.value)}
                    placeholder="e.g. Downtown Mall"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Subscription Plan</label>
                  <select
                    value={newClientPlanId}
                    onChange={e => setNewClientPlanId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price}/{p.billingPeriod})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">License Duration (Days)</label>
                  <select
                    value={newClientDays}
                    onChange={e => setNewClientDays(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  >
                    <option value="14">14 Days (Free Trial)</option>
                    <option value="30">30 Days (Monthly)</option>
                    <option value="90">90 Days (Quarterly)</option>
                    <option value="365">365 Days (Annual)</option>
                    <option value="3650">10 Years (Lifetime)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Display Currency</label>
                  <select
                    value={newClientCurrency}
                    onChange={e => setNewClientCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 font-mono"
                  >
                    <option value="$">$ (USD)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="£">£ (GBP)</option>
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="EGP">EGP (Egyptian Pound)</option>
                    <option value="LBP">LBP (Lebanese Pound)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Generate Access &amp; Activate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Edit Subscription Plan</h3>
            <p className="text-xs text-slate-500 mb-4">Price and limits are saved to the server and enforced for new inventory operations.</p>
            <form onSubmit={handleUpdatePlan} className="space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">
                Plan name
                <input required maxLength={100} value={editingPlan.name}
                  onChange={event => setEditingPlan({ ...editingPlan, name: event.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-semibold text-slate-700">
                  Price (USD)
                  <input required type="number" min="0" step="0.01" value={editingPlan.price}
                    onChange={event => setEditingPlan({ ...editingPlan, price: Number(event.target.value) })}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
                </label>
                <label className="block font-semibold text-slate-700">
                  Billing period
                  <select value={editingPlan.billingPeriod}
                    onChange={event => setEditingPlan({ ...editingPlan, billingPeriod: event.target.value as SubscriptionPlan['billingPeriod'] })}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block font-semibold text-slate-700">
                  Terminals
                  <input required type="number" min="1" value={editingPlan.maxTerminals}
                    onChange={event => setEditingPlan({ ...editingPlan, maxTerminals: Number(event.target.value) })}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
                </label>
                <label className="block font-semibold text-slate-700">
                  Inventory items
                  <input required type="number" min="1" value={editingPlan.maxItems}
                    onChange={event => setEditingPlan({ ...editingPlan, maxItems: Number(event.target.value) })}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
                </label>
                <label className="block font-semibold text-slate-700">
                  Branches
                  <input required type="number" min="1" value={editingPlan.maxBranches}
                    onChange={event => setEditingPlan({ ...editingPlan, maxBranches: Number(event.target.value) })}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
                </label>
              </div>
              <label className="block font-semibold text-slate-700">
                Description
                <textarea rows={2} maxLength={1000} value={editingPlan.description}
                  onChange={event => setEditingPlan({ ...editingPlan, description: event.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
              </label>
              <label className="block font-semibold text-slate-700">
                Included features (one per line)
                <textarea rows={4} maxLength={3600} value={editingPlan.features.join('\n')}
                  onChange={event => setEditingPlan({ ...editingPlan, features: event.target.value.split('\n').slice(0, 30) })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingPlan(null)}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Cancel</button>
                <button type="submit"
                  className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PLAN */}
      {isAddingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Subscription Tier</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new commercial plan for cafes and restaurant chains
            </p>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Specialty Roaster Plus"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price ($) *</label>
                  <input
                    type="number"
                    value={planPrice}
                    onChange={e => setPlanPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Period</label>
                  <select
                    value={planPeriod}
                    onChange={e => setPlanPeriod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Devices / Terminals</label>
                  <input
                    type="number"
                    value={planTerminals}
                    onChange={e => setPlanTerminals(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Catalog Items</label>
                  <input
                    type="number"
                    value={planMaxItems}
                    onChange={e => setPlanMaxItems(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Description</label>
                <input
                  type="text"
                  value={planDesc}
                  onChange={e => setPlanDesc(e.target.value)}
                  placeholder="Ideal for medium cafes with 2 POS bars..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingPlan(false)}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CLIENT */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Edit Client Details</h3>
            <p className="text-xs text-slate-500 mb-4">
              Modify subscription tier, contact info, or expiry date for {editingTenant.name}
            </p>

            <form onSubmit={handleSaveEditTenant} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={editingTenant.name}
                  onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner Email *</label>
                  <input
                    type="email"
                    value={editingTenant.adminEmail}
                    onChange={e => setEditingTenant({ ...editingTenant, adminEmail: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={editingTenant.adminPhone || ''}
                    onChange={e => setEditingTenant({ ...editingTenant, adminPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Branch</label>
                  <input
                    type="text"
                    value={editingTenant.city || ''}
                    onChange={e => setEditingTenant({ ...editingTenant, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Plan</label>
                  <select
                    value={editingTenant.planId}
                    onChange={e => setEditingTenant({ ...editingTenant, planId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price}/{p.billingPeriod})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paid Until (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={editingTenant.paidUntil}
                    onChange={e => setEditingTenant({ ...editingTenant, paidUntil: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Code (ISO 4217)</label>
                  <input
                    type="text"
                    value={editingTenant.currency}
                    onChange={e => setEditingTenant({ ...editingTenant, currency: e.target.value.toUpperCase().slice(0, 3) })}
                    maxLength={3}
                    pattern="[A-Z]{3}"
                    placeholder="USD"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
