import React from 'react';
import { Building2, Calendar, Globe, Landmark, MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { SUPPLIED_ASSETS } from '../shared/constants';
import { formatBr } from '../shared/finance';

export function AboutPage() {
  const { config } = useAuth();
  const company = config?.companyInfo;
  const settings = config?.settings;

  return (
    <AppShell title="About">
      <div className="space-y-5">
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-6">
            <h2 className="text-2xl font-extrabold">{company?.name || 'The Coca-Cola Company'}</h2>
            <p className="text-sm text-white/85 mt-2 max-w-3xl leading-relaxed">
              {company?.summary}
            </p>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div className="w-full h-56 rounded-2xl bg-white border border-slate-100 overflow-hidden flex justify-center items-center">
              <img
                src={SUPPLIED_ASSETS.bottles}
                alt="Coca-Cola bottles"
                className="h-full w-auto object-cover [clip-path:inset(6px_0_0_0)]"
                referrerPolicy="no-referrer"
              />
            </div>
            <img
              src={SUPPLIED_ASSETS.factory}
              alt="Coca-Cola bottling plant production line"
              className="w-full h-56 object-cover rounded-2xl border border-slate-100"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="px-5 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#D71920] shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Company</p>
                <p className="font-bold text-slate-900">{company?.name}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#D71920] shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Founded</p>
                <p className="font-bold text-slate-900">{company?.founded}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-[#D71920] shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Founder</p>
                <p className="font-bold text-slate-900">{company?.founder}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#D71920] shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Headquarters</p>
                <p className="font-bold text-slate-900">{company?.headquarters}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center gap-3 sm:col-span-2">
              <Globe className="w-5 h-5 text-[#D71920] shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Industry</p>
                <p className="font-bold text-slate-900">{company?.industry}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Admin-Managed Payment Information & Compliance Disclosure */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#D71920]" />
            <h3 className="text-base font-bold text-slate-900">
              Administrator-Managed Payment Information
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Landmark className="w-4 h-4 text-[#D71920]" />
                <span>Deposit Methods</span>
              </div>
              {config?.activeDepositMethods && config.activeDepositMethods.length > 0 ? (
                config.activeDepositMethods.map((m) => (
                  <div key={m.id} className="text-xs border-t first:border-t-0 border-slate-200/70 pt-1.5 first:pt-0">
                    <p className="text-slate-800 font-semibold">{m.name}</p>
                    <p className="font-mono font-bold text-[#D71920]">{m.accountNumber}</p>
                  </div>
                ))
              ) : (
                <>
                  <p className="text-slate-700">{settings?.depositCbeAccountName}</p>
                  <p className="font-mono font-bold text-[#D71920]">{settings?.depositCbeAccountNumber}</p>
                </>
              )}
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Landmark className="w-4 h-4 text-[#D71920]" />
                <span>Payout Methods</span>
              </div>
              <p className="text-slate-700">
                {config?.activePayoutMethods && config.activePayoutMethods.length > 0
                  ? config.activePayoutMethods.map((m) => m.name).join(', ')
                  : settings?.withdrawalMethodOnly || 'CBE ONLY (Approved CBE account required)'}
              </p>
              <p className="text-xs text-slate-500">
                Minimum {formatBr(settings?.minWithdrawal ?? 150)} · Fee {settings?.withdrawalFeePercent ?? 17}%
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {company?.authorizationDisclosure}
          </p>
        </section>
      </div>
    </AppShell>
  );
}
