import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setFallbackSessionToken } from '../api/client';
import type { PlatformConfig, UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  config: PlatformConfig | null;
  unreadNotifications: number;
  appReady: boolean;
  setUserState: (user: UserProfile | null, unread?: number) => void;
  refreshAuth: () => Promise<UserProfile | null>;
  refreshConfig: () => Promise<PlatformConfig | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [appReady, setAppReady] = useState(false);

  // Ensure any legacy reduced-motion override flag is cleared so animations run by default
  useEffect(() => {
    document.documentElement.classList.remove('reduce-motion');
    try {
      localStorage.removeItem('cc_reduce_motion');
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await apiFetch<PlatformConfig>('/api/config');
      setConfig(cfg);
      return cfg;
    } catch {
      return null;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: UserProfile | null; unreadNotifications: number }>('/api/auth/me');
      setUser(res.user);
      setUnreadNotifications(res.unreadNotifications || 0);
      return res.user;
    } catch {
      setUser(null);
      setUnreadNotifications(0);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([refreshConfig(), refreshAuth()]).finally(() => {
      if (active) setAppReady(true);
    });
    return () => {
      active = false;
    };
  }, [refreshConfig, refreshAuth]);

  const setUserState = useCallback((nextUser: UserProfile | null, unread?: number) => {
    setUser(nextUser);
    if (typeof unread === 'number') setUnreadNotifications(unread);
  }, []);

  const logout = useCallback(async () => {
    setFallbackSessionToken(null);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session state even if the network request fails or is interrupted
    } finally {
      setFallbackSessionToken(null);
      setUser(null);
      setUnreadNotifications(0);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        config,
        unreadNotifications,
        appReady,
        setUserState,
        refreshAuth,
        refreshConfig,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
