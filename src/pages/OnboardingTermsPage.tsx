import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CocaColaScriptLogo } from '../components/BrandMark';
import { formatBr, formatEtb, isSafeRedirectPath } from '../shared/finance';
import type { UserProfile } from '../types';

export function OnboardingTermsPage() {
  const { user, config, setUserState, refreshAuth, refreshConfig } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const safeDestination = isSafeRedirectPath(rawRedirect);

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);
  const alertRef = useRef<HTMLDivElement | null>(null);

  const latestVersion = config?.settings?.termsVersion || 'v1.0';

  // Already accepted users must never repeatedly see the onboarding screen
  useEffect(() => {
    if (user && user.termsAcceptedVersion === latestVersion) {
      navigate(safeDestination, { replace: true });
    }
  }, [user, latestVersion, safeDestination, navigate]);

  const settings = config?.settings;

  const submitAcceptance = async () => {
    setError('');

    let activeUser = user;
    if (!activeUser) {
      activeUser = await refreshAuth();
    }

    if (!activeUser) {
      setError('Your session is not authenticated. Please log in again.');
      navigate(`/login?redirect=${encodeURIComponent(safeDestination)}`, { replace: true });
      return;
    }

    if (!accepted) {
      setError('Please check the box confirming you have read and agree to the Platform Terms & Summary.');
      window.setTimeout(() => {
        alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 20);
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const activeConfig = config || (await refreshConfig());
      const targetVersion = activeConfig?.settings?.termsVersion || 'v1.0';

      const res = await apiFetch<{
        ok?: boolean;
        success?: boolean;
        user?: UserProfile | null;
        acceptedVersion?: string;
        termsAccepted?: boolean;
      }>('/api/onboarding/accept-terms', {
        method: 'POST',
        body: JSON.stringify({
          accepted: true,
          termsVersion: targetVersion,
        }),
      });

      if (!res?.ok && !res?.success) {
        throw new Error('Could not save your terms acceptance. Please try again.');
      }

      // Refresh from the server so navigation only happens after the accepted version is verified.
      const acceptedUser = res.user || (await refreshAuth());
      if (!acceptedUser || acceptedUser.termsAcceptedVersion !== targetVersion) {
        throw new Error('Your acceptance could not be verified yet. Please try again.');
      }

      setUserState(acceptedUser);
      navigate(safeDestination, { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to save your acceptance. Please try again.';
      setError(msg);
      if (err?.status === 401) {
        navigate(`/login?redirect=${encodeURIComponent(safeDestination)}`, { replace: true });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitAcceptance();
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] py-6 sm:py-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Card Header — Sign Out intentionally kept under My > Logout */}
        <div className="bg-gradient-to-r from-[#D71920] to-[#A3080C] text-white px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Platform Terms &amp; Summary</h1>
              <p className="text-xs text-white/85">
                Version {latestVersion} · Please review before continuing
              </p>
            </div>
          </div>
          <CocaColaScriptLogo color="#FFFFFF" className="h-8 hidden sm:inline-flex" />
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 sm:p-8 space-y-5" noValidate>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900">
              <p className="font-semibold">Wallet & Rewards Notice</p>
              <p className="mt-1">Wallet entries are recorded in the platform ledger. Deposits are credited only after administrator verification. Withdrawals require administrator approval and a completed manual bank transfer. Daily rewards must be claimed manually and depend on active plan eligibility. No return is guaranteed.</p>
            </div>
          </div>

          {/* Key Configured Terms Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Registration Bonus</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                {formatEtb(settings?.registrationBonus ?? 150)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">ETB wallet balance</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Daily Check-In</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                +{formatEtb(settings?.dailyCheckinAmount ?? 2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Manual claim daily</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Active Plan Limit</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                {settings?.purchaseLimit ?? 2} Active Plans
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">365-day term</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Referral Rewards</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                {settings?.referralLevel1Percent ?? 20}% · {settings?.referralLevel2Percent ?? 2}% ·{' '}
                {settings?.referralLevel3Percent ?? 1}%
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">On plan purchases</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Minimum Withdrawal (ETB)</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                {formatBr(settings?.minWithdrawal ?? 150)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {settings?.withdrawalFeePercent ?? 17}% fee · Verified deposits only
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Deposit Channel</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {config?.financialOperationsEnabled && config.activeDepositMethods?.[0]
                  ? `${config.activeDepositMethods[0].name} · ${config.activeDepositMethods[0].accountNumber}`
                  : 'Currently unavailable — do not transfer funds'}
              </p>
            </div>
          </div>

          {/* Scrollable Material Terms */}
          <div
            tabIndex={0}
            aria-label="Full platform terms and conditions"
            className="h-44 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm text-slate-700 space-y-2.5 leading-relaxed"
          >
            <p>
              <strong>1. Wallet, Deposits &amp; Withdrawals:</strong> Wallet balances are ETB ledger
              entries and are not bank deposits or guaranteed returns. Verified deposits are credited
              after administrator review. When financial operations are enabled, eligible customers may
              request withdrawals subject to the available balance, minimum amount, configured fee,
              administrator review, and manual bank-transfer confirmation. Promotional rewards are
              conditional and must be claimed under the platform rules. This independently operated
              platform does not claim endorsement by The Coca-Cola Company.
            </p>
            <p>
              <strong>2. Manual Claims &amp; Active Limits:</strong> Daily check-in rewards and daily plan mining
              rewards are never credited automatically—you must press the Claim button manually once per Ethiopia
              calendar day. Up to {settings?.purchaseLimit ?? 2} active plans are permitted per account.
            </p>
            <p>
              <strong>3. Deposit &amp; Withdrawal Availability:</strong>{' '}
              {config?.financialOperationsEnabled
                ? 'Deposits may be submitted for administrator verification. Eligible withdrawals are subject to the displayed minimum amount and fee, administrator review, and confirmation of the manual bank transfer before completion.'
                : 'Deposits and withdrawals are currently disabled. Do not transfer money to any bank account or treat wallet amounts as withdrawable while this notice is displayed.'}
            </p>
            <p>
              <strong>4. Account Security:</strong> Logout remains accessible under My &gt; Logout (or the sidebar
              menu). Inviter attribution recorded at registration cannot be altered later.
            </p>
          </div>

          {/* Checkbox */}
          <label
            htmlFor="terms-accept-checkbox"
            className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white hover:bg-slate-50 cursor-pointer transition-colors ${
              error && !accepted ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'
            }`}
          >
            <input
              id="terms-accept-checkbox"
              data-testid="terms-checkbox"
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                if (error) setError('');
              }}
              className="mt-0.5 w-5 h-5 accent-[#D71920] rounded cursor-pointer shrink-0"
            />
            <span className="text-sm text-slate-800 select-none">
              I have read and understand the Platform Terms &amp; Summary ({latestVersion}),
              fees, eligibility rules, and whether financial operations are enabled.
            </span>
          </label>

          {error && (
            <div
              ref={alertRef}
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            data-testid="accept-terms-btn"
            disabled={submitting}
            onClick={() => void submitAcceptance()}
            className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{submitting ? 'Saving Acceptance...' : 'Accept Terms & Continue'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
