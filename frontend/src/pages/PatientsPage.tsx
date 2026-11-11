import React, { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  HeartPulse,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { ApiRequestError, apiRequest, buildQueryString } from '../api/client';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { PagedResponse, Patient, PatientHistory, PatientRequest } from '../types/api';
import { formatCurrency, formatDate } from '../utils/format';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const EMPTY_FORM: PatientRequest = {
  fullName: '',
  dateOfBirth: '',
  gender: 'Male',
  phone: '',
  email: '',
  address: '',
  bloodGroup: 'O+',
  emergencyContact: '',
  bp: '',
  sugar: '',
  weightKg: '',
  heightCm: '',
};

export const PatientsPage: React.FC = () => {
  const { hasPermission, settings } = useAuth();
  const { pushToast } = useToast();
  const currency = settings?.currencySymbol || '₹';

  const canEdit = hasPermission('EDIT_PATIENTS');
  const canDelete = hasPermission('DELETE_PATIENTS');

  const [patients, setPatients] = useState<PagedResponse<Patient> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  const [page, setPage] = useState(0);

  // Add / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Profile / History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<PatientHistory | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        query: query.trim(),
        gender: genderFilter,
        bloodGroup: bloodFilter,
        page,
        size: 10,
      });
      const res = await apiRequest<PagedResponse<Patient>>(`/patients${qs}`);
      setPatients(res);
    } catch (err) {
      pushToast('error', 'Failed to load patients', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [query, genderFilter, bloodFilter, page, pushToast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const openCreateModal = () => {
    setEditingPatient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setForm({
      fullName: p.fullName,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
      phone: p.phone,
      email: p.email || '',
      address: p.address || '',
      bloodGroup: p.bloodGroup || 'Unknown',
      emergencyContact: p.emergencyContact || '',
      bp: p.bp || '',
      sugar: p.sugar || '',
      weightKg: p.weightKg || '',
      heightCm: p.heightCm || '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openHistoryModal = async (p: Patient) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const data = await apiRequest<PatientHistory>(`/patients/${p.id}/history`);
      setHistoryData(data);
    } catch (err) {
      pushToast('error', 'Failed to load patient profile', err instanceof Error ? err.message : undefined);
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (editingPatient) {
        await apiRequest<Patient>(`/patients/${editingPatient.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Patient Updated', `${form.fullName} profile saved.`);
      } else {
        await apiRequest<Patient>('/patients', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Patient Registered', `${form.fullName} added to registry.`);
      }
      setFormOpen(false);
      fetchPatients();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Unable to save patient record.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest<void>(`/patients/${deleteTarget.id}`, { method: 'DELETE' });
      pushToast('success', 'Patient Deleted', `${deleteTarget.fullName} removed.`);
      setDeleteTarget(null);
      fetchPatients();
    } catch (err) {
      pushToast(
        'error',
        'Cannot Delete Patient',
        err instanceof Error ? err.message : 'Patient may have linked clinical records.'
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
            Patient Registry & Triage Vitals
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Patient Management
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Register Patient</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by PAT code, full name, phone, or email..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            aria-label="Filter by gender"
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <select
            aria-label="Filter by blood group"
            value={bloodFilter}
            onChange={(e) => {
              setBloodFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Blood Groups</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-horizon-border bg-horizon-card p-4 shadow-horizon">
        {loading ? (
          <p className="py-10 text-center text-sm text-horizon-muted">Loading patient registry...</p>
        ) : !patients || patients.content.length === 0 ? (
          <EmptyState
            title="No patients found"
            description="Adjust your search or filters, or register a new patient."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">DOB / Gender</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Blood</th>
                    <th className="px-3 py-3">Baseline Vitals</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-horizon-border/60">
                  {patients.content.map((p) => (
                    <tr key={p.id} className="hover:bg-horizon-card-hover/50">
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-horizon-accent">
                        {p.patientCode}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-horizon-text">{p.fullName}</p>
                        <p className="text-xs text-horizon-muted">{p.email || 'No email'}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-muted">
                        <p className="text-horizon-text">{formatDate(p.dateOfBirth)}</p>
                        <p>{p.gender}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-text">{p.phone}</td>
                      <td className="px-3 py-3">
                        <span className="rounded border border-horizon-border bg-horizon-bg px-2 py-0.5 text-xs font-semibold text-horizon-accent">
                          {p.bloodGroup}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-muted">
                        {p.bp || p.sugar ? `BP: ${p.bp || '-'} · Sugar: ${p.sugar || '-'}` : 'Not recorded'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openHistoryModal(p)}
                            title="View profile & history"
                            aria-label={`View ${p.fullName}`}
                            className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              title="Edit patient"
                              aria-label={`Edit ${p.fullName}`}
                              className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              title="Delete patient"
                              aria-label={`Delete ${p.fullName}`}
                              className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-red-500/60 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={patients.page}
              totalPages={patients.totalPages}
              totalElements={patients.totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPatient ? `Edit Patient · ${editingPatient.patientCode}` : 'Register New Patient'}
        subtitle="Complete demographics and baseline vitals."
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
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-red-400">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Date of Birth *</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.dateOfBirth && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Gender *</label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value as 'Male' | 'Female' | 'Other' })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Blood Group</label>
              <select
                value={form.bloodGroup}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Phone Number *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 90001 20001"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">Emergency Contact</label>
              <input
                type="text"
                value={form.emergencyContact}
                onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                placeholder="Name & phone"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-horizon-border bg-horizon-bg/50 p-3.5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-horizon-accent">
              <HeartPulse className="h-4 w-4" />
              <span>Triage Baseline Vitals (Optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-[11px] text-horizon-muted">Blood Pressure</label>
                <input
                  type="text"
                  value={form.bp}
                  onChange={(e) => setForm({ ...form, bp: e.target.value })}
                  placeholder="120/80"
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-horizon-muted">Blood Sugar</label>
                <input
                  type="text"
                  value={form.sugar}
                  onChange={(e) => setForm({ ...form, sugar: e.target.value })}
                  placeholder="96 mg/dL"
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-horizon-muted">Weight (kg)</label>
                <input
                  type="text"
                  value={form.weightKg}
                  onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                  placeholder="70"
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-horizon-muted">Height (cm)</label>
                <input
                  type="text"
                  value={form.heightCm}
                  onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                  placeholder="172"
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

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
              {saving ? 'Saving...' : editingPatient ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Patient Profile & Longitudinal History Modal */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyData ? `${historyData.patient.fullName} · ${historyData.patient.patientCode}` : 'Patient Profile'}
        subtitle="Demographics, appointments, clinical records, and billing history."
        maxWidthClass="max-w-4xl"
      >
        {historyLoading || !historyData ? (
          <p className="py-8 text-center text-sm text-horizon-muted">Loading longitudinal patient record...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-horizon-border bg-horizon-bg p-4 text-xs sm:grid-cols-4">
              <div>
                <span className="text-horizon-muted">Date of Birth</span>
                <p className="mt-0.5 font-semibold text-horizon-text">
                  {formatDate(historyData.patient.dateOfBirth)}
                </p>
              </div>
              <div>
                <span className="text-horizon-muted">Gender · Blood</span>
                <p className="mt-0.5 font-semibold text-horizon-text">
                  {historyData.patient.gender} · {historyData.patient.bloodGroup}
                </p>
              </div>
              <div>
                <span className="text-horizon-muted">Phone</span>
                <p className="mt-0.5 font-semibold text-horizon-text">{historyData.patient.phone}</p>
              </div>
              <div>
                <span className="text-horizon-muted">Vitals (BP / Sugar)</span>
                <p className="mt-0.5 font-semibold text-horizon-text">
                  {historyData.patient.bp || '—'} / {historyData.patient.sugar || '—'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-horizon-muted">Address</span>
                <p className="mt-0.5 text-horizon-text">{historyData.patient.address || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-horizon-muted">Emergency Contact</span>
                <p className="mt-0.5 text-horizon-text">{historyData.patient.emergencyContact || '—'}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-horizon-text">
                Appointments ({historyData.appointments.length})
              </h3>
              {historyData.appointments.length === 0 ? (
                <p className="text-xs text-horizon-muted">No appointments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {historyData.appointments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-horizon-border bg-horizon-bg/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-horizon-text">{a.appointmentCode}</span> ·{' '}
                        {formatDate(a.appointmentDate)} {a.appointmentTime} with {a.doctorName}
                        <p className="text-horizon-muted">{a.reason}</p>
                      </div>
                      <StatusBadge status={a.status} label={a.statusDisplay} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-horizon-text">
                Clinical Medical Records
              </h3>
              {!historyData.clinicalAccessGranted ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Clinical diagnoses and prescriptions are restricted to Doctors and Administrators.
                  </span>
                </div>
              ) : historyData.medicalRecords.length === 0 ? (
                <p className="text-xs text-horizon-muted">No medical records recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyData.medicalRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-lg border border-horizon-border bg-horizon-bg/60 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-horizon-accent">
                          {rec.recordCode} · {formatDate(rec.visitDate)}
                        </span>
                        <span className="text-horizon-muted">{rec.doctorName}</span>
                      </div>
                      <p className="mt-1 font-semibold text-horizon-text">
                        Diagnosis: {rec.diagnosis}
                      </p>
                      <p className="text-horizon-muted">Treatment: {rec.treatment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-horizon-text">
                Invoices & Billing ({historyData.bills.length})
              </h3>
              {historyData.bills.length === 0 ? (
                <p className="text-xs text-horizon-muted">No invoices issued.</p>
              ) : (
                <div className="space-y-2">
                  {historyData.bills.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-horizon-border bg-horizon-bg/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-horizon-text">{b.invoiceNumber}</span> · Total{' '}
                        {formatCurrency(b.totalAmount, currency)} · Balance{' '}
                        {formatCurrency(b.balanceDue, currency)}
                      </div>
                      <StatusBadge status={b.paymentStatus} label={b.paymentStatusDisplay} />
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
        title="Delete Patient Record"
        message={`Are you sure you want to permanently remove ${deleteTarget?.fullName} (${deleteTarget?.patientCode})? Records linked to appointments or invoices are protected.`}
        confirmLabel="Delete Patient"
        loading={deleting}
      />
    </section>
  );
};
