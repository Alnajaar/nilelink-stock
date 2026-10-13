import React from 'react';
import { Truck, Phone, Mail, Calendar, CreditCard, ExternalLink } from 'lucide-react';
import { Supplier } from '../types/stock';

interface SuppliersScreenProps {
  suppliers: Supplier[];
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ suppliers }) => {
  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-600" />
          <span>Vendor & Supplier Directory</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct distributor contacts, payment terms, delivery schedules, and order minimums
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map(sup => (
          <div
            key={sup.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{sup.name}</h3>
                  <div className="text-xs font-medium text-amber-600">{sup.category}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                  <Truck className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2 mt-4 text-xs">
                <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                  <span className="text-slate-400">Representative</span>
                  <span className="font-semibold text-slate-800">{sup.contactPerson}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                  </span>
                  <a
                    href={`tel:${sup.phone}`}
                    className="font-mono font-medium text-amber-600 hover:underline"
                  >
                    {sup.phone}
                  </a>
                </div>

                <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                  </span>
                  <a
                    href={`mailto:${sup.email}`}
                    className="text-slate-700 hover:underline truncate max-w-[180px]"
                  >
                    {sup.email}
                  </a>
                </div>

                <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Payment Terms
                  </span>
                  <span className="font-medium text-slate-800">{sup.paymentTerms}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 py-1">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Delivery Days
                  </span>
                  <span className="font-medium text-slate-800 text-right">{sup.deliveryDays}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
              <a
                href={`tel:${sup.phone}`}
                className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Vendor</span>
              </a>
              <a
                href={`https://wa.me/${sup.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
