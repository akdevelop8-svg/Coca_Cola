import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Gift,
  Headphones,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { InvestNowButton } from '../components/InvestNowButton';
import { useAuth } from '../context/AuthContext';
import { INVESTMENT_PLANS, SUPPLIED_ASSETS, type InvestmentPlanDef } from '../shared/constants';
import {
  DEMO_DAILY_CHECKIN_AMOUNT,
  DEMO_REGISTRATION_BONUS,
  formatDemoCredits,
  getCustomerDisplayName,
  MAX_ACTIVE_PLANS,
} from '../shared/finance';
import type { WalletSummary } from '../types';

export function HomePage() {
  const { user, config, refreshConfig } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const navigate = useNavigate();
  const plansSectionRef = useRef<HTMLElement | null>(null);

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlanDef | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ ok: boolean; text: string } | null>(null);

  const slides = config?.carouselAssets?.length
    ? config.carouselAssets
    : [
        {
          id: 'default-1',
          title: 'Invest Today — Build a Better Tomorrow',
          subtitle: 'Together for a Prosperous Future',
          imageUrl: SUPPLIED_ASSETS.splashDrinkHero,
          isActive: true,
          sortOrder: 1,
        },
        {
          id: 'default-2',
          title: 'Coca-Cola Original Taste Collection',
          subtitle: 'Iconic beverage products enjoyed globally',
          imageUrl: SUPPLIED_ASSETS.bottles,
          isActive: true,
          sortOrder: 2,
        },
        {
          id: 'default-3',
          title: 'Modern Bottling & Production Operations',
          subtitle: 'High-capacity bottling infrastructure',
          imageUrl: SUPPLIED_ASSETS.factory,
          isActive: true,
          sortOrder: 3,
        },
      ];

  const [slideIndex, setSlideIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (carouselPaused || prefersReduced || slides.length <= 1) return;

    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [carouselPaused, slides.length]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const [data] = await Promise.all([
        apiFetch<WalletSummary>('/api/dashboard/summary'),
        refreshConfig(),
      ]);
      setSummary(data);
    } catch {
      // keep existing state cleanly on transient failure
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const handleConfirmPlan = async () => {
    if (!selectedPlan || purchaseBusy) return;
    setPurchaseBusy(true);
    setPurchaseResult(null);
    try {
      await apiFetch('/api/plans/purchase', {
        method: 'POST',
        body: JSON.stringify({ planCode: selectedPlan.code }),
      });
      setPurchaseResult({
        ok: true,
        text: `${selectedPlan.name} activated with ${formatDemoCredits(selectedPlan.investment)}. Visit Income to manually claim daily mining.`,
      });
      await loadSummary();
    } catch (err: any) {
      setPurchaseResult({
        ok: false,
        text: err?.message || 'Could not complete plan purchase.',
      });
    } finally {
      setPurchaseBusy(false);
    }
  };

  const settings = config?.settings;
  const activeSlide = slides[slideIndex % slides.length];
  const giftCodeEnabled = Boolean(config?.giftCodeEnabled);

  return (
    <AppShell title="Home Dashboard">
      <div className="space-y-5">
        {/* A. HERO CAROUSEL BANNER */}
        <section
          aria-label="Featured Campaigns"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onFocus={() => setCarouselPaused(true)}
          onBlur={() => setCarouselPaused(false)}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-r from-[#C81018] via-[#E11D24] to-[#98080D] text-white shadow-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch min-h-[210px] sm:min-h-[250px]">
            <div className="md:col-span-7 p-5 sm:p-8 flex flex-col justify-center relative z-10">
              <p data-testid="home-welcome-greeting" className="text-xs sm:text-sm font-semibold text-white/90 mb-1.5">
                Welcome back, {displayName}
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-balance">
                Invest Today <span className="text-amber-300">Build a Better Tomorrow</span>
              </h2>
              <p className="mt-2 text-sm sm:text-base text-white/90">
                Together for a Prosperous Future
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#D71920] font-bold text-sm shadow-md hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <span>Start Investing</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/85">{activeSlide.subtitle}</span>
              </div>
            </div>

            <div className="md:col-span-5 relative min-h-[160px] sm:min-h-[220px] overflow-hidden bg-[#8C060A]">
              <img
                key={activeSlide.id}
                src={activeSlide.imageUrl}
                alt={activeSlide.title}
                className="w-full h-full object-cover object-center transition-opacity duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#D71920]/70 via-transparent to-transparent md:block hidden" />
            </div>
          </div>

          {/* Carousel Controls */}
          {slides.length > 1 && (
            <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Show slide ${i + 1}: ${s.title}`}
                    onClick={() => setSlideIndex(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === slideIndex ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)}
                  className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => setSlideIndex((prev) => (prev + 1) % slides.length)}
                  className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Sandbox Simulator Clear Notice */}
        <div
          data-testid="sandbox-simulator-disclaimer"
          className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900 flex items-center gap-2.5"
        >
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Sandbox Simulator Only:</strong> Rewards, daily check-ins, and plan calculations operate strictly in{' '}
            <strong>simulated ETB</strong> (no cash value, no guaranteed financial returns, not withdrawable money).
          </span>
        </div>

        {/* B. FOUR ACCOUNT SUMMARY CARDS */}
        <section aria-label="Account Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => navigate('/checkin')}
                className="px-3 py-1 rounded-full bg-[#D71920] text-white text-xs font-semibold hover:bg-[#B80D13] cursor-pointer"
              >
                Check-In
              </button>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500">Wallet Balance</p>
              <p data-testid="summary-balance" className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">
                {loadingSummary ? '...' : formatDemoCredits(summary?.demoBalance ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => navigate('/income')}
                className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
              >
                View Details
              </button>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500">Mining Earnings</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">
                {loadingSummary ? '...' : formatDemoCredits(summary?.demoTotalEarnings ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => navigate('/team')}
                className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 cursor-pointer"
              >
                View Team
              </button>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500">Team Members</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">
                {loadingSummary ? '...' : summary?.qualifyingTeamMembersCount ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => navigate('/task')}
                className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
              >
                View Tasks
              </button>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500">Total Rewards</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">
                {loadingSummary ? '...' : formatDemoCredits(summary?.demoTotalRewards ?? 0)}
              </p>
            </div>
          </div>
        </section>

        {/* C. QUICK ACTION TILES (Gift Code shown ONLY when Admin enables Gift Codes) */}
        <section
          aria-label="Quick Actions"
          className={`grid gap-2.5 sm:gap-4 ${giftCodeEnabled ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}
        >
          <button
            type="button"
            onClick={() => navigate('/recharge')}
            className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 hover:border-[#D71920]/40 flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800">Recharge</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/withdraw')}
            className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 hover:border-[#D71920]/40 flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800">Withdraw</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/service')}
            className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 hover:border-[#D71920]/40 flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#D71920] flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800">Service</span>
          </button>

          <button
            type="button"
            data-testid="home-checkin-btn"
            onClick={() => navigate('/checkin')}
            className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 hover:border-[#D71920]/40 flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
              {summary?.checkedInToday ? 'Claimed Today' : 'Daily Check-in'}
            </span>
          </button>

          {giftCodeEnabled && (
            <button
              type="button"
              data-testid="home-gift-code-btn"
              onClick={() => navigate('/gift-code')}
              className="bg-white rounded-2xl p-3 sm:p-4 border border-amber-300 hover:border-[#D71920] flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer col-span-2 sm:col-span-1"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Gift className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                Gift Code
              </span>
            </button>
          )}
        </section>

        {/* D. DEMO SIMULATOR RULES OVERVIEW */}
        <section aria-label="Simulator Rules Overview" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Registration Bonus</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {formatDemoCredits(settings?.registrationBonus ?? DEMO_REGISTRATION_BONUS)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Referral Rewards</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {settings?.referralLevel1Percent ?? 20}% · {settings?.referralLevel2Percent ?? 2}% ·{' '}
                {settings?.referralLevel3Percent ?? 1}%
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Daily Check-In</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {formatDemoCredits(settings?.dailyCheckinAmount ?? DEMO_DAILY_CHECKIN_AMOUNT)} / Day
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#D71920] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Active Plan Limit</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {summary?.activePlansCount ?? 0} / {MAX_ACTIVE_PLANS} Active · 365 Days
              </p>
            </div>
          </div>
        </section>

        {/* E. INVESTMENT PLANS (FULL WIDTH, ALL 13 PLANS A-M) */}
        <section
          ref={plansSectionRef}
          id="investment-plans"
          aria-label="Investment Plans"
          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#D71920] to-[#B80D13] text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-5 h-5 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold tracking-wide uppercase">
                Investment Plans (ETB)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/income')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>My Purchased Plans</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Simulated plans use <strong>ETB balance only</strong> (max {MAX_ACTIVE_PLANS} active plans, 365-day manual daily claim).
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              Available: {formatDemoCredits(summary?.demoBalance ?? 0)}
            </span>
          </div>

          <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INVESTMENT_PLANS.map((plan) => (
              <div
                key={plan.code}
                data-testid={`plan-card-${plan.code}`}
                className={`rounded-2xl border border-slate-200 bg-[#FAFBFD] p-3.5 flex flex-col justify-between ${
                  plan.code === 'M' ? 'sm:col-span-2 lg:col-span-4' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#D71920] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                      {plan.code}
                    </span>
                    <span className="text-[11px] font-semibold text-[#D71920] bg-red-50 px-2.5 py-0.5 rounded-full">
                      {plan.periodDays} Days
                    </span>
                  </div>

                  {/* Dedicated uncropped Coca-Cola brand logo slot on every plan card */}
                  <div className="mb-3 rounded-xl bg-white border border-slate-200/80 px-2.5 py-2 flex items-center justify-center">
                    <img
                      src={SUPPLIED_ASSETS.planLogo}
                      alt={`Coca-Cola ${plan.name}`}
                      data-testid={`plan-logo-${plan.code}`}
                      className="h-14 sm:h-16 w-auto max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Investment:</span>
                      <span className="font-bold text-slate-900 tabular-nums text-right">
                        {formatDemoCredits(plan.investment)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Daily Mining:</span>
                      <span className="font-bold text-[#D71920] tabular-nums text-right">
                        {formatDemoCredits(plan.dailyMining)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ONLY the Invest Now button performs the synchronized 5-second 3D flip */}
                <div className="mt-3.5">
                  <InvestNowButton
                    planCode={plan.code}
                    onClick={() => {
                      setPurchaseResult(null);
                      setSelectedPlan(plan);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Plan Purchase Confirmation Modal */}
      {selectedPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm Plan ${selectedPlan.code}`}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#D71920] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Confirm Plan {selectedPlan.code}</h3>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                aria-label="Close plan modal"
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Selected Plan</span>
                  <strong>{selectedPlan.name}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Amount to Deduct</span>
                  <strong className="tabular-nums text-slate-900">
                    {formatDemoCredits(selectedPlan.investment)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Daily Mining (Manual Claim)</span>
                  <strong className="text-[#D71920] tabular-nums">
                    {formatDemoCredits(selectedPlan.dailyMining)} / day
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Duration</span>
                  <strong>{selectedPlan.periodDays} Days</strong>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Your Wallet Balance</span>
                  <strong className="tabular-nums">{formatDemoCredits(summary?.demoBalance ?? 0)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Active Plans Held</span>
                  <strong>
                    {summary?.activePlansCount ?? 0} / {MAX_ACTIVE_PLANS}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <strong>Sandbox Simulator:</strong> Deducts simulated ETB only. No real money or cash payout is involved. Daily rewards require manual claiming on the Income page.
              </div>

              {purchaseResult && (
                <div
                  role={purchaseResult.ok ? 'status' : 'alert'}
                  className={`rounded-xl p-3 text-xs ${
                    purchaseResult.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {purchaseResult.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="flex-1 py-2.5 rounded-full border border-slate-300 text-slate-700 font-semibold text-sm cursor-pointer"
                >
                  Close
                </button>
                {purchaseResult?.ok ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(null);
                      navigate('/income');
                    }}
                    className="flex-1 py-2.5 rounded-full bg-emerald-600 text-white font-semibold text-sm cursor-pointer"
                  >
                    Open Income Page
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="confirm-plan-purchase-btn"
                    disabled={purchaseBusy}
                    onClick={handleConfirmPlan}
                    className="flex-1 py-2.5 rounded-full bg-[#D71920] text-white font-semibold text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {purchaseBusy ? 'Processing...' : 'Confirm Purchase'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
