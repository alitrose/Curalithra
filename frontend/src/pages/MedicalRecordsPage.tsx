import React, { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest, buildQueryString } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Appointment,
  Doctor,
  MedicalRecord,
  MedicalRecordRequest,
  PagedResponse,
  Patient,
  PrescriptionRequest,
} from '../types/api';
import { formatDate, todayIsoDate } from '../utils/format';

const EMPTY_RX: PrescriptionRequest = {
  medicationName: '',
  dosage: '',
  frequency: '',
  durationDays: 5,
  instructions: '',
  status: 'ACTIVE',
};

export const MedicalRecordsPage: React.FC = () => {
  const { user, hasPermission, settings } = useAuth();
  const { pushToast } = useToast();
  const isDemo = Boolean(user?.demoUser);
  const canEdit = hasPermission('EDIT_MEDICAL_RECORDS');

  const [records, setRecords] = useState<PagedResponse<MedicalRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [page, setPage] = useState(0);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [form, setForm] = useState<MedicalRecordRequest>({
    patientId: 0,
    doctorId: 0,
    appointmentId: null,
    visitDate: todayIsoDate(),
    symptoms: '',
    diagnosis: '',
    treatment: '',
    vitalsBp: '',
    vitalsTemp: '',
    notes: '',
    prescriptions: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [detailRecord, setDetailRecord] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<PagedResponse<Patient>>('/patients?size=100&sortBy=fullName&sortDir=asc'),
      apiRequest<PagedResponse<Doctor>>('/doctors?size=100&sortBy=fullName&sortDir=asc'),
    ])
      .then(([p, d]) => {
        setPatients(p.content);
        setDoctors(d.content);
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        query: query.trim(),
        patientId: patientFilter,
        page,
        size: 10,
      });
      const res = await apiRequest<PagedResponse<MedicalRecord>>(`/medical-records${qs}`);
      setRecords(res);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load medical records',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [query, patientFilter, page, pushToast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!formOpen || !form.patientId) {
      setPatientAppointments([]);
      return;
    }
    apiRequest<PagedResponse<Appointment>>(`/appointments?patientId=${form.patientId}&size=50`)
      .then((res) => setPatientAppointments(res.content))
      .catch(() => setPatientAppointments([]));
  }, [formOpen, form.patientId]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setForm({
      patientId: patients[0]?.id || 0,
      doctorId: doctors[0]?.id || 0,
      appointmentId: null,
      visitDate: todayIsoDate(),
      symptoms: '',
      diagnosis: '',
      treatment: '',
      vitalsBp: '',
      vitalsTemp: '',
      notes: '',
      prescriptions: [],
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditModal = (rec: MedicalRecord) => {
    setEditingRecord(rec);
    setForm({
      patientId: rec.patientId,
      doctorId: rec.doctorId,
      appointmentId: rec.appointmentId,
      visitDate: rec.visitDate,
      symptoms: rec.symptoms,
      diagnosis: rec.diagnosis,
      treatment: rec.treatment,
      vitalsBp: rec.vitalsBp || '',
      vitalsTemp: rec.vitalsTemp || '',
      notes: rec.notes || '',
      prescriptions: rec.prescriptions.map((rx) => ({
        medicationName: rx.medicationName,
        dosage: rx.dosage,
        frequency: rx.frequency,
        durationDays: rx.durationDays,
        instructions: rx.instructions || '',
        status: rx.status,
      })),
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const addPrescriptionRow = () => {
    setForm((prev) => ({
      ...prev,
      prescriptions: [...prev.prescriptions, { ...EMPTY_RX }],
    }));
  };

  const updatePrescriptionRow = (
    idx: number,
    patch: Partial<PrescriptionRequest>
  ) => {
    setForm((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.map((item, i) =>
        i === idx ? { ...item, ...patch } : item
      ),
    }));
  };

  const removePrescriptionRow = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errs: Record<string, string> = {};
    if (!form.patientId) errs.patientId = 'Patient is required.';
    if (!form.doctorId) errs.doctorId = 'Attending doctor is required.';
    if (!form.visitDate) errs.visitDate = 'Visit date is required.';
    if (!form.symptoms.trim()) errs.symptoms = 'Presenting symptoms are required.';
    if (!form.diagnosis.trim()) errs.diagnosis = 'Clinical diagnosis is required.';
    if (!form.treatment.trim()) errs.treatment = 'Treatment plan is required.';
    if (
      form.prescriptions.some(
        (rx) =>
          !rx.medicationName.trim() ||
          !rx.dosage.trim() ||
          !rx.frequency.trim() ||
          rx.durationDays < 1
      )
    ) {
      errs.prescriptions =
        'All attached prescriptions must include medication name, dosage, frequency, and duration.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await apiRequest<MedicalRecord>(`/medical-records/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Clinical Record Updated', `${editingRecord.recordCode} saved.`);
      } else {
        const created = await apiRequest<MedicalRecord>('/medical-records', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        pushToast('success', 'Medical Record Created', `${created.recordCode} saved.`);
      }
      setFormOpen(false);
      fetchRecords();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Unable to save medical record.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Electronic Medical Records (Role-Restricted)
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Clinical Records & Assessments
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={isDemo}
            onClick={openCreateModal}
            title={
              isDemo
                ? 'Creating medical records is disabled in Read-Only Public Demo Mode'
                : 'New Clinical Record'
            }
            className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-horizon-accent"
          >
            <Plus className="h-4 w-4" />
            <span>New Clinical Record</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-7">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by REC code, patient, diagnosis, or symptoms..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-5">
          <select
            aria-label="Filter by patient"
            value={patientFilter}
            onChange={(e) => {
              setPatientFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Patients</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.patientCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-horizon-border bg-horizon-card p-4 shadow-horizon">
        {loading ? (
          <p className="py-10 text-center text-sm text-horizon-muted">Loading clinical records...</p>
        ) : !records || records.content.length === 0 ? (
          <EmptyState
            title="No clinical records found"
            description="Adjust search filters or create a new patient consultation assessment."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                    <th className="px-3 py-3">Record</th>
                    <th className="px-3 py-3">Visit Date</th>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Attending Doctor</th>
                    <th className="px-3 py-3">Diagnosis</th>
                    <th className="px-3 py-3">Rx Count</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-horizon-border/60">
                  {records.content.map((rec) => (
                    <tr key={rec.id} className="hover:bg-horizon-card-hover/50">
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-horizon-accent">
                        {rec.recordCode}
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-text">
                        {formatDate(rec.visitDate)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-horizon-text">{rec.patientName}</p>
                        <p className="text-xs text-horizon-muted">{rec.patientCode}</p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="text-horizon-text">{rec.doctorName}</p>
                        <p className="text-horizon-muted">{rec.doctorSpecialization}</p>
                      </td>
                      <td className="max-w-xs truncate px-3 py-3 text-xs font-medium text-horizon-text">
                        {rec.diagnosis}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-horizon-border bg-horizon-bg px-2 py-0.5 text-xs text-horizon-accent">
                          {rec.prescriptions.length} Rx
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailRecord(rec)}
                            title="View clinical note"
                            aria-label={`View ${rec.recordCode}`}
                            className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              disabled={isDemo}
                              onClick={() => openEditModal(rec)}
                              title={
                                isDemo
                                  ? 'Editing clinical records is disabled in Read-Only Public Demo Mode'
                                  : 'Edit clinical record'
                              }
                              aria-label={`Edit ${rec.recordCode}`}
                              className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
                            >
                              <Pencil className="h-4 w-4" />
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
              page={records.page}
              totalPages={records.totalPages}
              totalElements={records.totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingRecord
            ? `Edit Clinical Record · ${editingRecord.recordCode}`
            : 'Create Medical Record'
        }
        subtitle="Record clinical SOAP findings and attached prescriptions."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
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
                onChange={(e) =>
                  setForm({ ...form, patientId: Number(e.target.value), appointmentId: null })
                }
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
              <label className="block text-xs font-semibold text-horizon-muted">
                Attending Doctor *
              </label>
              <select
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value={0}>Select doctor...</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.specialization})
                  </option>
                ))}
              </select>
              {fieldErrors.doctorId && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.doctorId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Visit Date *</label>
              <input
                type="date"
                value={form.visitDate}
                onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.visitDate && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.visitDate}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Linked Appointment (Optional)
              </label>
              <select
                value={form.appointmentId ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    appointmentId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="">None / Walk-in Consultation</option>
                {patientAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.appointmentCode} · {a.appointmentDate} {a.appointmentTime} ({a.doctorName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Blood Pressure (Vitals)
              </label>
              <input
                type="text"
                value={form.vitalsBp}
                onChange={(e) => setForm({ ...form, vitalsBp: e.target.value })}
                placeholder="120/80"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Temperature (Vitals)
              </label>
              <input
                type="text"
                value={form.vitalsTemp}
                onChange={(e) => setForm({ ...form, vitalsTemp: e.target.value })}
                placeholder="98.6 F"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Presenting Symptoms *
              </label>
              <textarea
                rows={2}
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.symptoms && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.symptoms}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">Diagnosis *</label>
              <textarea
                rows={2}
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.diagnosis && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.diagnosis}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Treatment Plan *
              </label>
              <textarea
                rows={2}
                value={form.treatment}
                onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.treatment && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.treatment}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Physician Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Inline Prescriptions */}
          <div className="rounded-xl border border-horizon-border bg-horizon-bg/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-horizon-accent">
                  Attached Prescriptions ({form.prescriptions.length})
                </p>
                <p className="text-[11px] text-horizon-muted">
                  Medications ordered as part of this clinical visit.
                </p>
              </div>
              <button
                type="button"
                onClick={addPrescriptionRow}
                className="inline-flex items-center gap-1 rounded-lg border border-horizon-emerald bg-horizon-emerald/20 px-3 py-1.5 text-xs font-semibold text-horizon-accent hover:bg-horizon-emerald/30"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Medication</span>
              </button>
            </div>

            {fieldErrors.prescriptions && (
              <p className="mb-2 text-xs text-red-400">{fieldErrors.prescriptions}</p>
            )}

            {form.prescriptions.length === 0 ? (
              <p className="text-xs text-horizon-muted">No medications attached.</p>
            ) : (
              <div className="space-y-3">
                {form.prescriptions.map((rx, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-horizon-border bg-horizon-card p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="Medication name *"
                        value={rx.medicationName}
                        onChange={(e) =>
                          updatePrescriptionRow(idx, { medicationName: e.target.value })
                        }
                        className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Dosage (e.g. 500mg)"
                        value={rx.dosage}
                        onChange={(e) => updatePrescriptionRow(idx, { dosage: e.target.value })}
                        className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Frequency (e.g. Twice daily)"
                        value={rx.frequency}
                        onChange={(e) =>
                          updatePrescriptionRow(idx, { frequency: e.target.value })
                        }
                        className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Days"
                        value={rx.durationDays}
                        onChange={(e) =>
                          updatePrescriptionRow(idx, {
                            durationDays: Number(e.target.value) || 1,
                          })
                        }
                        className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => removePrescriptionRow(idx)}
                        aria-label="Remove medication"
                        className="rounded border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-red-500/50 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="sm:col-span-12">
                      <input
                        type="text"
                        placeholder="Instructions (e.g. Take after meals)"
                        value={rx.instructions}
                        onChange={(e) =>
                          updatePrescriptionRow(idx, { instructions: e.target.value })
                        }
                        className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              {saving ? 'Saving...' : editingRecord ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Clinical Note Modal */}
      <Modal
        open={Boolean(detailRecord)}
        onClose={() => setDetailRecord(null)}
        title={detailRecord ? `Clinical Assessment · ${detailRecord.recordCode}` : 'Medical Record'}
        maxWidthClass="max-w-3xl"
      >
        {detailRecord && (
          <div className="space-y-4">
            <div className="print-sheet space-y-4 rounded-xl border border-horizon-border bg-horizon-bg p-5 text-xs">
              <div className="flex items-start justify-between border-b border-horizon-border pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-horizon-text">
                    {settings?.hospitalName || 'CURALITHRA Medical Center'}
                  </h3>
                  <p className="text-horizon-muted">
                    Electronic Clinical Note · {detailRecord.recordCode}
                  </p>
                </div>
                <span className="text-horizon-muted">Visit: {formatDate(detailRecord.visitDate)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-horizon-muted">Patient</span>
                  <p className="font-semibold text-horizon-text">
                    {detailRecord.patientName} ({detailRecord.patientCode})
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">Attending Physician</span>
                  <p className="font-semibold text-horizon-text">
                    {detailRecord.doctorName} — {detailRecord.doctorSpecialization}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">BP / Temperature</span>
                  <p className="font-semibold text-horizon-text">
                    {detailRecord.vitalsBp || '—'} / {detailRecord.vitalsTemp || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">Linked Appointment</span>
                  <p className="font-semibold text-horizon-text">
                    {detailRecord.appointmentCode || 'Walk-in / Direct Assessment'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-horizon-border pt-3">
                <div>
                  <span className="font-semibold text-horizon-accent">Symptoms</span>
                  <p className="mt-0.5 text-horizon-text">{detailRecord.symptoms}</p>
                </div>
                <div>
                  <span className="font-semibold text-horizon-accent">Diagnosis</span>
                  <p className="mt-0.5 text-horizon-text">{detailRecord.diagnosis}</p>
                </div>
                <div>
                  <span className="font-semibold text-horizon-accent">Treatment Plan</span>
                  <p className="mt-0.5 text-horizon-text">{detailRecord.treatment}</p>
                </div>
                {detailRecord.notes && (
                  <div>
                    <span className="font-semibold text-horizon-accent">Doctor Notes</span>
                    <p className="mt-0.5 text-horizon-muted">{detailRecord.notes}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-horizon-border pt-3">
                <p className="mb-2 flex items-center gap-1.5 font-semibold text-horizon-accent">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Prescriptions ({detailRecord.prescriptions.length})</span>
                </p>
                {detailRecord.prescriptions.length === 0 ? (
                  <p className="text-horizon-muted">No prescriptions issued for this visit.</p>
                ) : (
                  <div className="space-y-2">
                    {detailRecord.prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="flex items-center justify-between rounded-lg border border-horizon-border bg-horizon-card px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-horizon-text">
                            {rx.medicationName} ({rx.dosage})
                          </p>
                          <p className="text-horizon-muted">
                            {rx.frequency} for {rx.durationDays} days
                            {rx.instructions ? ` · ${rx.instructions}` : ''}
                          </p>
                        </div>
                        <StatusBadge status={rx.status} label={rx.statusDisplay} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg border border-horizon-border bg-horizon-bg px-4 py-2 text-xs font-semibold text-horizon-text hover:border-horizon-emerald"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Clinical Note</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
