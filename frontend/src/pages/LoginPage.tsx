import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCheck,
  Users,
} from 'lucide-react';
import { CuralithraLogo } from '../components/CuralithraLogo';
import { ApiRequestError, apiRequest, isApiConfigured } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { HealthStatus, Role } from '../types/api';

interface DemoRolePresentation {
  role: Role;
  title: string;
  persona: string;
  ctaLabel: string;
  highlights: string[];
  featured?: boolean;
  icon: React.FC<{ className?: string }>;
}

const PUBLIC_DEMO_ROLES: DemoRolePresentation[] = [
  {
    role: 'ADMIN',
    title: 'Administrator Demo',
    persona: 'Dr. Elena Vance — Medical Director',
    ctaLabel: 'Explore as Administrator',
    featured: true,
    icon: ShieldCheck,
    highlights: [
      'Dashboard overview',
      'Patient management',
      'Doctor and staff management',
      'Department management',
      'Appointment overview',
      'Billing and reports',
      'Audit logs',
      'System settings',
    ],
  },
  {
    role: 'DOCTOR',
    title: 'Doctor Demo',
    persona: 'Dr. Evelyn Hayes — Senior Cardiologist',
    ctaLabel: 'Explore as Doctor',
    icon: Stethoscope,
    highlights: [
      'Doctor dashboard',
      'Assigned patients',
      'Appointment schedule',
      'Medical records',
      'Prescriptions',
      'Clinical workflow',
    ],
  },
  {
    role: 'RECEPTIONIST',
    title: 'Receptionist Demo',
    persona: 'Maya Lin — Front Desk Coordinator',
    ctaLabel: 'Explore as Receptionist',
    icon: Users,
    highlights: [
      'Reception dashboard',
      'Patient registration',
      'Appointment scheduling',
      'Patient lookup',
      'Billing workflow',
      'Front-desk operations',
    ],
  },
];

export const LoginPage: React.FC = () => {
  const {
    user,
    setupRequired,
    demoStatus,
    sessionNotice,
    clearSessionNotice,
    login,
    loginWithDemoRole,
    setupWorkspace,
    refreshSetupStatus,
    refreshDemoStatus,
  } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const apiConfigured = isApiConfigured();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Private deployment staff login state (shown ONLY when demoStatus.enabled === false)
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-run setup state
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [seedDemoData, setSeedDemoData] = useState(true);
  const [createSampleRoleAccounts, setCreateSampleRoleAccounts] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<Role | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const checkConnectivity = useCallback(async () => {
    if (!apiConfigured) {
      setHealth(null);
      setHealthOffline(true);
      return;
    }
    setCheckingHealth(true);
    try {
      const res = await apiRequest<HealthStatus>('/health');
      setHealth(res);
      setHealthOffline(false);
      await Promise.all([refreshSetupStatus(), refreshDemoStatus()]);
    } catch {
      setHealth(null);
      setHealthOffline(true);
    } finally {
      setCheckingHealth(false);
    }
  }, [apiConfigured, refreshDemoStatus, refreshSetupStatus]);

  useEffect(() => {
    checkConnectivity();
  }, [checkConnectivity]);

  const handleDemoRole = async (role: Role) => {
    setErrorMsg(null);
    setFieldErrors({});
    clearSessionNotice();
    setDemoLoadingRole(role);
    try {
      const signedIn = await loginWithDemoRole(role);
      pushToast(
        'success',
        'Demo Mode Active',
        `Exploring as ${signedIn.fullName} (${signedIn.roleDisplay})`
      );
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Unable to start demo session. Please verify backend connectivity and try again.');
      }
    } finally {
      setDemoLoadingRole(null);
    }
  };

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

  // Public Interactive Demo is the default visitor experience whenever Setup is complete
  // and Public Demo is not explicitly disabled on the server.
  const isPrivateAuthMode = !setupRequired && demoStatus?.enabled === false;
  const isPublicDemoView = !setupRequired && !isPrivateAuthMode;

  const backendNotice =
    demoStatus?.notice ||
    'All patient profiles, doctors, appointments, medical records, prescriptions, and billing ledgers in this workspace are 100% synthetic demonstration data.';

  return (
    <div className="flex min-h-screen flex-col justify-between bg-horizon-bg text-horizon-text">
      <header className="border-b border-horizon-border bg-horizon-nav/95">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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

          <div className="flex items-center gap-2">
            {isPublicDemoView && (
              <span className="hidden items-center gap-1.5 rounded-full border border-horizon-accent/50 bg-horizon-accent/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-horizon-accent sm:inline-flex">
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Public Demo</span>
              </span>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-horizon-border bg-horizon-card px-3.5 py-1.5 text-xs">
              <Server className={`h-3.5 w-3.5 ${healthOffline ? 'text-amber-400' : 'text-horizon-accent'}`} />
              <span className="text-horizon-muted">
                {health
                  ? `API ${health.status} · DB ${health.database}`
                  : !apiConfigured
                  ? 'API URL Not Configured'
                  : healthOffline
                  ? 'API Connecting...'
                  : 'Checking API...'}
              </span>
            </div>
            {healthOffline && apiConfigured && (
              <button
                type="button"
                onClick={checkConnectivity}
                disabled={checkingHealth}
                title="Retry backend health check"
                className="inline-flex items-center gap-1 rounded-full border border-horizon-border bg-horizon-card px-3 py-1.5 text-xs font-semibold text-horizon-text transition hover:border-horizon-accent hover:text-horizon-accent disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${checkingHealth ? 'animate-spin' : ''}`} />
                <span>{checkingHealth ? 'Checking...' : 'Retry'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {isPublicDemoView ? (
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-horizon-emerald/60 bg-horizon-emerald/15 px-4 py-1.5 text-xs font-semibold text-horizon-accent">
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Interactive Clinical Demo · Instant Role Access · No Password Required</span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-horizon-text sm:text-5xl">
              Welcome to CURALITHRA
            </h1>

            <p className="mt-3 text-base leading-relaxed text-horizon-muted sm:text-lg">
              Explore a connected clinical operations and hospital management platform.
            </p>
          </div>

          <div
            role="note"
            data-testid="synthetic-data-notice"
            className="mx-auto mt-6 flex w-full max-w-4xl flex-col items-start justify-between gap-3 rounded-2xl border border-horizon-emerald/45 bg-horizon-card/80 px-5 py-3.5 text-xs text-horizon-muted sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-horizon-accent sm:mt-0" />
              <span>{backendNotice}</span>
            </div>
            <span className="shrink-0 rounded-full border border-horizon-border bg-horizon-bg px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-horizon-accent">
              Short-Lived JWT Sandbox
            </span>
          </div>

          {(sessionNotice || errorMsg || healthOffline) && (
            <div className="mx-auto mt-5 w-full max-w-4xl space-y-3">
              {sessionNotice && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3.5 text-xs text-amber-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>{sessionNotice}</span>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-500/50 bg-red-500/10 p-3.5 text-xs text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {healthOffline && (
                <div
                  role="status"
                  data-testid="api-offline-banner"
                  className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/45 bg-amber-500/10 p-3.5 text-xs text-amber-200"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-100">
                        {!apiConfigured
                          ? 'Backend API URL Not Configured'
                          : 'Connecting to Hosted Clinical Backend'}
                      </p>
                      <p className="mt-0.5 text-amber-200/85">
                        {!apiConfigured
                          ? 'Set VITE_API_BASE_URL in the frontend build to connect to the hosted Spring Boot API.'
                          : 'If the Render backend is waking from idle sleep, wait a few seconds and click Retry.'}
                      </p>
                    </div>
                  </div>
                  {apiConfigured && (
                    <button
                      type="button"
                      onClick={checkConnectivity}
                      disabled={checkingHealth}
                      className="shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-60"
                    >
                      {checkingHealth ? 'Checking...' : 'Retry'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <section
            aria-label="Choose a public demo role"
            data-testid="demo-role-cards"
            className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {PUBLIC_DEMO_ROLES.map((card) => {
              const serverRole = demoStatus?.roles.find((r) => r.role === card.role);
              const title = serverRole?.title || card.title;
              const persona = serverRole?.summary || card.persona;
              const highlights =
                serverRole?.highlights && serverRole.highlights.length > 0
                  ? serverRole.highlights
                  : card.highlights;
              const Icon = card.icon;
              const isBusy = demoLoadingRole === card.role;

              return (
                <article
                  key={card.role}
                  data-testid={`demo-card-${card.role.toLowerCase()}`}
                  className={`flex flex-col justify-between rounded-2xl border bg-horizon-card p-6 shadow-horizon transition ${
                    card.featured
                      ? 'border-horizon-accent/60 ring-1 ring-horizon-accent/20'
                      : 'border-horizon-border hover:border-horizon-emerald/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
                          card.featured
                            ? 'border-horizon-accent/50 bg-horizon-accent/15 text-horizon-accent'
                            : 'border-horizon-emerald/50 bg-horizon-emerald/15 text-horizon-accent'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full border border-horizon-emerald/50 bg-horizon-emerald/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-horizon-accent">
                        {card.role}
                      </span>
                    </div>

                    <h2 className="mt-4 font-display text-xl font-bold text-horizon-text">
                      {title}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-horizon-accent">
                      {persona}
                    </p>

                    <ul className="mt-5 space-y-2 border-t border-horizon-border pt-4">
                      {highlights.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs text-horizon-text/90">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-horizon-accent" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    data-testid={`explore-${card.role.toLowerCase()}-btn`}
                    disabled={Boolean(demoLoadingRole)}
                    onClick={() => handleDemoRole(card.role)}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      card.featured
                        ? 'bg-horizon-accent text-horizon-nav hover:bg-horizon-accent-hover'
                        : 'border border-horizon-emerald/70 bg-horizon-emerald text-white hover:border-horizon-accent hover:bg-horizon-accent hover:text-horizon-nav'
                    }`}
                  >
                    <span>
                      {isBusy ? `Launching ${card.title}...` : card.ctaLabel}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </section>

          <section className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-horizon-border bg-horizon-card/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-horizon-accent">
                <Lock className="h-4 w-4" />
                <span>Backend-Verified Demo JWTs</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-horizon-muted">
                Every role click issues a short-lived, server-signed HS256 token scoped strictly to
                demo access with 20 RBAC permissions enforced server-side.
              </p>
            </div>
            <div className="rounded-xl border border-horizon-border bg-horizon-card/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-horizon-accent">
                <Sparkles className="h-4 w-4" />
                <span>Connected PostgreSQL Sandbox</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-horizon-muted">
                Preloaded with 20 synthetic patients, 8 doctors, 8 departments, 12 appointments,
                6 EMR charts, 8 prescriptions, and 8 invoices.
              </p>
            </div>
            <div className="rounded-xl border border-horizon-border bg-horizon-card/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-horizon-accent">
                <ShieldCheck className="h-4 w-4" />
                <span>Read-Only Sandbox Protection</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-horizon-muted">
                Shared demonstration data is read-only, rate-limited server-side, and protected by
                immediate JWT revocation on Exit Demo.
              </p>
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-6 lg:pt-4">
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

            <div className="space-y-5 lg:col-span-6">
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
      )}

      <footer className="border-t border-horizon-border bg-horizon-nav py-4 text-center text-xs text-horizon-muted">
        CURALITHRA — Intelligent Hospital Management System · Horizon Edition · Public Interactive Demo
      </footer>
    </div>
  );
};
