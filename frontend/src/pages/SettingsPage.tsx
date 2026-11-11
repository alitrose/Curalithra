import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  ClipboardList,
  Pencil,
  Plus,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  ActivityLog,
  CreateUserRequest,
  Doctor,
  HealthStatus,
  HospitalSettings,
  PagedResponse,
  Role,
  UpdateHospitalSettingsRequest,
  UpdateUserAccessRequest,
  UserSummary,
} from '../types/api';
import { formatDateTime } from '../utils/format';

type TabKey = 'hospital' | 'users' | 'audit';

export const SettingsPage: React.FC = () => {
  const { user, settings, hasPermission, refreshSettings } = useAuth();
  const { pushToast } = useToast();

  const canManageSettings = hasPermission('MANAGE_SETTINGS');
  const canManageUsers = hasPermission('MANAGE_USERS');
  const canViewAudit = hasPermission('VIEW_ACTIVITY_LOGS');

  const initialTab: TabKey = canManageSettings
    ? 'hospital'
    : canManageUsers
      ? 'users'
      : 'audit';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Health & Hospital Settings
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [hospitalForm, setHospitalForm] = useState<UpdateHospitalSettingsRequest>({
    hospitalName: settings?.hospitalName || 'CURALITHRA Medical Center',
    tagline: settings?.tagline || 'Care, Connected. Operations, Simplified.',
    defaultTaxRate: settings?.defaultTaxRate ?? 0.05,
    defaultAppointmentMinutes: settings?.defaultAppointmentMinutes ?? 30,
    currencyCode: settings?.currencyCode || 'INR',
    currencySymbol: settings?.currencySymbol || '₹',
    supportEmail: settings?.supportEmail || '',
    supportPhone: settings?.supportPhone || '',
    address: settings?.address || '',
    invoiceFooterNote: settings?.invoiceFooterNote || '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Staff users
  const [staffList, setStaffList] = useState<UserSummary[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST',
    linkedDoctorId: null,
  });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  const [editUserTarget, setEditUserTarget] = useState<UserSummary | null>(null);
  const [editAccessForm, setEditAccessForm] = useState<UpdateUserAccessRequest>({
    role: 'RECEPTIONIST',
    active: true,
    linkedDoctorId: null,
    resetPassword: '',
  });
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<PagedResponse<ActivityLog> | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    apiRequest<HealthStatus>('/health').then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (canManageSettings) {
      apiRequest<HospitalSettings>('/settings')
        .then((s) =>
          setHospitalForm({
            hospitalName: s.hospitalName,
            tagline: s.tagline,
            defaultTaxRate: s.defaultTaxRate,
            defaultAppointmentMinutes: s.defaultAppointmentMinutes,
            currencyCode: s.currencyCode,
            currencySymbol: s.currencySymbol,
            supportEmail: s.supportEmail || '',
            supportPhone: s.supportPhone || '',
            address: s.address || '',
            invoiceFooterNote: s.invoiceFooterNote || '',
          })
        )
        .catch(() => {});
    }
  }, [canManageSettings]);

  const loadStaffAndDoctors = useCallback(async () => {
    if (!canManageUsers) return;
    setLoadingUsers(true);
    try {
      const [usersRes, docsRes] = await Promise.all([
        apiRequest<UserSummary[]>('/users'),
        apiRequest<PagedResponse<Doctor>>('/doctors?size=100&sortBy=fullName&sortDir=asc'),
      ]);
      setStaffList(usersRes);
      setDoctors(docsRes.content);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load staff directory',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageUsers, pushToast]);

  const loadAuditLogs = useCallback(async () => {
    if (!canViewAudit) return;
    setLoadingAudit(true);
    try {
      const res = await apiRequest<PagedResponse<ActivityLog>>(
        `/reports/audit-logs?page=${auditPage}&size=15`
      );
      setAuditLogs(res);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load audit logs',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoadingAudit(false);
    }
  }, [canViewAudit, auditPage, pushToast]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadStaffAndDoctors();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadStaffAndDoctors, loadAuditLogs]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest<HospitalSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(hospitalForm),
      });
      await refreshSettings();
      pushToast('success', 'Hospital Settings Saved', 'Global configuration updated.');
    } catch (err) {
      pushToast(
        'error',
        'Settings Update Failed',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    if (!createForm.fullName.trim() || !createForm.username.trim() || createForm.password.length < 6) {
      setUserFormError('Full name, username, and password (min 6 characters) are required.');
      return;
    }
    setSavingUser(true);
    try {
      const created = await apiRequest<UserSummary>('/users', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      pushToast('success', 'Staff Account Created', `${created.username} (${created.role})`);
      setCreateUserOpen(false);
      setCreateForm({
        fullName: '',
        username: '',
        email: '',
        password: '',
        role: 'RECEPTIONIST',
        linkedDoctorId: null,
      });
      loadStaffAndDoctors();
    } catch (err) {
      setUserFormError(err instanceof ApiRequestError ? err.message : 'Unable to create user.');
    } finally {
      setSavingUser(false);
    }
  };

  const openEditUserModal = (target: UserSummary) => {
    setEditUserTarget(target);
    setEditAccessForm({
      role: target.role,
      active: target.active,
      linkedDoctorId: target.linkedDoctorId,
      resetPassword: '',
    });
    setEditUserError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserTarget) return;
    setEditUserError(null);
    if (editAccessForm.resetPassword && editAccessForm.resetPassword.length < 6) {
      setEditUserError('Reset password must be at least 6 characters.');
      return;
    }
    setSavingUser(true);
    try {
      await apiRequest<UserSummary>(`/users/${editUserTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editAccessForm),
      });
      pushToast('success', 'Staff Access Updated', `${editUserTarget.username} updated.`);
      setEditUserTarget(null);
      loadStaffAndDoctors();
    } catch (err) {
      setEditUserError(
        err instanceof ApiRequestError ? err.message : 'Unable to update staff account.'
      );
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Administration, RBAC & Audit Compliance
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Settings & Administration
          </h1>
        </div>

        {health && (
          <div className="inline-flex items-center gap-2 rounded-full border border-horizon-border bg-horizon-card px-4 py-1.5 text-xs">
            <Server className="h-3.5 w-3.5 text-horizon-accent" />
            <span className="font-semibold text-horizon-text">{health.status}</span>
            <span className="text-horizon-muted">
              · {health.database} · v{health.version}
            </span>
          </div>
        )}
      </div>

      {/* Horizontal Tab Bar (No Sidebar) */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-horizon-border pb-3">
        {canManageSettings && (
          <button
            type="button"
            onClick={() => setActiveTab('hospital')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'hospital'
                ? 'bg-horizon-emerald text-white'
                : 'border border-horizon-border bg-horizon-card text-horizon-muted hover:text-horizon-text'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Hospital Settings</span>
          </button>
        )}
        {canManageUsers && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'users'
                ? 'bg-horizon-emerald text-white'
                : 'border border-horizon-border bg-horizon-card text-horizon-muted hover:text-horizon-text'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Staff & RBAC Accounts</span>
          </button>
        )}
        {canViewAudit && (
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'audit'
                ? 'bg-horizon-emerald text-white'
                : 'border border-horizon-border bg-horizon-card text-horizon-muted hover:text-horizon-text'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>System Audit Logs</span>
          </button>
        )}
      </div>

      {/* Tab 1: Hospital Settings */}
      {activeTab === 'hospital' && canManageSettings && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-horizon-border bg-horizon-card p-6 shadow-horizon lg:col-span-8"
          >
            <h2 className="mb-4 font-display text-lg font-bold text-horizon-text">
              Facility Configuration & Billing Defaults
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Hospital / Clinic Name *
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.hospitalName}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, hospitalName: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">Tagline *</label>
                <input
                  type="text"
                  required
                  value={hospitalForm.tagline}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, tagline: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Default Tax Rate (0.05 = 5%) *
                </label>
                <input
                  type="number"
                  step="0.005"
                  min={0}
                  max={1}
                  required
                  value={hospitalForm.defaultTaxRate}
                  onChange={(e) =>
                    setHospitalForm({
                      ...hospitalForm,
                      defaultTaxRate: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Default Appointment Duration (min) *
                </label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  value={hospitalForm.defaultAppointmentMinutes}
                  onChange={(e) =>
                    setHospitalForm({
                      ...hospitalForm,
                      defaultAppointmentMinutes: Number(e.target.value) || 30,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Currency Code *
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.currencyCode}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, currencyCode: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Currency Symbol *
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.currencySymbol}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, currencySymbol: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Support Email
                </label>
                <input
                  type="email"
                  value={hospitalForm.supportEmail}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, supportEmail: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Support Phone
                </label>
                <input
                  type="text"
                  value={hospitalForm.supportPhone}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, supportPhone: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-horizon-muted">
                  Hospital Address
                </label>
                <input
                  type="text"
                  value={hospitalForm.address}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-horizon-muted">
                  PDF Invoice Footer Note
                </label>
                <input
                  type="text"
                  value={hospitalForm.invoiceFooterNote}
                  onChange={(e) =>
                    setHospitalForm({ ...hospitalForm, invoiceFooterNote: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-lg bg-horizon-accent px-5 py-2.5 text-sm font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Hospital Settings'}
              </button>
            </div>
          </form>

          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
              <div className="flex items-center gap-2 text-horizon-accent">
                <Activity className="h-4 w-4" />
                <h3 className="font-display text-sm font-bold text-horizon-text">
                  Backend Service Telemetry
                </h3>
              </div>
              {health ? (
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-horizon-muted">Status</dt>
                    <dd className="font-semibold text-horizon-accent">{health.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-horizon-muted">Service</dt>
                    <dd className="text-horizon-text">{health.service}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-horizon-muted">Database</dt>
                    <dd className="text-horizon-text">{health.database}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-horizon-muted">Version</dt>
                    <dd className="text-horizon-text">v{health.version}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-horizon-muted">Checking /api/health...</p>
              )}
            </div>

            <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
              <div className="flex items-center gap-2 text-horizon-accent">
                <ShieldCheck className="h-4 w-4" />
                <h3 className="font-display text-sm font-bold text-horizon-text">
                  Security Architecture
                </h3>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-horizon-muted">
                <li>• Stateless HMAC JWT authentication</li>
                <li>• BCrypt cost-12 password hashing</li>
                <li>• 20-permission RBAC policy enforcement</li>
                <li>• Flyway schema migration governance</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Staff & RBAC Accounts */}
      {activeTab === 'users' && canManageUsers && (
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-horizon-text">
                Staff User Accounts
              </h2>
              <p className="text-xs text-horizon-muted">
                Provision Admin, Doctor, and Receptionist accounts with least-privilege RBAC.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateUserOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2 text-xs font-bold text-horizon-nav hover:bg-horizon-accent-hover"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff User</span>
            </button>
          </div>

          {loadingUsers ? (
            <p className="py-8 text-center text-sm text-horizon-muted">Loading staff users...</p>
          ) : staffList.length === 0 ? (
            <EmptyState title="No staff users" description="Create your first staff account." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                    <th className="px-3 py-3">Staff Member</th>
                    <th className="px-3 py-3">Username / Email</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Last Login</th>
                    <th className="px-3 py-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-horizon-border/60">
                  {staffList.map((u) => (
                    <tr key={u.id} className="hover:bg-horizon-card-hover/50">
                      <td className="px-3 py-3 font-semibold text-horizon-text">
                        {u.fullName}
                        {user?.id === u.id && (
                          <span className="ml-2 rounded bg-horizon-accent/20 px-1.5 py-0.5 text-[10px] text-horizon-accent">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-mono text-horizon-text">{u.username}</p>
                        <p className="text-horizon-muted">{u.email || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={u.role} label={u.roleDisplay} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={u.active ? 'ACTIVE' : 'CANCELLED'}
                          label={u.active ? 'Active' : 'Disabled'}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-muted">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit Access</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Audit Logs */}
      {activeTab === 'audit' && canViewAudit && (
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
          <h2 className="mb-4 font-display text-lg font-bold text-horizon-text">
            Immutable Security & Clinical Audit Trail
          </h2>
          {loadingAudit ? (
            <p className="py-8 text-center text-sm text-horizon-muted">Loading audit logs...</p>
          ) : !auditLogs || auditLogs.content.length === 0 ? (
            <EmptyState title="No audit logs yet" description="System activity will appear here." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-horizon-border uppercase tracking-wider text-horizon-muted">
                      <th className="px-3 py-3">Timestamp</th>
                      <th className="px-3 py-3">Actor</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Entity</th>
                      <th className="px-3 py-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-horizon-border/60">
                    {auditLogs.content.map((log) => (
                      <tr key={log.id} className="hover:bg-horizon-card-hover/50">
                        <td className="whitespace-nowrap px-3 py-2.5 text-horizon-muted">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-horizon-accent">
                          {log.username || 'system'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-horizon-text">
                          {log.actionType}
                        </td>
                        <td className="px-3 py-2.5 text-horizon-muted">
                          {log.entityType}
                          {log.entityId ? ` #${log.entityId}` : ''}
                        </td>
                        <td className="px-3 py-2.5 text-horizon-text">{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={auditLogs.page}
                totalPages={auditLogs.totalPages}
                totalElements={auditLogs.totalElements}
                onPageChange={setAuditPage}
              />
            </>
          )}
        </div>
      )}

      {/* Create Staff User Modal */}
      <Modal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title="Provision Staff Account"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {userFormError && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
              {userFormError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Full Name *</label>
              <input
                type="text"
                required
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Username *</label>
              <input
                type="text"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Temporary Password *
              </label>
              <input
                type="password"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({ ...createForm, role: e.target.value as Role })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="ADMIN">Administrator</option>
                <option value="DOCTOR">Doctor</option>
                <option value="RECEPTIONIST">Receptionist</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Linked Doctor Profile (Optional)
              </label>
              <select
                value={createForm.linkedDoctorId ?? ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    linkedDoctorId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="">Not linked to physician directory</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.doctorCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateUserOpen(false)}
              className="rounded-lg border border-horizon-border bg-horizon-bg px-4 py-2 text-sm text-horizon-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="rounded-lg bg-horizon-accent px-5 py-2 text-sm font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
            >
              {savingUser ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Access Modal */}
      <Modal
        open={Boolean(editUserTarget)}
        onClose={() => setEditUserTarget(null)}
        title={editUserTarget ? `Manage Access · ${editUserTarget.username}` : 'Manage Access'}
      >
        {editUserTarget && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            {editUserError && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
                {editUserError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Assigned Role</label>
              <select
                value={editAccessForm.role}
                onChange={(e) =>
                  setEditAccessForm({ ...editAccessForm, role: e.target.value as Role })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="ADMIN">Administrator</option>
                <option value="DOCTOR">Doctor</option>
                <option value="RECEPTIONIST">Receptionist</option>
              </select>
            </div>

            {editAccessForm.role === 'DOCTOR' && (
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Linked Doctor Record
                </label>
                <select
                  value={editAccessForm.linkedDoctorId ?? ''}
                  onChange={(e) =>
                    setEditAccessForm({
                      ...editAccessForm,
                      linkedDoctorId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                >
                  <option value="">None</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.doctorCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Reset Password (Leave blank to keep existing)
              </label>
              <input
                type="password"
                value={editAccessForm.resetPassword || ''}
                onChange={(e) =>
                  setEditAccessForm({ ...editAccessForm, resetPassword: e.target.value })
                }
                placeholder="Min 6 characters"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-horizon-text">
              <input
                type="checkbox"
                checked={editAccessForm.active}
                onChange={(e) => setEditAccessForm({ ...editAccessForm, active: e.target.checked })}
                className="h-4 w-4 rounded accent-horizon-accent"
              />
              <span>Account Active (can sign in to CURALITHRA)</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditUserTarget(null)}
                className="rounded-lg border border-horizon-border bg-horizon-bg px-4 py-2 text-sm text-horizon-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="rounded-lg bg-horizon-accent px-5 py-2 text-sm font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
              >
                {savingUser ? 'Updating...' : 'Save Access Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
};
