import React, { useEffect, useState } from 'react';
import { Check, Copy, FileText, Landmark, ShieldAlert, UploadCloud, Wallet } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { formatBrExact, getCustomerDisplayName } from '../shared/finance';
import type { DepositRequest, PaymentMethodRecord } from '../types';

export function RechargePage() {
  const { user, config } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [txReference, setTxReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedAcct, setCopiedAcct] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, dRes] = await Promise.all([
        apiFetch<{ depositMethods: PaymentMethodRecord[] }>('/api/payment-methods'),
        apiFetch<{ deposits: DepositRequest[] }>('/api/deposits'),
      ]);
      setMethods(mRes.depositMethods);
      if (mRes.depositMethods.length > 0) {
        setSelectedMethodId((prev) =>
          mRes.depositMethods.some((m) => m.id === prev) ? prev : mRes.depositMethods[0].id
        );
      }
      setDeposits(dRes.deposits);
    } catch (err: any) {
      setError(err?.message || 'Unable to load deposit methods right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedMethod = methods.find((m) => m.id === selectedMethodId) || methods[0];

  const handleCopyAccount = async (acct: string) => {
    try {
      await navigator.clipboard.writeText(acct);
      setCopiedAcct(true);
      window.setTimeout(() => setCopiedAcct(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrepareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 10) {
      setError('Enter a valid deposit amount (minimum Br 10).');
      return;
    }
    if (!selectedMethod) {
      setError('No active deposit payment method is currently available.');
      return;
    }
    if (txReference.trim().length < 4) {
      setError('Enter your transaction reference / short code (min 4 characters).');
      return;
    }
    if (!receiptFile) {
      setError('Please upload your payment receipt image or PDF.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmDeposit = async () => {
    if (!selectedMethod || !receiptFile || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('paymentMethodId', selectedMethod.id);
      formData.append('txReference', txReference.trim());
      formData.append('receipt', receiptFile);

      const res = await apiFetch<{ message: string }>('/api/deposits', {
        method: 'POST',
        body: formData,
      });

      setConfirmOpen(false);
      setSuccess(res.message);
      setAmount('');
      setTxReference('');
      setReceiptFile(null);
      await loadData();
    } catch (err: any) {
      setConfirmOpen(false);
      setError(err?.message || 'Failed to submit deposit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Recharge / Deposit">
      <div className="space-y-5">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Deposit Account Information & Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#D71920] to-[#A3080C] text-white px-5 py-4 flex items-center gap-2.5">
              <Wallet className="w-5 h-5" />
              <div>
                <h2 className="text-base font-bold">
                  Deposit Funds {selectedMethod ? `(${selectedMethod.name})` : ''} · {displayName}
                </h2>
                <p className="text-xs text-white/85">
                  Send to the verified account below, then submit your reference &amp; receipt
                </p>
              </div>
            </div>

            <form onSubmit={handlePrepareSubmit} className="p-5 space-y-4">
              {/* Registered Account Box */}
              {selectedMethod ? (
                <div className="rounded-2xl bg-red-50/70 border border-[#D71920]/25 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-[#D71920]" />
                      <span className="font-bold text-slate-900 text-sm">{selectedMethod.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#D71920]">Verified Account</span>
                  </div>
                  {selectedMethod.accountName && (
                    <p className="text-xs text-slate-600">{selectedMethod.accountName}</p>
                  )}
                  <div className="flex items-center justify-between gap-3 bg-white rounded-xl px-3.5 py-2.5 border border-slate-200">
                    <div>
                      <p className="text-[11px] text-slate-500">Account Number</p>
                      <p
                        data-testid="deposit-account-number"
                        className="text-base sm:text-lg font-extrabold font-mono text-slate-900 tracking-wide"
                      >
                        {selectedMethod.accountNumber}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(selectedMethod.accountNumber)}
                      className="px-3.5 py-1.5 rounded-full bg-[#D71920] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedAcct ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAcct ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  {selectedMethod.instructions && (
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedMethod.instructions}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
                  No active deposit payment methods are currently enabled.
                </div>
              )}

              {methods.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Payment Method
                  </label>
                  <select
                    value={selectedMethodId}
                    onChange={(e) => setSelectedMethodId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="deposit-amount" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deposit Amount (Br / ETB)
                </label>
                <input
                  id="deposit-amount"
                  type="number"
                  min={10}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount (e.g. 1500)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[600, 1500, 3000, 5000, 12000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className="px-3 py-1 rounded-full bg-slate-100 hover:bg-red-50 hover:text-[#D71920] text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Br {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="deposit-ref" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Transaction Reference / Short Code
                </label>
                <input
                  id="deposit-ref"
                  type="text"
                  value={txReference}
                  onChange={(e) => setTxReference(e.target.value)}
                  placeholder="Enter CBE reference / FT code (e.g. FT26320XYZ)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
                  required
                />
              </div>

              <div>
                <label htmlFor="deposit-receipt" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Upload Payment Receipt (JPG, PNG, WEBP, PDF · max 5MB)
                </label>
                <label
                  htmlFor="deposit-receipt"
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#D71920] bg-slate-50 p-5 cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-7 h-7 text-[#D71920]" />
                  <span className="text-xs font-medium text-slate-700 text-center">
                    {receiptFile ? receiptFile.name : 'Click to attach payment receipt screenshot or PDF'}
                  </span>
                  <input
                    id="deposit-receipt"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs sm:text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-800">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedMethod || submitting}
                className="w-full min-h-[46px] rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] text-white font-semibold text-sm shadow-md disabled:opacity-50 cursor-pointer"
              >
                Review &amp; Submit Deposit
              </button>
            </form>
          </div>

          {/* Deposit History */}
          <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center gap-2 text-sm font-bold">
              <FileText className="w-4 h-4" />
              <span>{displayName} — Deposit Request History</span>
            </div>
            <div className="p-4">
              {loading ? (
                <p className="text-sm text-slate-500 text-center py-8">Loading deposits...</p>
              ) : deposits.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No deposit requests submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-2">
                  {deposits.map((dep) => (
                    <div key={dep.id} className="pt-3 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatBrExact(dep.amount)}
                        </span>
                        <span
                          className={`text-xs font-bold uppercase ${
                            dep.status === 'approved'
                              ? 'text-emerald-700'
                              : dep.status === 'rejected'
                              ? 'text-red-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {dep.methodName} · Ref: <span className="font-mono">{dep.txReference}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(dep.createdAt).toLocaleString()}
                      </p>
                      {dep.rejectionReason && (
                        <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 mt-1">
                          Reason: {dep.rejectionReason}
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

      {/* Confirmation Summary Modal */}
      {confirmOpen && selectedMethod && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm Deposit Submission</h3>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <strong className="text-right">{selectedMethod.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Number</span>
                <strong className="font-mono">{selectedMethod.accountNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Amount</span>
                <strong className="text-[#D71920] tabular-nums">{formatBrExact(Number(amount))}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref</span>
                <strong className="font-mono">{txReference}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt File</span>
                <strong className="truncate max-w-[180px]">{receiptFile?.name}</strong>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Your wallet will remain unchanged until an administrator independently verifies this receipt and approves the deposit.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeposit}
                className="flex-1 py-2.5 rounded-full bg-[#D71920] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
