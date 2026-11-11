import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { UserSummary } from '../types/api';
import { formatDateTime } from '../utils/format';

export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { pushToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    if (!fullName.trim()) {
      setProfileError('Full name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      await apiRequest<UserSummary>('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ fullName, email }),
      });
      await refreshProfile();
      pushToast('success', 'Profile Updated', 'Your display name and contact email were saved.');
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword || newPassword.length < 6) {
      setPasswordError('Enter your current password and a new password of at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await apiRequest<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      pushToast('success', 'Password Updated', 'Your staff credential has been rotated.');
    } catch (err) {
      setPasswordError(
        err instanceof ApiRequestError ? err.message : 'Unable to change password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  const isDemo = Boolean(user.demoUser);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
          Staff Identity & Credential Security
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
          My Staff Profile
        </h1>
      </div>

      {isDemo && (
        <div className="mb-5 rounded-xl border border-horizon-emerald/50 bg-horizon-emerald/10 px-4 py-3 text-xs text-horizon-accent">
          Public Demo Mode: Profile edits and password rotation are disabled for shared sandbox
          accounts. Switch roles or reset data from the Demo Mode banner above.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Account Overview & Permissions */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-xl border border-horizon-border bg-horizon-card p-6 shadow-horizon">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl font-bold text-horizon-text">{user.fullName}</p>
                <p className="font-mono text-xs text-horizon-accent">@{user.username}</p>
              </div>
              <StatusBadge status={user.role} label={user.roleDisplay} />
            </div>

            <dl className="mt-5 space-y-2.5 border-t border-horizon-border pt-4 text-xs">
              <div className="flex justify-between">
                <dt className="text-horizon-muted">Email</dt>
                <dd className="text-horizon-text">{user.email || 'Not configured'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-horizon-muted">Account Created</dt>
                <dd className="text-horizon-text">{formatDateTime(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-horizon-muted">Last Sign-In</dt>
                <dd className="text-horizon-text">{formatDateTime(user.lastLoginAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-horizon-border bg-horizon-card p-6 shadow-horizon">
            <div className="mb-3 flex items-center gap-2 text-horizon-accent">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold text-horizon-text">
                Granted Role Permissions ({user.permissions.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((perm) => (
                <span
                  key={perm}
                  className="rounded-md border border-horizon-border bg-horizon-bg px-2 py-1 font-mono text-[10px] text-horizon-muted"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="space-y-5 lg:col-span-7">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border border-horizon-border bg-horizon-card p-6 shadow-horizon"
          >
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-horizon-accent" />
              <h2 className="font-display text-base font-bold text-horizon-text">
                Edit Profile Details
              </h2>
            </div>
            {profileError && (
              <div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
                {profileError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile || isDemo}
                title={isDemo ? 'Profile changes are disabled in Public Demo Mode' : undefined}
                className="rounded-lg bg-horizon-accent px-5 py-2 text-xs font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : isDemo ? 'Locked in Demo Mode' : 'Save Profile'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="rounded-xl border border-horizon-border bg-horizon-card p-6 shadow-horizon"
          >
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-horizon-accent" />
              <h2 className="font-display text-base font-bold text-horizon-text">
                Change Password
              </h2>
            </div>
            {passwordError && (
              <div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
                {passwordError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword || isDemo}
                title={isDemo ? 'Password rotation is disabled in Public Demo Mode' : undefined}
                className="rounded-lg border border-horizon-emerald bg-horizon-emerald px-5 py-2 text-xs font-bold text-white hover:bg-horizon-emerald/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : isDemo ? 'Locked in Demo Mode' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
