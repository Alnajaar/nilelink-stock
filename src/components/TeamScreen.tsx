import React, { useState } from 'react';
import { Users, UserPlus, KeyRound, Check, X, Trash2, Shield, Coffee } from 'lucide-react';
import { Employee, UserRole } from '../types/stock';

interface TeamScreenProps {
  employees: Employee[];
  currency: string;
  onAddEmployee: (name: string, pin: string, role: Exclude<UserRole, 'admin' | 'superadmin'>, compensation: {
    payType: 'hourly' | 'salary';
    payRateMinor: number;
    payPeriod: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual';
    currency: string;
  }) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
}

export const TeamScreen: React.FC<TeamScreenProps> = ({
  employees,
  currency,
  onAddEmployee,
  onToggleActive,
  onDeleteEmployee
}) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isAdding, setIsAdding] = useState(false);
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
  const [payRate, setPayRate] = useState('');
  const [payPeriod, setPayPeriod] = useState<'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual'>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !new RegExp(`^\\d{${import.meta.env.DEV ? '4,8' : '6,8'}}$`).test(pin)) {
      setError(`Enter a valid ${import.meta.env.DEV ? '4–8' : '6–8'} digit PIN.`);
      return;
    }
    const amount = Number(payRate);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid non-negative compensation amount.');
      return;
    }
    if (role === 'admin' || role === 'superadmin') return;
    setSubmitting(true);
    setError('');
    try {
      await onAddEmployee(name.trim(), pin.trim(), role, {
        payType,
        payRateMinor: Math.round(amount * 100),
        payPeriod,
        currency
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this team member.');
      return;
    } finally {
      setSubmitting(false);
    }
    setName('');
    setPin('');
    setRole('staff');
    setPayType('hourly');
    setPayRate('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <span>Staff & PIN Access Roster</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage team access, configured compensation, and active status.</p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5 text-amber-400" />
          <span>{isAdding ? 'Cancel' : 'Add Team Member'}</span>
        </button>
      </div>

      {/* Add Employee Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 animate-in fade-in-50 duration-150"
        >
          <h3 className="text-sm font-bold text-slate-900">Add New Team Member</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Leila Barista"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {import.meta.env.DEV ? '4–8 digit PIN Code *' : '6–8 digit PIN Code *'}
              </label>
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={8}
                minLength={import.meta.env.DEV ? 4 : 6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={import.meta.env.DEV ? '4–8 digits' : '6–8 digits'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role & Permissions *
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value="staff">Staff (Take, History, Count)</option>
                <option value="teamlead">Team Lead (+ Stock In, Waste, Stock Levels)</option>
                <option value="manager">Manager (+ Auto-Order, Suppliers, Reports)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Compensation type
              <select value={payType} onChange={event => setPayType(event.target.value as 'hourly' | 'salary')}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {payType === 'hourly' ? `Hourly rate (${currency})` : `Gross salary amount (${currency})`}
              <input type="number" min="0" step="0.01" required value={payRate} onChange={event => setPayRate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            </label>
            {payType === 'salary' && (
              <label className="block text-xs font-semibold text-slate-700">
                Salary period
                <select value={payPeriod} onChange={event => setPayPeriod(event.target.value as typeof payPeriod)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semimonthly</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
            )}
          </div>

          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Create Staff Profile'}
          </button>
        </form>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {employees.map(emp => {
          const isAdmin = emp.role === 'admin';

          return (
            <div
              key={emp.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    emp.role === 'admin'
                      ? 'bg-amber-100 text-amber-800'
                      : emp.role === 'manager'
                      ? 'bg-blue-100 text-blue-800'
                      : emp.role === 'teamlead'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {emp.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-amber-700" />
                  ) : (
                    <Coffee className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{emp.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        emp.role === 'admin'
                          ? 'bg-amber-100 text-amber-800'
                          : emp.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : emp.role === 'teamlead'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {emp.role === 'teamlead' ? 'Team Lead' : emp.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                    {emp.payType && <span>
                      {emp.payType === 'hourly' ? `${(emp.payRateMinor || 0) / 100} ${emp.currency || currency}/hr` :
                        `${(emp.payRateMinor || 0) / 100} ${emp.currency || currency} ${emp.payPeriod || 'monthly'}`}
                    </span>}
                    {emp.payType && <span>·</span>}
                    <span className={emp.active ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
                      {emp.active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {!isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggleActive(emp.id, !emp.active)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      emp.active
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {emp.active ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    onClick={() => onDeleteEmployee(emp.id)}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                    title="Deactivate member and revoke access"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
