import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { CocaColaScriptLogo } from './BrandMark';

interface CinematicAuthHeroProps {
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  footer: string;
}

export function CinematicAuthHero({
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  description,
  footer,
}: CinematicAuthHeroProps) {
  return (
    <section className="cc-auth-hero relative isolate min-h-[310px] lg:min-h-screen lg:w-1/2 overflow-hidden bg-[#76060A] text-white">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="absolute inset-0 h-full w-full object-cover object-center opacity-40"
        loading="eager"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(90,2,7,0.94)_0%,rgba(190,12,20,0.82)_48%,rgba(70,0,5,0.92)_100%)]" />
      <div className="cc-auth-light-sweep pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full border border-white/10 bg-white/[0.04] blur-[1px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full border border-amber-100/20 bg-red-300/[0.08] blur-2xl" />
      <div className="cc-auth-orb cc-auth-orb-one pointer-events-none absolute right-[14%] top-[20%] h-7 w-7 rounded-full border border-white/30 bg-white/15 shadow-[0_0_35px_rgba(255,255,255,0.25)]" />
      <div className="cc-auth-orb cc-auth-orb-two pointer-events-none absolute right-[28%] bottom-[24%] h-3 w-3 rounded-full bg-amber-200/80 shadow-[0_0_26px_rgba(253,230,138,0.7)]" />

      <div className="relative z-10 flex min-h-[310px] flex-col justify-between p-6 sm:p-9 lg:min-h-screen lg:p-10 xl:p-12">
        <div className="flex items-center justify-between">
          <CocaColaScriptLogo color="#FFFFFF" className="h-10 sm:h-12" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Welcome
          </span>
        </div>

        <div className="my-8 max-w-xl lg:my-auto lg:py-12">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-200 sm:text-xs">
            <span className="h-px w-8 bg-amber-200/80" />
            {eyebrow}
          </p>
          <h1 className="max-w-lg text-3xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-4xl xl:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            {description}
          </p>

          <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/20 bg-black/15 p-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:max-w-sm sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-200 ring-1 ring-white/15">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">Together for a Prosperous Future</p>
              <p className="mt-0.5 text-[11px] text-white/65">A smoother way to explore your platform</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-white/70" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-4 text-[10px] text-white/65 sm:text-xs">
          <span>{footer}</span>
          <span className="font-semibold tracking-[0.2em] text-white/80">ETHIOPIA</span>
        </div>
      </div>
    </section>
  );
}
