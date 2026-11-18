import React from 'react';
import { User } from 'lucide-react';

export function CocaColaScriptLogo({
  className = 'h-8 w-auto',
  color = '#D71920',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span className={`inline-flex items-center select-none ${className}`} aria-label="Coca-Cola">
      <svg
        viewBox="0 0 210 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        role="img"
        aria-hidden="true"
      >
        <text
          x="4"
          y="46"
          fill={color}
          style={{
            fontFamily: "'Lobster Two', 'Brush Script MT', 'Segoe Script', cursive",
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '46px',
            letterSpacing: '-1px',
          }}
        >
          Coca-Cola
        </text>
        <path
          d="M12 52C56 59 125 57 192 48"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    </span>
  );
}

export function UserAvatar({
  fullName,
  avatarUrl,
  size = 'md',
}: {
  fullName?: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName || 'User profile'}
        className={`${sizeClass} rounded-full object-cover border border-red-200 bg-white shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = (fullName || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-[#D71920] to-[#A3080C] text-white font-semibold flex items-center justify-center border border-white/60 shadow-sm shrink-0`}
      aria-label={fullName || 'Default user avatar'}
    >
      {initials || <User className="w-4 h-4" />}
    </div>
  );
}
