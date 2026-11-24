import React, { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { NotificationItem } from '../types';

export function NotificationToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    if (!user) {
      setNotification(null);
      return;
    }

    let active = true;
    let firstLoad = true;
    let newestId: string | null = null;

    const refresh = async () => {
      try {
        const result = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
        if (!active) return;
        const latest = result.notifications?.[0] || null;
        if (firstLoad) {
          firstLoad = false;
          newestId = latest?.id || null;
          const unread = (result.notifications || []).find((item) => !item.isRead);
          if (unread) setNotification(unread);
          return;
        }
        if (latest?.id && latest.id !== newestId) {
          newestId = latest.id;
          if (!latest.isRead) setNotification(latest);
        }
      } catch {
        // Notification polling is best-effort; the persistent unread badge remains available.
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id]);

  if (!notification) return null;

  const openNotification = () => {
    const target = notification.actionUrl;
    setNotification(null);
    navigate(target && target.startsWith('/') && !target.startsWith('//') ? target : '/notifications');
  };

  return (
    <div className="fixed top-20 right-3 sm:right-6 z-[80] w-[min(25rem,calc(100vw-1.5rem))]">
      <section role="status" aria-live="polite" className="rounded-2xl border border-red-200 bg-white p-4 shadow-2xl shadow-slate-900/15">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <button type="button" onClick={openNotification} className="flex-1 min-w-0 text-left">
            <span className="block text-[10px] uppercase tracking-wide font-extrabold text-[#D71920]">New notification</span>
            <span className="mt-0.5 block text-sm font-bold text-slate-900">{notification.title}</span>
            <span className="mt-1 block text-xs text-slate-600 line-clamp-3">{notification.body}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#D71920]">
              <Check className="h-3.5 w-3.5" /> View message
            </span>
          </button>
          <button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
