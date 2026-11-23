import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { SUPPLIED_ASSETS } from '../shared/constants';
import { formatEtb, getCustomerDisplayName } from '../shared/finance';

interface TeamMemberItem {
  id: string;
  level: 1 | 2 | 3;
  displayName: string;
  maskedPhone: string;
  referralCode: string;
  registeredAt: string;
  qualified: boolean;
  qualifyingStatus: string;
  qualifyingPurchaseDate: string | null;
  qualifyingPurchaseValue: number;
}

interface TeamResponse {
  invitationCode: string;
  rates: { level1: number; level2: number; level3: number };
  summary: {
    totalRegisteredMembers: number;
    qualifyingMembersCount: number;
    totalQualifyingVolume: number;
    teamCommission: number;
    level1Count: number;
    level2Count: number;
    level3Count: number;
  };
  levels: {
    level1: TeamMemberItem[];
    level2: TeamMemberItem[];
    level3: TeamMemberItem[];
  };
}

export function TeamPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3>(1);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);
  const [copyError, setCopyError] = useState('');

  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    apiFetch<TeamResponse>('/api/team')
      .then(setData)
      .catch((err: any) => {
        setLoadError(err?.message || 'Unable to load team details right now.');
      })
      .finally(() => setLoading(false));
  }, []);

  const displayName = getCustomerDisplayName(user);
  const inviteUrl = data?.invitationCode
    ? (() => {
        const url = new URL('/register', window.location.origin);
        url.searchParams.set('ref', data.invitationCode.trim().toUpperCase());
        return url.toString();
      })()
    : '';

  const copyText = async (text: string, field: 'code' | 'link') => {
    setCopyError('');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      // Android in-app browsers and non-secure contexts may block Clipboard API.
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = text;
      temporaryInput.setAttribute('readonly', '');
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand('copy');
      temporaryInput.remove();
      if (!copied) {
        setCopyError('Automatic copy was blocked. Please press and hold the referral link above to copy it.');
        return;
      }
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2500);
  };

  const activeList =
    activeLevel === 1
      ? data?.levels.level1 || []
      : activeLevel === 2
      ? data?.levels.level2 || []
      : data?.levels.level3 || [];

  return (
    <AppShell title="My Team">
      <div className="space-y-5">
        {/* Banner */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#D71920] to-[#98080D] text-white grid grid-cols-1 sm:grid-cols-12 shadow-md">
          <div className="sm:col-span-7 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-white/85 mb-0.5">{displayName}&apos;s Referral Network</p>
            <h2 className="text-xl sm:text-2xl font-bold">My 3-Level Referral Team</h2>
            <p className="text-xs sm:text-sm text-white/85 mt-1">
              Qualifying status requires a verified product purchase. Registration alone does not award commission.
            </p>
          </div>
          <div className="sm:col-span-5 h-32 sm:h-auto overflow-hidden bg-white flex justify-center items-center">
            <img
              src={SUPPLIED_ASSETS.bottles}
              alt="Coca-Cola bottles"
              className="h-full w-auto max-h-40 object-cover [clip-path:inset(6px_0_0_0)]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Three Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 text-center">
            <Users className="w-5 h-5 text-[#D71920] mx-auto mb-1" />
            <p className="text-[11px] sm:text-xs text-slate-500">Qualifying Team</p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : data?.summary.qualifyingMembersCount ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 text-center">
            <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-[11px] sm:text-xs text-slate-500">Total Registered</p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : data?.summary.totalRegisteredMembers ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-[11px] sm:text-xs text-slate-500">Team Income</p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : formatEtb(data?.summary.teamCommission ?? 0)}
            </p>
          </div>
        </div>

        {/* Referral Commission Rates */}
        <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="bg-[#D71920] text-white px-4 py-2.5 flex items-center justify-between text-sm font-bold">
            <span>Referral Rewards</span>
            <span className="text-[11px] font-normal text-white/90">ETB</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Level 1</p>
              <p className="text-xl font-extrabold text-[#D71920] tabular-nums">
                {data?.rates.level1 ?? 20}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Level 2</p>
              <p className="text-xl font-extrabold text-[#D71920] tabular-nums">
                {data?.rates.level2 ?? 2}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Level 3</p>
              <p className="text-xl font-extrabold text-[#D71920] tabular-nums">
                {data?.rates.level3 ?? 1}%
              </p>
            </div>
          </div>
        </section>

        {/* Invitation Code & Link Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Invitation Code</p>
              <p className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
                {data?.invitationCode || '------'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => data && copyText(data.invitationCode, 'code')}
              className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedField === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedField === 'code' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">Referral Link</p>
              <p
                data-testid="referral-link-url"
                className="text-xs font-mono text-slate-800 truncate mt-1 flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{inviteUrl || 'Generating...'}</span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Opening this link automatically adds your invitation code to the registration form.
              </p>
            </div>
            <button
              type="button"
              data-testid="copy-referral-link-btn"
              onClick={() => inviteUrl && copyText(inviteUrl, 'link')}
              className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedField === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedField === 'link' ? 'Copied' : 'Copy Referral Link'}</span>
            </button>
          </div>
        </div>
        {copyError && (
          <p role="alert" className="text-xs text-amber-700">{copyError}</p>
        )}

        {/* Team Details Summary */}
        <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="bg-[#D71920] text-white px-4 py-2.5 text-sm font-bold">
            Team Details
          </div>
          <div className="p-4 divide-y divide-slate-100 text-sm">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Total Team Members</span>
              <strong className="tabular-nums">{data?.summary.totalRegisteredMembers ?? 0}</strong>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Qualifying Plan Volume</span>
              <strong className="tabular-nums">
                {formatEtb(data?.summary.totalQualifyingVolume ?? 0)}
              </strong>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Team Commission Earned</span>
              <strong className="tabular-nums">
                {formatEtb(data?.summary.teamCommission ?? 0)}
              </strong>
            </div>
          </div>
        </section>

        {/* Level 1 / 2 / 3 Member Breakdown */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            {([1, 2, 3] as const).map((lvl) => {
              const count =
                lvl === 1
                  ? data?.summary.level1Count ?? 0
                  : lvl === 2
                  ? data?.summary.level2Count ?? 0
                  : data?.summary.level3Count ?? 0;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setActiveLevel(lvl)}
                  className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
                    activeLevel === lvl
                      ? 'bg-[#D71920] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Level {lvl} ({count})
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Private member details are masked. Referral rewards are credited only after a qualifying plan purchase is recorded and remain subject to platform rules and funding availability.
            </span>
          </div>

          {activeList.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No Level {activeLevel} referrals registered yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeList.map((m) => (
                <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{m.displayName}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {m.maskedPhone} · Code: {m.referralCode} · Joined {new Date(m.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${m.qualified ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {m.qualifyingStatus}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Plan Volume: {formatEtb(m.qualifyingPurchaseValue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
