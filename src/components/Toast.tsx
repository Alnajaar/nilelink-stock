import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'ok' | 'err';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'ok', onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        className={`rounded-2xl px-4 py-3 shadow-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
          type === 'ok'
            ? 'bg-slate-900 text-white border-slate-700'
            : 'bg-red-950 text-red-100 border-red-800'
        }`}
      >
        <div className="flex items-center gap-2">
          {type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{message}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 rounded-lg"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
