import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Phone, Ticket } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CocaColaScriptLogo } from '../components/BrandMark';
import { SUPPLIED_ASSETS } from '../shared/constants';
import { isSafeRedirectPath, validateEthiopiaPhone } from '../shared/finance';
import type { UserProfile } from '../types';

export function RegisterPage() {
  const { config, setUserState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const refFromUrl = searchParams.get('ref')?.trim().toUpperCase() || '';
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
    if (refFromUrl) {
      setReferralCode(refFromUrl);
    }
  }, [refFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEthiopiaPhone(phone)) {
      setError('Enter a valid Ethiopia phone number (+251 9XXXXXXXX or 09XXXXXXXX).');
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
          referralCode: referralCode.trim() || undefined,
        }),
      });
      setSuccess('Account created successfully. Redirecting to Platform Terms...');
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
      {/* Left Branded Banner */}
      <div className="relative lg:w-1/2 bg-gradient-to-br from-[#E11D24] via-[#B80D13] to-[#7A0407] text-white p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <CocaColaScriptLogo color="#FFFFFF" className="h-10 sm:h-12" />
        </div>

        <div className="relative z-10 my-8 lg:my-auto max-w-md">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Create Your Account
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/90 leading-relaxed">
            Join and review platform terms, CBE deposit &amp; withdrawal workflows, and 3-level team referrals.
          </p>
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/20 shadow-xl">
            <img
              src={SUPPLIED_ASSETS.factory}
              alt="Coca-Cola bottling operations"
              className="w-full h-44 sm:h-52 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/75">
          Inviter attribution is permanently recorded at registration and verified server-side.
        </p>
      </div>

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
                  placeholder="+251911223344"
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
                Invitation Code {refFromUrl ? '(Auto-filled from invitation link)' : '(Optional)'}
              </label>
              <div className="relative">
                <Ticket className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-ref"
                  type="text"
                  value={referralCode}
                  readOnly={Boolean(refFromUrl)}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Enter invitation code"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920] ${
                    refFromUrl ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : ''
                  }`}
                />
              </div>
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
        </div>
      </div>
    </div>
  );
}
