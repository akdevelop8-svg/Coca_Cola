import React, { useEffect, useState } from 'react';
import { ExternalLink, Headphones, MessageCircle, Send } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { getCustomerDisplayName } from '../shared/finance';
import type { SupportTicket } from '../types';

export function CustomerServicePage() {
  const { user, config } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('deposit');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ tickets: SupportTicket[] }>('/api/support/tickets');
      setTickets(res.tickets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await apiFetch('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ category, subject, message }),
      });
      setSubject('');
      setMessage('');
      setSuccess('Support ticket submitted. An administrator will respond shortly.');
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (ticketId: string) => {
    const text = replyText[ticketId]?.trim();
    if (!text) return;
    await apiFetch(`/api/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
    setReplyText((prev) => ({ ...prev, [ticketId]: '' }));
    await loadTickets();
  };

  return (
    <AppShell title="Customer Service">
      <div className="space-y-5">
        {/* Official Telegram Customer Service Channels */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-[#D71920] to-[#A3080C] text-white px-5 py-4 flex items-center gap-3">
            <Headphones className="w-6 h-6" />
            <div>
              <h2 className="text-base sm:text-lg font-bold">Customer Service &amp; Telegram Support</h2>
              <p className="text-xs text-white/85">
                Reach our team directly via Telegram or submit a support ticket below
              </p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(config?.supportChannels || []).map((ch) => (
              <a
                key={ch.id}
                href={ch.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-sky-200 bg-sky-50 hover:bg-sky-100 p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-sky-900">{ch.label}</p>
                    <p className="text-sm font-bold text-sky-700 font-mono truncate">
                      {ch.handleOrUrl}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-sky-700 shrink-0" />
              </a>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Submit Ticket Form */}
          <form
            onSubmit={handleSubmitTicket}
            className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs"
          >
            <h3 className="text-base font-bold text-slate-900">Submit a Support Ticket</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              >
                <option value="deposit">Deposit / CBE Reference</option>
                <option value="withdrawal">Withdrawal / CBE Payout</option>
                <option value="account">Account &amp; Verification</option>
                <option value="general">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your request in detail..."
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full bg-[#D71920] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Send Ticket'}
            </button>
          </form>

          {/* User Ticket History */}
          <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#D71920]" />
              <h3 className="text-base font-bold text-slate-900">{displayName} — My Support Tickets</h3>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500 py-6 text-center">Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No support tickets submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {tickets.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{t.subject}</p>
                        <p className="text-[11px] text-slate-500 uppercase">
                          {t.category} · {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs font-bold uppercase text-[#D71920]">{t.status}</span>
                    </div>

                    <div className="space-y-2 bg-slate-50 rounded-xl p-3 text-xs">
                      {(t.messages || []).map((m) => (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg ${
                            m.senderRole === 'admin' ? 'bg-red-50 border border-red-100' : 'bg-white border border-slate-200'
                          }`}
                        >
                          <p className="font-semibold text-slate-800">
                            {m.senderName} ({m.senderRole})
                          </p>
                          <p className="text-slate-700 mt-0.5">{m.message}</p>
                        </div>
                      ))}
                    </div>

                    {t.status !== 'closed' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText[t.id] || ''}
                          onChange={(e) =>
                            setReplyText((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          placeholder="Write a follow-up reply..."
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleReply(t.id)}
                          className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
