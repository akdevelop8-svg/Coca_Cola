import React from 'react';

interface InvestNowButtonProps {
  onClick: () => void;
  planCode: string;
  className?: string;
}

export function InvestNowButton({ onClick, planCode, className = '' }: InvestNowButtonProps) {
  return (
    <span className={`invest-btn-perspective ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Invest Now in Plan ${planCode}`}
        className="invest-btn-flip w-full min-h-[38px] px-4 py-2 rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D71920]"
      >
        Invest Now
      </button>
    </span>
  );
}
