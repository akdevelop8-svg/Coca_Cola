import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { getCustomerDisplayName } from './shared/finance';
import { isAdminRole } from './shared/roles';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingTermsPage } from './pages/OnboardingTermsPage';
import { HomePage } from './pages/HomePage';
import { IncomePage } from './pages/IncomePage';
import { TeamPage } from './pages/TeamPage';
import { TaskPage } from './pages/TaskPage';
import { RechargePage } from './pages/RechargePage';
import { WithdrawPage } from './pages/WithdrawPage';
import { MyAccountPage } from './pages/MyAccountPage';
import { BankAccountPage } from './pages/BankAccountPage';
import { AboutPage } from './pages/AboutPage';
import { CustomerServicePage } from './pages/CustomerServicePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CheckinPage } from './pages/CheckinPage';
import { GiftCodePage } from './pages/GiftCodePage';
import { AchievementCelebration } from './components/AchievementCelebration';
import { NewCustomerGuide } from './components/NewCustomerGuide';

function RequireAuth({
  children,
  requireTerms = true,
}: {
  children: React.ReactNode;
  requireTerms?: boolean;
}) {
  const { user, config, appReady } = useAuth();
  const location = useLocation();

  if (!appReady) {
    return null;
  }

  const currentFull = `${location.pathname}${location.search}`;

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentFull)}`} replace />;
  }

  const latestVersion = config?.settings.termsVersion || 'v1.0';
  if (requireTerms && user.termsAcceptedVersion !== latestVersion) {
    return <Navigate to={`/onboarding-terms?redirect=${encodeURIComponent(currentFull)}`} replace />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !isAdminRole(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

function PublicOnlyAuth({ children }: { children: React.ReactNode }) {
  const { user, config, appReady } = useAuth();
  const location = useLocation();
  if (!appReady) return null;

  if (user) {
    if (isAdminRole(user.role)) {
      return <Navigate to="/admin" replace />;
    }
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || '/home';
    const latestVersion = config?.settings.termsVersion || 'v1.0';
    if (user.termsAcceptedVersion !== latestVersion) {
      return <Navigate to={`/onboarding-terms?redirect=${encodeURIComponent(redirect)}`} replace />;
    }
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, appReady } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone && (
        <LoadingScreen
          appReady={appReady}
          avatarUrl={user?.avatarUrl}
          userName={getCustomerDisplayName(user)}
          onComplete={() => setSplashDone(true)}
        />
      )}
      <div aria-hidden={!splashDone} className={!splashDone ? 'pointer-events-none select-none' : ''}>
        <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyAuth>
              <LoginPage />
            </PublicOnlyAuth>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyAuth>
              <RegisterPage />
            </PublicOnlyAuth>
          }
        />

        <Route
          path="/onboarding-terms"
          element={
            <RequireAuth requireTerms={false}>
              <OnboardingTermsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/income"
          element={
            <RequireAuth>
              <IncomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/team"
          element={
            <RequireAuth>
              <TeamPage />
            </RequireAuth>
          }
        />
        <Route
          path="/task"
          element={
            <RequireAuth>
              <TaskPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recharge"
          element={
            <RequireAuth>
              <RechargePage />
            </RequireAuth>
          }
        />
        <Route
          path="/withdraw"
          element={
            <RequireAuth>
              <WithdrawPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my"
          element={
            <RequireAuth>
              <MyAccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my/bank-account"
          element={
            <RequireAuth>
              <BankAccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="/about"
          element={
            <RequireAuth>
              <AboutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/service"
          element={
            <RequireAuth>
              <CustomerServicePage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/checkin"
          element={
            <RequireAuth>
              <CheckinPage />
            </RequireAuth>
          }
        />
        <Route
          path="/gift-code"
          element={
            <RequireAuth>
              <GiftCodePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <AchievementCelebration />
      <NewCustomerGuide userId={user?.role === 'customer' ? user.id : null} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
