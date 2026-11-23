import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Phone, ArrowRight } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CinematicAuthHero } from '../components/CinematicAuthHero';
import { isSafeRedirectPath } from '../shared/finance';
import { isAdminRole } from '../shared/roles';
import { triggerWelcomeCelebration } from '../shared/welcome';
import type { UserProfile } from '../types';

export function LoginPage() {
  const { config, setUserState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your phone number or username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserProfile; unreadNotifications: number }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      setUserState(res.user, res.unreadNotifications);

      if (isAdminRole(res.user.role)) {
        const latestVersion = config?.settings?.termsVersion || 'v1.0';
        if (res.user.termsAcceptedVersion !== latestVersion) {
          navigate(`/onboarding-terms?redirect=${encodeURIComponent('/admin')}`, { replace: true });
        } else {
          navigate('/admin', { replace: true });
        }
        return;
      }

      triggerWelcomeCelebration('login', res.user.displayName || res.user.fullName || '');
      const safeNext = isSafeRedirectPath(redirectTarget);
      if (!res.user.termsAcceptedVersion) {
        const nextParam = redirectTarget ? `?redirect=${encodeURIComponent(safeNext)}` : '';
        navigate(`/onboarding-terms${nextParam}`, { replace: true });
      } else {
        navigate(safeNext, { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7A0407] via-[#B80D13] to-[#D71920] flex flex-col lg:flex-row">
      <CinematicAuthHero
        imageSrc="/assets/aistudio/bottles_3242d4ef.jpg"
        imageAlt="Coca-Cola bottle collection"
        eyebrow="Your platform, beautifully connected"
        title={<>Invest Today <span className="text-amber-200">Build a Better Tomorrow</span></>}
        description="Welcome back. Sign in to explore your dashboard, purchased plans, daily claims and account activity."
        footer="Secure sign-in · Ethiopia (+251)"
      />

      {/* Phone Number or Username and Password */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200/80 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-sm text-slate-500 mt-0.5">Sign in to your account</p>
            </div>
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <span className="px-3 py-1.5 rounded-full bg-[#D71920] text-white">Login</span>
              <Link
                to={`/register${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`}
                className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900"
              >
                Register
              </Link>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identifier" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number or Username
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="+251 9/7XXXXXXXX, 09/07XXXXXXXX, or username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'Signing In...' : 'Login'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              to={`/register${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`}
              className="font-semibold text-[#D71920] hover:underline"
            >
              Create Account
            </Link>
          </p>
          {config?.settings?.privacyPolicyUrl && (
            <p className="mt-4 text-center text-xs text-slate-500">
              <a href={config.settings.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#B80D13] hover:underline">
                Privacy Policy
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
