import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import type { TeamTaskLevelProgress } from '../shared/finance';
import { celebrateAchievement } from '../shared/experience';

interface TasksResponse {
  verifiedDepositsTotal: number;
  maxTarget: number;
  overallPercent: number;
  valueTasks: TeamTaskLevelProgress[];
}

function formatEtbWhole(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `ETB ${safe.toLocaleString('en-US')}`;
}

function formatEtbDecimal(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `ETB ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TaskPage() {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadTasks = async () => {
    try {
      const res = await apiFetch<TasksResponse>('/api/tasks');
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load tasks right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleClaim = async (task: TeamTaskLevelProgress) => {
    if (!task.eligible || task.claimed || claimingId) return;
    setClaimingId(task.id);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch<{ message: string }>('/api/tasks/claim', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id }),
      });
      setSuccessMsg(
        res.message ||
          `Level ${task.level} reward (+${formatEtbWhole(task.rewardAmount)}) settled and credited to your wallet.`
      );
      celebrateAchievement({
        title: `Level ${task.level} Milestone Unlocked`,
        description: `Your ${formatEtbWhole(task.rewardAmount)} team task reward was successfully claimed.`,
        category: 'milestone',
      });
      await loadTasks();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to settle task reward right now.');
    } finally {
      setClaimingId(null);
    }
  };

  const verifiedTotal = data?.verifiedDepositsTotal ?? 0;
  const maxTarget = data?.maxTarget ?? 300000;
  const overallPercent = data?.overallPercent ?? 0;

  return (
    <AppShell title="Task">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5">
        {/* Top Heading Section matching reference */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0B57D0]">
            COCA-COLA · L1 + L2
          </p>
          <h2 className="text-2xl sm:text-[28px] font-extrabold text-[#003B73] tracking-tight mt-0.5">
            Team Task Reward
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Grow your team. Unlock your rewards.
          </p>
        </div>

        {/* Blue Verified L1 + L2 CBE Deposits Progress Card */}
        <section className="rounded-2xl bg-gradient-to-r from-[#0B57D0] via-[#0B63CE] to-[#0842A0] text-white p-4 sm:p-5 shadow-md space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-semibold text-white/95">
              Verified L1 + L2 CBE deposits
            </p>
            <span
              data-testid="tasks-verified-total"
              className="text-lg sm:text-xl font-extrabold tabular-nums shrink-0"
            >
              {loading ? '...' : formatEtbDecimal(verifiedTotal)}
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#062E6F]/55 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${overallPercent}%` }}
            />
          </div>

          <p className="text-[11px] sm:text-xs text-white/85">
            {overallPercent}% of {formatEtbWhole(maxTarget)} target · Only approved deposits count
          </p>
        </section>

        {successMsg && (
          <div
            role="status"
            data-testid="task-claim-success"
            className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs sm:text-sm text-emerald-800 flex items-center gap-2 font-medium"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm text-red-700"
          >
            {errorMsg}
          </div>
        )}

        {/* 5 Level Milestone Cards in 2-Column Grid */}
        <section aria-label="Team deposit reward levels" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {(data?.valueTasks || []).map((task) => {
            const canClaimNow = task.eligible && !task.claimed;
            const isClaiming = claimingId === task.id;
            return (
              <div
                key={task.id}
                data-testid={`task-card-level-${task.level}`}
                className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs flex flex-col justify-between gap-3.5 transition-all ${
                  canClaimNow
                    ? 'border-emerald-300 ring-1 ring-emerald-200'
                    : task.claimed
                    ? 'border-emerald-200/80'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Badges Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-0.5 rounded-full bg-blue-50 text-[#0B57D0] border border-blue-100 text-[11px] font-extrabold uppercase tracking-wide">
                    LEVEL {task.level}
                  </span>

                  <span
                    className={`px-3 py-0.5 rounded-full text-[11px] font-bold ${
                      task.claimed
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : canClaimNow
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 border border-slate-200/70'
                    }`}
                  >
                    {task.claimed ? 'Claimed' : canClaimNow ? 'Ready to Claim' : 'Locked'}
                  </span>
                </div>

                {/* Target & Reward Row */}
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Team deposit target</p>
                    <p className="text-lg sm:text-xl font-extrabold text-[#003B73] tabular-nums leading-tight mt-0.5">
                      {formatEtbWhole(task.targetAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 font-medium">Reward</p>
                    <p className="text-lg sm:text-xl font-extrabold text-[#D71920] tabular-nums leading-tight mt-0.5">
                      +{formatEtbWhole(task.rewardAmount)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Progress</span>
                    <span className="font-bold text-[#003B73] tabular-nums">{task.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        task.claimed || task.eligible ? 'bg-emerald-500' : 'bg-[#0B57D0]'
                      }`}
                      style={{ width: `${task.percent}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Row: Remaining + Claim Button */}
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatEtbDecimal(task.remaining)} remaining
                  </span>

                  <button
                    type="button"
                    data-testid={`task-claim-btn-${task.level}`}
                    disabled={!canClaimNow || isClaiming}
                    onClick={() => void handleClaim(task)}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      canClaimNow
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-200 cursor-pointer'
                        : task.claimed
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isClaiming ? 'Settling...' : task.claimed ? 'Claimed' : 'Claim'}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Bottom Disclaimer Note matching reference */}
        <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed pt-1">
          Rewards are credited once per level to your Coca-Cola wallet after you claim without any deductions. Unverified submissions and pending or rejected recharge requests do not count. An approved recharge is not automatically a bank payout.
        </p>
      </div>
    </AppShell>
  );
}
