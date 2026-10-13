import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Download, LogIn, LogOut, Pause, Play, RefreshCw } from 'lucide-react';
import { Employee } from '../types/stock';
import { ApiService, WorkforceTimeEntry } from '../services/apiService';

interface WorkforceScreenProps {
  tenantId: string;
  user: Employee;
  onShowToast: (message: string, type?: 'ok' | 'err') => void;
}

function initialRange(): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export const WorkforceScreen: React.FC<WorkforceScreenProps> = ({ tenantId, user, onShowToast }) => {
  const canManage = ['admin', 'manager', 'superadmin'].includes(user.role);
  const canClock = user.role !== 'superadmin';
  const [range, setRange] = useState(initialRange);
  const [activeEntry, setActiveEntry] = useState<WorkforceTimeEntry | null>(null);
  const [entries, setEntries] = useState<WorkforceTimeEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const results = await Promise.all([
        canClock ? ApiService.getMyTime() : Promise.resolve(null),
        canManage ? ApiService.getTimeEntries(tenantId, range.from, range.to) : Promise.resolve([])
      ]);
      setActiveEntry(results[0]);
      setEntries(results[1]);
      setApiReady(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not load workforce time data.';
      setError(message);
      setApiReady(false);
    }
  }, [canClock, canManage, range.from, range.to, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clock = async (action: 'clock_in' | 'clock_out' | 'start_break' | 'end_break') => {
    setBusy(true);
    try {
      await ApiService.recordClockAction({ tenantId, action });
      await refresh();
      onShowToast('Time record updated.');
    } catch (reason) {
      onShowToast(reason instanceof Error ? reason.message : 'Could not update your time record.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (entryId: string, decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await ApiService.approveTimeEntry(tenantId, entryId, decision);
      await refresh();
      onShowToast(decision === 'approved' ? 'Timesheet approved.' : 'Timesheet rejected.');
    } catch (reason) {
      onShowToast(reason instanceof Error ? reason.message : 'Could not update the timesheet.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = async () => {
    setBusy(true);
    try {
      const csv = await ApiService.exportPayroll(tenantId, range.from, range.to);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `time-export-${range.from}-${range.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      onShowToast(reason instanceof Error ? reason.message : 'Could not export time records.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const clockIn = activeEntry !== null;
  const onBreak = Boolean(activeEntry?.breakStartedAt);
  const pending = entries.filter(entry => entry.status === 'submitted');

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <Clock3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Workforce &amp; time</h2>
          <p className="text-xs text-slate-500">Clock shifts, review submitted hours, and export approved records.</p>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canClock && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">{user.name}</h3>
              <p className="text-xs text-slate-500">
                {activeEntry ? `Shift started ${new Date(activeEntry.clockIn).toLocaleString()}` : 'You are currently clocked out.'}
                {activeEntry && ` · ${activeEntry.breakMinutes} break minutes recorded`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!clockIn ? (
                <button disabled={busy || !apiReady} onClick={() => void clock('clock_in')}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Clock in
                </button>
              ) : (
                <>
                  <button disabled={busy || !apiReady} onClick={() => void clock(onBreak ? 'end_break' : 'start_break')}
                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
                    {onBreak ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {onBreak ? 'End break' : 'Start break'}
                  </button>
                  {!onBreak && (
                    <button disabled={busy || !apiReady} onClick={() => void clock('clock_out')}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Clock out
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {canManage && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <label className="text-xs font-semibold text-slate-600">From
                <input type="date" value={range.from} max={range.to} onChange={event => setRange(prev => ({ ...prev, from: event.target.value }))}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">To
                <input type="date" value={range.to} min={range.from} onChange={event => setRange(prev => ({ ...prev, to: event.target.value }))}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => void refresh()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button disabled={busy || !apiReady} onClick={() => void downloadCsv()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export approved time
              </button>
            </div>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Exports include approved time entries and hourly gross estimates only. Salary rates are stored for reference; payroll taxes, statutory deductions, and salary-period proration are not calculated.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold">Clock in</th>
                  <th className="p-3 font-semibold">Clock out</th>
                  <th className="p-3 font-semibold">Hours</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td className="p-3 font-semibold text-slate-800">{entry.employeeName}</td>
                    <td className="p-3 text-slate-600">{new Date(entry.clockIn).toLocaleString()}</td>
                    <td className="p-3 text-slate-600">{entry.clockOut ? new Date(entry.clockOut).toLocaleString() : '—'}</td>
                    <td className="p-3 text-slate-700">{entry.hours ?? '—'}</td>
                    <td className="p-3 capitalize text-slate-600">{entry.status}</td>
                    <td className="p-3">
                      {entry.status === 'submitted' && (
                        <div className="flex gap-2">
                          <button disabled={busy || !apiReady} onClick={() => void decide(entry.id, 'approved')} className="font-bold text-emerald-700 disabled:opacity-50">Approve</button>
                          <button disabled={busy || !apiReady} onClick={() => void decide(entry.id, 'rejected')} className="font-bold text-red-700 disabled:opacity-50">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No time entries for this date range.</td></tr>}
              </tbody>
            </table>
          </div>
          {pending.length > 0 && <p className="text-xs text-amber-700">{pending.length} submitted shift(s) await approval.</p>}
        </section>
      )}
    </div>
  );
};
