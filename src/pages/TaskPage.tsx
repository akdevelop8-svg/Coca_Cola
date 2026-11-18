import React, { useEffect, useState } from 'react';
import { Award, Gift, Lock, Trophy } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { formatDemoCredits } from '../shared/finance';

interface TasksResponse {
  qualifyingPurchasesCount: number;
  qualifyingPurchasesVolume: number;
  complianceApproved: boolean;
  countTasks: Array<{
    id: string;
    title: string;
    targetCount: number;
    description: string;
    progress: number;
    eligible: boolean;
    claimed: boolean;
  }>;
  valueTasks: Array<{
    id: string;
    level: number;
    targetAmount: number;
    rewardAmount: number;
    progress: number;
    remaining: number;
    eligible: boolean;
    claimed: boolean;
  }>;
}

export function TaskPage() {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    apiFetch<TasksResponse>('/api/tasks')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (taskId: string) => {
    setFeedback('');
    try {
      await apiFetch('/api/tasks/claim', {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
    } catch (err: any) {
      setFeedback(err?.message || 'Task reward cannot be claimed yet.');
    }
  };

  return (
    <AppShell title="Task & Rewards">
      <div className="space-y-5">
        {/* Red Header Card matching mobile TASK reference */}
        <div className="rounded-2xl bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-5 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Trophy className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Team Task Rewards</h2>
            <p className="text-xs sm:text-sm text-white/85">
              Grow your team with verified product purchases. Unlock your rewards.
            </p>
          </div>
        </div>

        {/* Blue Verified Progress Header Card */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] text-white p-5 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Verified Qualifying Team Purchases</p>
            <span className="text-lg font-extrabold tabular-nums">
              {loading ? '...' : `${data?.qualifyingPurchasesCount ?? 0} / 5`}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(100, ((data?.qualifyingPurchasesCount ?? 0) / 5) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/85">
            Qualifying demo volume: <strong className="tabular-nums">{formatDemoCredits(data?.qualifyingPurchasesVolume ?? 0)}</strong> · Rewards never trigger on registrations alone.
          </p>
        </div>

        {feedback && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900">
            {feedback}
          </div>
        )}

        {/* Section A: Team Count Milestones (1, 3, 5) */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">A. Qualifying Team Purchase Count Milestones</h3>
          <div className="space-y-2.5">
            {(data?.countTasks || []).map((task) => {
              const pct = Math.min(100, Math.round((task.progress / task.targetCount) * 100));
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#D71920]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-600">
                          {task.progress}/{task.targetCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!task.eligible || task.claimed || !data?.complianceApproved}
                    onClick={() => handleClaim(task.id)}
                    className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer shrink-0"
                  >
                    {task.claimed ? 'Claimed' : 'Claim'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section B: Team Value Milestones (ETB 25k -> 300k) */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">B. Team Qualifying Purchase Volume Milestones</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data?.valueTasks || []).map((task) => {
              const pct = Math.min(100, Math.round((task.progress / task.targetAmount) * 100));
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-bold text-slate-900">
                        Level {task.level}: Target {formatDemoCredits(task.targetAmount)}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-[#D71920] tabular-nums">
                      +{formatDemoCredits(task.rewardAmount)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Remaining: {formatDemoCredits(task.remaining)}</span>
                    <button
                      type="button"
                      disabled={!task.eligible || task.claimed || !data?.complianceApproved}
                      onClick={() => handleClaim(task.id)}
                      className="px-3.5 py-1.5 rounded-full bg-[#D71920] text-white font-semibold disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer"
                    >
                      {task.claimed ? 'Claimed' : task.eligible ? 'Claim' : 'Locked'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gift Illustration Footer */}
        <div className="rounded-2xl bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">Reward Governance</h3>
            <p className="text-xs text-white/85 mt-1">
              All milestone rewards require admin policy activation and verified product purchases.
            </p>
          </div>
          <Gift className="w-10 h-10 text-amber-300 shrink-0" />
        </div>
      </div>
    </AppShell>
  );
}
