import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { useAuth } from '../context/AuthContext';
import { getCustomerDisplayName } from '../shared/finance';
import type { NotificationItem } from '../types';

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
      setItems(res.notifications);
    } catch {
      // keep existing notifications cleanly on transient failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await apiFetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
        await refreshAuth();
        await loadNotifications();
      }
      if (item.actionUrl && item.actionUrl !== '/notifications') {
        navigate(item.actionUrl);
      }
    } catch {
      // ignore transient errors when marking notification read
    }
  };

  const markAll = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await refreshAuth();
      await loadNotifications();
    } catch {
      // ignore transient errors
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="bg-[#D71920] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h2 className="font-bold text-base">{displayName} · Account Notifications &amp; Announcements</h2>
          </div>
          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full cursor-pointer"
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
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markRead(item)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                  item.isRead ? 'bg-white' : 'bg-red-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.kind === 'broadcast' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#D71920] text-[10px] font-bold uppercase shrink-0">
                        Announcement
                      </span>
                    )}
                    <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
                  </div>
                  {!item.isRead && (
                    <span className="text-[11px] font-bold text-[#D71920] shrink-0">Unread</span>
                  )}
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
              </button>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
