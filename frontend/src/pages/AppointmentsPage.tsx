import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  List,
  Pencil,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { ApiRequestError, apiRequest, buildQueryString } from '../api/client';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Appointment,
  AppointmentRequest,
  AppointmentStatus,
  CalendarDayGroup,
  Doctor,
  PagedResponse,
  Patient,
} from '../types/api';
import { formatDate, todayIsoDate } from '../utils/format';

const STANDARD_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export const AppointmentsPage: React.FC = () => {
  const { user, hasPermission, settings } = useAuth();
  const { pushToast } = useToast();
  const defaultDuration = settings?.defaultAppointmentMinutes || 30;

  const isDemo = Boolean(user?.demoUser);
  const canManage = hasPermission('MANAGE_APPOINTMENTS');
  const canCancel = hasPermission('CANCEL_APPOINTMENTS');

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [appointments, setAppointments] = useState<PagedResponse<Appointment> | null>(null);
  const [calendarGroups, setCalendarGroups] = useState<CalendarDayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  // Reference lists
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Create / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [form, setForm] = useState<AppointmentRequest>({
    patientId: 0,
    doctorId: 0,
    appointmentDate: todayIsoDate(),
    appointmentTime: '10:00',
    durationMinutes: defaultDuration,
    reason: '',
    status: 'SCHEDULED',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [doctorDayBookings, setDoctorDayBookings] = useState<Appointment[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [selectedDetail, setSelectedDetail] = useState<Appointment | null>(null);

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadReferenceLists = useCallback(async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        apiRequest<PagedResponse<Patient>>('/patients?size=100&sortBy=fullName&sortDir=asc'),
        apiRequest<PagedResponse<Doctor>>('/doctors?size=100&sortBy=fullName&sortDir=asc'),
      ]);
      setPatients(patRes.content);
      setDoctors(docRes.content);
    } catch {
      // handled when user interacts
    }
  }, []);

  useEffect(() => {
    loadReferenceLists();
  }, [loadReferenceLists]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'table') {
        const qs = buildQueryString({
          query: query.trim(),
          status: statusFilter,
          doctorId: doctorFilter,
          fromDate,
          toDate,
          page,
          size: 10,
        });
        const res = await apiRequest<PagedResponse<Appointment>>(`/appointments${qs}`);
        setAppointments(res);
      } else {
        const qs = buildQueryString({
          query: query.trim(),
          status: statusFilter,
          doctorId: doctorFilter,
          fromDate,
          toDate,
        });
        const groups = await apiRequest<CalendarDayGroup[]>(`/appointments/calendar${qs}`);
        setCalendarGroups(groups);
      }
    } catch (err) {
      pushToast(
        'error',
        'Failed to load appointments',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [viewMode, query, statusFilter, doctorFilter, fromDate, toDate, page, pushToast]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const fetchDoctorDayBookings = useCallback(async (doctorId: number, date: string) => {
    if (!doctorId || !date) {
      setDoctorDayBookings([]);
      return;
    }
    try {
      const qs = buildQueryString({
        doctorId,
        fromDate: date,
        toDate: date,
        size: 100,
        sortBy: 'appointmentTime',
        sortDir: 'asc',
      });
      const res = await apiRequest<PagedResponse<Appointment>>(`/appointments${qs}`);
      setDoctorDayBookings(
        res.content.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')
      );
    } catch {
      setDoctorDayBookings([]);
    }
  }, []);

  useEffect(() => {
    if (formOpen && form.doctorId && form.appointmentDate) {
      fetchDoctorDayBookings(form.doctorId, form.appointmentDate);
    }
  }, [formOpen, form.doctorId, form.appointmentDate, fetchDoctorDayBookings]);

  const suggestedOpenSlots = useMemo(() => {
    const dur = Math.max(5, form.durationMinutes || defaultDuration);
    const activeOthers = doctorDayBookings.filter((b) =>
      editingAppointment ? b.id !== editingAppointment.id : true
    );
    return STANDARD_SLOTS.filter((slot) => {
      const sStart = timeToMinutes(slot);
      const sEnd = sStart + dur;
      return !activeOthers.some((other) => {
        const oStart = timeToMinutes(other.appointmentTime);
        const oEnd = oStart + Math.max(1, other.durationMinutes);
        return sStart < oEnd && oStart < sEnd;
      });
    });
  }, [doctorDayBookings, form.durationMinutes, defaultDuration, editingAppointment]);

  const activeDoctors = useMemo(() => doctors.filter((d) => d.active), [doctors]);

  const openCreateModal = () => {
    setEditingAppointment(null);
    setForm({
      patientId: patients[0]?.id || 0,
      doctorId: activeDoctors[0]?.id || doctors[0]?.id || 0,
      appointmentDate: todayIsoDate(),
      appointmentTime: '10:00',
      durationMinutes: defaultDuration,
      reason: '',
      status: 'SCHEDULED',
      notes: '',
    });
    setFormError(null);
    setConflictError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditModal = (appt: Appointment) => {
    setEditingAppointment(appt);
    setForm({
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      appointmentDate: appt.appointmentDate,
      appointmentTime: appt.appointmentTime.slice(0, 5),
      durationMinutes: appt.durationMinutes,
      reason: appt.reason,
      status: appt.status,
      notes: appt.notes || '',
    });
    setFormError(null);
    setConflictError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setConflictError(null);

    const errs: Record<string, string> = {};
    if (!form.patientId) errs.patientId = 'Please select a patient.';
    if (!form.doctorId) errs.doctorId = 'Please select a doctor.';
    if (!form.appointmentDate) errs.appointmentDate = 'Date is required.';
    if (!/^\d{2}:\d{2}$/.test(form.appointmentTime)) {
      errs.appointmentTime = 'Valid HH:mm time is required.';
    }
    if (form.durationMinutes < 5 || form.durationMinutes > 480) {
      errs.durationMinutes = 'Duration must be between 5 and 480 minutes.';
    }
    if (!form.reason.trim()) errs.reason = 'Reason for visit is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (editingAppointment) {
        await apiRequest<Appointment>(`/appointments/${editingAppointment.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Appointment Updated', `${editingAppointment.appointmentCode} saved.`);
      } else {
        const created = await apiRequest<Appointment>('/appointments', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        pushToast(
          'success',
          'Appointment Scheduled',
          `${created.appointmentCode} booked with ${created.doctorName}.`
        );
      }
      setFormOpen(false);
      fetchAppointments();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409) {
          setConflictError(err.message);
          fetchDoctorDayBookings(form.doctorId, form.appointmentDate);
        } else {
          setFormError(err.message);
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setFormError('Unable to save appointment.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (appt: Appointment, nextStatus: AppointmentStatus) => {
    try {
      await apiRequest<Appointment>(`/appointments/${appt.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushToast('success', 'Status Updated', `${appt.appointmentCode} marked ${nextStatus}.`);
      fetchAppointments();
      if (selectedDetail?.id === appt.id) {
        setSelectedDetail((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      pushToast(
        'error',
        'Status Change Failed',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiRequest<Appointment>(`/appointments/${cancelTarget.id}`, {
        method: 'DELETE',
      });
      pushToast('success', 'Appointment Cancelled', `${cancelTarget.appointmentCode} cancelled.`);
      setCancelTarget(null);
      fetchAppointments();
    } catch (err) {
      pushToast(
        'error',
        'Cannot Cancel Appointment',
        err instanceof Error ? err.message : undefined
      );
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const renderActions = (a: Appointment) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setSelectedDetail(a)}
        title="View appointment details"
        aria-label={`View ${a.appointmentCode}`}
        className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
      >
        <Eye className="h-4 w-4" />
      </button>
      {canManage && a.status === 'SCHEDULED' && (
        <button
          type="button"
          disabled={isDemo}
          onClick={() => handleStatusChange(a, 'CONFIRMED')}
          title={
            isDemo
              ? 'Updating appointment status is disabled in Read-Only Public Demo Mode'
              : 'Confirm appointment'
          }
          aria-label={`Confirm ${a.appointmentCode}`}
          className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-accent hover:text-horizon-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}
      {canManage && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
        <button
          type="button"
          disabled={isDemo}
          onClick={() => handleStatusChange(a, 'COMPLETED')}
          title={
            isDemo
              ? 'Updating appointment status is disabled in Read-Only Public Demo Mode'
              : 'Mark completed'
          }
          aria-label={`Complete ${a.appointmentCode}`}
          className="rounded-lg border border-horizon-border bg-horizon-bg px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border"
        >
          Done
        </button>
      )}
      {canManage && a.status !== 'CANCELLED' && (
        <button
          type="button"
          disabled={isDemo}
          onClick={() => openEditModal(a)}
          title={
            isDemo
              ? 'Editing appointments is disabled in Read-Only Public Demo Mode'
              : 'Edit appointment'
          }
          aria-label={`Edit ${a.appointmentCode}`}
          className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {canCancel && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
        <button
          type="button"
          disabled={isDemo}
          onClick={() => setCancelTarget(a)}
          title={
            isDemo
              ? 'Cancelling appointments is disabled in Read-Only Public Demo Mode'
              : 'Cancel appointment'
          }
          aria-label={`Cancel ${a.appointmentCode}`}
          className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-red-500/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Scheduling & Conflict Prevention
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Appointment Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-horizon-border bg-horizon-card p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-horizon-emerald text-white'
                  : 'text-horizon-muted hover:text-horizon-text'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'calendar'
                  ? 'bg-horizon-emerald text-white'
                  : 'text-horizon-muted hover:text-horizon-text'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Schedule Agenda</span>
            </button>
          </div>

          {canManage && (
            <button
              type="button"
              disabled={isDemo}
              onClick={openCreateModal}
              title={
                isDemo
                  ? 'Scheduling appointments is disabled in Read-Only Public Demo Mode'
                  : 'Schedule Appointment'
              }
              className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-horizon-accent"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search APT code, patient, doctor, or reason..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as AppointmentStatus | '');
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="NO_SHOW">No Show</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <select
            aria-label="Filter by doctor"
            value={doctorFilter}
            onChange={(e) => {
              setDoctorFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-4 shadow-horizon">
          {loading ? (
            <p className="py-10 text-center text-sm text-horizon-muted">Loading appointments...</p>
          ) : !appointments || appointments.content.length === 0 ? (
            <EmptyState
              title="No appointments found"
              description="Adjust your filters or schedule a new patient consultation."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Date & Time</th>
                      <th className="px-3 py-3">Patient</th>
                      <th className="px-3 py-3">Doctor</th>
                      <th className="px-3 py-3">Reason</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-horizon-border/60">
                    {appointments.content.map((a) => (
                      <tr key={a.id} className="hover:bg-horizon-card-hover/50">
                        <td className="px-3 py-3 font-mono text-xs font-semibold text-horizon-accent">
                          {a.appointmentCode}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <p className="font-semibold text-horizon-text">{formatDate(a.appointmentDate)}</p>
                          <p className="text-horizon-muted">
                            {a.appointmentTime} · {a.durationMinutes} min
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-horizon-text">{a.patientName}</p>
                          <p className="text-xs text-horizon-muted">{a.patientCode}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-horizon-text">{a.doctorName}</p>
                          <p className="text-xs text-horizon-muted">{a.doctorSpecialization}</p>
                        </td>
                        <td className="max-w-xs truncate px-3 py-3 text-xs text-horizon-muted">
                          {a.reason}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={a.status} label={a.statusDisplay} />
                        </td>
                        <td className="px-3 py-3">{renderActions(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={appointments.page}
                totalPages={appointments.totalPages}
                totalElements={appointments.totalElements}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-horizon-border bg-horizon-card p-8 text-center text-sm text-horizon-muted">
              Loading schedule agenda...
            </div>
          ) : calendarGroups.length === 0 ? (
            <EmptyState
              title="No scheduled appointments in range"
              description="Expand your date range or schedule a consultation."
            />
          ) : (
            calendarGroups.map((group) => (
              <div
                key={group.date}
                className="rounded-xl border border-horizon-border bg-horizon-card p-4 shadow-horizon"
              >
                <div className="mb-3 flex items-center justify-between border-b border-horizon-border pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-horizon-accent" />
                    <h2 className="font-display text-base font-bold text-horizon-text">
                      {formatDate(group.date)}
                    </h2>
                  </div>
                  <span className="rounded-full border border-horizon-border bg-horizon-bg px-2.5 py-0.5 text-xs text-horizon-muted">
                    {group.appointments.length} visits
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {group.appointments.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col justify-between rounded-xl border border-horizon-border bg-horizon-bg/60 p-3.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-horizon-accent">
                            <Clock className="h-3.5 w-3.5" />
                            {a.appointmentTime} ({a.durationMinutes}m)
                          </span>
                          <StatusBadge status={a.status} label={a.statusDisplay} />
                        </div>
                        <p className="mt-2 font-semibold text-horizon-text">{a.patientName}</p>
                        <p className="text-xs text-horizon-muted">
                          {a.doctorName} · {a.doctorSpecialization}
                        </p>
                        <p className="mt-1.5 text-xs text-horizon-muted">{a.reason}</p>
                      </div>
                      <div className="mt-3 border-t border-horizon-border/60 pt-2">
                        {renderActions(a)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingAppointment
            ? `Update Appointment · ${editingAppointment.appointmentCode}`
            : 'Schedule New Appointment'
        }
        subtitle="Automatically checked against physician slot overlap."
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {conflictError && (
            <div
              role="alert"
              data-testid="appointment-conflict-alert"
              className="rounded-xl border border-amber-500/60 bg-amber-500/15 p-3.5 text-xs text-amber-100"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="font-bold text-amber-300">Schedule Conflict Detected (HTTP 409)</p>
                  <p className="mt-1">{conflictError}</p>
                  <p className="mt-1.5 text-amber-200/90">
                    Select one of the available open slots below to reschedule.
                  </p>
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Patient *</label>
              <select
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value={0}>Select patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.patientCode})
                  </option>
                ))}
              </select>
              {fieldErrors.patientId && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.patientId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Doctor *</label>
              <select
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value={0}>Select doctor...</option>
                {doctors
                  .filter((d) => d.active || (editingAppointment && editingAppointment.doctorId === d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} — {d.specialization}
                    </option>
                  ))}
              </select>
              {fieldErrors.doctorId && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.doctorId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Date *</label>
              <input
                type="date"
                value={form.appointmentDate}
                onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.appointmentDate && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.appointmentDate}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">Time (24h) *</label>
                <input
                  type="time"
                  value={form.appointmentTime}
                  onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
                {fieldErrors.appointmentTime && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.appointmentTime}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-horizon-muted">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: Number(e.target.value) || 30 })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            </div>

            {editingAppointment && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-horizon-muted">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as AppointmentStatus })
                  }
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_SHOW">No Show</option>
                  {canCancel && <option value="CANCELLED">Cancelled</option>}
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Reason for Visit *
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Cardiology annual follow-up & ECG review"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.reason && <p className="mt-1 text-xs text-red-400">{fieldErrors.reason}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Clinical / Front-Desk Notes
              </label>
              <textarea
                rows={2}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Open Slot Helper */}
          {form.doctorId > 0 && form.appointmentDate && (
            <div className="rounded-xl border border-horizon-border bg-horizon-bg/60 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-horizon-text">
                  Available Time Slots ({formatDate(form.appointmentDate)})
                </span>
                <span className="text-horizon-muted">
                  {doctorDayBookings.length} booked slot(s) on this date
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestedOpenSlots.length === 0 ? (
                  <span className="text-amber-300">
                    All standard clinic slots are occupied for this date.
                  </span>
                ) : (
                  suggestedOpenSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, appointmentTime: slot }));
                        setConflictError(null);
                      }}
                      className={`rounded-md border px-2.5 py-1 font-mono transition ${
                        form.appointmentTime === slot
                          ? 'border-horizon-accent bg-horizon-accent text-horizon-nav font-bold'
                          : 'border-horizon-border bg-horizon-card text-horizon-text hover:border-horizon-emerald'
                      }`}
                    >
                      {slot}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-horizon-border bg-horizon-bg px-4 py-2 text-sm text-horizon-muted hover:text-horizon-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-horizon-accent px-5 py-2 text-sm font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
            >
              {saving ? 'Checking Slot...' : editingAppointment ? 'Save Changes' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title={
          selectedDetail
            ? `Appointment · ${selectedDetail.appointmentCode}`
            : 'Appointment Details'
        }
      >
        {selectedDetail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-horizon-border bg-horizon-bg p-4">
              <div>
                <span className="text-horizon-muted">Patient</span>
                <p className="mt-0.5 text-sm font-semibold text-horizon-text">
                  {selectedDetail.patientName} ({selectedDetail.patientCode})
                </p>
              </div>
              <div>
                <span className="text-horizon-muted">Physician</span>
                <p className="mt-0.5 text-sm font-semibold text-horizon-text">
                  {selectedDetail.doctorName}
                </p>
                <p className="text-horizon-muted">{selectedDetail.doctorSpecialization}</p>
              </div>
              <div>
                <span className="text-horizon-muted">Date & Time</span>
                <p className="mt-0.5 font-semibold text-horizon-text">
                  {formatDate(selectedDetail.appointmentDate)} at {selectedDetail.appointmentTime} (
                  {selectedDetail.durationMinutes} min)
                </p>
              </div>
              <div>
                <span className="text-horizon-muted">Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedDetail.status} label={selectedDetail.statusDisplay} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-horizon-muted">Reason</span>
                <p className="mt-0.5 text-horizon-text">{selectedDetail.reason}</p>
              </div>
              <div className="col-span-2">
                <span className="text-horizon-muted">Notes</span>
                <p className="mt-0.5 text-horizon-text">{selectedDetail.notes || 'None'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Appointment"
        message={`Cancel appointment ${cancelTarget?.appointmentCode} for ${cancelTarget?.patientName} on ${cancelTarget?.appointmentDate} at ${cancelTarget?.appointmentTime}?`}
        confirmLabel="Cancel Appointment"
        loading={cancelling}
      />
    </section>
  );
};
