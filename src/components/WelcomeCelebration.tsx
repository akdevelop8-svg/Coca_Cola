import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import './WelcomeCelebration.css';

type WelcomeDetail = { kind: 'register' | 'login'; name: string };
type Firework = { left: string; top: string; delay: number; hue: number };
type FlowerBloom = { left: string; top: string; delay: number; hue: number; scale: number };
type MoneySpark = { left: string; delay: number; duration: number; drift: number };

const FIREWORKS: Firework[] = [
  { left: '11%', top: '24%', delay: 0.05, hue: 355 },
  { left: '87%', top: '19%', delay: 0.48, hue: 42 },
  { left: '20%', top: '69%', delay: 0.92, hue: 8 },
  { left: '79%', top: '67%', delay: 1.36, hue: 350 },
  { left: '49%', top: '12%', delay: 1.8, hue: 45 },
  { left: '61%', top: '78%', delay: 2.24, hue: 12 },
  { left: '37%', top: '38%', delay: 2.68, hue: 345 },
];

const FLOWERS: FlowerBloom[] = [
  { left: '4%', top: '48%', delay: 0.05, hue: 355, scale: 0.9 },
  { left: '17%', top: '10%', delay: 0.6, hue: 42, scale: 0.72 },
  { left: '31%', top: '78%', delay: 1.05, hue: 350, scale: 0.82 },
  { left: '68%', top: '9%', delay: 1.5, hue: 5, scale: 0.78 },
  { left: '91%', top: '43%', delay: 1.95, hue: 42, scale: 0.95 },
  { left: '82%', top: '83%', delay: 2.4, hue: 345, scale: 0.7 },
  { left: '7%', top: '84%', delay: 2.85, hue: 48, scale: 0.74 },
  { left: '94%', top: '9%', delay: 3.3, hue: 355, scale: 0.66 },
];

const MONEY_SPARKS: MoneySpark[] = Array.from({ length: 18 }, (_, index) => ({
  left: ((index * 41 + 9) % 96 + 2) + '%',
  delay: (index % 9) * 0.22,
  duration: 3.2 + (index % 5) * 0.42,
  drift: ((index * 29) % 120) - 60,
}));

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
        {FLOWERS.map((flower, index) => (
          <div
            key={'flower-' + index}
            className="cc-flower-bloom"
            style={{
              left: flower.left,
              top: flower.top,
              animationDelay: flower.delay + 's',
              '--flower-scale': flower.scale,
              '--flower-hue': String(flower.hue),
            } as React.CSSProperties}
          >
            {Array.from({ length: 5 }, (_, petal) => (
              <i
                key={petal}
                className="cc-flower-petal"
                style={{ '--petal-turn': (petal * 72) + 'deg' } as React.CSSProperties}
              />
            ))}
            <span className="cc-flower-center" />
          </div>
        ))}
        {MONEY_SPARKS.map((spark, index) => (
          <span
            key={'money-' + index}
            className="cc-money-spark"
            style={{
              left: spark.left,
              animationDelay: spark.delay + 's',
              animationDuration: spark.duration + 's',
              '--money-drift': spark.drift + 'px',
            } as React.CSSProperties}
          >
            $
          </span>
        ))}
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
        className="cc-welcome-card relative z-10 w-full max-w-lg overflow-hidden rounded-[30px] border border-[#ffd89b] bg-[#fff8f8]/95 px-5 pb-7 pt-8 text-center shadow-[0_30px_100px_rgba(80,0,12,0.5)] backdrop-blur-xl sm:px-8"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close welcome celebration"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-white/95 text-[#B80D13] shadow-sm transition-colors hover:bg-red-50 hover:text-[#7F0010]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="cc-welcome-hero mt-2 flex items-center gap-4 rounded-[26px] p-3 text-left sm:gap-5 sm:p-4">
          <img
            src="/assets/aistudio/bottles_3242d4ef.jpg"
            alt="Coca-Cola bottles"
            className="cc-welcome-product-image"
            loading="eager"
          />
          <div className="min-w-0 flex-1">
            <div className="cc-welcome-burst mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF1BC] via-[#F9C64D] to-[#E87831] text-[#8E0010] shadow-[0_8px_22px_rgba(255,197,65,0.42)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/90">
              Coca-Cola Platform
            </p>
            <h2 id="cc-welcome-title" className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
              {greeting}
            </h2>
            <p className="mt-1 break-words text-xl font-extrabold text-[#FFE39A] sm:text-2xl">
              {safeName}!
            </p>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#642b35]">
          {isNew
            ? 'Welcome to the platform.'
            : 'Your account is ready.'}
        </p>
        <div className="cc-welcome-pill mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-[#D71920]" />
          {isNew ? 'Let’s begin' : 'Welcome back'}
        </div>
      </section>
    </div>
  );
}
