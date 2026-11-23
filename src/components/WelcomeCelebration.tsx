import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import './WelcomeCelebration.css';

type WelcomeDetail = { kind: 'register' | 'login'; name: string };
type Firework = { left: string; top: string; delay: number; hue: number };

const FIREWORKS: Firework[] = [
  { left: '14%', top: '26%', delay: 0.1, hue: 350 },
  { left: '82%', top: '22%', delay: 0.65, hue: 42 },
  { left: '24%', top: '68%', delay: 1.15, hue: 8 },
  { left: '75%', top: '65%', delay: 1.7, hue: 28 },
  { left: '50%', top: '17%', delay: 2.25, hue: 350 },
];

const SPARKS = Array.from({ length: 16 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 16;
  const distance = 48 + (index % 4) * 13;
  return {
    id: index,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
});

export function WelcomeCelebration() {
  const [welcome, setWelcome] = useState<WelcomeDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleWelcome = (event: Event) => {
      const detail = (event as CustomEvent<WelcomeDetail>).detail;
      if (!detail || (detail.kind !== 'register' && detail.kind !== 'login')) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setWelcome(detail);
      timerRef.current = window.setTimeout(() => {
        setWelcome(null);
        timerRef.current = null;
      }, 5600);
    };

    window.addEventListener('cc:welcome', handleWelcome);
    return () => {
      window.removeEventListener('cc:welcome', handleWelcome);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const close = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setWelcome(null);
  };

  if (!welcome) return null;

  const isNew = welcome.kind === 'register';
  const greeting = isNew ? 'Welcome' : 'Welcome back';
  const safeName = welcome.name || 'Coca-Cola friend';

  return (
    <div className="cc-welcome-overlay fixed inset-0 z-[140] flex items-center justify-center overflow-hidden px-4 py-8" role="presentation">
      <div className="cc-welcome-wash absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {FIREWORKS.map((firework, index) => (
          <div
            key={index}
            className="cc-firework"
            style={{
              left: firework.left,
              top: firework.top,
              animationDelay: firework.delay + 's',
              '--firework-hue': String(firework.hue),
            } as React.CSSProperties}
          >
            {SPARKS.map((spark) => (
              <i
                key={spark.id}
                className="cc-firework-spark"
                style={{
                  '--spark-x': spark.x + 'px',
                  '--spark-y': spark.y + 'px',
                  animationDelay: (firework.delay + 0.15) + 's',
                } as React.CSSProperties}
              />
            ))}
            <span className="cc-firework-core" />
          </div>
        ))}
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            className="cc-welcome-confetti"
            style={{
              left: ((index * 37 + 8) % 100) + '%',
              animationDelay: ((index % 9) * 0.17) + 's',
              animationDuration: (2.7 + (index % 5) * 0.38) + 's',
              '--confetti-turn': ((index * 49) % 240) + 'deg',
            } as React.CSSProperties}
          />
        ))}
      </div>

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-welcome-title"
        className="cc-welcome-card relative z-10 w-full max-w-lg overflow-hidden rounded-[30px] border border-white/80 bg-white/95 px-6 pb-7 pt-8 text-center shadow-[0_30px_100px_rgba(145,20,25,0.24)] backdrop-blur-xl sm:px-10"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close welcome celebration"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-red-50 hover:text-[#D71920]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="cc-welcome-burst mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#FCE7A1] via-[#F9C64D] to-[#E87831] text-white shadow-[0_14px_35px_rgba(217,119,6,0.28)]">
          <Sparkles className="h-10 w-10" />
        </div>
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#C81018]">
          Coca-Cola Platform
        </p>
        <h2 id="cc-welcome-title" className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {greeting},
        </h2>
        <p className="mt-1 break-words text-2xl font-extrabold text-[#D71920] sm:text-3xl">
          {safeName}!
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
          {isNew
            ? 'We’re delighted you’re here. Your next chapter starts now.'
            : 'It’s great to see you again. Your community and journey are ready for you.'}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-[11px] font-bold text-[#B80D13]">
          <span className="h-2 w-2 rounded-full bg-[#D71920]" />
          {isNew ? 'A fresh start begins' : 'Welcome back to your community'}
        </div>
      </section>
    </div>
  );
}
