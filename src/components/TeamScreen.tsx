import React, { useState } from 'react';
import { Users, UserPlus, KeyRound, Check, X, Trash2, Shield, Coffee } from 'lucide-react';
import { Employee, UserRole } from '../types/stock';

interface TeamScreenProps {
  employees: Employee[];
  onAddEmployee: (name: string, pin: string, role: UserRole) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDeleteEmployee: (id: string) => void;
}

export const TeamScreen: React.FC<TeamScreenProps> = ({
  employees,
  onAddEmployee,
  onToggleActive,
  onDeleteEmployee
}) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pin.length < 3) return;
    onAddEmployee(name.trim(), pin.trim(), role);
    setName('');
    setPin('');
    setRole('staff');
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
          <p className="text-xs text-slate-500 mt-0.5">
            Manage barista and manager PINs, permissions, and active status
          </p>
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
                4-Digit PIN Code *
              </label>
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 2468"
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
                <option value="admin">Store Owner (Full Control &amp; Settings)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs"
          >
            Create Staff Profile
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
                    <span>PIN: {emp.pin}</span>
                    <span>·</span>
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
                    title="Remove member"
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
