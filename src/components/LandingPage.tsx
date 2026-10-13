import React, { useState } from 'react';
import {
  Coffee,
  Building2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Brain,
  ShieldAlert,
  BellRing,
  FileSpreadsheet,
  Layers,
  Store,
  Users,
  ChevronRight,
  Zap,
  Lock,
  Globe,
  Sliders,
  DollarSign,
  Smartphone,
  WifiOff,
  Check,
  X
} from 'lucide-react';
import { CafeTenant, SubscriptionPlan, Employee, UserRole } from '../types/stock';
import { ApiService } from '../services/apiService';
import { RestaurantOnboardingWizard } from './RestaurantOnboardingWizard';

interface LandingPageProps {
  tenants: CafeTenant[];
  plans: SubscriptionPlan[];
  onLaunchStore: (tenant: CafeTenant, user?: Employee) => void;
  onLaunchSuperAdmin: () => void;
  onNewTenantRegistered: (tenant: CafeTenant) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  tenants,
  plans,
  onLaunchStore,
  onLaunchSuperAdmin,
  onNewTenantRegistered
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [calcBranches, setCalcBranches] = useState<number>(1);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-pro');

  // Find recommended plan for calculator
  const recommendedPlan = calcBranches === 1 ? plans[0] : calcBranches <= 2 ? plans[1] : plans[2];

  // Quick Demo Launcher with exact roles
  const handleLaunchDemoRole = (role: UserRole, targetTenantId?: string) => {
    const targetTenant =
      (targetTenantId && tenants.find(t => t.id === targetTenantId)) || tenants[0];

    let user: Employee = {
      id: 'demo-user-' + role,
      name:
        role === 'admin'
          ? 'Store Owner'
          : role === 'manager'
          ? 'Operations Manager'
          : role === 'teamlead'
          ? 'Shift Team Lead'
          : 'Barista Staff',
      pin: role === 'admin' ? '2468' : role === 'manager' ? '1357' : role === 'teamlead' ? '8642' : '0000',
      role,
      active: true
    };

    onLaunchStore(targetTenant, user);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-900/40">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block leading-none">
                BARSTOCK<span className="text-amber-500">.OS</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Cafe &amp; Restaurant Inventory SaaS
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-amber-400 transition-colors">
              Features
            </a>
            <a href="#plans" className="hover:text-amber-400 transition-colors">
              Plans &amp; Pricing
            </a>
            <a href="#multibranch" className="hover:text-amber-400 transition-colors">
              Multi-Branch Chains
            </a>
            <a href="#demo" className="hover:text-amber-400 transition-colors">
              Role Sandbox
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onLaunchStore(tenants[0])}
              className="px-3.5 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Store Terminal</span>
            </button>

            <button
              onClick={onLaunchSuperAdmin}
              className="px-3.5 h-9 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-900/30 transition-all flex items-center gap-1.5"
              title="Super Admin SaaS Control Panel"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Super Admin HQ</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-800/60">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built Exclusively for Coffee Shops, Roasteries &amp; Restaurant Chains</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Stop Guessing Stock.{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Run High-Velocity Cafes
            </span>{' '}
            From One Platform.
          </h1>

          <p className="mt-5 text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Ultra-fast 1-second barista touch take, ML predictive auto-restocking, basement
            offline-first sync, and smart loss &amp; theft audits — scaled from single kiosks to 20+
            branch multi-unit empires.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => {
                setSelectedPlanId('plan-pro');
                setIsRegisterOpen(true);
              }}
              className="w-full sm:w-auto px-7 h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-900/40 hover:shadow-amber-800/60 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto px-6 h-12 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Interactive Role Demo</span>
            </a>
          </div>

          {/* Live Telemetry KPI Strip */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left">
              <span className="text-2xl font-black text-amber-400 block tracking-tight">0.8s</span>
              <span className="text-[11px] font-medium text-slate-400">Barista Touch Checkout</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left">
              <span className="text-2xl font-black text-emerald-400 block tracking-tight">100%</span>
              <span className="text-[11px] font-medium text-slate-400">Offline Basement Ready</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left">
              <span className="text-2xl font-black text-amber-400 block tracking-tight">+$1,450</span>
              <span className="text-[11px] font-medium text-slate-400">Avg Monthly Loss Saved</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left">
              <span className="text-2xl font-black text-white block tracking-tight">Multi-HQ</span>
              <span className="text-[11px] font-medium text-slate-400">1 to 20+ Branch Sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE ROLE SANDBOX (TEST DRIVE NOW) */}
      <section id="demo" className="py-16 sm:py-20 border-b border-slate-800/60 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-semibold mb-3">
              <Users className="w-3.5 h-3.5" />
              <span>Instant Live Sandbox</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Test Drive NileLink as Any Staff Role
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Every employee has dedicated permissions. Click below to instantly launch into the app
              with that pre-configured role.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Store Owner / Admin */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Store Owner</h3>
                <p className="text-[10px] text-amber-400 font-mono mt-0.5">PIN: 2468</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Full command: Smart theft audit, staff PIN management, suppliers, and legal tax
                  PDFs.
                </p>
              </div>
              <button
                onClick={() => handleLaunchDemoRole('admin')}
                className="mt-4 w-full h-9 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch as Owner</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Operations Manager */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Operations Manager</h3>
                <p className="text-[10px] text-blue-400 font-mono mt-0.5">PIN: 1357</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Restock orders, ML prediction, stock-in receiving, and waste cost tracking.
                </p>
              </div>
              <button
                onClick={() => handleLaunchDemoRole('manager')}
                className="mt-4 w-full h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch as Manager</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Shift Team Lead */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Shift Team Lead</h3>
                <p className="text-[10px] text-emerald-400 font-mono mt-0.5">PIN: 8642</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Fast bar take, closing night stock count verification, and floor waste entries.
                </p>
              </div>
              <button
                onClick={() => handleLaunchDemoRole('teamlead')}
                className="mt-4 w-full h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch Team Lead</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Barista Staff */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <Coffee className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Barista / Bartender</h3>
                <p className="text-[10px] text-purple-400 font-mono mt-0.5">PIN: 0000</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Streamlined, high-speed &quot;Take to Bar&quot; screen and camera barcode scanning only.
                </p>
              </div>
              <button
                onClick={() => handleLaunchDemoRole('staff')}
                className="mt-4 w-full h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch Barista</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Super Admin HQ */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-amber-950/40 border border-amber-500/40 flex flex-col justify-between shadow-xl">
              <div>
                <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center mb-3">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-amber-300">Super Admin (You)</h3>
                <p className="text-[10px] text-amber-400/80 font-mono mt-0.5">SaaS Owner HQ</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Manage all cafes, monitor expiring licenses, edit plan limits, and see platform
                  MRR.
                </p>
              </div>
              <button
                onClick={onLaunchSuperAdmin}
                className="mt-4 w-full h-9 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch Super Admin</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PLANS & TIERS SECTION (MATCHING USER EXACT SPECIFICATION) */}
      <section id="plans" className="py-20 sm:py-24 border-b border-slate-800/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-amber-500 text-xs font-bold tracking-wider uppercase">
              Transparent, Scalable SaaS Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
              Choose the Plan Sized for Your Stock
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              From a single kiosk with limited items to an expanding multi-branch chain managing
              thousands of SKUs across multiple locations.
            </p>

            {/* Billing cycle switcher */}
            <div className="mt-6 inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  billingPeriod === 'monthly' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  billingPeriod === 'annual' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                  2 Mo Free
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {plans.slice(0, 3).map((plan, idx) => {
              const isPopular = plan.popular || idx === 1;
              const displayPrice =
                billingPeriod === 'annual' ? Math.round(plan.price * 0.83) : plan.price;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                    isPopular
                      ? 'bg-slate-900/90 border-2 border-amber-500 shadow-2xl shadow-amber-900/20'
                      : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-600 text-white text-[11px] font-bold tracking-wide shadow-md">
                      MOST POPULAR FOR BUSY CAFES
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        {plan.badge || (idx === 0 ? 'Single Branch' : idx === 1 ? 'Medium Stock' : 'Multi-Chain')}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mt-1">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-2 min-h-10 leading-relaxed">
                      {plan.idealFor || plan.description}
                    </p>

                    {/* Price Tag */}
                    <div className="my-6 pb-6 border-b border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl sm:text-5xl font-black text-white">
                          ${displayPrice}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/month</span>
                      </div>
                      {billingPeriod === 'annual' && (
                        <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
                          Billed annually · Save ${(plan.price * 2.4).toFixed(0)}/yr
                        </span>
                      )}
                    </div>

                    {/* Limits Specs */}
                    <div className="space-y-2.5 mb-6 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-semibold text-white">
                          {plan.maxBranches === 1
                            ? '1 Dedicated Branch Location'
                            : plan.maxBranches === 2
                            ? 'Up to 2 Branch Locations'
                            : '3 to 10+ Integrated Branches'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong className="text-white">
                            {plan.maxItems >= 5000 ? 'Unlimited' : plan.maxItems}
                          </strong>{' '}
                          Stock Items &amp; Categories
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Up to <strong className="text-white">{plan.maxTerminals}</strong> POS &amp;
                          Counter Terminals
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-2 text-xs text-slate-400">
                      {plan.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setIsRegisterOpen(true);
                    }}
                    className={`mt-8 w-full h-11 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <span>Choose {plan.name.split('/')[0]}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Interactive Branch Calculator Widget */}
          <div className="mt-14 max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span>How many branches do you operate?</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust slider to see your recommended plan and multi-branch configuration.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={calcBranches}
                  onChange={e => setCalcBranches(Number(e.target.value))}
                  className="w-36 sm:w-48 accent-amber-500"
                />
                <span className="text-lg font-black text-amber-400 font-mono w-14 text-right">
                  {calcBranches} {calcBranches === 1 ? 'Store' : 'Stores'}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-300">
                Recommended Tier:{' '}
                <strong className="text-amber-400 font-bold">{recommendedPlan.name}</strong> ·{' '}
                {calcBranches === 1
                  ? 'Single store isolated database'
                  : 'Multi-branch central HQ command with branch switching'}
              </span>

              <button
                onClick={() => {
                  setSelectedPlanId(recommendedPlan.id);
                  setIsRegisterOpen(true);
                }}
                className="h-8 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs whitespace-nowrap self-start sm:self-auto transition-colors"
              >
                Provision for {calcBranches} {calcBranches === 1 ? 'Store' : 'Stores'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. MULTI-BRANCH FEATURE SPOTLIGHT */}
      <section id="multibranch" className="py-20 sm:py-24 border-b border-slate-800/60 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-4">
                <Building2 className="w-3.5 h-3.5" />
                <span>Multi-Location Architecture</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                One Account. Unlimited Branches.{' '}
                <span className="text-amber-400">Zero Cross-Store Data Leaks.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                When you sell NileLink to single coffee shops, they only see their own store. When a
                restaurateur owns 3, 4, or 5 coffee shops, they get the Enterprise Multi-Branch
                Switch — allowing them to switch between locations in 1 click, compare branch
                stock burns, and transfer items without confusion.
              </p>

              <div className="mt-6 space-y-3.5 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">Strict Client Isolation:</strong>
                    Individual cafes cannot see or access any other business on your platform.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">HQ Consolidated Analytics:</strong>
                    Owners of chains view consolidated consumption, spoilage waste, and shrinkage.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">Super Admin Expiry Control:</strong>
                    You (as SaaS Super Admin) can instantly extend, renew, or suspend licenses remotely.
                  </div>
                </div>
              </div>
            </div>

            {/* Visual multi-branch preview card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-[11px] font-mono text-slate-400 ml-2">
                    Nile Roastery Organization Group
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  2 ACTIVE BRANCHES
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-bold text-white text-xs">Demo Specialty Roastery · Flagship</p>
                      <p className="text-[10px] text-slate-400">142 Items · 8 Staff PINs · Live Sync</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchDemoRole('admin', 'nile-flagship')}
                    className="px-3 h-7 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-bold text-white text-xs">Nile Bistro &amp; Coffee · Branch 2</p>
                      <p className="text-[10px] text-slate-400">118 Items · 5 Staff PINs · Live Sync</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchDemoRole('admin', 'nile-branch-01')}
                    className="px-3 h-7 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>
                </div>

                {/* Single Store Client Separator */}
                <div className="pt-2 text-[11px] text-slate-500">
                  <span>Isolated Single Store Client (Cannot see above branches):</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-bold text-slate-300 text-xs">Example Artisan Espresso</p>
                      <p className="text-[10px] text-slate-500">Single Espresso Solo Plan · 1 Branch</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchDemoRole('admin', 'artisan-single-01')}
                    className="px-3 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ADVANCED FEATURES GRID */}
      <section id="features" className="py-20 sm:py-24 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-amber-500 text-xs font-bold tracking-wider uppercase">
              Engineered for Real Hospitality
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight mt-1">
              The Next-Gen Bar Operating System
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Every detail is tuned for speed, anti-theft accountability, and reliability in busy
              service shifts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">ML Predictive Stock Restock</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Machine learning algorithm calculates historical velocity and auto-suggests reorder
                quantities days before running out.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Smart Shrinkage &amp; Theft Audit</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Compares physical counts against expected logs to automatically isolate missing units,
                suspected theft, and unrecorded drain.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <BellRing className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Web Push Notification Service</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Dispatches background push notifications directly to admin phones even when the
                browser window is minimized or closed.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Branded Tax &amp; Payroll PDFs</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                One-click export of formal, formatted PDF reports with company tax numbers, authorized
                manager signatures, and valuation stamps.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <WifiOff className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Offline Basement Queue</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Staff can continue logging items in subterranean cold rooms without Wi-Fi. Queues sync
                silently the moment connection returns.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Cloudflare Edge Deployment Ready</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Engineered for global low-latency deployment on Cloudflare Pages and Workers with zero
                server maintenance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-12 bg-slate-950 border-t border-slate-900 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold text-xs">
              B
            </div>
            <span className="text-slate-300 font-bold">BarStock.OS</span>
            <span>· Multi-Tenant Cafe &amp; Restaurant SaaS</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={onLaunchSuperAdmin}
              className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Super Admin SaaS Portal</span>
            </button>
            <span>Cloudflare Edge Certified</span>
          </div>
        </div>
      </footer>

      {/* 8. MULTI-STEP RESTAURANT ONBOARDING WIZARD */}
      <RestaurantOnboardingWizard
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        plans={plans}
        defaultPlanId={selectedPlanId}
        onComplete={(newTenant, ownerUser) => {
          onNewTenantRegistered(newTenant);
          onLaunchStore(newTenant, ownerUser);
        }}
      />
    </div>
  );
};
