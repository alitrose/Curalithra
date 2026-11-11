import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  FileBarChart2,
  FileText,
  Info,
  LogOut,
  Menu,
  Pill,
  Settings,
  Stethoscope,
  User,
  Users,
  X,
} from 'lucide-react';
import { CuralithraLogo } from './CuralithraLogo';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import type { NotificationItem, NotificationsResponse } from '../types/api';

interface NavItem {
  to: string;
  label: string;
  permission?: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'VIEW_DASHBOARD', icon: Activity },
  { to: '/patients', label: 'Patients', permission: 'VIEW_PATIENTS', icon: Users },
  { to: '/doctors', label: 'Doctors', permission: 'VIEW_DOCTORS', icon: Stethoscope },
  { to: '/appointments', label: 'Appointments', permission: 'VIEW_APPOINTMENTS', icon: CalendarDays },
  { to: '/medical-records', label: 'Records', permission: 'VIEW_MEDICAL_RECORDS', icon: FileText },
  { to: '/prescriptions', label: 'Prescriptions', permission: 'VIEW_MEDICAL_RECORDS', icon: Pill },
  { to: '/billing', label: 'Billing', permission: 'VIEW_BILLING', icon: CreditCard },
  { to: '/reports', label: 'Reports', permission: 'VIEW_REPORTS', icon: FileBarChart2 },
];

/**
 * CURALITHRA Horizon Edition Horizontal Top Navigation Bar.
 * Strictly zero sidebar anywhere; responsive viewports use a top dropdown menu.
 */
export const TopNavBar: React.FC = () => {
  const { user, settings, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState<NotificationsResponse | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
  const canAccessAdmin =
    hasPermission('MANAGE_USERS') || hasPermission('MANAGE_SETTINGS') || hasPermission('VIEW_ACTIVITY_LOGS');

  const fetchNotifications = async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      const data = await apiRequest<NotificationsResponse>('/notifications');
      setNotifData(data);
    } catch {
      // ignore passive notification polling errors
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const handleToggleNotifications = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      fetchNotifications();
    }
  };

  const handleMarkItemRead = async (item: NotificationItem) => {
    try {
      const updated = await apiRequest<NotificationsResponse>(
        `/notifications/${encodeURIComponent(item.id)}/read`,
        { method: 'POST' }
      );
      setNotifData(updated);
    } catch {
      // ignore error
    }
    setNotifOpen(false);
    if (item.route) {
      navigate(item.route);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const updated = await apiRequest<NotificationsResponse>('/notifications/mark-all-read', {
        method: 'POST',
      });
      setNotifData(updated);
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
    await logout();
    navigate('/login');
  };

  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-horizon-border bg-horizon-nav/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <NavLink to="/dashboard" className="flex shrink-0 items-center gap-3">
          <CuralithraLogo />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold tracking-wider text-horizon-text">
                CURALITHRA
              </span>
              <span className="hidden rounded border border-horizon-emerald/60 bg-horizon-emerald/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-horizon-accent sm:inline-block">
                Horizon
              </span>
            </div>
            <span className="hidden text-[11px] font-medium text-horizon-muted xl:block">
              {settings?.hospitalName || 'Intelligent Hospital Management'}
            </span>
          </div>
        </NavLink>

        <nav
          aria-label="Primary horizontal navigation"
          className="hidden items-center gap-1 xl:flex"
        >
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-horizon-card text-horizon-accent ring-1 ring-horizon-accent/40'
                    : 'text-horizon-muted hover:bg-horizon-card/60 hover:text-horizon-text'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Notification Bell & Popover */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={handleToggleNotifications}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-horizon-border bg-horizon-card text-horizon-muted transition hover:border-horizon-emerald hover:text-horizon-text"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  data-testid="notification-unread-badge"
                  className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-horizon-accent px-1 text-[10px] font-bold text-horizon-nav"
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                data-testid="notification-popover"
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-horizon-border bg-horizon-card shadow-horizon sm:w-96"
              >
                <div className="flex items-center justify-between border-b border-horizon-border px-4 py-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-horizon-text">
                      Clinical Notifications
                    </h3>
                    <p className="text-[11px] text-horizon-muted">
                      {unreadCount} unread · {notifData?.totalCount ?? 0} total alerts
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1 rounded-md border border-horizon-border bg-horizon-bg px-2.5 py-1 text-[11px] font-semibold text-horizon-accent transition hover:border-horizon-emerald"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 divide-y divide-horizon-border/60 overflow-y-auto">
                  {notifLoading && !notifData ? (
                    <p className="p-4 text-center text-xs text-horizon-muted">Loading alerts...</p>
                  ) : !notifData || notifData.items.length === 0 ? (
                    <p className="p-4 text-center text-xs text-horizon-muted">No notifications available.</p>
                  ) : (
                    notifData.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleMarkItemRead(item)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-horizon-card-hover ${
                          item.read ? 'opacity-65' : 'bg-horizon-bg/40'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {item.severity === 'warning' ? (
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                          ) : item.severity === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-horizon-accent" />
                          ) : (
                            <Info className="h-4 w-4 text-sky-400" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-horizon-text">
                              {item.title}
                            </p>
                            {!item.read && (
                              <span
                                title="Unread"
                                className="h-2 w-2 shrink-0 rounded-full bg-horizon-accent"
                              />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-horizon-muted">{item.message}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {canAccessAdmin && (
            <NavLink
              to="/settings"
              aria-label="Settings"
              title="Administration & Settings"
              className={({ isActive }) =>
                `hidden h-9 w-9 items-center justify-center rounded-lg border transition sm:inline-flex ${
                  isActive
                    ? 'border-horizon-accent/60 bg-horizon-card text-horizon-accent'
                    : 'border-horizon-border bg-horizon-card text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text'
                }`
              }
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          )}

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition sm:inline-flex ${
                isActive
                  ? 'border-horizon-accent/60 bg-horizon-card text-horizon-accent'
                  : 'border-horizon-border bg-horizon-card text-horizon-text hover:border-horizon-emerald'
              }`
            }
          >
            <User className="h-3.5 w-3.5 text-horizon-accent" />
            <span className="max-w-[130px] truncate font-medium">
              {user?.fullName || 'Clinical Staff'}
            </span>
            {user?.role && (
              <span className="rounded bg-horizon-emerald/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-horizon-accent">
                {user.role}
              </span>
            )}
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logout"
            title="Sign out"
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-horizon-border bg-horizon-card text-horizon-muted transition hover:border-red-500/60 hover:text-red-400 sm:inline-flex"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-horizon-border bg-horizon-card px-3 text-sm font-medium text-horizon-text xl:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>Menu</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          data-testid="mobile-top-dropdown"
          className="border-t border-horizon-border bg-horizon-nav px-4 py-3 xl:hidden"
        >
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-horizon-card text-horizon-accent ring-1 ring-horizon-accent/40'
                      : 'text-horizon-muted hover:bg-horizon-card hover:text-horizon-text'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
            {canAccessAdmin && (
              <NavLink
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-horizon-card text-horizon-accent ring-1 ring-horizon-accent/40'
                      : 'text-horizon-muted hover:bg-horizon-card hover:text-horizon-text'
                  }`
                }
              >
                <Settings className="h-4 w-4" />
                <span>Settings & Admin</span>
              </NavLink>
            )}
            <NavLink
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-horizon-card text-horizon-accent ring-1 ring-horizon-accent/40'
                    : 'text-horizon-muted hover:bg-horizon-card hover:text-horizon-text'
                }`
              }
            >
              <User className="h-4 w-4" />
              <span>Profile ({user?.role})</span>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
