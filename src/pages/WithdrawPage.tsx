import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CreditCard, Landmark, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { calculateWithdrawalBreakdown, formatBr, formatBrExact, getCustomerDisplayName } from '../shared/finance';
import type { PayoutAccountRecord, WalletSummary, WithdrawalRequest } from '../types';

const getEthiopiaMinuteOfDay = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
};

const getEthiopianClockMinuteOfDay = () =>
  (getEthiopiaMinuteOfDay() - 6 * 60 + 1440) % 1440;

const parseClockMinutes = (value: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const isWithinWithdrawalWindow = (
  startTime: string,
  endTime: string,
  minuteOfDay = getEthiopianClockMinuteOfDay(),
) => {
  const start = parseClockMinutes(startTime);
  const end = parseClockMinutes(endTime);
  if (start === null || end === null || start === end) return false;
  return start < end
    ? minuteOfDay >= start && minuteOfDay < end
    : minuteOfDay >= start || minuteOfDay < end;
};

const formatClock12 = (totalMinutes: number) => {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const withdrawalWindowLabel = (startTime: string, endTime: string) => {
  const start = parseClockMinutes(startTime);
  const end = parseClockMinutes(endTime);
  if (start === null || end === null) return 'Schedule unavailable';
  return `${formatClock12(start)}–${formatClock12(end)} Ethiopian clock (${formatClock12(start + 360)}–${formatClock12(end + 360)} EAT)`;
};

export function WithdrawPage() {
  const { user, config, refreshConfig } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountRecord | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [ethiopiaClockMinutes, setEthiopiaClockMinutes] = useState(getEthiopianClockMinuteOfDay);

  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const withdrawalIdempotencyKey = useRef<{ amount: string; key: string } | null>(null);

  const settings = config?.settings;
  const withdrawalEnabled = settings?.withdrawalEnabled ?? true;
  const withdrawalStartTime = settings?.withdrawalStartTime ?? '04:00';
  const withdrawalEndTime = settings?.withdrawalEndTime ?? '11:00';
  const currentWithdrawalWindowLabel = withdrawalWindowLabel(withdrawalStartTime, withdrawalEndTime);
  const minWithdrawal = settings?.minWithdrawal ?? 150;
  const feePercent = settings?.withdrawalFeePercent ?? 17;
  const activePayoutNames =
    config?.activePayoutMethods && config.activePayoutMethods.length > 0
      ? config.activePayoutMethods.map((m) => m.name).join(', ')
      : settings?.withdrawalMethodOnly || 'CBE ONLY';

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, wRes] = await Promise.all([
        apiFetch<WalletSummary>('/api/dashboard/summary'),
        apiFetch<{ account: PayoutAccountRecord | null }>('/api/payout-account'),
        apiFetch<{ withdrawals: WithdrawalRequest[] }>('/api/withdrawals'),
      ]);
      setSummary(sRes);
      setPayoutAccount(pRes.account);
      setWithdrawals(wRes.withdrawals);
    } catch (err: any) {
      setError(err?.message || 'Unable to load withdrawal details right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const refreshEthiopiaTime = () => setEthiopiaClockMinutes(getEthiopianClockMinuteOfDay());
    refreshEthiopiaTime();
    const interval = window.setInterval(refreshEthiopiaTime, 15_000);
    window.addEventListener('focus', refreshEthiopiaTime);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshEthiopiaTime);
    };
  }, []);

  useEffect(() => {
    const refreshAvailability = () => { void refreshConfig(); };
    refreshAvailability();
    const interval = window.setInterval(refreshAvailability, 60_000);
    window.addEventListener('focus', refreshAvailability);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshAvailability);
    };
  }, [refreshConfig]);

  const isWithdrawalWindowOpen =
    withdrawalEnabled &&
    isWithinWithdrawalWindow(withdrawalStartTime, withdrawalEndTime, ethiopiaClockMinutes);
  const available = summary?.availableBalance ?? 0;
  const parsedAmount = Number(amount);
  const breakdown = calculateWithdrawalBreakdown(parsedAmount, available, minWithdrawal, feePercent);

  const canSubmit =
    isWithdrawalWindowOpen &&
    !loading &&
    payoutAccount?.status === 'approved' &&
    breakdown.isValid;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!withdrawalEnabled) {
      setError('Customer withdrawals are currently disabled by the administrator.');
      return;
    }
    if (!isWithinWithdrawalWindow(withdrawalStartTime, withdrawalEndTime)) {
      setError(`Withdrawal requests are accepted daily only during ${currentWithdrawalWindowLabel}.`);
      return;
    }
    if (!payoutAccount) {
      setError('Save your payout account under Bank Account Management first.');
      return;
    }
    if (payoutAccount.status !== 'approved') {
      setError('Please save or update your payout details in Bank Account Management before requesting a withdrawal.');
      return;
    }
    if (!breakdown.isValid) {
      setError(breakdown.error || 'Enter a valid withdrawal amount.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmWithdraw = async () => {
    if (submitting) return;
    if (!withdrawalEnabled) {
      setConfirmOpen(false);
      setError('Customer withdrawals are currently disabled by the administrator.');
      return;
    }
    if (!isWithinWithdrawalWindow(withdrawalStartTime, withdrawalEndTime)) {
      setConfirmOpen(false);
      setError(`Withdrawal requests are accepted daily only during ${currentWithdrawalWindowLabel}.`);
      setEthiopiaClockMinutes(getEthiopianClockMinuteOfDay());
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Persist one idempotency key per user and gross amount so a retry after reload
      // cannot create a second withdrawal if the first response was lost.
      const amountKey = Number(breakdown.grossAmount).toFixed(2);
      const storageKey = `coca-cola:withdrawal:${user?.id || 'current-user'}:${amountKey}`;
      let idempotency =
        withdrawalIdempotencyKey.current?.amount === amountKey
          ? withdrawalIdempotencyKey.current.key
          : null;
      if (!idempotency) {
        try {
          idempotency = localStorage.getItem(storageKey) || crypto.randomUUID();
          localStorage.setItem(storageKey, idempotency);
        } catch {
          idempotency = crypto.randomUUID();
        }
      }
      withdrawalIdempotencyKey.current = { amount: amountKey, key: idempotency };
      const res = await apiFetch<{ message: string }>('/api/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount: breakdown.grossAmount,
          idempotencyKey: idempotency,
        }),
      });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // The in-memory key still protects retries for this page session.
      }
      setConfirmOpen(false);
      setSuccess(res.message);
      withdrawalIdempotencyKey.current = null;
      setAmount('');
      await loadData();
    } catch (err: any) {
      setConfirmOpen(false);
      setError(err?.message || 'Withdrawal request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusClass = (status: WithdrawalRequest['status']) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'bg-emerald-100 text-emerald-800';
      case 'processed':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <AppShell title="Withdraw Funds">
      <div className="space-y-5">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Withdrawal Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#D71920] to-[#A3080C] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5" />
                <div>
                  <h2 className="text-base font-bold">Withdraw ({activePayoutNames}) · {displayName}</h2>
                  <p className="text-xs text-white/85">
                    Minimum: {formatBr(minWithdrawal)} · Fee: {feePercent}%
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-white/80 whitespace-nowrap">Available Balance</p>
                <p className="text-base font-extrabold tabular-nums whitespace-nowrap">
                  {loading ? '...' : formatBrExact(available)}
                </p>
              </div>
            </div>

            <form onSubmit={handleOpenConfirm} className="p-5 space-y-4">
              {/* Saved Payout Account Card */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#D71920]" />
                    <span className="text-xs font-bold text-slate-900">
                      Your Saved Payout Method: {activePayoutNames}
                    </span>
                  </div>
                  <Link
                    to="/my/bank-account"
                    className="text-xs font-semibold text-[#D71920] hover:underline"
                  >
                    Manage Account
                  </Link>
                </div>

                {!payoutAccount ? (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    No payout account saved yet.{' '}
                    <Link to="/my/bank-account" className="font-bold underline">
                      Save your payout account
                    </Link>{' '}
                    before requesting a withdrawal. Admin approval is not required.
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <p className="font-semibold text-slate-800">{payoutAccount.accountOwnerName}</p>
                      <p className="font-mono text-slate-600">
                        {payoutAccount.methodName} · {payoutAccount.maskedAccountNumber}
                      </p>
                    </div>
                    <span
                      className={`font-bold uppercase ${
                        payoutAccount.status === 'approved'
                          ? 'text-emerald-700'
                          : payoutAccount.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-amber-700'
                      }`}
                    >
                      {payoutAccount.status === 'approved'
                        ? 'Saved · Ready'
                        : 'Update Required'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="withdraw-amount" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Withdrawal Amount (Br / ETB)
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min={minWithdrawal}
                  step="0.01"
                  value={amount}
                  onChange={(e) => { withdrawalIdempotencyKey.current = null; setAmount(e.target.value); }}
                  placeholder={`Enter amount (min ${minWithdrawal})`}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>

              {/* Fee Preview Breakdown */}
              <div className="rounded-2xl bg-red-50/60 border border-red-200 p-4 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Request</span>
                  <strong className="tabular-nums">{formatBrExact(breakdown.grossAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Withdrawal Fee ({feePercent}%)</span>
                  <strong className="text-red-700 tabular-nums">-{formatBrExact(breakdown.feeAmount)}</strong>
                </div>
                <div className="pt-2 border-t border-red-200 flex justify-between items-baseline gap-3 text-sm sm:text-base">
                  <span className="font-bold text-slate-900">
                    Net Payout ({payoutAccount?.methodName || activePayoutNames})
                  </span>
                  <strong className="text-emerald-700 tabular-nums shrink-0 whitespace-nowrap">
                    {formatBrExact(breakdown.netAmount)}
                  </strong>
                </div>
              </div>

              {amount && !breakdown.isValid && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{breakdown.error}</span>
                </div>
              )}

              <div
                role="status"
                aria-live="polite"
                className={`rounded-xl border p-3 text-xs sm:text-sm ${
                  isWithdrawalWindowOpen
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {!withdrawalEnabled
                  ? `Customer withdrawals are currently disabled by the administrator. Published schedule: ${currentWithdrawalWindowLabel}.`
                  : isWithdrawalWindowOpen
                    ? `Withdrawal requests are open now. Daily schedule: ${currentWithdrawalWindowLabel}.`
                    : `Withdrawal requests are closed right now. They are available daily only during ${currentWithdrawalWindowLabel}. Please return during that time.`}
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs sm:text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full min-h-[46px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] text-white font-semibold text-sm shadow-md disabled:opacity-50 cursor-pointer"
              >
                Withdraw Now
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                Reserved balance during pending review: {formatBrExact(summary?.reservedBalance ?? 0)} · Purchase Limit ({settings?.purchaseLimit ?? 2}) is separate from withdrawal limits.
              </p>
            </form>
          </div>

          {/* Withdrawal History */}
          <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 text-sm font-bold">
              {displayName} — Withdrawal Request History
            </div>
            <div className="p-4">
              {loading ? (
                <p className="text-sm text-slate-500 text-center py-8">Loading withdrawals...</p>
              ) : withdrawals.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No withdrawal requests yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-2">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="pt-3 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatBrExact(w.grossAmount)}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            (Net {formatBrExact(w.netAmount)})
                          </span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${getStatusClass(w.status)}`}>
                          {w.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono">
                        {w.methodName} · {w.maskedAccountNumber}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Requested: {new Date(w.createdAt).toLocaleString()}
                      </p>
                      {w.processedAt && (
                        <p className="text-[11px] text-blue-700">
                          Processed: {new Date(w.processedAt).toLocaleString()}
                        </p>
                      )}
                      {w.completedAt && (
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Completed: {new Date(w.completedAt).toLocaleString()}
                        </p>
                      )}
                      {w.providerReference && (
                        <p className="text-xs text-emerald-700 font-mono">Ref: {w.providerReference}</p>
                      )}
                      {w.rejectionReason && (
                        <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2">
                          Reason: {w.rejectionReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmOpen && payoutAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm {payoutAccount.methodName} Withdrawal</h3>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <strong>{payoutAccount.methodName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Owner</span>
                <strong>{payoutAccount.accountOwnerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Number</span>
                <strong className="font-mono">{payoutAccount.maskedAccountNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Amount</span>
                <strong className="tabular-nums">{formatBrExact(breakdown.grossAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fee ({feePercent}%)</span>
                <strong className="text-red-700 tabular-nums">-{formatBrExact(breakdown.feeAmount)}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold">Net Payout</span>
                <strong className="text-emerald-700 tabular-nums">{formatBrExact(breakdown.netAmount)}</strong>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !isWithdrawalWindowOpen}
                onClick={handleConfirmWithdraw}
                className="flex-1 py-2.5 rounded-full bg-[#D71920] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : isWithdrawalWindowOpen ? 'Confirm Withdrawal' : 'Withdrawal Window Closed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
