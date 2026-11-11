import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
  Department,
  Doctor,
  DoctorRequest,
  PagedResponse,
} from '../types/api';
import { formatCurrency, formatDate } from '../utils/format';

const EMPTY_DOC: DoctorRequest = {
  fullName: '',
  specialization: '',
  departmentId: 0,
  phone: '',
  email: '',
  qualification: '',
  experienceYears: 5,
  availabilitySchedule: 'Mon-Sat 09:00-17:00',
  consultationFee: 500,
  active: true,
};

export const DoctorsPage: React.FC = () => {
  const { user, hasPermission, settings } = useAuth();
  const { pushToast } = useToast();
  const currency = settings?.currencySymbol || '₹';

  const isDemo = Boolean(user?.demoUser);
  const canEdit = hasPermission('EDIT_DOCTORS');
  const canDelete = hasPermission('DELETE_DOCTORS');

  const [doctors, setDoctors] = useState<PagedResponse<Doctor> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [page, setPage] = useState(0);

  // Add/Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorRequest>(EMPTY_DOC);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Schedule modal
  const [profileDoc, setProfileDoc] = useState<Doctor | null>(null);
  const [docAppointments, setDocAppointments] = useState<Appointment[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMetadata = useCallback(async () => {
    try {
      const [depts, specs] = await Promise.all([
        apiRequest<Department[]>('/doctors/departments'),
        apiRequest<string[]>('/doctors/specializations'),
      ]);
      setDepartments(depts);
      setSpecializations(specs);
    } catch {
      // ignore metadata failure
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        query: query.trim(),
        specialization: specFilter,
        page,
        size: 12,
      });
      const res = await apiRequest<PagedResponse<Doctor>>(`/doctors${qs}`);
      setDoctors(res);
    } catch (err) {
      pushToast('error', 'Failed to load doctors', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [query, specFilter, page, pushToast]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const openCreateModal = () => {
    setEditingDoctor(null);
    setForm({
      ...EMPTY_DOC,
      departmentId: departments[0]?.id || 0,
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditModal = (d: Doctor) => {
    setEditingDoctor(d);
    setForm({
      fullName: d.fullName,
      specialization: d.specialization,
      departmentId: d.departmentId,
      phone: d.phone,
      email: d.email,
      qualification: d.qualification,
      experienceYears: d.experienceYears,
      availabilitySchedule: d.availabilitySchedule,
      consultationFee: d.consultationFee,
      active: d.active,
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openProfileModal = async (d: Doctor) => {
    setProfileDoc(d);
    setLoadingSchedule(true);
    setDocAppointments([]);
    try {
      const list = await apiRequest<Appointment[]>(`/doctors/${d.id}/appointments`);
      setDocAppointments(list);
    } catch {
      // ignore
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Doctor full name is required.';
    if (!form.specialization.trim()) errs.specialization = 'Specialization is required.';
    if (!form.departmentId) errs.departmentId = 'Department is required.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    if (!form.qualification.trim()) errs.qualification = 'Qualification is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (editingDoctor) {
        await apiRequest<Doctor>(`/doctors/${editingDoctor.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Doctor Updated', `${form.fullName} profile updated.`);
      } else {
        await apiRequest<Doctor>('/doctors', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Doctor Added', `${form.fullName} added to medical directory.`);
      }
      setFormOpen(false);
      loadMetadata();
      fetchDoctors();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Unable to save doctor profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest<void>(`/doctors/${deleteTarget.id}`, { method: 'DELETE' });
      pushToast('success', 'Doctor Removed', `${deleteTarget.fullName} removed.`);
      setDeleteTarget(null);
      loadMetadata();
      fetchDoctors();
    } catch (err) {
      pushToast(
        'error',
        'Cannot Delete Doctor',
        err instanceof Error ? err.message : 'Doctor may have existing appointments or records.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Specialists, Departments & Consultation Fees
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Doctor Management
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Add Specialist</span>
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-8">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by DOC code, physician name, specialization, or department..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-4">
          <select
            aria-label="Filter by specialization"
            value={specFilter}
            onChange={(e) => {
              setSpecFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Specializations</option>
            {specializations.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-horizon-muted">Loading medical specialists...</p>
      ) : !doctors || doctors.content.length === 0 ? (
        <EmptyState
          title="No doctors found"
          description="Try clearing filters or register a new specialist doctor."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doctors.content.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon transition hover:border-horizon-emerald/70"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-horizon-accent">
                        {doc.doctorCode}
                      </span>
                      <h2 className="mt-0.5 font-display text-lg font-bold text-horizon-text">
                        {doc.fullName}
                      </h2>
                      <p className="text-xs font-medium text-horizon-accent">
                        {doc.specialization} · {doc.departmentName}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        doc.active
                          ? 'border-horizon-emerald bg-horizon-emerald/20 text-horizon-accent'
                          : 'border-red-500/40 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {doc.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-horizon-muted">
                    <p>
                      <strong className="text-horizon-text">Qualification:</strong> {doc.qualification} (
                      {doc.experienceYears} yrs)
                    </p>
                    <p>
                      <strong className="text-horizon-text">Schedule:</strong> {doc.availabilitySchedule}
                    </p>
                    <p>
                      <strong className="text-horizon-text">Contact:</strong> {doc.phone} · {doc.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-horizon-border pt-3">
                  <div>
                    <span className="text-[11px] text-horizon-muted">Consultation Fee</span>
                    <p className="font-display text-base font-bold text-horizon-text">
                      {formatCurrency(doc.consultationFee, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openProfileModal(doc)}
                      title="View profile & appointments"
                      className="rounded-lg border border-horizon-border bg-horizon-bg p-2 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditModal(doc)}
                        title="Edit doctor"
                        className="rounded-lg border border-horizon-border bg-horizon-bg p-2 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={isDemo}
                        onClick={() => setDeleteTarget(doc)}
                        title={
                          isDemo
                            ? 'Deleting doctors is disabled in Public Demo Mode — use Reset Demo Data'
                            : 'Delete doctor'
                        }
                        className="rounded-lg border border-horizon-border bg-horizon-bg p-2 text-horizon-muted hover:border-red-500/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={doctors.page}
            totalPages={doctors.totalPages}
            totalElements={doctors.totalElements}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Add/Edit Doctor Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDoctor ? `Edit Specialist · ${editingDoctor.doctorCode}` : 'Register Specialist Doctor'}
        subtitle="Configure department, availability schedule, and consultation fee."
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Full Name *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Dr. Evelyn Hayes"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-red-400">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Department *</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value={0}>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
              {fieldErrors.departmentId && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.departmentId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Specialization *</label>
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Cardiology"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.specialization && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.specialization}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Qualification *</label>
              <input
                type="text"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                placeholder="MD, DM (Cardiology)"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.qualification && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.qualification}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Phone *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Experience (Years)</label>
              <input
                type="number"
                min={0}
                max={75}
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Consultation Fee ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.consultationFee}
                onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">Availability Schedule *</label>
              <input
                type="text"
                value={form.availabilitySchedule}
                onChange={(e) => setForm({ ...form, availabilitySchedule: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-horizon-text">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-horizon-emerald"
            />
            <span>Doctor is active and accepting appointments</span>
          </label>

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
              {saving ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Create Doctor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Doctor Schedule Profile Modal */}
      <Modal
        open={Boolean(profileDoc)}
        onClose={() => setProfileDoc(null)}
        title={profileDoc ? `${profileDoc.fullName} · ${profileDoc.doctorCode}` : 'Doctor Profile'}
        subtitle={profileDoc ? `${profileDoc.specialization} (${profileDoc.departmentName})` : undefined}
        maxWidthClass="max-w-3xl"
      >
        {profileDoc && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-horizon-border bg-horizon-bg p-4 text-xs sm:grid-cols-4">
              <div>
                <span className="text-horizon-muted">Qualification</span>
                <p className="mt-0.5 font-semibold text-horizon-text">{profileDoc.qualification}</p>
              </div>
              <div>
                <span className="text-horizon-muted">Experience</span>
                <p className="mt-0.5 font-semibold text-horizon-text">{profileDoc.experienceYears} years</p>
              </div>
              <div>
                <span className="text-horizon-muted">Consultation Fee</span>
                <p className="mt-0.5 font-semibold text-horizon-accent">
                  {formatCurrency(profileDoc.consultationFee, currency)}
                </p>
              </div>
              <div>
                <span className="text-horizon-muted">Availability</span>
                <p className="mt-0.5 font-semibold text-horizon-text">{profileDoc.availabilitySchedule}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-horizon-text">
                <CalendarDays className="h-4 w-4 text-horizon-accent" />
                <span>Assigned Appointments ({docAppointments.length})</span>
              </h3>
              {loadingSchedule ? (
                <p className="text-xs text-horizon-muted">Loading schedule...</p>
              ) : docAppointments.length === 0 ? (
                <p className="text-xs text-horizon-muted">No appointments assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {docAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between rounded-lg border border-horizon-border bg-horizon-bg/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-horizon-text">{apt.appointmentCode}</span> ·{' '}
                        {formatDate(apt.appointmentDate)} {apt.appointmentTime} · {apt.patientName}
                        <p className="text-horizon-muted">{apt.reason}</p>
                      </div>
                      <StatusBadge status={apt.status} label={apt.statusDisplay} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Specialist Doctor"
        message={`Are you sure you want to delete ${deleteTarget?.fullName}? Doctors with historical appointments or clinical records are protected by referential integrity.`}
        confirmLabel="Remove Doctor"
        loading={deleting}
      />
    </section>
  );
};
