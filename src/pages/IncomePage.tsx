import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Coins, FileSearch, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { SUPPLIED_ASSETS } from '../shared/constants';
import { formatEtb, getCustomerDisplayName, MAX_ACTIVE_PLANS } from '../shared/finance';
import type { LedgerTransaction } from '../types';

interface PurchasedPlanItem {
  id: string;
  planCode: string;
  amount: number;
  dailyMiningRate: number;
  periodDays: number;
  status: string;
  startDate: string;
  endDate: string;
  purchaseEthDate: string;
  daysElapsed: number;
  remainingDays: number;
  isCompleted: boolean;
  canClaim: boolean;
  statusLabel: 'Ready to Claim' | 'Claimed Today' | 'Plan Completed';
  claimedToday: boolean;
  totalClaimed: number;
}

interface IncomeResponse {
  activePlansCount: number;
  myIncome: number;
  availableBalance: number;
  reservedBalance: number;
  promotionalCredit: number;
  totalRewards: number;
  teamCommission: number;
  todayEthiopiaDate: string;
  purchases: PurchasedPlanItem[];
  transactions: LedgerTransaction[];
}

export function IncomePage() {
  const { user } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const [data, setData] = useState<IncomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'month'>('all');

  const loadIncome = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<IncomeResponse>('/api/income');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchased plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIncome();
  }, []);

  const handleManualClaimPlan = async (purchaseId: string) => {
    if (claimingId) return;
    setClaimingId(purchaseId);
    setStatusMsg('');
    setError('');
    try {
      const res = await apiFetch<{ message: string }>(`/api/income/claim/${purchaseId}`, {
        method: 'POST',
      });
      setStatusMsg(res.message);
      await loadIncome();
    } catch (err: any) {
      setError(err?.message || 'Could not claim daily mining reward.');
      await loadIncome();
    } finally {
      setClaimingId(null);
    }
  };

  const filteredTx = (data?.transactions || []).filter((tx) => {
    if (filter === 'all') return true;
    const d = new Date(tx.createdAt);
    const now = new Date();
    if (filter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const txTypeLabel = (type: LedgerTransaction['type']) => {
    switch (type) {
      case 'registration_bonus':
        return 'Registration Bonus';
      case 'daily_checkin':
        return 'Daily Check-In';
      case 'gift_code':
        return 'Gift Code';
      case 'plan_purchase':
        return 'Plan Purchase';
      case 'daily_mining_claim':
        return 'Daily Mining Claim';
      case 'referral_reward':
        return 'Referral Reward';
      case 'task_reward':
        return 'Team Task Reward';
      case 'deposit_credit':
        return 'Verified Deposit';
      case 'withdrawal_reserve':
        return 'Withdrawal Request';
      case 'withdrawal_settle':
        return 'Manual Bank Transfer Completed';
      case 'withdrawal_release':
        return 'Withdrawal Rejected — Funds Returned';
      default:
        return type;
    }
  };

  return (
    <AppShell title="My Income & Plans">
      <div className="space-y-5">
        {/* Top Banner */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#D71920] to-[#98080D] text-white grid grid-cols-1 sm:grid-cols-12 shadow-md">
          <div className="sm:col-span-7 p-5 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-bold">{displayName}&apos;s Purchased Plans &amp; Income</h2>
            <p className="text-xs sm:text-sm text-white/85 mt-1">
              Lists only plans purchased by your account. Daily mining ETB is never added automatically — press CLAIM manually each day.
            </p>
          </div>
          <div className="sm:col-span-5 h-32 sm:h-auto overflow-hidden">
            <img
              src={SUPPLIED_ASSETS.factory}
              alt="Coca-Cola bottling facility"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Wallet Notice */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Wallet notice:</strong> Rewards are credited to the wallet ledger after a successful claim. Deposits and withdrawals follow administrator verification and approval.
          </span>
        </div>

        {/* Three Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Purchased Plans</p>
              <p data-testid="income-active-count" className="text-xl font-extrabold text-slate-900 tabular-nums">
                {loading ? '...' : `${data?.activePlansCount ?? 0} / ${MAX_ACTIVE_PLANS}`}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Claimed Mining</p>
              <p data-testid="income-total-earnings" className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
                {loading ? '...' : formatEtb(data?.myIncome ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-[#D71920] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Wallet Balance</p>
              <p data-testid="income-wallet-balance" className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
                {loading ? '...' : formatEtb(data?.availableBalance ?? 0)}
              </p>
            </div>
          </div>
        </div>


        <section aria-label="Wallet balance breakdown" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs">
            <p className="text-[11px] sm:text-xs text-slate-500">Registration Bonus &amp; Promo</p>
            <p data-testid="income-promo-balance" className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : formatEtb(data?.promotionalCredit ?? 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs">
            <p className="text-[11px] sm:text-xs text-slate-500">Check-In, Task &amp; Gift Rewards</p>
            <p data-testid="income-reward-balance" className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : formatEtb(data?.totalRewards ?? 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs">
            <p className="text-[11px] sm:text-xs text-slate-500">Referral Commissions</p>
            <p data-testid="income-commission-balance" className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : formatEtb(data?.teamCommission ?? 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs">
            <p className="text-[11px] sm:text-xs text-slate-500">Reserved for Withdrawals</p>
            <p data-testid="income-reserved-balance" className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
              {loading ? '...' : formatEtb(data?.reservedBalance ?? 0)}
            </p>
          </div>
        </section>

        {statusMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Purchased Plans Panel (ONLY plans purchased by logged-in user) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">My Purchased Plans</h3>
            {data?.todayEthiopiaDate && (
              <span className="text-xs font-mono text-slate-500">
                Ethiopia Date: {data.todayEthiopiaDate}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 py-6 text-center">Loading purchased plans...</p>
          ) : !data?.purchases.length ? (
            <div className="py-10 text-center space-y-2" data-testid="no-purchased-plans">
              <FileSearch className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No purchased plans yet</p>
              <p className="text-xs text-slate-500">
                Only plans actually purchased with your ETB balance appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.purchases.map((p) => (
                <article
                  key={p.id}
                  data-testid={`purchased-plan-${p.planCode}`}
                  className="rounded-2xl border border-slate-200 bg-[#FAFBFD] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-[#D71920] text-white text-xs font-extrabold flex items-center justify-center">
                        {p.planCode}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900">Plan {p.planCode}</h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Purchased: {new Date(p.startDate).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        p.isCompleted
                          ? 'bg-slate-200 text-slate-700'
                          : p.claimedToday
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-white border border-slate-200/80 p-3 text-xs">
                    <div>
                      <p className="text-slate-500">Original Investment</p>
                      <p className="font-bold text-slate-900 tabular-nums mt-0.5">
                        {formatEtb(p.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Daily Mining</p>
                      <p className="font-bold text-[#D71920] tabular-nums mt-0.5">
                        {formatEtb(p.dailyMiningRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Days Elapsed</span>
                      </p>
                      <p className="font-bold text-slate-900 tabular-nums mt-0.5">
                        {p.daysElapsed} / {p.periodDays} Days
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Remaining Days</p>
                      <p className="font-bold text-slate-900 tabular-nums mt-0.5">
                        {p.remainingDays} Days Left
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-xs">
                      <span className="text-slate-500">Total Claimed: </span>
                      <strong className="text-emerald-700 tabular-nums">
                        {formatEtb(p.totalClaimed)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      data-testid={`claim-plan-btn-${p.id}`}
                      disabled={!p.canClaim || claimingId === p.id}
                      onClick={() => handleManualClaimPlan(p.id)}
                      className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer shrink-0 ${
                        p.isCompleted
                          ? 'bg-slate-200 text-slate-600 cursor-not-allowed'
                          : p.claimedToday
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                          : 'bg-[#D71920] hover:bg-[#B80D13] text-white shadow-sm disabled:opacity-60'
                      }`}
                    >
                      {claimingId === p.id
                        ? 'Claiming...'
                        : p.isCompleted
                        ? 'Plan Completed'
                        : p.claimedToday
                        ? 'Claimed Today'
                        : 'CLAIM'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Complete Wallet Transaction History */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-[#D71920] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">{displayName} — Wallet Transaction History</h3>
            <div className="flex items-center gap-1 bg-white/15 p-1 rounded-full text-xs">
              {(['all', 'today', 'month'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-full capitalize cursor-pointer ${
                    filter === tab ? 'bg-white text-[#D71920] font-semibold' : 'text-white'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'today' ? 'Today' : 'This Month'}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <FileSearch className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No transactions found</p>
              <p className="text-xs text-slate-500">Your ETB activity will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                    <th className="px-4 py-3 font-semibold">Activity</th>
                    <th className="px-4 py-3 font-semibold text-right">ETB</th>
                    <th className="px-4 py-3 font-semibold text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTx.map((tx) => {
                    const isPositive = tx.amountSigned >= 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{txTypeLabel(tx.type)}</p>
                          {tx.note && <p className="text-xs text-slate-500">{tx.note}</p>}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${
                            isPositive ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {formatEtb(Math.abs(tx.amountSigned))}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                          {formatEtb(tx.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
