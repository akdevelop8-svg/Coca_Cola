import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Crown,
  Globe,
  MapPinned,
  RefreshCw,
  Route,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import './CommunityPage.css';

type CommunityTab = 'map' | 'legends' | 'journey';

interface NetworkMember {
  id: string;
  level: number;
  displayName: string;
  registeredAt: string;
  qualified: boolean;
  qualifyingStatus?: string;
  qualifyingPurchaseDate?: string | null;
}

interface TeamData {
  summary?: {
    totalRegisteredMembers: number;
    qualifyingMembersCount: number;
    level1Count: number;
    level2Count: number;
    level3Count: number;
  };
  members?: NetworkMember[];
}

interface Purchase {
  id: string;
  planCode: string;
  amount: number;
  status: string;
  createdAt: string;
  startDate: string;
}

interface LedgerEntry {
  id: string;
  type: string;
  amountSigned: number;
  createdAt: string;
}

interface IncomeData {
  purchases?: Purchase[];
  transactions?: LedgerEntry[];
}

interface CheckinData {
  history?: Array<{ id: string; ethiopiaDate: string; amount: number; status: string; createdAt: string }>;
}

interface TaskData {
  valueTasks?: Array<{ id: string; level: number; claimed: boolean }>;
}

interface CommunityData {
  team: TeamData | null;
  income: IncomeData | null;
  checkin: CheckinData | null;
  tasks: TaskData | null;
  errors: string[];
}

interface JourneyEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  kind: 'start' | 'plan' | 'checkin' | 'wallet' | 'network';
  amount?: number;
}

const TAB_ITEMS: Array<{ id: CommunityTab; label: string; description: string }> = [
  { id: 'map', label: 'World Map', description: 'Your network around the world' },
  { id: 'legends', label: 'Hall of Legends', description: 'Recognizing your network' },
  { id: 'journey', label: 'My Journey', description: 'Your personal milestones' },
];

function formatDate(value?: string | null, includeTime = false): string {
  if (!value) return 'Date not available';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

function formatEtb(value: number): string {
  const safe = Number.isFinite(value) ? Math.abs(value) : 0;
  return 'ETB ' + safe.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function daysSince(value?: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function MapArtwork({ memberCount }: { memberCount: number | null }) {
  return (
    <div className="cc-community-map relative overflow-hidden rounded-[26px] border border-red-100 bg-gradient-to-br from-[#FFF9F4] via-[#FFFDF9] to-[#FDEBE6] p-3 sm:p-5">
      <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-red-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-amber-100/70 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3 px-2 pt-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#C81018]">Community footprint</p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-900 sm:text-xl">One community. Many journeys.</h3>
          <p className="mt-1 text-xs text-slate-500">Your invited network · country-level view</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white/85 px-3 py-1.5 text-[10px] font-bold text-[#B80D13] shadow-sm">
          <CircleDot className="h-3 w-3" /> Ethiopia
        </span>
      </div>

      <svg
        viewBox="0 0 1000 500"
        role="img"
        aria-label="Illustrative world map with an approximate country-level marker over Ethiopia"
        className="relative mt-2 h-auto w-full"
      >
        <defs>
          <linearGradient id="ccLand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F7C8BC" />
            <stop offset="100%" stopColor="#EBA79A" />
          </linearGradient>
          <radialGradient id="ccPinGlow">
            <stop offset="0%" stopColor="#D71920" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D71920" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="url(#ccLand)" stroke="#D98D81" strokeOpacity="0.35" strokeWidth="2">
          <path d="M85 102 L124 66 186 54 224 72 251 63 286 88 282 117 252 132 244 162 213 174 194 208 167 208 151 185 123 179 111 149 83 136Z" />
          <path d="M205 222 L238 213 263 230 274 267 259 302 247 340 226 374 207 359 197 321 182 288 185 251Z" />
          <path d="M355 91 L397 69 433 75 450 98 437 119 402 124 381 113Z" />
          <path d="M405 142 L454 130 485 153 480 197 462 233 444 277 417 310 396 277 388 230 378 185Z" />
          <path d="M468 87 L528 61 591 73 622 65 666 86 712 77 756 103 804 100 856 129 876 163 847 187 812 180 784 201 751 184 721 196 691 179 658 191 636 169 607 176 581 151 544 157 521 134 493 141Z" />
          <path d="M544 173 L581 169 608 191 610 223 590 245 567 229 550 206Z" />
          <path d="M711 208 L739 198 769 211 788 236 775 258 750 262 725 242Z" />
          <path d="M803 288 L847 278 884 300 878 331 850 347 816 329Z" />
          <path d="M909 378 L930 370 945 387 933 404 912 398Z" />
          <path d="M306 53 L322 43 338 54 327 68Z" />
          <path d="M520 292 L539 283 552 297 541 311Z" />
        </g>
        <g aria-hidden="true">
          <circle cx="613" cy="225" r="74" fill="url(#ccPinGlow)" className="cc-map-glow" />
          <circle cx="613" cy="225" r="20" fill="#D71920" fillOpacity="0.15" />
          <circle cx="613" cy="225" r="10" fill="#D71920" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M613 205 L613 178" stroke="#B80D13" strokeWidth="2" strokeLinecap="round" />
          <rect x="572" y="145" width="82" height="30" rx="15" fill="#B80D13" />
          <text x="613" y="165" fill="#FFFFFF" textAnchor="middle" fontSize="13" fontWeight="700">ETHIOPIA</text>
        </g>
      </svg>

      <div className="relative mt-1 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/75 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-[#D71920]" />
          <span className="text-xs font-semibold text-slate-700">Your network is represented at country level</span>
        </div>
        <span className="text-xs font-extrabold tabular-nums text-[#B80D13]">
          {memberCount === null ? '—' : memberCount.toLocaleString('en-US') + ' members'}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-5 py-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-[#D71920]/55" />
      <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{message}</p>
    </div>
  );
}

export function CommunityPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityTab>('map');
  const [data, setData] = useState<CommunityData>({
    team: null,
    income: null,
    checkin: null,
    tasks: null,
    errors: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    const results = await Promise.allSettled([
      apiFetch<TeamData>('/api/team'),
      apiFetch<IncomeData>('/api/income'),
      apiFetch<CheckinData>('/api/checkin'),
      apiFetch<TaskData>('/api/tasks'),
    ]);

    const errors: string[] = [];
    const valueAt = <T,>(index: number): T | null => {
      const result = results[index];
      if (result.status === 'fulfilled') return result.value as T;
      errors.push('Some account activity could not be loaded. Please refresh to try again.');
      return null;
    };

    setData({
      team: valueAt<TeamData>(0),
      income: valueAt<IncomeData>(1),
      checkin: valueAt<CheckinData>(2),
      tasks: valueAt<TaskData>(3),
      errors: Array.from(new Set(errors)),
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const members = data.team?.members || [];
  const summary = data.team?.summary;
  const purchases = data.income?.purchases || [];
  const checkins = data.checkin?.history || [];
  const transactions = data.income?.transactions || [];
  const joinedDays = daysSince(user?.createdAt);

  const journeyEvents = useMemo<JourneyEvent[]>(() => {
    const events: JourneyEvent[] = [];
    if (user?.createdAt) {
      events.push({
        id: 'account-created',
        title: 'Your journey began',
        description: 'You created your Coca-Cola Platform account.',
        date: user.createdAt,
        kind: 'start',
      });
    }

    for (const purchase of purchases) {
      events.push({
        id: 'purchase-' + purchase.id,
        title: 'Plan ' + purchase.planCode + ' purchase recorded',
        description: 'A plan purchase was recorded on your account.',
        date: purchase.createdAt || purchase.startDate,
        kind: 'plan',
        amount: Number(purchase.amount) || 0,
      });
    }

    for (const checkin of checkins) {
      events.push({
        id: 'checkin-' + checkin.id,
        title: 'Daily check-in recorded',
        description: 'Your check-in for ' + checkin.ethiopiaDate + ' is in the account history.',
        date: checkin.createdAt,
        kind: 'checkin',
        amount: Number(checkin.amount) || 0,
      });
    }

    const transactionLabels: Record<string, { title: string; description: string; kind: JourneyEvent['kind'] }> = {
      registration_bonus: { title: 'Registration ledger entry posted', description: 'A registration entry appears in your wallet history.', kind: 'wallet' },
      gift_code: { title: 'Gift code redemption recorded', description: 'A gift-code entry appears in your wallet history.', kind: 'wallet' },
      daily_mining_claim: { title: 'Daily plan claim recorded', description: 'A daily claim appears in your account ledger.', kind: 'wallet' },
      referral_reward: { title: 'Referral reward recorded', description: 'A referral entry appears in your account ledger.', kind: 'network' },
      task_reward: { title: 'Team milestone reward recorded', description: 'A team-task entry appears in your account ledger.', kind: 'network' },
      deposit_credit: { title: 'Verified deposit credited', description: 'A verified deposit entry appears in your wallet ledger.', kind: 'wallet' },
      withdrawal_settle: { title: 'Withdrawal settlement recorded', description: 'A withdrawal settlement entry appears in your wallet ledger.', kind: 'wallet' },
      withdrawal_release: { title: 'Withdrawal reservation released', description: 'A reserved withdrawal amount was released back to the wallet ledger.', kind: 'wallet' },
    };

    for (const transaction of transactions) {
      const label = transactionLabels[transaction.type];
      if (!label || transaction.type === 'daily_checkin' || transaction.type === 'plan_purchase') continue;
      events.push({
        id: 'ledger-' + transaction.id,
        title: label.title,
        description: label.description,
        date: transaction.createdAt,
        kind: label.kind,
        amount: Number(transaction.amountSigned) || 0,
      });
    }

    return events
      .filter((event) => event.date && Number.isFinite(new Date(event.date).getTime()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 60);
  }, [user?.createdAt, purchases, checkins, transactions]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()),
    [members],
  );
  const firstMember = sortedMembers[0] || null;
  const newestMember = sortedMembers[sortedMembers.length - 1] || null;
  const networkHighlights = members.filter((member) => member.qualified);

  return (
    <AppShell title="Community">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#D71920] via-[#B80D13] to-[#78050A] px-5 py-6 text-white shadow-lg sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/[0.05]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-rose-200/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-200">Coca-Cola Community</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Your people. Your progress. Your story.</h2>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/80 sm:text-sm">
                Explore the network you invited, celebrate real milestones and revisit the activity recorded on your account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')} />
              {refreshing ? 'Refreshing…' : 'Refresh activity'}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm sm:gap-3 sm:p-2">
          {TAB_ITEMS.map((tab) => {
            const selected = activeTab === tab.id;
            const Icon = tab.id === 'map' ? Globe : tab.id === 'legends' ? Trophy : Route;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={selected}
                className={'flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center transition-all sm:min-h-[70px] sm:flex-row sm:gap-2 sm:px-3 ' + (
                  selected
                    ? 'bg-gradient-to-r from-[#D71920] to-[#B80D13] text-white shadow-md'
                    : 'text-slate-600 hover:bg-red-50 hover:text-[#B80D13]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
                <span className="text-[10px] font-extrabold sm:text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {data.errors.length > 0 && !loading && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {data.errors[0]} Available sections still show the records that loaded successfully.
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#D71920]" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Loading your community…</p>
            <p className="mt-1 text-xs text-slate-500">Collecting the account records available to you.</p>
          </div>
        ) : (
          <>
            {activeTab === 'map' && (
              <section className="space-y-4">
                <MapArtwork memberCount={summary ? summary.totalRegisteredMembers : null} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <Users className="h-5 w-5 text-[#D71920]" />
                    <p className="mt-3 text-[11px] text-slate-500">Registered network</p>
                    <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{summary ? summary.totalRegisteredMembers : '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="mt-3 text-[11px] text-slate-500">With a plan purchase</p>
                    <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{summary ? summary.qualifyingMembersCount : '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex h-5 items-center gap-1 text-[#B80D13]"><span className="text-xs font-black">L1</span></div>
                    <p className="mt-3 text-[11px] text-slate-500">Direct invites</p>
                    <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{summary ? summary.level1Count : '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex h-5 items-center gap-1 text-[#B80D13]"><span className="text-xs font-black">L2 + L3</span></div>
                    <p className="mt-3 text-[11px] text-slate-500">Extended network</p>
                    <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{summary ? summary.level2Count + summary.level3Count : '—'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-extrabold text-slate-900">Latest network activity</h3>
                  </div>
                  {members.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">Your invited members will appear here when they join your network.</p>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-100">
                      {[...members]
                        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
                        .slice(0, 5)
                        .map((member) => (
                          <div key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800">{member.displayName || 'Community member'} joined your network</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">Level {member.level} · {formatDate(member.registeredAt)}</p>
                            </div>
                            {member.qualified && (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Purchase recorded</span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <p className="rounded-xl bg-red-50/80 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
                  Privacy note: this view uses your own three-level invitation network. All registrations currently use Ethiopian phone numbers, so the map shows an approximate Ethiopia country marker only. No GPS, street address or exact member location is shown.
                </p>
              </section>
            )}

            {activeTab === 'legends' && (
              <section className="space-y-4">
                <div className="rounded-[26px] border border-amber-100 bg-gradient-to-br from-[#FFFDF7] to-[#FFF2E5] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-700">Hall of Legends</p>
                      <h3 className="mt-0.5 text-xl font-extrabold text-slate-900">People who shape your network</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    This recognition space is based on your own invited network, not a platform-wide leaderboard. Highlights are determined from registration dates and plan-purchase records returned by your account.
                  </p>
                </div>

                {members.length === 0 ? (
                  <EmptyState title="Your Hall of Legends is ready" message="When people join through your invitation network, their verified account milestones can appear here." />
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {firstMember && (
                        <article className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-amber-600"><Award className="h-5 w-5" /><span className="text-[10px] font-extrabold uppercase tracking-wider">First to join your network</span></div>
                          <h4 className="mt-3 text-lg font-extrabold text-slate-900">{firstMember.displayName || 'Community member'}</h4>
                          <p className="mt-1 text-xs text-slate-500">Level {firstMember.level} · Joined {formatDate(firstMember.registeredAt)}</p>
                        </article>
                      )}
                      {newestMember && (
                        <article className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-[#D71920]"><Sparkles className="h-5 w-5" /><span className="text-[10px] font-extrabold uppercase tracking-wider">Newest network member</span></div>
                          <h4 className="mt-3 text-lg font-extrabold text-slate-900">{newestMember.displayName || 'Community member'}</h4>
                          <p className="mt-1 text-xs text-slate-500">Level {newestMember.level} · Joined {formatDate(newestMember.registeredAt)}</p>
                        </article>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /><h3 className="text-sm font-extrabold text-slate-900">Network members with a plan purchase</h3></div>
                        <span className="text-xs font-extrabold tabular-nums text-[#B80D13]">{networkHighlights.length}</span>
                      </div>
                      {networkHighlights.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">No plan purchases are recorded for your network members yet.</p>
                      ) : (
                        <div className="mt-3 divide-y divide-slate-100">
                          {networkHighlights
                            .slice()
                            .sort((a, b) => new Date(b.qualifyingPurchaseDate || b.registeredAt).getTime() - new Date(a.qualifyingPurchaseDate || a.registeredAt).getTime())
                            .map((member) => (
                              <div key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-slate-800">{member.displayName || 'Community member'}</p>
                                  <p className="mt-0.5 text-[10px] text-slate-500">Level {member.level} · {formatDate(member.qualifyingPurchaseDate)}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Plan purchase</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === 'journey' && (
              <section className="space-y-4">
                <div className="rounded-[26px] border border-red-100 bg-gradient-to-br from-white via-white to-red-50 p-5 sm:p-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#C81018]">My Journey</p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-900">Every milestone has a story.</h3>
                  <p className="mt-1 text-xs text-slate-500">Your personal timeline, built from account records.</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white p-3 shadow-sm">
                      <CalendarDays className="h-4 w-4 text-[#D71920]" />
                      <p className="mt-2 text-lg font-extrabold tabular-nums text-slate-900">{joinedDays}</p>
                      <p className="text-[10px] text-slate-500">Days in community</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <p className="mt-2 text-lg font-extrabold tabular-nums text-slate-900">{purchases.length}</p>
                      <p className="text-[10px] text-slate-500">Plan records</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="mt-2 text-lg font-extrabold tabular-nums text-slate-900">{checkins.length}</p>
                      <p className="text-[10px] text-slate-500">Recent check-ins*</p>
                    </div>
                  </div>
                </div>

                {journeyEvents.length === 0 ? (
                  <EmptyState title="Your story starts here" message="Account activity will appear on this timeline as records become available." />
                ) : (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                    <div className="flex items-center gap-2">
                      <Route className="h-5 w-5 text-[#D71920]" />
                      <h3 className="text-sm font-extrabold text-slate-900">Your timeline</h3>
                      <span className="ml-auto text-[10px] font-semibold text-slate-400">Newest first</span>
                    </div>
                    <ol className="mt-5 space-y-0">
                      {journeyEvents.map((event, index) => {
                        const EventIcon = event.kind === 'start'
                          ? Sparkles
                          : event.kind === 'plan'
                            ? Trophy
                            : event.kind === 'checkin'
                              ? CalendarDays
                              : event.kind === 'network'
                                ? Users
                                : CircleDot;
                        return (
                          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                            {index < journeyEvents.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-red-100" />}
                            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 text-[#D71920]">
                              <EventIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1 rounded-xl bg-slate-50/80 px-3 py-2.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-xs font-extrabold text-slate-800">{event.title}</p>
                                <time className="text-[10px] text-slate-400">{formatDate(event.date, true)}</time>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{event.description}</p>
                              {typeof event.amount === 'number' && event.amount !== 0 && (
                                <p className={'mt-1 text-[11px] font-bold tabular-nums ' + (event.amount > 0 ? 'text-emerald-700' : 'text-slate-700')}>
                                  Ledger entry: {event.amount > 0 ? '+' : '−'}{formatEtb(event.amount)}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <p className="mt-5 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-400">
                      *Check-in count reflects the latest 30 check-in records returned by the account API. The timeline displays up to 60 recent events from the available account history; it is not a complete lifetime archive.
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
