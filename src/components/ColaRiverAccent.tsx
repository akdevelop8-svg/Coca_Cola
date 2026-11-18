import React from 'react';

export function ColaRiverAccent() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none w-full overflow-hidden mt-6 opacity-90"
    >
      <div className="relative h-14 sm:h-16 w-full rounded-2xl overflow-hidden bg-gradient-to-r from-[#8A080C] via-[#C81018] to-[#7A0609] flex items-center justify-between px-4 sm:px-6 text-white">
        <svg
          viewBox="0 0 1200 80"
          preserveAspectRatio="none"
          className="cola-river-animate absolute inset-0 w-[115%] h-full opacity-35"
        >
          <path
            d="M0,45 C180,15 360,70 540,40 C720,10 900,68 1200,32 L1200,80 L0,80 Z"
            fill="#4A0204"
          />
          <path
            d="M0,58 C210,32 420,76 660,48 C880,22 1040,62 1200,45 L1200,80 L0,80 Z"
            fill="#FF5C5C"
            opacity="0.3"
          />
        </svg>
        <div className="relative z-10 flex items-center gap-2.5 text-xs sm:text-sm font-medium">
          <span className="inline-block w-2.5 h-6 rounded-full bg-white/80" />
          <span className="font-semibold tracking-wide">Together for a Prosperous Future</span>
        </div>
        <span className="relative z-10 text-[11px] sm:text-xs text-white/85">
          Sandbox Mode · Ethiopia
        </span>
      </div>
    </div>
  );
}

export function SidebarColaPourAccent() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none mx-3 mb-2 rounded-xl bg-gradient-to-b from-[#9E0B10] to-[#6B0407] p-3 text-white/95 overflow-hidden relative border border-white/10"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold leading-tight">Grow Together</p>
          <p className="text-[10px] text-white/75 leading-tight mt-0.5">Achieve More</p>
        </div>
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none">
          {/* Stylized bottle pouring into glass */}
          <rect x="6" y="4" width="10" height="16" rx="3" transform="rotate(-28 6 4)" fill="#FCA5A5" opacity="0.9" />
          <path
            d="M19 16 C22 22, 24 27, 25 34"
            stroke="#3B0305"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="cola-pour-animate"
          />
          <path
            d="M19 16 C22 22, 24 27, 25 34"
            stroke="#F87171"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="cola-pour-animate"
          />
          <path d="M18 32 H34 L32 45 H20 Z" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1.4" />
          <path d="M19.5 36 H32.5 L31.2 44 H20.8 Z" fill="#450A0A" />
        </svg>
      </div>
    </div>
  );
}
