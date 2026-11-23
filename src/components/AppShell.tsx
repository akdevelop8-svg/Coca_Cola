import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  CreditCard,
  Globe,
  Headphones,
  Home,
  Info,
  LogOut,
  Menu,
  ShieldCheck,
  TrendingUp,
  Trophy,
  User as UserIcon,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CocaColaScriptLogo, UserAvatar } from './BrandMark';
import { ColaRiverAccent, SidebarColaPourAccent } from './ColaRiverAccent';
import { getCustomerDisplayName } from '../shared/finance';
import { isAdminRole } from '../shared/roles';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/income', label: 'Income', icon: TrendingUp },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/community', label: 'Community', icon: Globe },
  { to: '/task', label: 'Task', icon: Trophy },
  { to: '/recharge', label: 'Recharge', icon: Wallet },
  { to: '/withdraw', label: 'Withdraw', icon: CreditCard },
  { to: '/my', label: 'My', icon: UserIcon },
  { to: '/about', label: 'About', icon: Info },
  { to: '/service', label: 'Customer Service', icon: Headphones },
];

const MOBILE_BOTTOM_NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/income', label: 'Income', icon: TrendingUp },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/task', label: 'Task', icon: Trophy },
  { to: '/my', label: 'My', icon: UserIcon },
];

export function AppShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { user, config, unreadNotifications, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const userIsAdmin = user ? isAdminRole(user.role) : false;
  const displayName = getCustomerDisplayName(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7A0407] via-[#B80D13] to-[#D71920] text-white flex">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-gradient-to-b from-[#C81018] via-[#A3080C] to-[#7A0407] text-white z-30 shadow-xl">
        <div className="px-5 py-5 flex items-center justify-center border-b border-white/15">
          <NavLink to="/home" className="focus:outline-none">
            <CocaColaScriptLogo color="#FFFFFF" className="h-10" />
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main Sidebar Navigation">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#D71920] shadow-sm font-semibold'
                      : 'text-white/90 hover:bg-white/12 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {userIsAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap mt-2 border border-amber-300/30 ${
                  isActive
                    ? 'bg-amber-300 text-[#7A0407] font-semibold'
                    : 'bg-amber-400/15 text-amber-100 hover:bg-amber-400/25'
                }`
              }
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Admin Dashboard</span>
            </NavLink>
          )}
        </nav>

        <SidebarColaPourAccent />

        <div className="p-3 border-t border-white/15">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Out Hamburger Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-gradient-to-b from-[#C81018] to-[#7A0407] text-white flex flex-col h-full shadow-2xl z-10">
            <div className="px-4 py-4 flex items-center justify-between border-b border-white/15">
              <CocaColaScriptLogo color="#FFFFFF" className="h-8" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {MAIN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                        isActive ? 'bg-white text-[#D71920] font-semibold' : 'text-white/90 hover:bg-white/12'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              {userIsAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-amber-400/20 text-amber-100 mt-2"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Admin Dashboard</span>
                </NavLink>
              )}
            </nav>
            <SidebarColaPourAccent />
            <div className="p-3 border-t border-white/15">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 text-white text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-14 sm:h-16 bg-gradient-to-r from-[#870009]/98 via-[#B80D13]/96 to-[#D71920]/95 backdrop-blur-md border-b border-white/20 shadow-lg shadow-[#5b0008]/20 px-3 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-white hover:bg-white/15 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <CocaColaScriptLogo color="#FFFFFF" className="h-7" />
            </div>
            {title && (
              <h1 className="hidden lg:block text-base font-bold text-white truncate">
                {title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label={`Notifications (${unreadNotifications} unread)`}
              className="relative min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-white hover:bg-white/15 cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#D71920] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/my')}
              aria-label="Open My Account"
              className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <UserAvatar fullName={displayName} avatarUrl={user?.avatarUrl} size="sm" />
              <div className="hidden sm:block text-left leading-tight">
                <p data-testid="header-display-name" className="text-xs font-semibold text-white max-w-[130px] truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-white/75 font-mono">
                  {user?.referralCode || ''}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24 lg:pb-10">
          {children}
          <ColaRiverAccent />
          {config?.settings?.privacyPolicyUrl && (
            <footer className="mt-6 border-t border-white/25 pt-4 pb-2 text-center text-xs text-white/75">
              <a
                href={config.settings.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#B80D13] hover:underline"
              >
                Privacy Policy
              </a>
            </footer>
          )}
        </main>
      </div>

      {/* Fixed Bottom Navigation (Mobile & Tablet) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-r from-[#870009]/98 via-[#B80D13]/97 to-[#D71920]/96 backdrop-blur-md border-t border-white/25 shadow-[0_-8px_28px_rgba(55,0,5,0.22)] h-16 px-2 grid grid-cols-5 items-center"
      >
        {MOBILE_BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                  isActive ? 'text-[#FFE7A6] font-bold' : 'text-white/75 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
