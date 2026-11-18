import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { SUPPLIED_ASSETS } from '../shared/constants';
import { CocaColaScriptLogo } from './BrandMark';

const MIN_LOADING_MS = 8000;

export function LoadingScreen({
  appReady,
  avatarUrl,
  userName,
  onComplete,
}: {
  appReady: boolean;
  avatarUrl?: string | null;
  userName?: string | null;
  onComplete: () => void;
}) {
  const profileSrc = avatarUrl || SUPPLIED_ASSETS.splashDrinkHero;
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  // Preload & decode the profile image immediately so it appears without flashing or delay
  useEffect(() => {
    let cancelled = false;
    setImageError(false);

    const preloadSrc = (src: string) => {
      const img = new Image();
      img.src = src;

      const markReady = () => {
        if (!cancelled) setImageReady(true);
      };

      if (img.complete && img.naturalWidth > 0) {
        if (typeof img.decode === 'function') {
          img.decode().then(markReady).catch(markReady);
        } else {
          markReady();
        }
      } else {
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().then(markReady).catch(markReady);
          } else {
            markReady();
          }
        };
        img.onerror = () => {
          if (!cancelled) {
            setImageError(true);
            setImageReady(true);
          }
        };
      }
    };

    preloadSrc(profileSrc);
    if (profileSrc !== SUPPLIED_ASSETS.splashDrinkHero) {
      const heroPreload = new Image();
      heroPreload.src = SUPPLIED_ASSETS.splashDrinkHero;
    }

    return () => {
      cancelled = true;
    };
  }, [profileSrc]);

  // Enforce minimum 8-second display on fresh page load while waiting for readiness
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinElapsed(true);
    }, MIN_LOADING_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const isLoadingFinished = minElapsed && appReady && imageReady;

  // Stop spinning animation once loading finishes and transition cleanly
  useEffect(() => {
    if (!isLoadingFinished) return;
    setFadingOut(true);
    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, 360);
    return () => window.clearTimeout(doneTimer);
  }, [isLoadingFinished, onComplete]);

  const initials = (userName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      data-testid="loading-screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#E11D24] via-[#C81018] to-[#8C060A] text-white overflow-hidden transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle circular ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-black/20 blur-3xl" />
      </div>

      {/* Top Script Brand Logo */}
      <div className="relative z-10 pt-10 sm:pt-12 flex flex-col items-center gap-1.5 px-6 text-center">
        <CocaColaScriptLogo color="#FFFFFF" className="h-12 sm:h-14" />
        <p className="text-xs sm:text-sm font-medium tracking-wide text-white/90">
          Taste the Future · Together for a Prosperous Future
        </p>
      </div>

      {/* Center Circular Profile Image + Centered Rotating Circular Loader Rings */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 my-4">
        <div
          data-testid="loading-avatar-ring-wrapper"
          data-spinning={isLoadingFinished ? 'false' : 'true'}
          className="relative w-56 h-56 sm:w-68 sm:h-68 aspect-square rounded-full flex items-center justify-center shrink-0"
        >
          {/* Ambient Outer Circular Halo */}
          <div
            className="absolute inset-0 rounded-full border-2 border-white/15 pointer-events-none"
            aria-hidden="true"
          />

          {/* Primary Smooth 360-degree Rotating Circular Loader Ring */}
          <svg
            data-testid="circular-loader-ring"
            viewBox="0 0 120 120"
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full pointer-events-none loading-ring-spin ${
              isLoadingFinished ? 'loading-ring-paused' : ''
            }`}
          >
            <defs>
              <linearGradient id="colaLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="55%" stopColor="#FDE68A" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="57"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="3.5"
            />
            <circle
              cx="60"
              cy="60"
              r="57"
              fill="none"
              stroke="url(#colaLoaderGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="135 225"
            />
          </svg>

          {/* Secondary Subtle Inner Counter-Rotating Circular Accent */}
          <svg
            viewBox="0 0 120 120"
            aria-hidden="true"
            className={`absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] pointer-events-none loading-ring-reverse ${
              isLoadingFinished ? 'loading-ring-paused' : ''
            }`}
          >
            <circle
              cx="60"
              cy="60"
              r="57"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeDasharray="52 310"
            />
          </svg>

          {/* Perfectly Circular 1:1 Profile Image (Never rectangular) */}
          <div
            data-testid="loading-circular-profile"
            className="relative z-10 w-[calc(100%-28px)] h-[calc(100%-28px)] aspect-square rounded-full overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.42)] ring-4 ring-white/90 bg-[#9E0B10] flex items-center justify-center"
          >
            {!imageError ? (
              <img
                data-testid="loading-profile-image"
                src={profileSrc}
                alt={userName ? `${userName} profile` : 'Enjoying a refreshing Coca-Cola'}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                onLoad={() => setImageReady(true)}
                onError={() => {
                  setImageError(true);
                  setImageReady(true);
                }}
                className="w-full h-full aspect-square rounded-full object-cover object-center block"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                data-testid="loading-profile-fallback"
                className="w-full h-full rounded-full bg-gradient-to-br from-[#B80D13] to-[#6E0407] flex flex-col items-center justify-center text-white select-none"
              >
                {initials ? (
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                    {initials}
                  </span>
                ) : (
                  <User className="w-16 h-16 sm:w-20 sm:h-20 text-white/90" aria-hidden="true" />
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs sm:text-sm font-semibold tracking-wider uppercase text-amber-200 text-center">
          Invest Today — Build a Better Tomorrow
        </p>
      </div>

      {/* Bottom Circular Status Label (No rectangular progress bar) */}
      <div className="relative z-10 pb-10 sm:pb-12 px-6 flex flex-col items-center gap-1.5 text-center">
        <span className="text-base font-bold tracking-wide text-white">
          {isLoadingFinished ? 'Ready' : 'Loading...'}
        </span>
        <p className="text-xs text-white/80">
          Preparing your secure session &amp; platform data
        </p>
      </div>
    </div>
  );
}
