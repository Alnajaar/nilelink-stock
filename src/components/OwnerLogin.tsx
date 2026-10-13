import React, { FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound, Store } from 'lucide-react';

interface OwnerLoginProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  onBack: () => void;
}

export const OwnerLogin: React.FC<OwnerLoginProps> = ({ onSubmit, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(email.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-5">
        <button type="button" onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Public site
        </button>
        <div className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold">Owner sign in</h1>
          <p className="text-sm text-slate-400 mt-1">Use your business owner email and password.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-300">
          Owner email
          <input autoComplete="username" required type="email" value={email} onChange={event => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-300">
          Password
          <input autoComplete="current-password" required type="password" value={password} onChange={event => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" />
        </label>
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
          <KeyRound className="w-4 h-4" /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
};
