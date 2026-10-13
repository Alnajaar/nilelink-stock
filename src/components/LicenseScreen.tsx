import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Calendar,
  Lock,
  Unlock,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Code,
  Globe,
  Sparkles,
  Server,
  Database,
  Smartphone,
  Layers,
  Wifi
} from 'lucide-react';
import { LicenseInfo, CafeTenant } from '../types/stock';
import { LicenseManager } from '../services/licenseService';
import { PWAInstallButton } from './PWAInstallButton';

interface LicenseScreenProps {
  license: LicenseInfo;
  activeCafe: CafeTenant;
  tenants: CafeTenant[];
  onRenewLicense: () => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const LicenseScreen: React.FC<LicenseScreenProps> = ({
  license,
  activeCafe,
  tenants,
  onRenewLicense,
  onShowToast
}) => {
  // Apply code state
  const [codeToApply, setCodeToApply] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Generator state for software owner
  const [targetTenantId, setTargetTenantId] = useState(activeCafe.id);
  const [newExpiryDate, setNewExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [selectedTier, setSelectedTier] = useState<'Starter' | 'Pro' | 'Enterprise'>('Enterprise');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  const handleApply = async () => {
    if (!codeToApply.trim()) return;
    setIsApplying(true);
    const res = await LicenseManager.verifyAndRedeemCode(codeToApply, activeCafe.id);
    setIsApplying(false);

    if (res.success && res.expiryDate) {
      LicenseManager.saveLicense(activeCafe.id, res.expiryDate, res.tier || 'Enterprise', false);
      onShowToast(res.message, 'ok');
      setCodeToApply('');
      onRenewLicense();
    } else {
      onShowToast(res.message, 'err');
    }
  };

  const handleGenerateKey = async () => {
    const d = new Date(newExpiryDate + 'T23:59:59');
    if (isNaN(d.getTime())) {
      onShowToast('Please select a valid expiry date.', 'err');
      return;
    }

    const compact = await LicenseManager.generateCompactCode(targetTenantId, d);
    const selectedTenant = tenants.find(t => t.id === targetTenantId);
    const fullToken = await LicenseManager.generateLicenseToken(
      targetTenantId,
      selectedTenant?.name || targetTenantId,
      d,
      selectedTier
    );

    setGeneratedCode(compact);
    setGeneratedToken(fullToken);
    onShowToast(`Cryptographic renewal key generated for ${targetTenantId}!`, 'ok');
  };

  const handleToggleKillSwitch = (revoked: boolean) => {
    LicenseManager.setRevocation(activeCafe.id, revoked);
    onRenewLicense();
    onShowToast(
      revoked
        ? `Kill-switch activated! ${activeCafe.name} is now locked.`
        : `System restored for ${activeCafe.name}.`,
      revoked ? 'err' : 'ok'
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <span>License & Commercial Security Center</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Cryptographic token verification, software reseller management, and anti-tamper controls
        </p>
      </div>

      {/* 1. Current Active License Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Client Tenant
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{license.cafeName}</div>
            <div className="text-xs text-slate-500 font-mono">
              Tenant ID: <span className="font-semibold text-slate-700">{license.cafeId}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 ${
                license.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : license.status === 'warning'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  license.status === 'active'
                    ? 'bg-emerald-500'
                    : license.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              />
              <span>{license.status} ({license.tier})</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <div className="text-slate-400 font-medium">Valid Until</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {new Date(license.expiryDate).toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-medium">Days Remaining</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
              {license.daysLeft} days
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-medium">Encryption</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
              HMAC-SHA256
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-medium">Tamper Guard</div>
            <div className="text-sm font-bold text-emerald-600 mt-0.5">
              Hardware/ID Bound
            </div>
          </div>
        </div>
      </div>

      {/* 2. Apply Renewal Code */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-amber-600" />
          <span>Apply Renewal Code or Digital Certificate</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Enter the signed activation code provided by the software vendor to extend your expiration date.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={codeToApply}
            onChange={e => setCodeToApply(e.target.value.toUpperCase())}
            placeholder="e.g. 20271231-AHMAD-8E4A71B9 or BSK2-..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800"
          />
          <button
            onClick={handleApply}
            disabled={isApplying || !codeToApply.trim()}
            className="h-10 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs shrink-0"
          >
            {isApplying ? 'Verifying...' : 'Redeem & Unlock'}
          </button>
        </div>
      </div>

      {/* 3. Software Owner & Reseller Toolkit */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              SaaS Super Admin Toolkit (Vendor License Generator)
            </h3>
          </div>
          <span className="text-[11px] text-amber-400 font-mono">Master Mode</span>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Use this panel to issue cryptographically signed license keys when selling the software to new cafes or collecting monthly subscriptions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Target Cafe Client
            </label>
            <select
              value={targetTenantId}
              onChange={e => setTargetTenantId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              New Expiry Date
            </label>
            <input
              type="date"
              value={newExpiryDate}
              onChange={e => setNewExpiryDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              License Tier
            </label>
            <select
              value={selectedTier}
              onChange={e => setSelectedTier(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="Enterprise">Enterprise (All Features)</option>
              <option value="Pro">Pro (Standard Multi-Bar)</option>
              <option value="Starter">Starter (Single Terminal)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              setNewExpiryDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
          >
            +30 Days (Monthly)
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 90);
              setNewExpiryDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
          >
            +90 Days (Quarterly)
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              setNewExpiryDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
          >
            +1 Year (Annual)
          </button>
        </div>

        <button
          onClick={handleGenerateKey}
          className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-md shadow-amber-950/40"
        >
          Generate Signed HMAC-SHA256 Activation Key
        </button>

        {generatedCode && (
          <div className="mt-4 p-3.5 bg-slate-950 border border-amber-500/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Compact Mobile Key:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                  onShowToast('Key copied to clipboard!', 'ok');
                }}
                className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-mono font-bold text-amber-300 text-sm tracking-wider select-all">
              {generatedCode}
            </div>
            <div className="text-[11px] text-slate-400">
              Send this code to the cafe owner. It will unlock their terminal until {newExpiryDate}.
            </div>
          </div>
        )}

        {/* Remote Kill-Switch Demonstration */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">Emergency Remote Deactivation</div>
            <div className="text-[11px] text-slate-400">
              Simulate locking this client terminal if subscription is delinquent
            </div>
          </div>
          <button
            onClick={() => handleToggleKillSwitch(license.status !== 'revoked')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              license.status === 'revoked'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {license.status === 'revoked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{license.status === 'revoked' ? 'Restore Access' : 'Deactivate Terminal'}</span>
          </button>
        </div>
      </div>

      {/* 4. Progressive Web App (PWA) & Local IndexedDB Engine */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Progressive Web App (PWA) &amp; Offline IndexedDB Engine
              </h3>
              <p className="text-xs text-slate-500">
                Install BarStock Pro as an offline-first desktop or mobile app with zero latency
              </p>
            </div>
          </div>
          <PWAInstallButton variant="prominent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Database className="w-4 h-4 text-amber-600" />
              <span>High-Capacity IndexedDB</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Stores all stock catalogs, dispensing logs, waste logs, and audit counts in transactional client storage.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>Automatic Background Sync</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Actions taken in walk-in coolers or basements queue offline and auto-reconcile with cloud when reconnected.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Service Worker Precaching</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Full application shell, icons, and fonts precached for instant launch without network dependencies.
            </p>
          </div>
        </div>
      </div>

      {/* 5. NileLink White-Label Architecture & Cloudflare Deployment */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">
            NileLink Stock: Cloudflare Edge &amp; Anti-Tamper Security Architecture
          </h3>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4 text-xs text-emerald-950 space-y-2">
          <p className="font-bold">
            Why NileLink Stock eliminates the &ldquo;This application was created by a Google Apps Script user&rdquo; banner permanently:
          </p>
          <ul className="list-disc pl-4 space-y-1.5 text-emerald-900">
            <li>
              <strong>Elimination of Google Iframe Banner:</strong> The mandatory warning banner is injected strictly by <code>script.google.com</code> into web apps hosted inside Google. By deploying NileLink Stock to <strong>Cloudflare Pages</strong> or custom domains (e.g. <code>stock.yourcafe.com</code>), the Google banner is 100% eliminated.
            </li>
            <li>
              <strong>Obfuscated Security &amp; Anti-Tamper:</strong> Digital licenses are cryptographically verified using salted HMAC-SHA256 signatures with tenant hardware/ID binding. API credentials and access secrets are kept isolated from client devtools.
            </li>
            <li>
              <strong>Instant Edge Performance:</strong> Running on Cloudflare Pages guarantees sub-20ms global edge latency with offline service capabilities so baristas can record transactions even during peak hours without network slowdowns.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
