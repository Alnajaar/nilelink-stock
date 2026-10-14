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
import { PublicSiteContent } from '../types/content';

interface LandingPageProps {
  tenants: CafeTenant[];
  plans: SubscriptionPlan[];
  publicContent: PublicSiteContent;
  onLaunchStore: (tenant: CafeTenant, user?: Employee) => void;
  onOwnerLogin: () => void;
  onNewTenantRegistered: (tenant: CafeTenant) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  tenants,
  plans,
  publicContent,
  onLaunchStore,
  onOwnerLogin,
  onNewTenantRegistered
}) => {
  const [calcBranches, setCalcBranches] = useState<number>(1);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-pro');
  const featureIcons = [Brain, ShieldAlert, BellRing, FileSpreadsheet, WifiOff, Globe];

  // Find recommended plan for calculator
  const recommendedPlan = calcBranches === 1 ? plans[0] : calcBranches <= 2 ? plans[1] : plans[2];

  // Quick Demo Launcher with exact roles
  const handleLaunchDemoRole = (role: UserRole, targetTenantId?: string) => {
    if (!import.meta.env.DEV) return;

    const targetTenant =
      (targetTenantId && tenants.find(t => t.id === targetTenantId)) || tenants[0];
    if (!targetTenant) return;

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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-900/40 overflow-hidden">
              {publicContent.logoUrl
                ? <img src={publicContent.logoUrl} alt="" className="w-full h-full object-cover" />
                : <Coffee className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block leading-none">
                {publicContent.brandName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {publicContent.tagline}
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
            <a href="#features" className="hover:text-amber-400 transition-colors">How it works</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOwnerLogin}
              className="px-3.5 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Owner Sign In</span>
            </button>
            {import.meta.env.DEV && <button
              onClick={() => onLaunchStore(tenants[0])}
              className="px-3.5 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Store Terminal</span>
            </button>}

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
            <span>{publicContent.heroEyebrow}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              {publicContent.headline}
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {publicContent.description}
          </p>
          {publicContent.features.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {publicContent.features.map((feature, index) => (
                <span key={`${feature}-${index}`} className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                  {feature}
                </span>
              ))}
            </div>
          )}

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => {
                setSelectedPlanId('plan-pro');
                setIsRegisterOpen(true);
              }}
              className="w-full sm:w-auto px-7 h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-900/40 hover:shadow-amber-800/60 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>{publicContent.primaryCta}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#features"
              className="w-full sm:w-auto px-6 h-12 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Explore features</span>
            </a>
          </div>

          {publicContent.marketingMetrics.length > 0 && (
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
              {publicContent.marketingMetrics.map((metric, index) => (
                <div key={`${metric.label}-${index}`} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left">
                  <span className={`text-2xl font-black block tracking-tight ${index === 1 ? 'text-emerald-400' : index === 3 ? 'text-white' : 'text-amber-400'}`}>
                    {metric.value}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{metric.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. INTERACTIVE ROLE SANDBOX (TEST DRIVE NOW) */}
      {import.meta.env.DEV && <section id="demo" className="py-16 sm:py-20 border-b border-slate-800/60 bg-slate-900/30">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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

          </div>
        </div>
      </section>}

      {/* 4. PLANS & TIERS SECTION (MATCHING USER EXACT SPECIFICATION) */}
      <section id="plans" className="py-20 sm:py-24 border-b border-slate-800/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-amber-500 text-xs font-bold tracking-wider uppercase">
              {publicContent.pricingEyebrow}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
              {publicContent.pricingHeadline}
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              {publicContent.pricingDescription}
            </p>

          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {plans.slice(0, 3).map((plan, idx) => {
              const isPopular = plan.popular || idx === 1;
              const displayPrice = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: plan.currency || 'USD',
                maximumFractionDigits: 2
              }).format(plan.price);
              const periodLabel = {
                monthly: 'per month',
                quarterly: 'per quarter',
                annual: 'per year',
                lifetime: 'one-time'
              }[plan.billingPeriod];

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
                          {displayPrice}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{periodLabel}</span>
                      </div>
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
                <span>{publicContent.multiBranchEyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                {publicContent.multiBranchHeadline}
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                {publicContent.multiBranchDescription}
              </p>

              <div className="mt-6 space-y-3.5 text-xs text-slate-300">
                {publicContent.multiBranchBenefits.map((benefit, index) => (
                  <div key={`${benefit.title}-${index}`} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white block font-semibold">{benefit.title}:</strong>
                      {benefit.description}
                    </div>
                  </div>
                ))}
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
                    {publicContent.branchPreview.organizationName}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  {publicContent.branchPreview.activeBranchesLabel}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-bold text-white text-xs">{publicContent.branchPreview.flagshipName}</p>
                      <p className="text-[10px] text-slate-400">{publicContent.branchPreview.flagshipDetails}</p>
                    </div>
                  </div>
                  {import.meta.env.DEV && <button
                    onClick={() => handleLaunchDemoRole('admin', 'nile-flagship')}
                    className="px-3 h-7 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-bold text-white text-xs">{publicContent.branchPreview.secondBranchName}</p>
                      <p className="text-[10px] text-slate-400">{publicContent.branchPreview.secondBranchDetails}</p>
                    </div>
                  </div>
                  {import.meta.env.DEV && <button
                    onClick={() => handleLaunchDemoRole('admin', 'nile-branch-01')}
                    className="px-3 h-7 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>}
                </div>

                {/* Single Store Client Separator */}
                <div className="pt-2 text-[11px] text-slate-500">
                  <span>{publicContent.branchPreview.singleBranchNotice}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-bold text-slate-300 text-xs">{publicContent.branchPreview.singleBranchName}</p>
                      <p className="text-[10px] text-slate-500">{publicContent.branchPreview.singleBranchDetails}</p>
                    </div>
                  </div>
                  {import.meta.env.DEV && <button
                    onClick={() => handleLaunchDemoRole('admin', 'artisan-single-01')}
                    className="px-3 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] rounded-lg transition-colors"
                  >
                    Switch In
                  </button>}
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
              {publicContent.featuresEyebrow}
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight mt-1">
              {publicContent.featuresHeadline}
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              {publicContent.featuresDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicContent.featureCards.map((card, index) => {
              const FeatureIcon = featureIcons[index % featureIcons.length];
              return (
                <div key={`${card.title}-${index}`} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                    <FeatureIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">{card.title}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{card.description}</p>
                </div>
              );
            })}
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
            <span className="text-slate-300 font-bold">{publicContent.brandName}</span>
            <span>· {publicContent.footerTagline}</span>
          </div>

          <div className="flex items-center gap-6">
            <span>{publicContent.trustBadge}</span>
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
