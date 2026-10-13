import React, { useState } from 'react';
import { Lock, Coffee, AlertCircle, KeyRound, ShieldCheck, ChevronRight, Store, Building2, Sparkles, Link2 } from 'lucide-react';
import { Employee, CafeTenant, LicenseInfo } from '../types/stock';
import { LicenseManager } from '../services/licenseService';

interface PinLoginProps {
  cafe: CafeTenant;
  tenants: CafeTenant[];
  onSelectCafe: (tenant: CafeTenant) => void;
  license: LicenseInfo;
  onVerifyPin: (pin: string) => Promise<{ success: boolean; user?: Employee; message?: string }>;
  onLoginSuccess: (user: Employee) => void;
  onLicenseRenewed: () => void;
  onOpenSuperAdmin?: () => void;
  onGoToLanding?: () => void;
}

export const PinLogin: React.FC<PinLoginProps> = ({
  cafe,
  tenants,
  onSelectCafe,
  license,
  onVerifyPin,
  onLoginSuccess,
  onLicenseRenewed,
  onOpenSuperAdmin,
  onGoToLanding
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [renewalCode, setRenewalCode] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [renewMsg, setRenewMsg] = useState('');
  const [renewSuccess, setRenewSuccess] = useState(false);
  const [inputAccessCode, setInputAccessCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [isCheckingPin, setIsCheckingPin] = useState(false);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 8) {
      setErrorMsg('');
      const nextPin = pin + digit;
      setPin(nextPin);
    }
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const checkPin = async (pinToCheck: string) => {
    if (pinToCheck.length < (import.meta.env.DEV ? 4 : 6)) {
      setErrorMsg(import.meta.env.DEV ? 'Enter your 4-digit PIN.' : 'Enter your 6–8 digit PIN.');
      return;
    }

    setIsCheckingPin(true);
    try {
      const res = await onVerifyPin(pinToCheck);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Invalid PIN. Please try again.');
        setPin('');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
      setPin('');
    } finally {
      setIsCheckingPin(false);
    }
  };

  const handleApplyAccessCode = () => {
    const code = inputAccessCode.trim().toUpperCase();
    if (!code) return;

    const matched = tenants.find(t => t.accessCode?.toUpperCase() === code);
    if (matched) {
      onSelectCafe(matched);
      setShowCodeInput(false);
      setInputAccessCode('');
      setErrorMsg('');
    } else {
      setErrorMsg(`No cafe found matching access code "${code}".`);
    }
  };

  const handleApplyRenewal = async () => {
    if (!renewalCode.trim()) {
      setRenewMsg('Please enter an activation code.');
      return;
    }
    setRenewing(true);
    setRenewMsg('');
    const res = await LicenseManager.verifyAndRedeemCode(renewalCode, cafe.id);
    setRenewing(false);
    if (res.success && res.expiryDate) {
      LicenseManager.saveLicense(cafe.id, res.expiryDate, res.tier || 'Enterprise', false);
      setRenewSuccess(true);
      setRenewMsg(res.message);
      setTimeout(() => {
        onLicenseRenewed();
      }, 1200);
    } else {
      setRenewSuccess(false);
      setRenewMsg(res.message);
    }
  };

  // If system is hard-locked due to expiration or remote kill-switch
  if (license.status === 'expired' || license.status === 'revoked') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-950/80 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight">System Locked</h1>
          <p className="text-sm font-semibold text-amber-400 mt-1">{cafe.name}</p>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 my-4 text-xs text-red-300">
            {license.status === 'revoked'
              ? 'This system has been remotely suspended. Contact NileLink Stock Support.'
              : `License expired on ${new Date(license.expiryDate).toLocaleDateString()}. Please enter a renewal code to restore service.`}
          </div>

          <div className="mt-4 text-left">
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              Enter Cryptographic Renewal Key
            </label>
            <div className="relative">
              <input
                type="text"
                value={renewalCode}
                onChange={e => setRenewalCode(e.target.value.toUpperCase())}
                placeholder="YYYYMMDD-CAFEID-SIG8 or BSK2-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>

            <button
              onClick={handleApplyRenewal}
              disabled={renewing}
              className="w-full mt-3 h-11 bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 active:scale-[0.98]"
            >
              {renewing ? 'Verifying Digital Signature...' : 'Unlock System'}
            </button>

            {renewMsg && (
              <p className={`mt-3 text-xs text-center ${renewSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                {renewMsg}
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-slate-700 text-center">
              <p className="text-xs text-slate-400">
                Demo Activation Code for {cafe.name}:
              </p>
              <button
                onClick={() => setRenewalCode(`20271231-${cafe.id.toUpperCase().slice(0, 8)}-ANY`)}
                className="text-xs font-mono text-amber-400 hover:underline mt-1"
              >
                Auto-fill 2027 Extended License Key
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
      {/* Top Tenant Header with Strict Multi-Tenant Isolation */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between text-xs text-slate-400 pt-2">
        <div className="flex items-center gap-2">
          {onGoToLanding && (
            <button
              onClick={onGoToLanding}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors pr-2 border-r border-slate-700"
              title="Return to Public SaaS Landing Page"
            >
              <span>← Home</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-200">{cafe.name}</span>
            {cafe.city && <span className="text-[10px] text-slate-500">· {cafe.city}</span>}
          </div>
        </div>
        {import.meta.env.DEV && <div>
          <button
            onClick={() => setShowCodeInput(!showCodeInput)}
            className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-mono transition-colors"
            title="Switch client store using private access code"
          >
            <KeyRound className="w-3 h-3" />
            <span>Switch Store Code</span>
          </button>
        </div>}
      </div>

      {/* Center Keypad Card */}
      <div className="max-w-sm w-full mx-auto my-auto bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-inner">
            <Coffee className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{cafe.name}</h1>
          <p className="text-xs text-slate-400 mt-1">Enter your staff PIN to sign in</p>
        </div>

        {/* PIN Dots Display */}
        <div className="h-12 flex items-center justify-center gap-2 mb-6 bg-slate-900/60 rounded-2xl border border-slate-700/50">
          {Array.from({ length: import.meta.env.DEV ? 4 : 8 }, (_, idx) => idx).map(idx => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                pin.length > idx
                  ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-red-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 active:scale-[0.96] text-white text-xl font-semibold transition-all border border-slate-600/40 flex items-center justify-center shadow-sm select-none"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-700/30 hover:bg-slate-700/50 active:scale-[0.96] text-slate-400 hover:text-white text-sm font-semibold transition-all border border-slate-700/50 flex items-center justify-center select-none"
          >
            Clear
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 active:scale-[0.96] text-white text-xl font-semibold transition-all border border-slate-600/40 flex items-center justify-center shadow-sm select-none"
          >
            0
          </button>
          <button
            onClick={() => checkPin(pin)}
            disabled={pin.length < (import.meta.env.DEV ? 4 : 6) || isCheckingPin}
            className="h-14 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:hover:bg-amber-600 active:scale-[0.96] text-white text-lg font-bold transition-all flex items-center justify-center shadow-md shadow-amber-900/30 select-none"
          >
            {isCheckingPin ? <span className="text-xs">Checking…</span> : <ChevronRight className="w-6 h-6" />}
          </button>
        </div>

        {/* Access Code Switcher */}
        {import.meta.env.DEV && <div className="mt-4 pt-4 border-t border-slate-700/60">
          {!showCodeInput ? (
            <button
              onClick={() => setShowCodeInput(true)}
              className="text-[11px] text-amber-400 hover:underline mx-auto flex items-center justify-center gap-1"
            >
              <KeyRound className="w-3 h-3" />
              <span>Have a Cafe Access Code? Enter here</span>
            </button>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={inputAccessCode}
                  onChange={e => setInputAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DEMO-ENTERPRISE-01"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleApplyAccessCode}
                  className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
                >
                  Load
                </button>
              </div>
              <button
                onClick={() => setShowCodeInput(false)}
                className="text-[10px] text-slate-500 hover:text-slate-400 block mx-auto"
              >
                Cancel
              </button>
            </div>
          )}
        </div>}

        {/* Quick Demo Credentials helper: Admin and Normal Employee Only */}
        {import.meta.env.DEV && <div className="mt-4 pt-3 border-t border-slate-700/60">
          <p className="text-[11px] font-medium text-slate-400 text-center mb-2">
            Quick Sign-In (Demo Testing):
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <button
              onClick={() => checkPin('2468')}
              className="p-2 bg-slate-700/40 hover:bg-slate-700/70 border border-amber-500/30 rounded-xl text-xs text-slate-300 transition-colors shadow-xs"
            >
              <span className="block font-bold text-amber-400">Admin Demo</span>
              <span className="text-[10px] text-slate-400 font-mono">PIN: 2468</span>
            </button>
            <button
              onClick={() => checkPin('0000')}
              className="p-2 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-700 rounded-xl text-xs text-slate-300 transition-colors shadow-xs"
            >
              <span className="block font-bold text-slate-200">Employee Demo</span>
              <span className="text-[10px] text-slate-400 font-mono">PIN: 0000</span>
            </button>
          </div>
        </div>}
      </div>

      {/* Footer Info */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-500 py-2 flex flex-col items-center gap-1.5">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>NileLink Stock Platform · Cloudflare Edge &amp; Anti-Tamper Core</span>
        </div>
        {onOpenSuperAdmin && (
          <button
            onClick={onOpenSuperAdmin}
            className="text-[11px] text-amber-400/80 hover:text-amber-400 hover:underline flex items-center gap-1 mt-1 font-semibold"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Launch Super Admin SaaS Console</span>
          </button>
        )}
      </div>
    </div>
  );
};
