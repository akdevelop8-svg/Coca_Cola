import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../api/client';

type PlanRow = {
  code: string;
  name: string;
  investment: number;
  dailyMining: number;
  periodDays: number;
  isActive: boolean;
};

type TaskRow = {
  id: string;
  level: number;
  targetAmount: number;
  rewardAmount: number;
  isEnabled: boolean;
};

export function BusinessRulesManager({ mode }: { mode: 'plans' | 'tasks' }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'plans') {
        const res = await apiFetch<{ plans: PlanRow[] }>('/api/admin/plans');
        setPlans(res.plans || []);
      } else {
        const res = await apiFetch<{ tasks: TaskRow[] }>('/api/admin/tasks');
        setTasks(res.tasks || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load these settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [mode]);

  const updatePlan = (code: string, key: keyof PlanRow, value: string | boolean) => {
    setPlans((rows) => rows.map((row) => row.code === code
      ? { ...row, [key]: typeof value === 'boolean' ? value : Number(value) }
      : row));
    setSuccess('');
  };

  const updateTask = (id: string, key: keyof TaskRow, value: string | boolean) => {
    setTasks((rows) => rows.map((row) => row.id === id
      ? { ...row, [key]: typeof value === 'boolean' ? value : Number(value) }
      : row));
    setSuccess('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'plans') {
        await apiFetch('/api/admin/plans', {
          method: 'PUT',
          body: JSON.stringify({ plans }),
        });
        setSuccess('Investment plan settings were saved. New purchases will use the updated values; existing purchased plans are unchanged.');
      } else {
        await apiFetch('/api/admin/tasks', {
          method: 'PUT',
          body: JSON.stringify({ tasks }),
        });
        setSuccess('Team task settings were saved. Existing task claims and wallet entries are unchanged.');
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save these settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {mode === 'plans' ? 'Investment Plan Settings' : 'Team Task Settings'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {mode === 'plans'
              ? 'Edit plan prices, daily mining amounts, durations, and availability. Changes apply to new purchases only.'
              : 'Edit each task target, reward amount, and availability. Previously claimed task rewards are not changed.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading || saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" onClick={() => void save()} disabled={loading || saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#D71920] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />{success}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading settings...</div>
      ) : mode === 'plans' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <article key={plan.code} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900">Plan {plan.code}</h4>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={plan.isActive} onChange={(e) => updatePlan(plan.code, 'isActive', e.target.checked)} />
                  Active
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">Purchase amount (ETB)
                <input type="number" min="0.01" step="0.01" value={plan.investment}
                  onChange={(e) => updatePlan(plan.code, 'investment', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Daily mining amount (ETB)
                <input type="number" min="0.01" step="0.01" value={plan.dailyMining}
                  onChange={(e) => updatePlan(plan.code, 'dailyMining', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Duration (days)
                <input type="number" min="1" max="3650" step="1" value={plan.periodDays}
                  onChange={(e) => updatePlan(plan.code, 'periodDays', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" />
              </label>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900">Task Level {task.level}</h4>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={task.isEnabled} onChange={(e) => updateTask(task.id, 'isEnabled', e.target.checked)} />
                  Active
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">Team deposit target (ETB)
                <input type="number" min="0.01" step="0.01" value={task.targetAmount}
                  onChange={(e) => updateTask(task.id, 'targetAmount', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Reward amount (ETB)
                <input type="number" min="0.01" step="0.01" value={task.rewardAmount}
                  onChange={(e) => updateTask(task.id, 'rewardAmount', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" />
              </label>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Wallet balances cannot be added to or reduced from these controls. Changes are validated by the server and written to the admin audit log.</span>
      </div>
    </section>
  );
}
