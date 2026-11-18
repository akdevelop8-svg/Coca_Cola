import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Headphones,
  Info,
  Landmark,
  LogOut,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import {
  formatDemoCredits,
  getCustomerDisplayName,
  MAX_ACTIVE_PLANS,
  validateNickname,
} from '../shared/finance';
import { isAdminRole } from '../shared/roles';
import type { UserProfile, WalletSummary } from '../types';

export function MyAccountPage() {
  const { user, config, setUserState, logout, refreshConfig } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [rulesModal, setRulesModal] = useState(false);

  const [nicknameInput, setNicknameInput] = useState(user?.nickname || '');
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSuccess, setNicknameSuccess] = useState('');

  useEffect(() => {
    setNicknameInput(user?.nickname || '');
  }, [user?.nickname]);

  useEffect(() => {
    void Promise.all([
      apiFetch<WalletSummary>('/api/dashboard/summary').then(setSummary).catch(() => {}),
      refreshConfig(),
    ]);
  }, []);

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    setNicknameSuccess('');
    const check = validateNickname(nicknameInput);
    if (!check.ok) {
      setNicknameError(check.error || 'Please enter a valid nickname.');
      return;
    }

    setSavingNickname(true);
    try {
      const res = await apiFetch<{ ok: boolean; nickname: string; user: UserProfile; message?: string }>(
        '/api/profile/nickname',
        {
          method: 'PUT',
          body: JSON.stringify({ nickname: check.value }),
        }
      );
      if (res.user) {
        setUserState(res.user);
      }
      setNicknameInput(res.nickname || check.value);
      setNicknameSuccess(res.message || 'Nickname saved successfully.');
    } catch (err: any) {
      setNicknameError(err?.message || 'Could not save nickname.');
    } finally {
      setSavingNickname(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const displayName = getCustomerDisplayName(user);
  const giftCodeEnabled = Boolean(config?.giftCodeEnabled);

  const menuRows = [
    ...(giftCodeEnabled
      ? [{ label: 'Gift Code', icon: Gift, action: () => navigate('/gift-code'), testId: 'my-gift-code-btn' }]
      : []),
    { label: 'All Records & History', icon: FileText, action: () => navigate('/income') },
    { label: 'Recharge Records', icon: Wallet, action: () => navigate('/recharge') },
    { label: 'Withdrawal Records', icon: CreditCard, action: () => navigate('/withdraw') },
    { label: 'Bank Account Management', icon: Landmark, action: () => navigate('/my/bank-account') },
    { label: 'About Us', icon: Info, action: () => navigate('/about') },
    { label: 'Platform Rules', icon: ScrollText, action: () => setRulesModal(true) },
    { label: 'Customer Service', icon: Headphones, action: () => navigate('/service') },
  ];

  return (
    <AppShell title="My Account">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Profile Header Card */}
        <section className="rounded-3xl bg-gradient-to-r from-[#D71920] to-[#98080D] text-white p-5 sm:p-6 shadow-lg space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar fullName={displayName} avatarUrl={user?.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 data-testid="profile-display-name" className="text-xl font-bold truncate">
                {displayName}
              </h2>
              <p className="text-xs text-white/85 font-mono mt-0.5">
                Member ID: {user?.referralCode} · {user?.phone}
              </p>
              {user && isAdminRole(user.role) && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-300 text-[#7A0407] text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Open Admin Dashboard</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-white/12 rounded-2xl p-3 text-center">
            <div>
              <p className="text-[11px] text-white/80">Account Balance</p>
              <p className="text-xs sm:text-sm font-extrabold tabular-nums">
                {formatDemoCredits(summary?.demoBalance ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-white/80">Total Rewards</p>
              <p className="text-xs sm:text-sm font-extrabold tabular-nums">
                {formatDemoCredits(summary?.demoTotalRewards ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-white/80">Team Commission</p>
              <p className="text-xs sm:text-sm font-extrabold tabular-nums">
                {formatDemoCredits(summary?.demoTeamCommission ?? 0)}
              </p>
            </div>
          </div>

          {/* Profile Quick Actions: Withdraw & Deposit */}
          <div className="grid grid-cols-2 gap-3" data-testid="profile-quick-actions">
            <button
              type="button"
              data-testid="my-quick-withdraw-btn"
              onClick={() => navigate('/withdraw')}
              className="py-2.5 px-4 rounded-full bg-white text-[#D71920] font-bold text-sm hover:bg-red-50 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Landmark className="w-4 h-4 shrink-0" />
              <span>Withdraw</span>
            </button>
            <button
              type="button"
              data-testid="my-quick-deposit-btn"
              onClick={() => navigate('/recharge')}
              className="py-2.5 px-4 rounded-full bg-black/25 hover:bg-black/35 text-white font-bold text-sm border border-white/25 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>Deposit</span>
            </button>
          </div>
        </section>

        {/* Set Your Nickname Card */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Set Your Nickname</h3>
                <p className="text-xs text-slate-500">
                  Displayed across your profile, home greeting, and team records (phone number remains your login ID).
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveNickname} className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <label htmlFor="nickname-input" className="sr-only">
                Preferred Nickname
              </label>
              <input
                id="nickname-input"
                data-testid="nickname-input"
                type="text"
                maxLength={24}
                value={nicknameInput}
                onChange={(e) => {
                  setNicknameInput(e.target.value);
                  if (nicknameError) setNicknameError('');
                  if (nicknameSuccess) setNicknameSuccess('');
                }}
                placeholder="Enter your nickname (2–24 characters)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#D71920]/30 focus:border-[#D71920]"
              />
            </div>
            <button
              type="submit"
              data-testid="save-nickname-btn"
              disabled={savingNickname}
              className="px-5 py-2.5 rounded-xl bg-[#D71920] hover:bg-[#B80D13] text-white text-sm font-bold disabled:opacity-60 cursor-pointer shrink-0"
            >
              {savingNickname ? 'Saving...' : 'Save Nickname'}
            </button>
          </form>

          {nicknameError && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {nicknameError}
            </div>
          )}
          {nicknameSuccess && (
            <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{nicknameSuccess}</span>
            </div>
          )}
        </section>

        {/* Menu Rows including conditional Gift Code and Logout */}
        <nav aria-label="My Account Menu" className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {menuRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.label}
                type="button"
                data-testid={(row as any).testId}
                onClick={row.action}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-[#D71920] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            data-testid="my-logout-button"
            className="w-full px-4 sm:px-5 py-4 flex items-center justify-between gap-3 hover:bg-red-50/70 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-[#D71920] flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-[#D71920]">Log Out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D71920]" />
          </button>
        </nav>
      </div>

      {/* Platform Rules Modal */}
      {rulesModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Simulator &amp; Platform Rules</h3>
              <button type="button" onClick={() => setRulesModal(false)} className="cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p><strong>Terms Version Accepted:</strong> {user?.termsAcceptedVersion || 'Pending'}</p>
              <p><strong>Currency:</strong> Simulated ETB Only (no real cash value, not withdrawable)</p>
              <p><strong>Registration Bonus:</strong> {config?.settings.registrationBonus ?? 150} ETB</p>
              <p><strong>Daily Check-In:</strong> {config?.settings.dailyCheckinAmount ?? 2} ETB (manual claim once/day)</p>
              <p><strong>Active Plan Limit:</strong> Maximum {MAX_ACTIVE_PLANS} active plans (365-day manual daily claim)</p>
              <p><strong>Referral Rewards:</strong> Level 1: {config?.settings.referralLevel1Percent ?? 20}%, Level 2: {config?.settings.referralLevel2Percent ?? 2}%, Level 3: {config?.settings.referralLevel3Percent ?? 1}%</p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
