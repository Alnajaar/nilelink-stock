import React, { useState } from 'react';
import {
  Store,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Building2,
  Check,
  ShieldCheck,
  Users,
  Layers,
  Key,
  Utensils,
  MapPin,
  Flame,
  Snowflake,
  Package,
  Calendar,
  X,
  Smartphone,
  ScanLine
} from 'lucide-react';
import { CafeTenant, SubscriptionPlan, Employee, StockItem } from '../types/stock';
import { ApiService } from '../services/apiService';
import { StorageService } from '../services/storageService';

interface RestaurantOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
  onComplete: (tenant: CafeTenant, ownerUser: Employee) => void;
  defaultPlanId?: string;
}

export const RestaurantOnboardingWizard: React.FC<RestaurantOnboardingWizardProps> = ({
  isOpen,
  onClose,
  plans,
  onComplete,
  defaultPlanId = 'plan-pro'
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Profile & Identity
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Specialty Coffee & Roastery');
  const [ownerName, setOwnerName] = useState('Alex Rivers');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('$');

  // Step 2: Subscription Plan
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlanId);

  // Step 3: First Branch & Zones
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [zones, setZones] = useState<string[]>([
    'Espresso & Beverage Bar',
    'Kitchen & Cook Line',
    'Walk-in Cold Storage',
    'Dry Packaging & Beans'
  ]);
  const [ownerPin, setOwnerPin] = useState('2468');
  const [managerPin, setManagerPin] = useState('1357');
  const [staffPin, setStaffPin] = useState('0000');
  const [seedStarterStock, setSeedStarterStock] = useState(true);

  // Step 4: Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[1] || plans[0];

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrorMsg('Please enter your business or restaurant name.');
      return;
    }
    if (!adminEmail.trim()) {
      setErrorMsg('Please provide a valid owner email address.');
      return;
    }
    setErrorMsg('');
    if (!branchName) {
      setBranchName(`${businessName.trim()} - Flagship`);
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    setCurrentStep(3);
  };

  const handleToggleZone = (zone: string) => {
    if (zones.includes(zone)) {
      if (zones.length > 1) {
        setZones(zones.filter(z => z !== zone));
      }
    } else {
      setZones([...zones, zone]);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const branchesCount = selectedPlan.maxBranches > 1 ? (selectedPlan.id === 'plan-enterprise' ? 3 : 2) : 1;

      const res = await ApiService.registerTenant({
        name: businessName.trim(),
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone.trim(),
        city: city.trim() || 'Central',
        planId: selectedPlanId,
        branchesCount,
        currency
      });

      if (!res.success || !res.tenant) {
        throw new Error(res.message || 'Could not provision new restaurant workspace.');
      }

      const tenant = res.tenant;

      // Create owner and initial staff employees for this tenant
      const initialEmployees: Employee[] = [
        {
          id: `emp-${tenant.id}-owner`,
          name: ownerName.trim() || 'Store Owner',
          pin: ownerPin.trim() || '2468',
          role: 'admin',
          active: true
        },
        {
          id: `emp-${tenant.id}-mgr`,
          name: 'Lead Operations Manager',
          pin: managerPin.trim() || '1357',
          role: 'manager',
          active: true
        },
        {
          id: `emp-${tenant.id}-barista`,
          name: 'Barista / Line Staff',
          pin: staffPin.trim() || '0000',
          role: 'staff',
          active: true
        }
      ];

      StorageService.saveEmployees(tenant.id, initialEmployees);

      // Seed starter catalog if requested
      if (seedStarterStock) {
        const starterItems: StockItem[] = [
          {
            id: `item-${Date.now()}-1`,
            name: 'Ethiopia Yirgacheffe Beans (Single Origin)',
            category: 'Coffee Beans',
            unit: 'kg',
            openingStock: 25,
            currentStock: 25,
            minLevel: 8,
            maxLevel: 40,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 24.5,
            barcode: 'NL-ETH-8821',
            sku: 'SKU-ETH-01',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-2`,
            name: 'House Espresso Blend (Dark Roast)',
            category: 'Coffee Beans',
            unit: 'kg',
            openingStock: 40,
            currentStock: 40,
            minLevel: 12,
            maxLevel: 60,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 18.0,
            barcode: 'NL-ESP-1102',
            sku: 'SKU-ESP-02',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-3`,
            name: 'Oat Milk Barista Edition (1L)',
            category: 'Dairy & Plant Milk',
            unit: 'cartons',
            openingStock: 48,
            currentStock: 48,
            minLevel: 16,
            maxLevel: 72,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 2.8,
            barcode: 'NL-OAT-9934',
            sku: 'SKU-OAT-03',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-4`,
            name: 'Organic Whole Milk 3.8% (1 Gallon)',
            category: 'Dairy & Plant Milk',
            unit: 'bottles',
            openingStock: 30,
            currentStock: 30,
            minLevel: 10,
            maxLevel: 50,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 3.5,
            barcode: 'NL-MILK-4421',
            sku: 'SKU-MILK-04',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-5`,
            name: 'Artisan Madagascar Vanilla Syrup (750ml)',
            category: 'Syrups & Flavors',
            unit: 'bottles',
            openingStock: 12,
            currentStock: 12,
            minLevel: 4,
            maxLevel: 24,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 8.5,
            barcode: 'NL-VAN-7731',
            sku: 'SKU-VAN-05',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-6`,
            name: 'Salted Caramel Specialty Sauce (1.89L)',
            category: 'Syrups & Flavors',
            unit: 'jugs',
            openingStock: 8,
            currentStock: 8,
            minLevel: 3,
            maxLevel: 16,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 14.0,
            barcode: 'NL-CAR-3329',
            sku: 'SKU-CAR-06',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-7`,
            name: 'Ceremonial Grade Matcha Powder (500g)',
            category: 'Tea & Matcha',
            unit: 'tins',
            openingStock: 10,
            currentStock: 10,
            minLevel: 3,
            maxLevel: 15,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 32.0,
            barcode: 'NL-MAT-5541',
            sku: 'SKU-MAT-07',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-8`,
            name: '12oz Compostable Hot Cups with Lids',
            category: 'Packaging',
            unit: 'sleeves',
            openingStock: 35,
            currentStock: 35,
            minLevel: 10,
            maxLevel: 50,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 6.2,
            barcode: 'NL-CUP-12OZ',
            sku: 'SKU-CUP-08',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-9`,
            name: 'Extra Virgin Olive Oil (5L Tin)',
            category: 'Kitchen Supplies',
            unit: 'tins',
            openingStock: 6,
            currentStock: 6,
            minLevel: 2,
            maxLevel: 10,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 38.0,
            barcode: 'NL-EVOO-5L',
            sku: 'SKU-KIT-09',
            lastUpdated: new Date().toISOString()
          },
          {
            id: `item-${Date.now()}-10`,
            name: 'French Butter Unsalted (1kg Block)',
            category: 'Kitchen Supplies',
            unit: 'blocks',
            openingStock: 15,
            currentStock: 15,
            minLevel: 5,
            maxLevel: 25,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            unitCost: 9.5,
            barcode: 'NL-BTR-1KG',
            sku: 'SKU-KIT-10',
            lastUpdated: new Date().toISOString()
          }
        ];
        StorageService.saveItems(tenant.id, starterItems);
      }

      onComplete(tenant, initialEmployees[0]);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error completing onboarding process.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Restaurant Onboarding Wizard
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Step {currentStep} of 4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Setup your coffee shop or restaurant stock operating system
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/20 text-[11px] font-semibold text-center">
          <div
            className={`py-2.5 px-1 border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              currentStep >= 1
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-slate-800">1</span>
            <span className="hidden sm:inline">Concept</span>
          </div>
          <div
            className={`py-2.5 px-1 border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              currentStep >= 2
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-slate-800">2</span>
            <span className="hidden sm:inline">Plan</span>
          </div>
          <div
            className={`py-2.5 px-1 border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              currentStep >= 3
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-slate-800">3</span>
            <span className="hidden sm:inline">Branch & Zones</span>
          </div>
          <div
            className={`py-2.5 px-1 border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              currentStep === 4
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-slate-800">4</span>
            <span className="hidden sm:inline">Activate</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: RESTAURANT PROFILE & IDENTITY */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Restaurant / Coffee Shop Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Artisan Roast & Kitchen"
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Business Concept
                  </label>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Specialty Coffee & Roastery">Specialty Coffee & Roastery</option>
                    <option value="Cafe & Artisan Bakery">Cafe & Artisan Bakery</option>
                    <option value="Bistro & Casual Dining">Bistro & Casual Dining</option>
                    <option value="Fast Casual Restaurant">Fast Casual Restaurant</option>
                    <option value="Bar & Cocktail Lounge">Bar & Cocktail Lounge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Currency Symbol
                  </label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="$">$ (USD - US Dollars)</option>
                    <option value="€">€ (EUR - Euros)</option>
                    <option value="£">£ (GBP - British Pounds)</option>
                    <option value="AED">AED (Emirati Dirhams)</option>
                    <option value="SAR">SAR (Saudi Riyals)</option>
                    <option value="CAD $">CAD $ (Canadian Dollars)</option>
                    <option value="AUD $">AUD $ (Australian Dollars)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Owner / Administrator Name
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Alex Rivers"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Owner Admin Email *
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="owner@myrestaurant.com"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone / WhatsApp (For Urgent Stock Alerts)
                  </label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={e => setAdminPhone(e.target.value)}
                    placeholder="+1 (555) 392-8812"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    City / Neighborhood
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Downtown Arts District"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end">
                <button
                  type="submit"
                  className="px-6 h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-900/30 flex items-center gap-2 transition-all"
                >
                  <span>Continue to Plan Selection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: SUBSCRIPTION PLAN & SCALE */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Choose Your Scale & Subscription Plan</h3>
                  <p className="text-xs text-slate-400">
                    All plans come with a 14-day fully featured risk-free trial.
                  </p>
                </div>

                {/* Billing toggle */}
                <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      billingPeriod === 'monthly'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('annual')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      billingPeriod === 'annual'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Annual</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Plan Options Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map(p => {
                  const isSelected = selectedPlanId === p.id;
                  const price =
                    billingPeriod === 'annual'
                      ? Math.round(p.price * 12 * 0.8 / 12)
                      : p.price;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between relative ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      {p.popular && (
                        <div className="absolute -top-2.5 right-3 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                          Most Popular
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-white">{p.name}</h4>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500 text-slate-950'
                                : 'border-slate-700'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-white font-mono">${price}</span>
                            <span className="text-xs text-slate-400">/mo</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {p.maxBranches} {p.maxBranches === 1 ? 'Branch' : 'Branches'} · Up to {p.maxItems} Items
                          </div>
                        </div>

                        <ul className="space-y-1.5 text-[11px] text-slate-300">
                          {p.features.slice(0, 3).map((f, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400">
                        {p.maxBranches === 1
                          ? 'Single shop or kiosk'
                          : p.maxBranches <= 3
                          ? 'Roastery + 2 cafes'
                          : 'Multi-branch enterprise'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Selected: <strong>{selectedPlan.name}</strong> ({selectedPlan.maxBranches} Branch limit, {selectedPlan.maxItems} Item catalog).
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="px-6 h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-900/30 flex items-center gap-2 transition-all"
                >
                  <span>Continue to Branch & Operations</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FIRST BRANCH & OPERATIONS SETUP */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Setup First Branch & Dispensing Zones</h3>
                <p className="text-xs text-slate-400">
                  Configure where stock is stored and where staff take items (Bar vs Kitchen).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    First Branch Name *
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={e => setBranchName(e.target.value)}
                    placeholder="Downtown Flagship"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Branch Street Location
                  </label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={e => setBranchAddress(e.target.value)}
                    placeholder="120 Main Street, Suite 4"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Destination & Storage Zones */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Operating Zones (Where items are stocked & taken)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { name: 'Espresso & Beverage Bar', icon: Coffee, desc: 'Beans, syrups, dairy, cups' },
                    { name: 'Kitchen & Cook Line', icon: Utensils, desc: 'Sauces, oils, butter, bread' },
                    { name: 'Walk-in Cold Storage', icon: Snowflake, desc: 'Perishables & bulk dairy' },
                    { name: 'Dry Packaging & Beans', icon: Package, desc: 'Bags, cups, to-go boxes' }
                  ].map(z => {
                    const isSelected = zones.includes(z.name);
                    const Icon = z.icon;
                    return (
                      <div
                        key={z.name}
                        onClick={() => handleToggleZone(z.name)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-500/60 bg-amber-500/10 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">{z.name}</div>
                            <div className="text-[10px] text-slate-400">{z.desc}</div>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-700'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff PIN Setup */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Terminal Access Quick PINs (4-Digits)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Store Owner PIN (Admin)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={ownerPin}
                      onChange={e => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Shift Manager PIN
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={managerPin}
                      onChange={e => setManagerPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-blue-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Barista / Staff PIN
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Starter Catalog Seed */}
              <label className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={seedStarterStock}
                  onChange={e => setSeedStarterStock(e.target.checked)}
                  className="mt-0.5 rounded text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <div className="font-semibold text-amber-300">
                    Seed with Curated Cafe & Restaurant Stock Catalog
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Preloads 10 essential items (Beans, Whole Milk, Oat Milk, Syrups, Matcha, Cups, Butter, Olive Oil) with barcodes ready to test scanning right away!
                  </div>
                </div>
              </label>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-900/30 flex items-center gap-2 transition-all"
                >
                  <span>Review & Complete Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & INSTANT ACTIVATION */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Your Restaurant Workspace Is Ready</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Click below to provision your database, configure dispensing zones, and log into your terminal with your Admin PIN.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Business Profile
                  </div>
                  <div className="font-bold text-white text-sm">{businessName}</div>
                  <div className="text-slate-400 text-xs">{businessType} · {city || 'Downtown'}</div>
                  <div className="text-slate-400 text-xs">Owner: {ownerName} ({adminEmail})</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Plan & Branch Setup
                  </div>
                  <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                    <span>{selectedPlan.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                      14-Day Free Trial
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs">First Branch: {branchName}</div>
                  <div className="text-slate-400 text-xs">Zones: {zones.length} active (Bar, Kitchen, Cold, Dry)</div>
                </div>
              </div>

              {/* Login Credentials Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4" />
                  <span>Immediate Access Credentials</span>
                </div>
                <div className="text-slate-300">
                  Your store admin account is ready. Use PIN: <strong className="text-white font-mono text-sm px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40">{ownerPin}</strong> to authenticate on any tablet or terminal.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={isSubmitting}
                  className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={isSubmitting}
                  className="px-7 h-11 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-950/50 flex items-center gap-2 transition-all active:scale-95"
                >
                  <span>{isSubmitting ? 'Provisioning...' : 'Complete & Launch Restaurant Terminal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
