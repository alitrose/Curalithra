import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { CuralithraLogo } from '../components/CuralithraLogo';
import { ApiRequestError, apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { HealthStatus } from '../types/api';

export const LoginPage: React.FC = () => {
  const { user, setupRequired, sessionNotice, clearSessionNotice, login, setupWorkspace, refreshSetupStatus } =
    useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);

  // Login state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Setup state
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [seedDemoData, setSeedDemoData] = useState(true);
  const [createSampleRoleAccounts, setCreateSampleRoleAccounts] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let mounted = true;
    apiRequest<HealthStatus>('/health')
      .then((res) => {
        if (mounted) {
          setHealth(res);
          setHealthOffline(false);
        }
      })
      .catch(() => {
        if (mounted) setHealthOffline(true);
      });
    refreshSetupStatus();
    return () => {
      mounted = false;
    };
  }, [refreshSetupStatus]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});
    clearSessionNotice();

    const errs: Record<string, string> = {};
    if (!usernameOrEmail.trim()) errs.usernameOrEmail = 'Username or email is required.';
    if (!password) errs.password = 'Password is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const signedIn = await login({
        usernameOrEmail: usernameOrEmail.trim(),
        password,
      });
      pushToast('success', `Welcome back, ${signedIn.fullName}`, `${signedIn.roleDisplay} session active`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setErrorMsg('Unable to sign in. Please verify API connectivity.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});
    clearSessionNotice();

    const errs: Record<string, string> = {};
    if (!adminName.trim()) errs.fullName = 'Administrator full name is required.';
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(adminUsername.trim())) {
      errs.username = 'Username must be 3-32 characters (letters, numbers, ., _, -).';
    }
    if (adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (adminPassword.length < 6) {
      errs.password = 'Passphrase must be at least 6 characters.';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const created = await setupWorkspace({
        fullName: adminName.trim(),
        username: adminUsername.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        seedDemoData,
        createSampleRoleAccounts: seedDemoData && createSampleRoleAccounts,
      });
      pushToast('success', 'Workspace Initialized', `Signed in as ${created.fullName}`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setErrorMsg('Unable to initialize CURALITHRA workspace.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-horizon-bg text-horizon-text">
      <header className="border-b border-horizon-border bg-horizon-nav/95">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <CuralithraLogo size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-wider text-horizon-text">
                  CURALITHRA
                </span>
                <span className="rounded border border-horizon-emerald/60 bg-horizon-emerald/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-horizon-accent">
                  Horizon Edition
                </span>
              </div>
              <p className="text-[11px] text-horizon-muted">Care, Connected. Operations, Simplified.</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-horizon-border bg-horizon-card px-3.5 py-1.5 text-xs">
            <Server className={`h-3.5 w-3.5 ${healthOffline ? 'text-red-400' : 'text-horizon-accent'}`} />
            <span className="text-horizon-muted">
              {health
                ? `API ${health.status} · DB ${health.database}`
                : healthOffline
                ? 'API Offline'
                : 'Checking API...'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-horizon-emerald/50 bg-horizon-emerald/10 px-3.5 py-1 text-xs font-semibold text-horizon-accent">
              <ShieldCheck className="h-4 w-4" />
              <span>HIPAA-Minded RBAC & Clinical Operations Platform</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-horizon-text sm:text-4xl">
              {setupRequired
                ? 'Initialize Your Hospital Workspace'
                : 'Clinical Operations Portal'}
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-horizon-muted">
              CURALITHRA unites patient registries, conflict-aware physician scheduling, electronic
              medical records, prescriptions, BigDecimal invoice ledgers, and compliance audit trails
              in one secure Horizon workspace.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-horizon-border bg-horizon-card p-4">
                <CheckCircle2 className="h-4 w-4 text-horizon-accent" />
                <p className="mt-2 font-display text-sm font-semibold text-horizon-text">
                  Role-Based Access Control
                </p>
                <p className="mt-1 text-xs text-horizon-muted">
                  Strict clinical isolation across Administrator, Doctor, and Receptionist roles.
                </p>
              </div>
              <div className="rounded-xl border border-horizon-border bg-horizon-card p-4">
                <Sparkles className="h-4 w-4 text-horizon-accent" />
                <p className="mt-2 font-display text-sm font-semibold text-horizon-text">
                  PostgreSQL & Flyway Verified
                </p>
                <p className="mt-1 text-xs text-horizon-muted">
                  Atomic bookings, partial unique slot guards, and OpenPDF financial receipts.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-horizon-border bg-horizon-card p-6 shadow-horizon sm:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-horizon-border pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-horizon-text">
                    {setupRequired ? 'First-Run Administrator Setup' : 'Staff Sign In'}
                  </h2>
                  <p className="mt-0.5 text-xs text-horizon-muted">
                    {setupRequired
                      ? 'Create the primary Administrator account to unlock CURALITHRA.'
                      : 'Enter your assigned clinical staff credentials.'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-horizon-emerald/50 bg-horizon-emerald/15 text-horizon-accent">
                  {setupRequired ? <UserCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
              </div>

              {sessionNotice && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>{sessionNotice}</span>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {setupRequired ? (
                <form onSubmit={handleSetupSubmit} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="setup-fullName" className="block text-xs font-semibold text-horizon-muted">
                      Administrator Full Name
                    </label>
                    <input
                      id="setup-fullName"
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g., Dr. Elena Vance"
                      className="mt-1.5 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 text-sm text-horizon-text placeholder:text-horizon-muted/50 focus:border-horizon-accent focus:outline-none"
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="setup-username" className="block text-xs font-semibold text-horizon-muted">
                        Username
                      </label>
                      <input
                        id="setup-username"
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                      {fieldErrors.username && (
                        <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="setup-email" className="block text-xs font-semibold text-horizon-muted">
                        Email Address
                      </label>
                      <input
                        id="setup-email"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@hospital.org"
                        className="mt-1.5 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 text-sm text-horizon-text placeholder:text-horizon-muted/50 focus:border-horizon-accent focus:outline-none"
                      />
                      {fieldErrors.email && (
                        <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="setup-password" className="block text-xs font-semibold text-horizon-muted">
                      Administrator Passphrase (min. 6 characters)
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="setup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Create a strong passphrase"
                        className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 pr-10 text-sm text-horizon-text placeholder:text-horizon-muted/50 focus:border-horizon-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-2.5 text-horizon-muted hover:text-horizon-text"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-horizon-border bg-horizon-bg/60 p-3.5">
                    <label className="flex items-start gap-2.5 text-xs text-horizon-text">
                      <input
                        type="checkbox"
                        checked={seedDemoData}
                        onChange={(e) => setSeedDemoData(e.target.checked)}
                        className="mt-0.5 accent-horizon-emerald"
                      />
                      <span>
                        <strong className="block">Seed synthetic clinical dataset</strong>
                        <span className="text-horizon-muted">
                          Populates 7 departments, 6 doctors, 12 synthetic patients, appointments,
                          EMR records, and sample invoices.
                        </span>
                      </span>
                    </label>

                    {seedDemoData && (
                      <label className="flex items-start gap-2.5 pl-6 text-xs text-horizon-text">
                        <input
                          type="checkbox"
                          checked={createSampleRoleAccounts}
                          onChange={(e) => setCreateSampleRoleAccounts(e.target.checked)}
                          className="mt-0.5 accent-horizon-emerald"
                        />
                        <span>
                          <strong className="block">Create sample Doctor & Receptionist accounts</strong>
                          <span className="text-horizon-muted">
                            Creates <code className="text-horizon-accent">doctor.demo</code> and{' '}
                            <code className="text-horizon-accent">reception.demo</code> using your chosen passphrase.
                          </span>
                        </span>
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Initializing Workspace...' : 'Initialize CURALITHRA Workspace'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="login-identifier" className="block text-xs font-semibold text-horizon-muted">
                      Username or Email
                    </label>
                    <input
                      id="login-identifier"
                      type="text"
                      autoComplete="username"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="username or staff@hospital.org"
                      className="mt-1.5 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 text-sm text-horizon-text placeholder:text-horizon-muted/50 focus:border-horizon-accent focus:outline-none"
                    />
                    {fieldErrors.usernameOrEmail && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.usernameOrEmail}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold text-horizon-muted">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2.5 pr-10 text-sm text-horizon-text placeholder:text-horizon-muted/50 focus:border-horizon-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-2.5 text-horizon-muted hover:text-horizon-text"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Signing In...' : 'Sign In to CURALITHRA'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-horizon-border bg-horizon-nav py-4 text-center text-xs text-horizon-muted">
        CURALITHRA — Intelligent Hospital Management System · Horizon Edition
      </footer>
    </div>
  );
};
