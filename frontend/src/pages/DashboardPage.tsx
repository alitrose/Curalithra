import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CreditCard,
  Filter,
  RefreshCw,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest, buildQueryString } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { DashboardStats } from '../types/api';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  isoDateDaysAgo,
  todayIsoDate,
} from '../utils/format';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#38bdf8',
  CONFIRMED: '#B8F36B',
  COMPLETED: '#287A59',
  CANCELLED: '#f87171',
  NO_SHOW: '#fbbf24',
};

export const DashboardPage: React.FC = () => {
  const { user, settings, hasPermission } = useAuth();
  const { pushToast } = useToast();
  const currency = settings?.currencySymbol || '₹';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadStats = useCallback(
    async (f = fromDate, t = toDate) => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQueryString({ fromDate: f || undefined, toDate: t || undefined });
        const data = await apiRequest<DashboardStats>(`/dashboard/stats${qs}`);
        setStats(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load clinical dashboard metrics.';
        setError(msg);
        pushToast('error', 'Dashboard Unavailable', msg);
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, pushToast]
  );

  useEffect(() => {
    loadStats('', '');
  }, [loadStats]);

  const applyPreset = (preset: 'all' | 'today' | '30d') => {
    const today = todayIsoDate();
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      loadStats('', '');
    } else if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
      loadStats(today, today);
    } else {
      const from = isoDateDaysAgo(30);
      setFromDate(from);
      setToDate(today);
      loadStats(from, today);
    }
  };

  const combinedTrends = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, { month: string; patients: number; appointments: number }>();
    for (const p of stats.patientRegistrationTrend) {
      map.set(p.month, { month: p.month, patients: p.count, appointments: 0 });
    }
    for (const a of stats.appointmentTrend) {
      const existing = map.get(a.month) || { month: a.month, patients: 0, appointments: 0 };
      existing.appointments = a.count;
      map.set(a.month, existing);
    }
    return Array.from(map.values()).sort((x, y) => x.month.localeCompare(y.month));
  }, [stats]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header & Date Filter Bar */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
              CURALITHRA · Horizon Operations Overview
            </p>
            {user?.demoUser && (
              <span className="rounded-full border border-horizon-emerald/50 bg-horizon-emerald/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-horizon-accent">
                {user.roleDisplay} Demo View
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-horizon-text sm:text-3xl">
            Clinical Operations Dashboard
          </h1>
          <p className="mt-1 text-xs text-horizon-muted">
            Live hospital census, appointment throughput, and financial collection metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-horizon-border bg-horizon-card p-2.5">
          <Filter className="ml-1 h-4 w-4 text-horizon-muted" />
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
          <span className="text-xs text-horizon-muted">to</span>
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => loadStats(fromDate, toDate)}
            className="rounded-lg bg-horizon-emerald px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-horizon-emerald/85"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => applyPreset('30d')}
            className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-muted hover:text-horizon-text"
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-muted hover:text-horizon-text"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className="inline-flex items-center gap-1 rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-muted hover:text-horizon-text"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {error && !stats && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-xl border border-horizon-border bg-horizon-card"
            />
          ))}
        </div>
      ) : (
        stats && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Patients</span>
                  <Users className="h-4 w-4 text-horizon-accent" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.totalPatients}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">
                  {fromDate || toDate ? 'Registered in selected range' : 'Active clinical registry'}
                </p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Doctors</span>
                  <Stethoscope className="h-4 w-4 text-horizon-accent" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.totalDoctors}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">Specialists on roster</p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Visits</span>
                  <CalendarClock className="h-4 w-4 text-sky-400" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.todaysAppointments}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">
                  {stats.pendingAppointments} pending · {stats.completedAppointments} completed
                </p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Cancelled Visits</span>
                  <CalendarX2 className="h-4 w-4 text-red-400" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.cancelledAppointments}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">Released physician slots</p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Pending Queue</span>
                  <Activity className="h-4 w-4 text-amber-400" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.pendingAppointments}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">Scheduled & confirmed visits</p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Completed Visits</span>
                  <CalendarCheck2 className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-horizon-text">
                  {stats.completedAppointments}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">Consultations finalized</p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Collected Revenue</span>
                  <Wallet className="h-4 w-4 text-horizon-accent" />
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-horizon-accent">
                  {formatCurrency(stats.collectedRevenue, currency)}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">
                  Of {formatCurrency(stats.totalRevenue, currency)} billed
                </p>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
                <div className="flex items-center justify-between text-horizon-muted">
                  <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Due</span>
                  <CreditCard className="h-4 w-4 text-amber-400" />
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-horizon-text">
                  {formatCurrency(stats.pendingRevenue, currency)}
                </p>
                <p className="mt-1 text-xs text-horizon-muted">Pending receivables balance</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-5">
                <h2 className="font-display text-base font-bold text-horizon-text">
                  Monthly Billed Revenue Trend
                </h2>
                <p className="text-xs text-horizon-muted">Non-cancelled invoice totals by month</p>
                <div className="mt-4 h-64 w-full">
                  {stats.monthlyRevenueTrend.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-horizon-muted">
                      No revenue data in selected range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.monthlyRevenueTrend}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#B8F36B" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#287A59" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#303B34" />
                        <XAxis dataKey="month" stroke="#9AA89D" fontSize={11} />
                        <YAxis stroke="#9AA89D" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#090D0B',
                            borderColor: '#303B34',
                            borderRadius: '0.75rem',
                            color: '#F4F7F2',
                          }}
                          formatter={(val: number) => [formatCurrency(Number(val), currency), 'Revenue']}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#B8F36B"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#revGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-4">
                <h2 className="font-display text-base font-bold text-horizon-text">
                  Patient & Visit Growth
                </h2>
                <p className="text-xs text-horizon-muted">Registrations vs. appointments per month</p>
                <div className="mt-4 h-64 w-full">
                  {combinedTrends.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-horizon-muted">
                      No trend data in selected range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={combinedTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#303B34" />
                        <XAxis dataKey="month" stroke="#9AA89D" fontSize={11} />
                        <YAxis stroke="#9AA89D" fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#090D0B',
                            borderColor: '#303B34',
                            borderRadius: '0.75rem',
                            color: '#F4F7F2',
                          }}
                        />
                        <Bar dataKey="patients" name="Patients" fill="#287A59" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="appointments" name="Appointments" fill="#B8F36B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-3">
                <h2 className="font-display text-base font-bold text-horizon-text">
                  Appointment Status Mix
                </h2>
                <p className="text-xs text-horizon-muted">Distribution across queue states</p>
                <div className="mt-3 h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusDistribution.filter((s) => s.count > 0)}
                        dataKey="count"
                        nameKey="displayName"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                      >
                        {stats.statusDistribution
                          .filter((s) => s.count > 0)
                          .map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={STATUS_COLORS[entry.status] || '#287A59'}
                            />
                          ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D0B',
                          borderColor: '#303B34',
                          borderRadius: '0.75rem',
                          color: '#F4F7F2',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {stats.statusDistribution.map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-horizon-muted">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[item.status] || '#287A59' }}
                        />
                        {item.displayName}
                      </span>
                      <span className="font-semibold text-horizon-text">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Operational Panels */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-horizon-text">
                    Upcoming Appointments
                  </h2>
                  <Link to="/appointments" className="text-xs font-semibold text-horizon-accent hover:underline">
                    View Schedule →
                  </Link>
                </div>
                {stats.upcomingAppointments.length === 0 ? (
                  <p className="py-6 text-center text-xs text-horizon-muted">No upcoming appointments.</p>
                ) : (
                  <div className="divide-y divide-horizon-border/60">
                    {stats.upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-horizon-text">
                            {apt.patientName}{' '}
                            <span className="text-xs font-normal text-horizon-muted">
                              ({apt.appointmentCode})
                            </span>
                          </p>
                          <p className="truncate text-xs text-horizon-muted">
                            {apt.doctorName} · {formatDate(apt.appointmentDate)} at {apt.appointmentTime}
                          </p>
                        </div>
                        <StatusBadge status={apt.status} label={apt.statusDisplay} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-horizon-text">
                    Recent Patients
                  </h2>
                  <Link to="/patients" className="text-xs font-semibold text-horizon-accent hover:underline">
                    Registry →
                  </Link>
                </div>
                {stats.recentPatients.length === 0 ? (
                  <p className="py-6 text-center text-xs text-horizon-muted">No recent patients.</p>
                ) : (
                  <div className="divide-y divide-horizon-border/60">
                    {stats.recentPatients.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-horizon-text">
                            {p.fullName}
                          </p>
                          <p className="truncate text-xs text-horizon-muted">
                            {p.patientCode} · {p.gender} · {p.phone}
                          </p>
                        </div>
                        <span className="rounded-md border border-horizon-border bg-horizon-bg px-2 py-0.5 text-xs font-semibold text-horizon-accent">
                          {p.bloodGroup}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon lg:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-horizon-text">
                    {hasPermission('VIEW_ACTIVITY_LOGS') ? 'Recent Activity' : 'System Alerts'}
                  </h2>
                  {hasPermission('VIEW_ACTIVITY_LOGS') && (
                    <Link to="/settings" className="text-xs font-semibold text-horizon-accent hover:underline">
                      Audit Log →
                    </Link>
                  )}
                </div>

                {hasPermission('VIEW_ACTIVITY_LOGS') && stats.recentActivities.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.recentActivities.slice(0, 6).map((act) => (
                      <div key={act.id} className="rounded-lg border border-horizon-border/60 bg-horizon-bg/60 p-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-horizon-accent">{act.actionType}</span>
                          <span className="text-horizon-muted">{formatDateTime(act.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs text-horizon-text">{act.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {stats.notifications.map((n) => (
                      <Link
                        key={n.id}
                        to={n.route}
                        className="block rounded-lg border border-horizon-border/60 bg-horizon-bg/60 p-2.5 transition hover:border-horizon-emerald"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-horizon-text">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          <span>{n.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-horizon-muted">{n.message}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
};
