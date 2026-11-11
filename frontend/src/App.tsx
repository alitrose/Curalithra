import React from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { DemoBanner } from './components/DemoBanner';
import { TopNavBar } from './components/TopNavBar';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { BillingPage } from './pages/BillingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalRecordsPage } from './pages/MedicalRecordsPage';
import { PatientsPage } from './pages/PatientsPage';
import { PrescriptionsPage } from './pages/PrescriptionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const ProtectedShell: React.FC = () => {
  const { user, initializing, demoRevision } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-horizon-bg text-sm text-horizon-muted">
        Initializing CURALITHRA session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-horizon-bg text-horizon-text">
      <TopNavBar />
      <DemoBanner />
      <main className="w-full" key={`${user.id}-${demoRevision}`}>
        <Outlet />
      </main>
    </div>
  );
};

interface RequirePermissionProps {
  anyOf: string[];
  children: React.ReactNode;
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ anyOf, children }) => {
  const { hasPermission } = useAuth();
  const allowed = anyOf.some((p) => hasPermission(p));

  if (!allowed) {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-amber-500/40 bg-horizon-card p-8 shadow-horizon">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-4 font-display text-xl font-bold text-horizon-text">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-horizon-muted">
            Your staff role does not hold permission to view this clinical or administrative module.
          </p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedShell />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <RequirePermission anyOf={['VIEW_DASHBOARD']}>
            <DashboardPage />
          </RequirePermission>
        }
      />
      <Route
        path="/patients"
        element={
          <RequirePermission anyOf={['VIEW_PATIENTS']}>
            <PatientsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/doctors"
        element={
          <RequirePermission anyOf={['VIEW_DOCTORS']}>
            <DoctorsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/appointments"
        element={
          <RequirePermission anyOf={['VIEW_APPOINTMENTS']}>
            <AppointmentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/medical-records"
        element={
          <RequirePermission anyOf={['VIEW_MEDICAL_RECORDS']}>
            <MedicalRecordsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <RequirePermission anyOf={['VIEW_MEDICAL_RECORDS']}>
            <PrescriptionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing"
        element={
          <RequirePermission anyOf={['VIEW_BILLING']}>
            <BillingPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports"
        element={
          <RequirePermission anyOf={['VIEW_REPORTS']}>
            <ReportsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings"
        element={
          <RequirePermission anyOf={['MANAGE_SETTINGS', 'MANAGE_USERS', 'VIEW_ACTIVITY_LOGS']}>
            <SettingsPage />
          </RequirePermission>
        }
      />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
);

export const App: React.FC = () => {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
};

export default App;
