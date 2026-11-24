import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarCheck, CircleHelp, Home, Landmark,
  Trophy, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dismissNewCustomerGuide, shouldShowNewCustomerGuide } from '../shared/experience';

interface GuideStep {
  title: string;
  description: string;
  tip: string;
  path: string;
  action: string;
  icon: LucideIcon;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'Home',
    description: 'View your balance, activity and plans.',
    tip: 'Balances show posted wallet transactions.',
    path: '/home',
    action: 'Home',
    icon: Home,
  },
  {
    title: 'Income',
    description: 'View plans and claim daily income manually.',
    tip: 'Claim only when the timer is ready.',
    path: '/income',
    action: 'Open Income',
    icon: TrendingUp,
  },
  {
    title: 'Daily Check-In',
    description: 'Check the Ethiopia date and claim when ready.',
    tip: 'One check-in per 24 hours.',
    path: '/checkin',
    action: 'Open Check-In',
    icon: CalendarCheck,
  },
  {
    title: 'Team & Invites',
    description: 'Copy your invite code or link.',
    tip: 'Share it to invite new members.',
    path: '/team',
    action: 'Team',
    icon: Users,
  },
  {
    title: 'Tasks',
    description: 'Track team deposits and rewards.',
    tip: 'Only approved activity counts.',
    path: '/task',
    action: 'Tasks',
    icon: Trophy,
  },
  {
    title: 'Wallet',
    description: 'Manage deposits, withdrawals and support.',
    tip: 'Deposits need approval. Withdraw during the daily window.',
    path: '/recharge',
    action: 'Wallet',
    icon: Wallet,
  },
];

export function NewCustomerGuide({ userId }: { userId: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!userId || location.pathname === '/onboarding-terms') {
      setVisible(false);
      return;
    }
    setVisible(shouldShowNewCustomerGuide(userId));
  }, [userId, location.pathname]);

  const close = () => {
    if (userId) dismissNewCustomerGuide(userId);
    setVisible(false);
  };

  if (!visible || !userId) return null;

  const step = GUIDE_STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-customer-guide-title"
        data-testid="new-customer-guide"
        className="cc-guide-enter relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[#D71920] via-[#B80D13] to-[#79050A] px-5 pb-6 pt-5 text-white sm:px-7 sm:pt-6">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border border-white/15 bg-white/[0.04]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-rose-300/10 blur-2xl" />
          <button
            type="button"
            onClick={close}
            aria-label="Close app guide"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="relative text-[10px] font-bold uppercase tracking-[0.23em] text-amber-200">
            New member tour · {stepIndex + 1} of {GUIDE_STEPS.length}
          </p>
          <h2 id="new-customer-guide-title" className="relative mt-2 pr-10 text-xl font-extrabold sm:text-2xl">
            Let’s explore your platform
          </h2>
          <p className="relative mt-1 text-xs leading-relaxed text-white/75">
            A quick guide to the main areas. You can close it at any time.
          </p>
          <div className="relative mt-5 flex gap-1.5" aria-label={`Guide step ${stepIndex + 1} of ${GUIDE_STEPS.length}`}>
            {GUIDE_STEPS.map((item, index) => (
              <span
                key={item.path}
                className={`h-1.5 flex-1 rounded-full transition-colors ${index <= stepIndex ? 'bg-amber-200' : 'bg-white/25'}`}
              />
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#D71920] ring-1 ring-red-100">
              <StepIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D71920]">
                Step {stepIndex + 1}
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
            <div className="flex items-start gap-2.5">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-relaxed text-amber-950">{step.tip}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(step.path)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#D71920]"
          >
            {step.action} <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? close() : setStepIndex((value) => Math.min(GUIDE_STEPS.length - 1, value + 1)))}
              className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E11D24] to-[#A3080C] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-transform hover:-translate-y-0.5"
            >
              {isLast ? 'Finish Guide' : 'Next'}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            className="mt-3 flex w-full items-center justify-center gap-1 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700"
          >
            Close guide
          </button>
        </div>
      </section>
    </div>
  );
}
