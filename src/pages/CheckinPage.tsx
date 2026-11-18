import React, { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Coins, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { formatDemoCredits } from '../shared/finance';

interface CheckinStatusResponse {
  checkedInToday: boolean;
  ethiopiaDate: string;
  rewardAmount: number;
  demoBalance: number;
  history: Array<{
    id: string;
    ethiopiaDate: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export function CheckinPage() {
  const [data, setData] = useState<CheckinStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Read-only fetch on page open — NEVER auto-credits Demo ETB
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CheckinStatusResponse>('/api/checkin');
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load daily check-in status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleManualClaim = async () => {
    if (claiming || data?.checkedInToday) return;
    setClaiming(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch<{ message: string; demoBalance: number }>('/api/checkin', {
        method: 'POST',
      });
      setStatusMsg(res.message);
      await loadStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not claim daily check-in.');
      await loadStatus();
    } finally {
      setClaiming(false);
    }
  };

  const claimedToday = Boolean(data?.checkedInToday);

  return (
    <AppShell title="Daily Check-In">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Banner */}
        <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-5 sm:p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Daily Check-In</h2>
              <p className="text-xs sm:text-sm text-white/85 mt-0.5">
                Manual claim only · +{data?.rewardAmount ?? 2} Demo ETB per Ethiopia calendar day
              </p>
            </div>
          </div>
          <div className="bg-white/15 rounded-2xl px-4 py-2.5 text-right">
            <p className="text-[11px] text-white/80">Demo Wallet Balance</p>
            <p data-testid="checkin-demo-balance" className="text-base sm:text-lg font-extrabold tabular-nums">
              {loading ? '...' : formatDemoCredits(data?.demoBalance ?? 0)}
            </p>
          </div>
        </section>

        {/* Demo Simulator Disclaimer */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p>
            <strong>Demo ETB Simulator:</strong> Opening the app or this page never automatically awards Demo ETB.
            Press <strong>CLAIM</strong> below once per calendar day (Ethiopia time: Africa/Addis_Ababa) to collect{' '}
            <strong>{data?.rewardAmount ?? 2} Demo ETB</strong>. Demo ETB has no cash value and is not withdrawable.
          </p>
        </div>

        {statusMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Manual Claim Action Card */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Today (Ethiopia Time): <strong className="font-mono text-slate-800">{data?.ethiopiaDate || '...'}</strong></span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#D71920]" />
              <span>Daily Reward: {data?.rewardAmount ?? 2} Demo ETB</span>
            </h3>
            <p className="text-xs text-slate-500">
              {claimedToday
                ? 'Claimed Today — come back after midnight (Ethiopia time) for your next manual claim.'
                : 'Ready to claim manually. Click CLAIM to credit your Demo Wallet.'}
            </p>
          </div>

          <button
            type="button"
            data-testid="daily-checkin-claim-btn"
            disabled={loading || claiming || claimedToday}
            onClick={handleManualClaim}
            className={`min-w-[160px] min-h-[46px] px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-colors cursor-pointer shrink-0 ${
              claimedToday
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white disabled:opacity-60'
            }`}
          >
            {loading
              ? 'Loading...'
              : claiming
              ? 'Claiming...'
              : claimedToday
              ? 'Claimed Today'
              : 'CLAIM'}
          </button>
        </section>

        {/* Check-In History */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-5 py-3.5 text-sm font-bold">
            Daily Check-In History
          </div>
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading history...</p>
          ) : !data?.history.length ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No daily check-ins claimed yet. Press CLAIM above to claim today&apos;s {data?.rewardAmount ?? 2} Demo ETB.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.history.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">{item.ethiopiaDate}</p>
                    <p className="text-[11px] text-slate-500">
                      Claimed {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    +{formatDemoCredits(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
