import React, { useEffect, useState } from 'react';
import { Landmark, Lock, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import type {
  PaymentMethodRecord,
  PayoutAccountRecord,
  PayoutChangeRequestRecord,
} from '../types';

export function BankAccountPage() {
  const [account, setAccount] = useState<PayoutAccountRecord | null>(null);
  const [changeRequests, setChangeRequests] = useState<PayoutChangeRequestRecord[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [newMethodId, setNewMethodId] = useState('');
  const [loading, setLoading] = useState(true);

  const [accountNumber, setAccountNumber] = useState('');
  const [accountOwnerName, setAccountOwnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Change Request state
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [newAcctNum, setNewAcctNum] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [acctRes, pmRes] = await Promise.all([
        apiFetch<{
          account: PayoutAccountRecord | null;
          changeRequests: PayoutChangeRequestRecord[];
        }>('/api/payout-account'),
        apiFetch<{ payoutMethods: PaymentMethodRecord[] }>('/api/payment-methods'),
      ]);
      setAccount(acctRes.account);
      setChangeRequests(acctRes.changeRequests);
      setPayoutMethods(pmRes.payoutMethods);
      if (pmRes.payoutMethods.length > 0) {
        setSelectedMethodId((prev) =>
          pmRes.payoutMethods.some((m) => m.id === prev) ? prev : pmRes.payoutMethods[0].id
        );
        setNewMethodId((prev) =>
          pmRes.payoutMethods.some((m) => m.id === prev) ? prev : pmRes.payoutMethods[0].id
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load payout account details right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedMethod =
    payoutMethods.find((m) => m.id === selectedMethodId) || payoutMethods[0] || null;
  const selectedNewMethod =
    payoutMethods.find((m) => m.id === newMethodId) || payoutMethods[0] || null;
  const activeMethodNames = payoutMethods.map((m) => m.name).join(', ') || 'CBE ONLY';

  const handleSaveInitial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!selectedMethod) {
      setError('No active payout method is currently enabled by Admin.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/payout-account', {
        method: 'POST',
        body: JSON.stringify({
          methodId: selectedMethod.id,
          accountNumber,
          accountOwnerName,
        }),
      });
      setMessage(res.message);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save payout account.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!selectedNewMethod) {
      setError('No active payout method is currently enabled by Admin.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/payout-account/change-request', {
        method: 'POST',
        body: JSON.stringify({
          reason: changeReason,
          newMethodId: selectedNewMethod.id,
          newAccountNumber: newAcctNum,
          newAccountOwnerName: newOwnerName,
        }),
      });
      setChangeOpen(false);
      setChangeReason('');
      setNewAcctNum('');
      setNewOwnerName('');
      setMessage(res.message);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit change request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Bank Account Management">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-[#D71920] to-[#A3080C] text-white px-5 py-4 flex items-center gap-3">
            <Landmark className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold">
                Payout Account ({payoutMethods.length > 0 ? activeMethodNames : 'Payout'})
              </h2>
              <p className="text-xs text-white/85">
                Withdrawals require a saved and Admin-approved payout account
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                {message}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-slate-500 py-4">Loading account details...</p>
            ) : account && account.isLocked ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Saved Account (Locked)</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <Lock className="w-3.5 h-3.5" /> Locked
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Method</span>
                    <strong>{account.methodName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account Holder</span>
                    <strong>{account.accountOwnerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account Number</span>
                    <strong className="font-mono">{account.maskedAccountNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Verification Status</span>
                    <strong
                      className={`uppercase text-xs ${
                        account.status === 'approved'
                          ? 'text-emerald-700'
                          : account.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-amber-700'
                      }`}
                    >
                      {account.status}
                    </strong>
                  </div>
                  {account.reviewNote && (
                    <p className="text-xs text-slate-600 pt-1">Admin Note: {account.reviewNote}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setChangeOpen((o) => !o)}
                  className="w-full py-2.5 rounded-full border border-[#D71920] text-[#D71920] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-50 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>I need to change my account</span>
                </button>

                {changeOpen && (
                  <form onSubmit={handleRequestChange} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Request Payout Account Change</h3>
                    {payoutMethods.length > 1 ? (
                      <div>
                        <label htmlFor="change-method" className="block text-xs font-semibold text-slate-700 mb-1">
                          New Payout Method
                        </label>
                        <select
                          id="change-method"
                          value={newMethodId}
                          onChange={(e) => setNewMethodId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          {payoutMethods.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : selectedNewMethod ? (
                      <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
                        Method: <strong>{selectedNewMethod.name}</strong>
                      </div>
                    ) : null}
                    <input
                      type="text"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="New Account Holder Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      required
                    />
                    <input
                      type="text"
                      value={newAcctNum}
                      onChange={(e) => setNewAcctNum(e.target.value)}
                      placeholder="New Account Number (digits only)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                      required
                    />
                    <textarea
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="Explain why you need to update your payout account"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={saving || payoutMethods.length === 0}
                      className="w-full py-2.5 rounded-full bg-[#D71920] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {saving ? 'Submitting...' : 'Submit Change Request'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveInitial} className="space-y-4">
                <div>
                  <label htmlFor="payout-method" className="block text-xs font-semibold text-slate-700 mb-1">
                    Payout Method
                  </label>
                  {payoutMethods.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      No active payout methods are currently enabled. Contact Customer Service.
                    </div>
                  ) : payoutMethods.length === 1 ? (
                    <input
                      id="payout-method"
                      type="text"
                      readOnly
                      value={payoutMethods[0].name}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-sm text-slate-700 font-medium"
                    />
                  ) : (
                    <select
                      id="payout-method"
                      value={selectedMethodId}
                      onChange={(e) => setSelectedMethodId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                    >
                      {payoutMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedMethod?.instructions && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {selectedMethod.instructions}
                  </p>
                )}
                <div>
                  <label htmlFor="cbe-owner" className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    id="cbe-owner"
                    type="text"
                    value={accountOwnerName}
                    onChange={(e) => setAccountOwnerName(e.target.value)}
                    placeholder="Full name registered on your payout account"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cbe-number" className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Number
                  </label>
                  <input
                    id="cbe-number"
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1000XXXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || payoutMethods.length === 0}
                  className="w-full py-3 rounded-full bg-[#D71920] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : `Save & Lock ${selectedMethod?.name || 'Payout'} Account`}
                </button>
              </form>
            )}
          </div>
        </div>

        {changeRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Account Change Request History</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {changeRequests.map((cr) => (
                <div key={cr.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {cr.newMethodName} · {cr.newAccountOwnerName} · {cr.newAccountNumber}
                    </p>
                    <p className="text-slate-500">Reason: {cr.reason}</p>
                    {cr.adminNote && <p className="text-slate-600">Admin Note: {cr.adminNote}</p>}
                  </div>
                  <span className="font-bold uppercase text-slate-700">{cr.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
