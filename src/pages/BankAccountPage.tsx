import React, { useEffect, useState } from 'react';
import { CheckCircle2, Landmark, Save } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import type { PaymentMethodRecord, PayoutAccountRecord } from '../types';

export function BankAccountPage() {
  const [account, setAccount] = useState<PayoutAccountRecord | null>(null);
  const [payoutMethods, setPayoutMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountOwnerName, setAccountOwnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountResult, methodResult] = await Promise.all([
        apiFetch<{ account: PayoutAccountRecord | null }>('/api/payout-account'),
        apiFetch<{ payoutMethods: PaymentMethodRecord[] }>('/api/payment-methods'),
      ]);
      const methods = methodResult.payoutMethods || [];
      setAccount(accountResult.account);
      setPayoutMethods(methods);
      const methodName = accountResult.account?.methodName;
      const savedMethod = methods.find((method) => method.name === methodName);
      setSelectedMethodId(savedMethod?.id || methods[0]?.id || '');
      setAccountNumber(accountResult.account?.accountNumber || '');
      setAccountOwnerName(accountResult.account?.accountOwnerName || '');
    } catch (err: any) {
      setError(err?.message || 'Unable to load your payout account details right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedMethod = payoutMethods.find((method) => method.id === selectedMethodId) || null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!selectedMethod) {
      setError('No active payout method is currently available.');
      return;
    }
    if (accountNumber.trim().length < 5 || !accountOwnerName.trim()) {
      setError('Enter the account holder name and a valid account number.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{ message: string }>('/api/payout-account', {
        method: 'POST',
        body: JSON.stringify({
          methodId: selectedMethod.id,
          accountNumber: accountNumber.trim(),
          accountOwnerName: accountOwnerName.trim(),
        }),
      });
      setMessage(result.message);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save your payout account.');
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
              <h2 className="text-base font-bold">Your Payout Account</h2>
              <p className="text-xs text-white/85">Save or update the bank account you want to receive withdrawals into</p>
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
              <p className="text-sm text-slate-500 py-4">Loading your payout account...</p>
            ) : (
              <>
                {account && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Saved · Ready for withdrawal</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-600">Method</span>
                      <strong>{account.methodName}</strong>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-600">Account holder</span>
                      <strong>{account.accountOwnerName}</strong>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-600">Account number</span>
                      <strong className="font-mono">{account.maskedAccountNumber}</strong>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label htmlFor="payout-method" className="block text-xs font-semibold text-slate-700 mb-1">
                      Payout Method
                    </label>
                    {payoutMethods.length === 0 ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        No active payout methods are currently available. Please contact Customer Service.
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
                        onChange={(event) => setSelectedMethodId(event.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {payoutMethods.map((method) => (
                          <option key={method.id} value={method.id}>{method.name}</option>
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
                    <label htmlFor="payout-owner" className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      id="payout-owner"
                      type="text"
                      autoComplete="name"
                      value={accountOwnerName}
                      onChange={(event) => setAccountOwnerName(event.target.value)}
                      placeholder="Full name registered on your bank account"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="payout-number" className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Number
                    </label>
                    <input
                      id="payout-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Enter your bank account number"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                      required
                    />
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                    Your payout account is saved immediately and is not sent for administrator approval. Administrators receive the account details only when you submit a withdrawal request.
                  </div>

                  <button
                    type="submit"
                    disabled={saving || loading || payoutMethods.length === 0}
                    className="w-full py-3 rounded-full bg-[#D71920] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : account ? 'Save Bank Account Changes' : 'Save Bank Account'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
