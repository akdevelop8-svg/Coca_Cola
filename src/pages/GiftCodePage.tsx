import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Gift, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { formatDemoCredits } from '../shared/finance';
import type { GiftCodeRedemptionRecord } from '../types';

interface CustomerGiftCodeResponse {
  giftCodeEnabled: boolean;
  demoBalance: number;
  redemptions: GiftCodeRedemptionRecord[];
}

export function GiftCodePage() {
  const { config, refreshConfig } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<CustomerGiftCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadGiftCodes = async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        apiFetch<CustomerGiftCodeResponse>('/api/gift-codes'),
        refreshConfig(),
      ]);
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load gift code details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGiftCodes();
  }, []);

  const featureEnabled = data ? data.giftCodeEnabled : Boolean(config?.giftCodeEnabled);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !featureEnabled) return;
    const clean = codeInput.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a gift code.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch<{ message: string; demoBalance: number }>('/api/gift-codes/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: clean }),
      });
      setSuccessMsg(res.message);
      setCodeInput('');
      await loadGiftCodes();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gift code could not be redeemed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Gift Code Redemption">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header Card */}
        <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-5 sm:p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Gift Code Redemption</h2>
              <p className="text-xs sm:text-sm text-white/85">
                Redeem valid codes for Demo ETB (Simulator Only · No cash value)
              </p>
            </div>
          </div>
          <div className="bg-white/15 rounded-2xl px-4 py-2 text-right">
            <p className="text-[11px] text-white/80">Demo Wallet Balance</p>
            <p data-testid="gift-demo-balance" className="text-base font-extrabold tabular-nums">
              {loading ? '...' : formatDemoCredits(data?.demoBalance ?? 0)}
            </p>
          </div>
        </section>

        {!loading && !featureEnabled ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-amber-200 p-6 text-center space-y-4 shadow-xs">
            <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Gift Code Feature Disabled</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Gift Code redemptions are currently disabled by the Administrator.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="px-5 py-2.5 rounded-full bg-[#D71920] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </button>
          </div>
        ) : (
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <p className="text-xs text-slate-600">
              Enter your promotional Gift Code below to add <strong>Demo ETB</strong> to your Demo Wallet. Each code can be redeemed once per customer.
            </p>

            {successMsg && (
              <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRedeem} className="space-y-3">
              <div>
                <label htmlFor="gift-code-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Gift Code
                </label>
                <input
                  id="gift-code-input"
                  data-testid="gift-code-input"
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter gift code (e.g. COLA2026)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>

              <button
                type="submit"
                data-testid="gift-code-redeem-btn"
                disabled={loading || submitting}
                className="w-full min-h-[46px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] hover:from-[#C81018] hover:to-[#98080D] text-white font-semibold text-sm shadow-md disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Validating...' : 'Redeem'}
              </button>
            </form>
          </section>
        )}

        {/* Customer Redemption History */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-5 py-3 text-sm font-bold">
            My Redeemed Gift Codes
          </div>
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading history...</p>
          ) : !data?.redemptions.length ? (
            <p className="p-6 text-center text-sm text-slate-500">No gift codes redeemed yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.redemptions.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <div>
                    <p className="font-mono font-bold text-slate-900">{r.code}</p>
                    <p className="text-[11px] text-slate-500">
                      Redeemed {new Date(r.redeemedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    +{formatDemoCredits(r.rewardAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
