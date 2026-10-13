import React, { useState } from 'react';
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
  Globe
} from 'lucide-react';
import { CafeTenant, SubscriptionPlan } from '../types/stock';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../data/initialData';

interface SuperAdminPortalProps {
  tenants: CafeTenant[];
  plans: SubscriptionPlan[];
  onSaveTenants: (tenants: CafeTenant[]) => void;
  onSavePlans: (plans: SubscriptionPlan[]) => void;
  onSelectCafe: (tenant: CafeTenant) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
  onGoToLanding?: () => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  tenants,
  plans,
  onSaveTenants,
  onSavePlans,
  onSelectCafe,
  onShowToast,
  onGoToLanding
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'plans' | 'deploy'>('clients');
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
      t.accessCode.toLowerCase().includes(searchQuery.toLowerCase())
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
    onSaveTenants(updated);

    onShowToast(`Client ${newTenant.name} created with Access Code: ${code}`, 'ok');
    setIsAddingClient(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientCity('');
  };

  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete customer "${tenantName}"? This action cannot be undone.`)) {
      const updated = tenants.filter(t => t.id !== tenantId);
      onSaveTenants(updated);
      onShowToast(`Client ${tenantName} deleted.`, 'ok');
    }
  };

  const handleSaveEditTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const selectedPlan = plans.find(p => p.id === editingTenant.planId || p.name === editingTenant.plan);
    const updatedTenant: CafeTenant = {
      ...editingTenant,
      plan: selectedPlan ? selectedPlan.name : editingTenant.plan
    };

    const updated = tenants.map(t => (t.id === updatedTenant.id ? updatedTenant : t));
    onSaveTenants(updated);
    onShowToast(`Updated details for ${updatedTenant.name}!`, 'ok');
    setEditingTenant(null);
  };

  const handleToggleStatus = (tenantId: string) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        const nextStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...t, status: nextStatus as any };
      }
      return t;
    });
    onSaveTenants(updated);
    onShowToast('Client status updated.', 'ok');
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
    onSaveTenants(updated);
    onShowToast(`Extended subscription by ${extraDays} days!`, 'ok');
  };

  const handleSetLifetime = (tenantId: string) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        return { ...t, paidUntil: '2036-12-31', status: 'ACTIVE' as const };
      }
      return t;
    });
    onSaveTenants(updated);
    onShowToast(`Granted 10-year Lifetime access!`, 'ok');
  };

  const handleCopySpecialLink = (code: string) => {
    const link = `${window.location.origin}?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(code);
    onShowToast('Special Access Link copied to clipboard!', 'ok');
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
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

    const updated = [...plans, newPlan];
    onSavePlans(updated);
    onShowToast(`Plan ${newPlan.name} created!`, 'ok');
    setIsAddingPlan(false);
    setPlanName('');
    setPlanDesc('');
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
              Manage cafe accounts, generate client access codes, configure subscription pricing, and monitor active recurring revenue.
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
              onClick={() => setIsAddingClient(true)}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Cafe Client</span>
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
                placeholder="Search cafe name, email, or code..."
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
              const isCopied = copiedLink === tenant.accessCode;

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
                        <span className="text-slate-400 font-medium">Access Code:</span>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          {tenant.accessCode}
                        </span>

                        <button
                          onClick={() => handleCopySpecialLink(tenant.accessCode)}
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
                  <span className="text-[11px] text-slate-400 font-medium">Ready to sell</span>
                  {p.id.startsWith('plan-') && !['plan-starter', 'plan-pro', 'plan-enterprise'].includes(p.id) && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete plan "${p.name}"?`)) {
                          const updated = plans.filter(pl => pl.id !== p.id);
                          onSavePlans(updated);
                          onShowToast(`Plan ${p.name} deleted.`, 'ok');
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
                How to Deploy NileLink Stock to Cloudflare Pages in 3 Minutes
              </h3>
              <p className="text-xs text-slate-500">
                Zero server maintenance, global edge distribution, 100% free hosting tier
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Step 1: Build the Production Bundle</h4>
              <p>In your terminal or repository, run the build command:</p>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs">
                npm run build
              </pre>
              <p className="text-slate-500">
                This compiles everything into a lightweight static bundle inside the <code>dist/</code> folder.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Step 2: Deploy to Cloudflare Pages</h4>
              <p>Option A (Via Cloudflare Dashboard):</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                <li>Log in to <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-amber-600 font-semibold underline">Cloudflare Dashboard</a>.</li>
                <li>Go to <strong>Workers &amp; Pages</strong> &gt; <strong>Create Application</strong> &gt; <strong>Pages</strong>.</li>
                <li>Connect your Git repository (GitHub/GitLab) or drag-and-drop the <code>dist/</code> folder directly!</li>
                <li>Set <strong>Build command</strong> to <code>npm run build</code> and <strong>Build output directory</strong> to <code>dist</code>.</li>
              </ol>

              <p className="pt-2">Option B (Via Wrangler CLI):</p>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs">
                npx wrangler pages deploy dist --project-name nilelink-stock
              </pre>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2 text-emerald-900">
              <h4 className="font-bold text-emerald-950 text-sm">Step 3: Connect Custom Domain for Your Brand</h4>
              <p>
                In Cloudflare Pages, go to <strong>Custom Domains</strong> and attach your custom domain (e.g., <code>stock.nilelink.com</code>).
                All cafes will access your white-labeled application with zero Google banners, ultra-low latency, and automated SSL!
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
                  <label className="block font-semibold text-slate-700 mb-1">Owner Email *</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={editingTenant.currency}
                    onChange={e => setEditingTenant({ ...editingTenant, currency: e.target.value })}
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
