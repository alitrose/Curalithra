import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlaskConical, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Role } from '../types/api';

const DEMO_ROLE_BUTTONS: { role: Role; shortLabel: string; title: string }[] = [
  { role: 'ADMIN', shortLabel: 'Admin', title: 'Switch to Administrator Demo (full hospital view)' },
  { role: 'DOCTOR', shortLabel: 'Doctor', title: 'Switch to Doctor Demo (EMR & prescriptions)' },
  {
    role: 'RECEPTIONIST',
    shortLabel: 'Receptionist',
    title: 'Switch to Receptionist Demo (intake, scheduling & billing)',
  },
];

/**
 * Sticky horizontal Public Demo banner shown only for backend-authenticated demo sessions.
 * Strictly horizontal (zero sidebar), enabling instant role switching and Exit Demo in read-only sandbox mode.
 */
export const DemoBanner: React.FC = () => {
  const { user, loginWithDemoRole, logout } = useAuth();
  const { pushToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [switchingRole, setSwitchingRole] = useState<Role | null>(null);
  const [exiting, setExiting] = useState(false);

  if (!user?.demoUser) {
    return null;
  }

  const handleSwitchRole = async (targetRole: Role) => {
    if (targetRole === user.role || switchingRole || exiting) return;
    setSwitchingRole(targetRole);
    try {
      const switched = await loginWithDemoRole(targetRole);
      pushToast(
        'success',
        `Switched to ${switched.roleDisplay} Demo`,
        `Signed in as ${switched.fullName}`
      );

      const path = location.pathname;
      const blockedForReceptionist =
        path.startsWith('/medical-records') ||
        path.startsWith('/prescriptions') ||
        path.startsWith('/settings');
      const blockedForDoctor = path.startsWith('/settings');

      if (
        (targetRole === 'RECEPTIONIST' && blockedForReceptionist) ||
        (targetRole === 'DOCTOR' && blockedForDoctor)
      ) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      pushToast(
        'error',
        'Demo Role Switch Failed',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSwitchingRole(null);
    }
  };

  const handleExitDemo = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setExiting(false);
    }
  };

  return (
    <div
      data-testid="demo-mode-banner"
      className="border-b border-horizon-emerald/45 bg-gradient-to-r from-horizon-card via-horizon-nav to-horizon-card print:hidden"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-horizon-accent/60 bg-horizon-accent/15 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-horizon-accent">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>DEMO MODE · {user.roleDisplay}</span>
          </span>
          <span className="font-semibold text-horizon-text">
            {user.fullName}
          </span>
          <span className="hidden items-center gap-1 text-horizon-muted md:inline-flex">
            <span>·</span>
            <ShieldCheck className="h-3.5 w-3.5 text-horizon-accent" />
            <span>Read-only sandbox · Switch roles freely · Mutations &amp; resets disabled</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Switch Demo Role"
            className="inline-flex items-center rounded-lg border border-horizon-border bg-horizon-bg p-0.5 text-[11px]"
          >
            <span className="hidden px-2 font-semibold text-horizon-muted sm:inline">Role:</span>
            {DEMO_ROLE_BUTTONS.map((btn) => {
              const active = user.role === btn.role;
              const busy = switchingRole === btn.role;
              return (
                <button
                  key={btn.role}
                  type="button"
                  title={btn.title}
                  disabled={active || Boolean(switchingRole) || exiting}
                  onClick={() => handleSwitchRole(btn.role)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    active
                      ? 'bg-horizon-emerald text-white shadow-sm'
                      : 'text-horizon-muted hover:text-horizon-accent disabled:opacity-60'
                  }`}
                >
                  {busy ? 'Switching...' : btn.shortLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="exit-demo-btn"
            onClick={handleExitDemo}
            disabled={exiting || Boolean(switchingRole)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-horizon-border bg-horizon-card px-3 py-1 text-[11px] font-bold text-horizon-text transition hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{exiting ? 'Exiting...' : 'Exit Demo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
