import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Banknote,
  CheckCheck,
  CircleCheck,
  CircleX,
  CreditCard,
  Gift,
  Megaphone,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { useAuth } from '../context/AuthContext';
import { getCustomerDisplayName } from '../shared/finance';
import type { NotificationItem } from '../types';

const notificationVisual = (kind: string) => {
  if (kind.includes('approved') || kind.includes('completed')) {
    return { Icon: CircleCheck, color: 'bg-emerald-100 text-emerald-700', label: 'Approved' };
  }
  if (kind.includes('rejected')) {
    return { Icon: CircleX, color: 'bg-red-100 text-red-700', label: 'Rejected' };
  }
  if (kind.includes('deposit')) {
    return { Icon: Banknote, color: 'bg-blue-100 text-blue-700', label: 'Deposit' };
  }
  if (kind.includes('withdrawal')) {
    return { Icon: CreditCard, color: 'bg-violet-100 text-violet-700', label: 'Withdrawal' };
  }
  if (kind.includes('support')) {
    return { Icon: MessageSquare, color: 'bg-amber-100 text-amber-700', label: 'Support' };
  }
  if (kind.includes('gift') || kind.includes('reward')) {
    return { Icon: Gift, color: 'bg-fuchsia-100 text-fuchsia-700', label: 'Reward' };
  }
  if (kind.includes('admin_')) {
    return { Icon: Wallet, color: 'bg-orange-100 text-orange-700', label: 'Action required' };
  }
  if (kind === 'broadcast') {
    return { Icon: Megaphone, color: 'bg-rose-100 text-rose-700', label: 'Announcement' };
  }
  return { Icon: Bell, color: 'bg-slate-100 text-slate-700', label: 'Notification' };
};

export function NotificationsPage() {
  const { user, refreshAuth } = useAuth();
  const displayName = getCustomerDisplayName(user);
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setItems(res.notifications || []);
    } catch {
      // Keep the current items visible during a temporary connection issue.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const markRead = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await apiFetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
        await refreshAuth();
        await loadNotifications();
      }
      if (item.actionUrl && item.actionUrl !== '/notifications') navigate(item.actionUrl);
    } catch {
      // Ignore transient errors when marking a notification as read.
    }
  };

  const markAll = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await refreshAuth();
      await loadNotifications();
    } catch {
      // Ignore transient errors.
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="bg-[#D71920] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-5 h-5 shrink-0" />
            <h2 className="font-bold text-sm sm:text-base truncate">{displayName} · Notifications</h2>
          </div>
          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full cursor-pointer shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading notifications...</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No notifications yet.</p>
          ) : (
            items.map((item) => {
              const visual = notificationVisual(item.kind || '');
              const Icon = visual.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void markRead(item)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer border-l-4 ${
                    item.isRead ? 'bg-white border-transparent hover:bg-slate-50' : 'bg-red-50/40 border-[#D71920] hover:bg-red-50/70'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${visual.color}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${visual.color}`}>
                            {item.kind === 'broadcast' ? 'Announcement' : visual.label}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#D71920]" aria-label="Unread" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{item.body}</p>
                      {item.imageUrl && (
                        <div className="mt-3">
                          <AuthenticatedImage
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50"
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 mt-2">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
