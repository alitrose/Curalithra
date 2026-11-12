import React, { useCallback, useEffect, useState } from 'react';
import { Pill, Plus, Printer, Search } from 'lucide-react';
import { ApiRequestError, apiRequest, buildQueryString } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Doctor,
  MedicalRecord,
  PagedResponse,
  Patient,
  Prescription,
  PrescriptionStatus,
  StandalonePrescriptionRequest,
} from '../types/api';
import { formatDate, formatDateTime } from '../utils/format';

export const PrescriptionsPage: React.FC = () => {
  const { user, hasPermission, settings } = useAuth();
  const { pushToast } = useToast();
  const isDemo = Boolean(user?.demoUser);
  const canEdit = hasPermission('EDIT_MEDICAL_RECORDS');

  const [prescriptions, setPrescriptions] = useState<PagedResponse<Prescription> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatus | ''>('');
  const [patientFilter, setPatientFilter] = useState('');
  const [page, setPage] = useState(0);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);

  // Create modal
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StandalonePrescriptionRequest>({
    patientId: 0,
    doctorId: 0,
    medicalRecordId: null,
    medicationName: '',
    dosage: '',
    frequency: '',
    durationDays: 5,
    instructions: '',
    status: 'ACTIVE',
    clinicalContext: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Printable Rx modal
  const [printRx, setPrintRx] = useState<Prescription | null>(null);

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

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        query: query.trim(),
        status: statusFilter,
        patientId: patientFilter,
        page,
        size: 10,
      });
      const res = await apiRequest<PagedResponse<Prescription>>(`/prescriptions${qs}`);
      setPrescriptions(res);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load prescriptions',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, patientFilter, page, pushToast]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  useEffect(() => {
    if (!formOpen || !form.patientId) {
      setPatientRecords([]);
      return;
    }
    apiRequest<PagedResponse<MedicalRecord>>(`/medical-records?patientId=${form.patientId}&size=50`)
      .then((res) => setPatientRecords(res.content))
      .catch(() => setPatientRecords([]));
  }, [formOpen, form.patientId]);

  const openCreateModal = () => {
    setForm({
      patientId: patients[0]?.id || 0,
      doctorId: doctors[0]?.id || 0,
      medicalRecordId: null,
      medicationName: '',
      dosage: '',
      frequency: '',
      durationDays: 5,
      instructions: '',
      status: 'ACTIVE',
      clinicalContext: '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!form.patientId) errs.patientId = 'Patient is required.';
    if (!form.doctorId) errs.doctorId = 'Prescribing doctor is required.';
    if (!form.medicationName.trim()) errs.medicationName = 'Medication name is required.';
    if (!form.dosage.trim()) errs.dosage = 'Dosage is required.';
    if (!form.frequency.trim()) errs.frequency = 'Frequency is required.';
    if (form.durationDays < 1) errs.durationDays = 'Duration must be at least 1 day.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest<Prescription>('/prescriptions', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      pushToast(
        'success',
        'Prescription Issued',
        `${created.medicationName} ordered for ${created.patientName}.`
      );
      setFormOpen(false);
      fetchPrescriptions();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Unable to issue prescription.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (rx: Prescription, status: PrescriptionStatus) => {
    try {
      await apiRequest<Prescription>(`/prescriptions/${rx.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      pushToast('success', 'Prescription Updated', `${rx.medicationName} marked ${status}.`);
      fetchPrescriptions();
    } catch (err) {
      pushToast(
        'error',
        'Failed to update prescription',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Pharmacotherapy & Dispensing Registry
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Prescriptions
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={isDemo}
            onClick={openCreateModal}
            title={
              isDemo
                ? 'Issuing prescriptions is disabled in Read-Only Public Demo Mode'
                : 'Issue Prescription'
            }
            className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-horizon-accent"
          >
            <Plus className="h-4 w-4" />
            <span>Issue Prescription</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-5">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search medication, patient, doctor, or record code..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PrescriptionStatus | '');
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISPENSED">Dispensed</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="sm:col-span-4">
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
          <p className="py-10 text-center text-sm text-horizon-muted">Loading prescriptions...</p>
        ) : !prescriptions || prescriptions.content.length === 0 ? (
          <EmptyState
            title="No prescriptions found"
            description="Adjust search filters or issue a new prescription."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                    <th className="px-3 py-3">Medication</th>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Prescriber</th>
                    <th className="px-3 py-3">Regimen</th>
                    <th className="px-3 py-3">Record</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-horizon-border/60">
                  {prescriptions.content.map((rx) => (
                    <tr key={rx.id} className="hover:bg-horizon-card-hover/50">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-horizon-text">{rx.medicationName}</p>
                        <p className="text-xs text-horizon-muted">{rx.dosage}</p>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-horizon-text">
                        {rx.patientName}
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-muted">{rx.doctorName}</td>
                      <td className="px-3 py-3 text-xs">
                        <p className="text-horizon-text">
                          {rx.frequency} · {rx.durationDays} days
                        </p>
                        {rx.instructions && (
                          <p className="text-horizon-muted">{rx.instructions}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-horizon-accent">
                        {rx.recordCode}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={rx.status} label={rx.statusDisplay} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrintRx(rx)}
                            title="View & Print Prescription"
                            aria-label={`Print ${rx.medicationName}`}
                            className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {canEdit && rx.status === 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={isDemo}
                              onClick={() => handleStatusUpdate(rx, 'DISPENSED')}
                              title={
                                isDemo
                                  ? 'Updating prescription status is disabled in Read-Only Public Demo Mode'
                                  : 'Mark as dispensed'
                              }
                              className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border"
                            >
                              Dispense
                            </button>
                          )}
                          {canEdit && rx.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              disabled={isDemo}
                              onClick={() => handleStatusUpdate(rx, 'COMPLETED')}
                              title={
                                isDemo
                                  ? 'Updating prescription status is disabled in Read-Only Public Demo Mode'
                                  : 'Mark as completed'
                              }
                              className="rounded-lg border border-horizon-border bg-horizon-bg px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border"
                            >
                              Complete
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
              page={prescriptions.page}
              totalPages={prescriptions.totalPages}
              totalElements={prescriptions.totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Create Prescription Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Issue Prescription"
        subtitle="Attach to an existing medical record or create an outpatient prescription order."
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
                  setForm({ ...form, patientId: Number(e.target.value), medicalRecordId: null })
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
                Prescribing Doctor *
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

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">
                Linked Clinical Record (Optional)
              </label>
              <select
                value={form.medicalRecordId ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    medicalRecordId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="">Create new outpatient clinical entry automatically</option>
                {patientRecords.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {rec.recordCode} · {formatDate(rec.visitDate)} — {rec.diagnosis}
                  </option>
                ))}
              </select>
            </div>

            {!form.medicalRecordId && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-horizon-muted">
                  Clinical Context / Indication
                </label>
                <input
                  type="text"
                  value={form.clinicalContext || ''}
                  onChange={(e) => setForm({ ...form, clinicalContext: e.target.value })}
                  placeholder="e.g. Acute bronchitis follow-up consultation"
                  className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Medication Name *
              </label>
              <input
                type="text"
                value={form.medicationName}
                onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
                placeholder="e.g. Amoxicillin Clavulanate"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.medicationName && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.medicationName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Dosage *</label>
              <input
                type="text"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder="e.g. 625 mg"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.dosage && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.dosage}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Frequency *</label>
              <input
                type="text"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder="e.g. Twice daily (BD)"
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.frequency && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.frequency}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Duration (Days) *
              </label>
              <input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) =>
                  setForm({ ...form, durationDays: Number(e.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
              {fieldErrors.durationDays && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.durationDays}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-horizon-muted">Instructions</label>
              <textarea
                rows={2}
                value={form.instructions || ''}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Take after food with water. Complete the full antibiotic course."
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
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
              {saving ? 'Issuing...' : 'Issue Prescription'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Prescription Modal */}
      <Modal
        open={Boolean(printRx)}
        onClose={() => setPrintRx(null)}
        title="Printable Prescription Sheet"
      >
        {printRx && (
          <div className="space-y-4">
            <div className="print-sheet space-y-4 rounded-xl border border-horizon-border bg-horizon-bg p-6 text-xs">
              <div className="flex items-start justify-between border-b border-horizon-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-horizon-accent">
                    <Pill className="h-5 w-5" />
                    <h3 className="font-display text-lg font-bold text-horizon-text">
                      {settings?.hospitalName || 'CURALITHRA Medical Center'}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-horizon-muted">
                    {settings?.address || 'Digital Healthcare Campus'} ·{' '}
                    {settings?.supportPhone || ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-horizon-accent">{printRx.recordCode}</p>
                  <p className="text-horizon-muted">{formatDateTime(printRx.prescribedAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-horizon-border pb-4">
                <div>
                  <span className="text-horizon-muted">Patient Name</span>
                  <p className="text-sm font-bold text-horizon-text">{printRx.patientName}</p>
                </div>
                <div>
                  <span className="text-horizon-muted">Prescribing Physician</span>
                  <p className="text-sm font-bold text-horizon-text">{printRx.doctorName}</p>
                </div>
              </div>

              <div className="rounded-xl border border-horizon-border bg-horizon-card p-4">
                <p className="font-display text-lg font-bold text-horizon-accent">
                  Rx: {printRx.medicationName} — {printRx.dosage}
                </p>
                <p className="mt-2 text-sm text-horizon-text">
                  Sig: {printRx.frequency} for {printRx.durationDays} days
                </p>
                {printRx.instructions && (
                  <p className="mt-2 text-horizon-muted">
                    Patient Instructions: {printRx.instructions}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 text-[11px] text-horizon-muted">
                <span>Status: {printRx.statusDisplay}</span>
                <span>Authorized Electronic Signature · {printRx.doctorName}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2 text-xs font-bold text-horizon-nav hover:bg-horizon-accent-hover"
              >
                <Printer className="h-4 w-4" />
                <span>Print Prescription</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
