import React, { useEffect, useRef, useState } from 'react';
import { Check, Gift, Sparkles, Trophy, X } from 'lucide-react';
import type { AchievementDetail } from '../shared/experience';

const CONFETTI_BITS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: (index * 37 + 7) % 100,
  delay: (index % 6) * 0.11,
  duration: 1.8 + (index % 4) * 0.25,
  rotation: (index * 53) % 180,
}));

export function AchievementCelebration() {
  const [achievement, setAchievement] = useState<AchievementDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAchievement = (event: Event) => {
      const detail = (event as CustomEvent<AchievementDetail>).detail;
      if (!detail?.title || !detail?.description) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setAchievement(detail);
      timerRef.current = window.setTimeout(() => {
        setAchievement(null);
        timerRef.current = null;
      }, 5600);
    };

    window.addEventListener('cc:achievement', handleAchievement);
    return () => {
      window.removeEventListener('cc:achievement', handleAchievement);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const close = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setAchievement(null);
  };

  if (!achievement) return null;

  const isReward = achievement.category === 'reward';
  const CelebrationIcon = isReward ? Gift : achievement.category === 'welcome' ? Sparkles : Trophy;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-3" aria-live="polite">
      <section
        role="status"
        data-testid="achievement-celebration"
        data-category={achievement.category || 'milestone'}
        className={`cc-achievement-pop pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[26px] border bg-white/95 p-4 shadow-[0_22px_70px_rgba(65,25,10,0.28)] backdrop-blur-xl sm:p-5 ${
          isReward ? 'border-red-200/90' : 'border-amber-200/80'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(253,230,138,0.45),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D71920] via-amber-300 to-[#D71920]" />
        {CONFETTI_BITS.map((bit) => (
          <span
            key={bit.id}
            aria-hidden="true"
            className="cc-achievement-confetti pointer-events-none absolute top-0 h-2 w-1.5 rounded-sm"
            style={{
              left: `${bit.left}%`,
              animationDelay: `${bit.delay}s`,
              animationDuration: `${bit.duration}s`,
              transform: `rotate(${bit.rotation}deg)`,
            }}
          />
        ))}
        <button
          type="button"
          onClick={close}
          aria-label="Close achievement animation"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex items-center gap-3.5 pr-7">
          <div className={`cc-achievement-trophy relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_30px_rgba(217,119,6,0.28)] ring-4 ${
            isReward
              ? 'bg-gradient-to-br from-[#D71920] via-[#EB5459] to-amber-500 ring-red-100'
              : 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 ring-amber-100'
          }`}>
            <CelebrationIcon className="h-7 w-7" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#D71920] text-white ring-2 ring-white">
              <Check className="h-3 w-3" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.24em] text-amber-700">
              <Sparkles className="h-3 w-3" /> Achievement unlocked
            </p>
            <h3 className="mt-1 text-base font-extrabold leading-tight text-slate-900 sm:text-lg">
              {achievement.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
              {achievement.description}
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between border-t border-amber-100 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          <span>Coca-Cola Platform</span>
          <span className={isReward ? 'text-[#D71920]' : 'text-amber-700'}>
            {isReward ? 'Reward confirmed' : achievement.category === 'welcome' ? 'Welcome aboard' : 'Milestone reached'}
          </span>
        </div>
      </section>
    </div>
  );
}
