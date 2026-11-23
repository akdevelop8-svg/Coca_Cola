import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Phone, Ticket } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CinematicAuthHero } from '../components/CinematicAuthHero';
import { queueNewCustomerGuide } from '../shared/experience';
import { isSafeRedirectPath, validateEthiopiaPhone } from '../shared/finance';
import type { UserProfile } from '../types';

const INVITATION_QUERY_KEYS = ['ref', 'referralCode', 'referral', 'invite', 'invitationCode'] as const;

function resolveInvitationCode(routerParams: URLSearchParams): string {
  const candidates: URLSearchParams[] = [routerParams];

  if (typeof window !== 'undefined') {
    candidates.push(new URLSearchParams(window.location.search));

    // Some mobile in-app browsers preserve the invitation query inside the URL hash.
    const hashQuery = window.location.hash.split('?').slice(1).join('?');
    if (hashQuery) candidates.push(new URLSearchParams(hashQuery));
  }

  for (const params of candidates) {
    for (const key of INVITATION_QUERY_KEYS) {
      const value = params.get(key)?.trim();
      if (value) return value.replace(/\s+/g, '').toUpperCase();
    }
  }

  return '';
}

export function RegisterPage() {
  const { config, setUserState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const refFromUrl = resolveInvitationCode(searchParams);
  const redirectTarget = searchParams.get('redirect');

  const [phone, setPhone] = useState('+251');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // URL is the source of truth for referred registrations. Also clear any stale
    // manually entered code when the browser navigates to a different invitation link.
    setReferralCode(refFromUrl);
  }, [refFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEthiopiaPhone(phone)) {
      setError('Enter a valid Ethiopia phone number (+251 9/7XXXXXXXX or 09/07XXXXXXXX).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and confirmation password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserProfile; unreadNotifications: number }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          password,
          confirmPassword,
          referralCode: (refFromUrl || referralCode).trim().toUpperCase() || undefined,
        }),
      });
      setSuccess('Account created successfully. Redirecting to Platform Terms...');
      queueNewCustomerGuide(res.user.id);
      setUserState(res.user, res.unreadNotifications);

      const safeNext = isSafeRedirectPath(redirectTarget);
      const nextParam = redirectTarget ? `?redirect=${encodeURIComponent(safeNext)}` : '';
      navigate(`/onboarding-terms${nextParam}`, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col lg:flex-row">
      <CinematicAuthHero
        imageSrc="/assets/aistudio/factory_93c2daeb.jpg"
        imageAlt="Modern beverage bottling facility"
        eyebrow="A fresh start begins here"
        title={<>Create your account. <span className="text-amber-200">Explore what’s possible.</span></>}
        description="Join the platform, review its terms and discover the tools available for your account and team."
        footer="New account setup · Ethiopia (+251)"
      />

      {/* Right Register Card — Strictly 4 fields: Phone Number, Password, Confirm Password, Invitation Code */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200/80 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Register</h2>
              <p className="text-sm text-slate-500 mt-0.5">Create your platform account</p>
            </div>
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <Link
                to={`/login${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`}
                className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900"
              >
                Login
              </Link>
              <span className="px-3 py-1.5 rounded-full bg-[#D71920] text-white">Register</span>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number (+251)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251911223344 or +251711223344"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-ref" className="block text-sm font-medium text-slate-700 mb-1.5">
                Invitation Code {refFromUrl ? '(Automatically added from invitation link)' : '(Optional)'}
              </label>
              <div className="relative">
                <Ticket className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-ref"
                  type="text"
                  autoComplete="off"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder={refFromUrl ? 'Invitation code added automatically' : 'Open an invitation link to auto-fill'}
                  readOnly={Boolean(refFromUrl)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920] ${
                    refFromUrl ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {refFromUrl
                  ? 'This is your inviter’s code from the link. It is locked so the referral is recorded correctly.'
                  : 'When you register from an invitation link, the inviter’s code will appear here automatically.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white font-semibold text-sm shadow-md disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Creating Account...' : 'Register Now'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to={`/login${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`}
              className="font-semibold text-[#D71920] hover:underline"
            >
              Login
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
