import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  MessageSquare,
  ShieldAlert,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import { formatBrExact, formatDemoCredits } from '../../shared/finance';
import type { CustomerDetailProfile } from '../../types';

interface CustomerDetailModalProps {
  customerId: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
}

type DetailSection = 'timeline' | 'team' | 'finance' | 'plans' | 'tickets';

export function CustomerDetailModal({
  customerId,
  onClose,
  onStatusChanged,
}: CustomerDetailModalProps) {
  const [profile, setProfile] = useState<CustomerDetailProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<DetailSection>('timeline');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setSection('timeline');
    apiFetch<CustomerDetailProfile>(`/api/admin/customers/${customerId}`)
      .then((res) => {
        if (active) setProfile(res);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Failed to load customer details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (!customerId) return null;

  const handleToggleStatus = async () => {
    if (!profile || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const next = profile.customer.status === 'active' ? 'suspended' : 'active';
      await apiFetch(`/api/admin/users/${profile.customer.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: next, reason: `Admin ${next} via profile` }),
      });
      const updated = await apiFetch<CustomerDetailProfile>(
        `/api/admin/customers/${profile.customer.id}`
      );
      setProfile(updated);
      onStatusChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to update customer status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer Detail Profile"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8C060A] to-[#D71920] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold">
              Customer Profile {profile ? `· ${profile.customer.nickname || profile.customer.fullName || 'User'} (${profile.customer.phone})` : ''}
            </h3>
            {profile && (
              <p className="text-xs text-white/85">
                Referral Code: <strong className="font-mono">{profile.customer.referralCode}</strong> ·
                Joined {new Date(profile.customer.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer profile"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-10">Loading customer profile...</p>
          ) : error ? (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : profile ? (
            <>
              {/* Account Metadata Grid (Zero wallet balance exposed) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Phone &amp; Nickname</p>
                  <p className="text-sm font-bold font-mono text-slate-900 mt-1">{profile.customer.phone}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Display Name: <strong>{profile.customer.nickname || profile.customer.fullName || 'User'}</strong>
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Account Status</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        profile.customer.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {profile.customer.status}
                    </span>
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={handleToggleStatus}
                      className="text-xs font-semibold text-[#D71920] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {profile.customer.status === 'active' ? 'Suspend' : 'Restore'}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Invited By</p>
                  {profile.customer.invitedBy ? (
                    <p className="text-xs font-semibold text-slate-900 mt-1 font-mono">
                      {profile.customer.invitedBy.phone} ({profile.customer.invitedBy.referralCode})
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">Direct Registration</p>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Activity &amp; Terms</p>
                  <p className="text-xs text-slate-700 mt-1">
                    Last active:{' '}
                    {profile.customer.lastActiveAt
                      ? new Date(profile.customer.lastActiveAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Terms: {profile.customer.termsAcceptedVersion || 'Pending'}
                  </p>
                </div>
              </div>

              {/* Privacy Note */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-[11px] text-slate-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Privacy enforcement active: customer wallet balances and credentials are omitted from administrative inspection.
                </span>
              </div>

              {/* Sub-navigation inside modal */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
                {[
                  { id: 'timeline' as const, label: `Activity (${profile.activities.length})`, icon: Clock },
                  {
                    id: 'team' as const,
                    label: `Team (${profile.team.level1Count + profile.team.level2Count + profile.team.level3Count})`,
                    icon: Users,
                  },
                  {
                    id: 'finance' as const,
                    label: `Deposits (${profile.deposits.length}) & Withdrawals (${profile.withdrawals.length})`,
                    icon: Wallet,
                  },
                  {
                    id: 'plans' as const,
                    label: `Plans (${profile.planPurchases.length}) & Claims`,
                    icon: CreditCard,
                  },
                  {
                    id: 'tickets' as const,
                    label: `Feedback (${profile.tickets.length})`,
                    icon: MessageSquare,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        section === item.id
                          ? 'bg-[#D71920] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Section 1: Activity Timeline */}
              {section === 'timeline' && (
                <div className="space-y-2">
                  {profile.activities.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No activity logged yet.</p>
                  ) : (
                    profile.activities.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold uppercase text-[10px] text-slate-700">
                            {act.type}
                          </span>
                          <span className="text-slate-800 font-medium">{act.description}</span>
                        </div>
                        <span className="text-slate-400 font-mono">
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Section 2: 3-Level Team */}
              {section === 'team' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                      <p className="text-[11px] text-slate-600">Level 1 Referrals</p>
                      <p className="text-lg font-bold text-[#D71920]">{profile.team.level1Count}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[11px] text-slate-600">Level 2 Referrals</p>
                      <p className="text-lg font-bold text-slate-900">{profile.team.level2Count}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[11px] text-slate-600">Level 3 Referrals</p>
                      <p className="text-lg font-bold text-slate-900">{profile.team.level3Count}</p>
                    </div>
                  </div>
                  {profile.team.members.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No invited team members yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      {profile.team.members.map((m) => (
                        <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white">
                          <div>
                            <span className="font-bold text-slate-800 font-mono">{m.phone}</span>{' '}
                            <span className="text-slate-500">({m.referralCode})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                              L{m.level}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold ${
                                m.qualified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {m.qualified ? 'Qualified' : 'Registered'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Deposits, Withdrawals, Saved Payout Account */}
              {section === 'finance' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
                      <Landmark className="w-4 h-4 text-[#D71920]" />
                      <span>Saved Payout Account</span>
                    </div>
                    {profile.payoutAccount ? (
                      <div className="text-xs space-y-1">
                        <p>
                          <strong>{profile.payoutAccount.methodName}</strong> ·{' '}
                          <span className="font-mono">{profile.payoutAccount.accountNumber}</span>
                        </p>
                        <p className="text-slate-600">
                          Holder: {profile.payoutAccount.accountOwnerName} · Status:{' '}
                          <strong className="uppercase">{profile.payoutAccount.status}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No payout account saved.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-700">Deposit Requests</h4>
                      {profile.deposits.length === 0 ? (
                        <p className="text-xs text-slate-500">No deposit requests.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 text-xs">
                          {profile.deposits.map((d) => (
                            <div key={d.id} className="py-2 space-y-0.5">
                              <div className="flex justify-between font-semibold">
                                <span>{formatBrExact(d.amount)}</span>
                                <span className="uppercase">{d.status}</span>
                              </div>
                              <p className="text-slate-500 font-mono">
                                {d.methodName} · Ref: {d.txReference}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {new Date(d.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-700">Withdrawal Requests</h4>
                      {profile.withdrawals.length === 0 ? (
                        <p className="text-xs text-slate-500">No withdrawal requests.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 text-xs">
                          {profile.withdrawals.map((w) => (
                            <div key={w.id} className="py-2 space-y-0.5">
                              <div className="flex justify-between font-semibold">
                                <span>
                                  {formatBrExact(w.grossAmount)} (Net {formatBrExact(w.netAmount)})
                                </span>
                                <span className="uppercase">{w.status}</span>
                              </div>
                              <p className="text-slate-500 font-mono">
                                {w.methodName} · {w.accountNumberSnapshot}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {new Date(w.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Plan Purchases, Daily Check-ins, Daily Claims */}
              {section === 'plans' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Purchased Investment Plans
                    </h4>
                    {profile.planPurchases.length === 0 ? (
                      <p className="text-xs text-slate-500">No investment plans purchased.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 text-xs">
                        {profile.planPurchases.map((p) => (
                          <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900">
                                Plan {p.planCode} · {formatDemoCredits(p.amount)}
                              </p>
                              <p className="text-slate-500">
                                Daily: {formatDemoCredits(p.dailyMiningRate)} · {p.periodDays} days
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold uppercase">
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-700">
                        Daily Check-ins ({profile.dailyCheckins.length})
                      </h4>
                      {profile.dailyCheckins.length === 0 ? (
                        <p className="text-xs text-slate-500">No daily check-ins yet.</p>
                      ) : (
                        <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                          {profile.dailyCheckins.map((c) => (
                            <div key={c.id} className="flex justify-between py-1 border-b border-slate-100">
                              <span className="font-mono">{c.ethiopiaDate}</span>
                              <span className="uppercase text-slate-600">{c.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-700">
                        Daily Mining Claims ({profile.dailyClaims.length})
                      </h4>
                      {profile.dailyClaims.length === 0 ? (
                        <p className="text-xs text-slate-500">No daily mining claims yet.</p>
                      ) : (
                        <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                          {profile.dailyClaims.map((c) => (
                            <div key={c.id} className="flex justify-between py-1 border-b border-slate-100">
                              <span>
                                Plan {c.planCode} ({c.ethiopiaDate})
                              </span>
                              <span className="font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                Claimed
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 5: Feedback / Support Tickets */}
              {section === 'tickets' && (
                <div className="space-y-2">
                  {profile.tickets.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No support tickets submitted.</p>
                  ) : (
                    profile.tickets.map((t) => (
                      <div key={t.id} className="rounded-xl border border-slate-200 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{t.subject}</span>
                          <span className="uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-100">
                            {t.status}
                          </span>
                        </div>
                        <p className="text-slate-500">
                          Category: {t.category} · Updated {new Date(t.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
