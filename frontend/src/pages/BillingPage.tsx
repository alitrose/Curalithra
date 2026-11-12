import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CreditCard,
  Download,
  Eye,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { ApiRequestError, apiDownloadBlob, apiRequest, buildQueryString } from '../api/client';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Appointment,
  Bill,
  BillItemRequest,
  BillingPageResponse,
  CreateBillRequest,
  PagedResponse,
  Patient,
  PaymentMethod,
  PaymentStatus,
  RecordPaymentRequest,
} from '../types/api';
import { formatCurrency, formatDateTime } from '../utils/format';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Debit / Credit Card' },
  { value: 'UPI', label: 'UPI / Instant Pay' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'INSURANCE', label: 'Insurance Claim' },
];

const CATEGORIES = ['Consultation', 'Diagnostics', 'Procedure', 'Pharmacy', 'Hospitalization', 'General'];

export const BillingPage: React.FC = () => {
  const { user, hasPermission, settings } = useAuth();
  const { pushToast } = useToast();

  const isDemo = Boolean(user?.demoUser);
  const canManage = hasPermission('MANAGE_BILLING');
  const canDelete = hasPermission('DELETE_BILLING');
  const currency = settings?.currencySymbol || '₹';
  const defaultTax = settings?.defaultTaxRate ?? 0.05;

  const [billingData, setBillingData] = useState<BillingPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

  // Create invoice modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateBillRequest>({
    patientId: 0,
    appointmentId: null,
    items: [{ description: 'Specialist Consultation', category: 'Consultation', quantity: 1, unitPrice: 800 }],
    taxRate: defaultTax,
    initialPaymentAmount: 0,
    paymentMethod: 'CASH',
    referenceNo: '',
    notes: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingBill, setSavingBill] = useState(false);

  // Invoice detail & payment modal
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState<RecordPaymentRequest>({
    amount: 0,
    paymentMethod: 'CARD',
    referenceNo: '',
  });
  const [payError, setPayError] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Confirmations
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    apiRequest<PagedResponse<Patient>>('/patients?size=100&sortBy=fullName&sortDir=asc')
      .then((res) => setPatients(res.content))
      .catch(() => {});
  }, []);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        query: query.trim(),
        status: statusFilter,
        fromDate,
        toDate,
        page,
        size: 10,
      });
      const res = await apiRequest<BillingPageResponse>(`/billing${qs}`);
      setBillingData(res);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load billing records',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, fromDate, toDate, page, pushToast]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useEffect(() => {
    if (!createOpen || !createForm.patientId) {
      setPatientAppointments([]);
      return;
    }
    apiRequest<PagedResponse<Appointment>>(`/appointments?patientId=${createForm.patientId}&size=50`)
      .then((res) => setPatientAppointments(res.content))
      .catch(() => setPatientAppointments([]));
  }, [createOpen, createForm.patientId]);

  const livePreview = useMemo(() => {
    const subtotal = createForm.items.reduce(
      (sum, item) => sum + Math.round((item.quantity || 0) * (item.unitPrice || 0) * 100) / 100,
      0
    );
    const rate = createForm.taxRate ?? defaultTax;
    const taxAmount = Math.round(subtotal * rate * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    return { subtotal, taxAmount, total };
  }, [createForm.items, createForm.taxRate, defaultTax]);

  const openCreateModal = () => {
    setCreateForm({
      patientId: patients[0]?.id || 0,
      appointmentId: null,
      items: [
        {
          description: 'Specialist Consultation',
          category: 'Consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
      taxRate: settings?.defaultTaxRate ?? 0.05,
      initialPaymentAmount: 0,
      paymentMethod: 'CASH',
      referenceNo: '',
      notes: '',
    });
    setCreateError(null);
    setCreateOpen(true);
  };

  const openDetailModal = (bill: Bill) => {
    setSelectedBill(bill);
    setPayForm({
      amount: bill.balanceDue,
      paymentMethod: 'CARD',
      referenceNo: '',
    });
    setPayError(null);
  };

  const addItem = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { description: '', category: 'General', quantity: 1, unitPrice: 0 },
      ],
    }));
  };

  const updateItem = (idx: number, patch: Partial<BillItemRequest>) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (idx: number) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.patientId) {
      setCreateError('Please select a patient.');
      return;
    }
    if (createForm.items.length === 0) {
      setCreateError('At least one line item is required.');
      return;
    }
    if (createForm.items.some((i) => !i.description.trim() || i.quantity < 1 || i.unitPrice < 0)) {
      setCreateError('Every line item requires a description, quantity >= 1, and non-negative unit price.');
      return;
    }
    if ((createForm.initialPaymentAmount || 0) > livePreview.total) {
      setCreateError('Initial payment cannot exceed calculated invoice total.');
      return;
    }

    setSavingBill(true);
    try {
      const created = await apiRequest<Bill>('/billing', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      pushToast('success', 'Invoice Issued', `${created.invoiceNumber} created.`);
      setCreateOpen(false);
      fetchBills();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create invoice.');
    } finally {
      setSavingBill(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    setPayError(null);
    if (payForm.amount <= 0) {
      setPayError('Payment amount must be greater than 0.');
      return;
    }
    if (payForm.amount > selectedBill.balanceDue) {
      setPayError(`Payment exceeds outstanding balance due (${formatCurrency(selectedBill.balanceDue, currency)}).`);
      return;
    }

    setRecordingPayment(true);
    try {
      const updated = await apiRequest<Bill>(`/billing/${selectedBill.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(payForm),
      });
      setSelectedBill(updated);
      setPayForm({ amount: updated.balanceDue, paymentMethod: 'CARD', referenceNo: '' });
      pushToast('success', 'Payment Recorded', `${updated.invoiceNumber} updated.`);
      fetchBills();
    } catch (err) {
      setPayError(
        err instanceof ApiRequestError ? err.message : 'Unable to record payment.'
      );
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDownloadPdf = async (bill: Bill) => {
    try {
      await apiDownloadBlob(`/billing/${bill.id}/pdf`, `CURALITHRA-${bill.invoiceNumber}.pdf`);
      pushToast('success', 'PDF Downloaded', `${bill.invoiceNumber}.pdf saved.`);
    } catch (err) {
      pushToast(
        'error',
        'PDF Download Failed',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setConfirmBusy(true);
    try {
      const updated = await apiRequest<Bill>(`/billing/${cancelTarget.id}/cancel`, {
        method: 'POST',
      });
      pushToast('success', 'Invoice Cancelled', `${updated.invoiceNumber} cancelled.`);
      setCancelTarget(null);
      if (selectedBill?.id === updated.id) setSelectedBill(updated);
      fetchBills();
    } catch (err) {
      pushToast(
        'error',
        'Cannot Cancel Invoice',
        err instanceof Error ? err.message : undefined
      );
      setCancelTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setConfirmBusy(true);
    try {
      await apiRequest<void>(`/billing/${deleteTarget.id}`, { method: 'DELETE' });
      pushToast('success', 'Invoice Deleted', `${deleteTarget.invoiceNumber} deleted.`);
      setDeleteTarget(null);
      if (selectedBill?.id === deleteTarget.id) setSelectedBill(null);
      fetchBills();
    } catch (err) {
      pushToast(
        'error',
        'Delete Failed',
        err instanceof Error ? err.message : undefined
      );
      setDeleteTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            BigDecimal Ledger, Payments & PDF Invoices
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Billing & Revenue
          </h1>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={isDemo}
            onClick={openCreateModal}
            title={
              isDemo
                ? 'Creating invoices is disabled in Read-Only Public Demo Mode'
                : 'Create Invoice'
            }
            className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2.5 text-sm font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-horizon-accent"
          >
            <Plus className="h-4 w-4" />
            <span>Create Invoice</span>
          </button>
        )}
      </div>

      {/* Revenue Summary */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
          <p className="text-xs font-semibold uppercase tracking-wider text-horizon-muted">
            Total Billed (Active Invoices)
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-horizon-text">
            {formatCurrency(billingData?.totalBilled, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
          <p className="text-xs font-semibold uppercase tracking-wider text-horizon-muted">
            Total Collected
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-horizon-accent">
            {formatCurrency(billingData?.totalCollected, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
          <p className="text-xs font-semibold uppercase tracking-wider text-horizon-muted">
            Outstanding Balance Due
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-amber-300">
            {formatCurrency(billingData?.outstandingBalance, currency)}
          </p>
        </div>
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
            placeholder="Search INV number, patient name, or patient code..."
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text placeholder:text-horizon-muted/60 focus:border-horizon-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            aria-label="Filter by payment status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PaymentStatus | '');
              setPage(0);
            }}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            <option value="">All Payment Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
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

      {/* Invoices Table */}
      <div className="rounded-xl border border-horizon-border bg-horizon-card p-4 shadow-horizon">
        {loading ? (
          <p className="py-10 text-center text-sm text-horizon-muted">Loading billing ledger...</p>
        ) : !billingData || billingData.page.content.length === 0 ? (
          <EmptyState
            title="No invoices found"
            description="Adjust search filters or issue a new itemized invoice."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-horizon-border text-xs uppercase tracking-wider text-horizon-muted">
                    <th className="px-3 py-3">Invoice</th>
                    <th className="px-3 py-3">Issued</th>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Paid</th>
                    <th className="px-3 py-3">Balance</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-horizon-border/60">
                  {billingData.page.content.map((b) => (
                    <tr key={b.id} className="hover:bg-horizon-card-hover/50">
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-horizon-accent">
                        {b.invoiceNumber}
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-muted">
                        {formatDateTime(b.issuedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-horizon-text">{b.patientName}</p>
                        <p className="text-xs text-horizon-muted">{b.patientCode}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-horizon-text">
                        {formatCurrency(b.totalAmount, currency)}
                      </td>
                      <td className="px-3 py-3 text-xs text-horizon-accent">
                        {formatCurrency(b.paidAmount, currency)}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-amber-300">
                        {formatCurrency(b.balanceDue, currency)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.paymentStatus} label={b.paymentStatusDisplay} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetailModal(b)}
                            title="View invoice & record payment"
                            aria-label={`View ${b.invoiceNumber}`}
                            className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(b)}
                            title="Download PDF invoice"
                            aria-label={`Download PDF ${b.invoiceNumber}`}
                            className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-horizon-emerald hover:text-horizon-accent"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {canManage && b.paymentStatus !== 'CANCELLED' && b.paidAmount === 0 && (
                            <button
                              type="button"
                              disabled={isDemo}
                              onClick={() => setCancelTarget(b)}
                              title={
                                isDemo
                                  ? 'Cancelling invoices is disabled in Read-Only Public Demo Mode'
                                  : 'Cancel invoice'
                              }
                              aria-label={`Cancel ${b.invoiceNumber}`}
                              className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-amber-500/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={isDemo}
                              onClick={() => setDeleteTarget(b)}
                              title={
                                isDemo
                                  ? 'Deleting invoices is disabled in Read-Only Public Demo Mode'
                                  : 'Delete invoice'
                              }
                              aria-label={`Delete ${b.invoiceNumber}`}
                              className="rounded-lg border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-red-500/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-horizon-border disabled:hover:text-horizon-muted"
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
              page={billingData.page.page}
              totalPages={billingData.page.totalPages}
              totalElements={billingData.page.totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Itemized Invoice"
        subtitle="Totals and taxes are computed server-side using high-precision BigDecimal arithmetic."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreateBill} noValidate className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">Patient *</label>
              <select
                value={createForm.patientId}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    patientId: Number(e.target.value),
                    appointmentId: null,
                  })
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Linked Appointment (Optional)
              </label>
              <select
                value={createForm.appointmentId ?? ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    appointmentId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                <option value="">None / Outpatient Charge</option>
                {patientAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.appointmentCode} · {a.appointmentDate} ({a.doctorName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-horizon-border bg-horizon-bg/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-horizon-accent">
                Line Items
              </p>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-lg border border-horizon-emerald bg-horizon-emerald/20 px-3 py-1 text-xs font-semibold text-horizon-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {createForm.items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-horizon-border bg-horizon-card p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      placeholder="Service description *"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(idx, { category: e.target.value })}
                      className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                      className="w-full rounded border border-horizon-border bg-horizon-bg px-2 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full rounded border border-horizon-border bg-horizon-bg px-2.5 py-1.5 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end sm:col-span-1">
                    <button
                      type="button"
                      disabled={createForm.items.length <= 1}
                      onClick={() => removeItem(idx)}
                      aria-label="Remove item"
                      className="rounded border border-horizon-border bg-horizon-bg p-1.5 text-horizon-muted hover:border-red-500/50 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Tax Rate (decimal, 0.05 = 5%)
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step="0.005"
                value={createForm.taxRate ?? defaultTax}
                onChange={(e) =>
                  setCreateForm({ ...createForm, taxRate: Number(e.target.value) || 0 })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Initial Payment ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={createForm.initialPaymentAmount ?? 0}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    initialPaymentAmount: Number(e.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Payment Method
              </label>
              <select
                value={createForm.paymentMethod || 'CASH'}
                onChange={(e) =>
                  setCreateForm({ ...createForm, paymentMethod: e.target.value as PaymentMethod })
                }
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-horizon-muted">
                Payment Reference
              </label>
              <input
                type="text"
                value={createForm.referenceNo || ''}
                onChange={(e) => setCreateForm({ ...createForm, referenceNo: e.target.value })}
                placeholder="TXN-..."
                className="mt-1 w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-2 rounded-xl border border-horizon-emerald/40 bg-horizon-emerald/10 p-4 text-xs sm:flex-row sm:items-center">
            <div className="space-x-4 text-horizon-muted">
              <span>Subtotal: {formatCurrency(livePreview.subtotal, currency)}</span>
              <span>Tax: {formatCurrency(livePreview.taxAmount, currency)}</span>
            </div>
            <div className="font-display text-lg font-bold text-horizon-accent">
              Total: {formatCurrency(livePreview.total, currency)}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-horizon-border bg-horizon-bg px-4 py-2 text-sm text-horizon-muted hover:text-horizon-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBill}
              className="rounded-lg bg-horizon-accent px-5 py-2 text-sm font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
            >
              {savingBill ? 'Issuing Invoice...' : 'Issue Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Detail & Record Payment Modal */}
      <Modal
        open={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        title={selectedBill ? `Invoice · ${selectedBill.invoiceNumber}` : 'Invoice Details'}
        maxWidthClass="max-w-3xl"
      >
        {selectedBill && (
          <div className="space-y-5 text-xs">
            <div className="print-sheet space-y-4 rounded-xl border border-horizon-border bg-horizon-bg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-horizon-border pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-horizon-text">
                    {settings?.hospitalName || 'CURALITHRA Medical Center'}
                  </h3>
                  <p className="text-horizon-muted">
                    Patient: <strong className="text-horizon-text">{selectedBill.patientName}</strong> (
                    {selectedBill.patientCode})
                  </p>
                  {selectedBill.appointmentCode && (
                    <p className="text-horizon-muted">
                      Appointment Ref: {selectedBill.appointmentCode}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <StatusBadge
                    status={selectedBill.paymentStatus}
                    label={selectedBill.paymentStatusDisplay}
                  />
                  <p className="mt-1 text-horizon-muted">
                    Issued: {formatDateTime(selectedBill.issuedAt)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-horizon-border text-horizon-muted">
                      <th className="py-2">Description</th>
                      <th className="py-2">Category</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-horizon-border/60">
                    {selectedBill.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 font-medium text-horizon-text">{item.description}</td>
                        <td className="py-2 text-horizon-muted">{item.category}</td>
                        <td className="py-2 text-right text-horizon-text">{item.quantity}</td>
                        <td className="py-2 text-right text-horizon-muted">
                          {formatCurrency(item.unitPrice, currency)}
                        </td>
                        <td className="py-2 text-right font-semibold text-horizon-text">
                          {formatCurrency(item.lineTotal, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-horizon-border pt-3 sm:grid-cols-5">
                <div>
                  <span className="text-horizon-muted">Subtotal</span>
                  <p className="font-semibold text-horizon-text">
                    {formatCurrency(selectedBill.subtotal, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">
                    Tax ({(selectedBill.taxRate * 100).toFixed(2)}%)
                  </span>
                  <p className="font-semibold text-horizon-text">
                    {formatCurrency(selectedBill.taxAmount, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">Total</span>
                  <p className="font-bold text-horizon-text">
                    {formatCurrency(selectedBill.totalAmount, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">Paid</span>
                  <p className="font-bold text-horizon-accent">
                    {formatCurrency(selectedBill.paidAmount, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-horizon-muted">Balance Due</span>
                  <p className="font-bold text-amber-300">
                    {formatCurrency(selectedBill.balanceDue, currency)}
                  </p>
                </div>
              </div>

              {selectedBill.payments.length > 0 && (
                <div className="border-t border-horizon-border pt-3">
                  <p className="mb-2 font-semibold text-horizon-text">Payment History</p>
                  <div className="space-y-1.5">
                    {selectedBill.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded bg-horizon-card px-3 py-1.5"
                      >
                        <span>
                          {p.paymentMethodDisplay}
                          {p.referenceNo ? ` · Ref: ${p.referenceNo}` : ''}
                        </span>
                        <span className="font-semibold text-horizon-accent">
                          {formatCurrency(p.amount, currency)} · {formatDateTime(p.paidAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Record payment section */}
            {canManage &&
              (selectedBill.paymentStatus === 'PENDING' ||
                selectedBill.paymentStatus === 'PARTIALLY_PAID') && (
                isDemo ? (
                  <div className="rounded-xl border border-horizon-emerald/40 bg-horizon-emerald/10 p-3.5 text-xs text-horizon-muted print:hidden">
                    <span className="font-semibold text-horizon-accent">
                      Read-Only Demo Mode:
                    </span>{' '}
                    Recording payments is disabled to keep shared demonstration billing balances consistent. You can still print receipts or download the official OpenPDF invoice below.
                  </div>
                ) : (
                <form
                  onSubmit={handleRecordPayment}
                  className="rounded-xl border border-horizon-border bg-horizon-bg p-4 print:hidden"
                >
                  <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-horizon-accent">
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment</span>
                  </p>
                  {payError && (
                    <div className="mb-3 rounded border border-red-500/50 bg-red-500/10 p-2 text-red-200">
                      {payError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-horizon-muted">Amount ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedBill.balanceDue}
                        value={payForm.amount}
                        onChange={(e) =>
                          setPayForm({ ...payForm, amount: Number(e.target.value) || 0 })
                        }
                        className="mt-1 w-full rounded border border-horizon-border bg-horizon-card px-3 py-1.5 text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-horizon-muted">Method</label>
                      <select
                        value={payForm.paymentMethod}
                        onChange={(e) =>
                          setPayForm({
                            ...payForm,
                            paymentMethod: e.target.value as PaymentMethod,
                          })
                        }
                        className="mt-1 w-full rounded border border-horizon-border bg-horizon-card px-3 py-1.5 text-horizon-text focus:border-horizon-accent focus:outline-none"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm.value} value={pm.value}>
                            {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-horizon-muted">Reference No</label>
                      <input
                        type="text"
                        value={payForm.referenceNo || ''}
                        onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })}
                        placeholder="Optional receipt/UTR"
                        className="mt-1 w-full rounded border border-horizon-border bg-horizon-card px-3 py-1.5 text-horizon-text focus:border-horizon-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={recordingPayment}
                      className="rounded-lg bg-horizon-accent px-4 py-1.5 font-bold text-horizon-nav hover:bg-horizon-accent-hover disabled:opacity-60"
                    >
                      {recordingPayment ? 'Processing...' : 'Post Payment'}
                    </button>
                  </div>
                </form>
                )
              )}

            <div className="flex flex-wrap justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-horizon-border bg-horizon-bg px-3.5 py-2 font-semibold text-horizon-text hover:border-horizon-emerald"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(selectedBill)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-horizon-accent px-4 py-2 font-bold text-horizon-nav hover:bg-horizon-accent-hover"
              >
                <Download className="h-4 w-4" />
                <span>Download Official PDF</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        variant="warning"
        title="Cancel Invoice"
        message={`Cancel invoice ${cancelTarget?.invoiceNumber} (${formatCurrency(cancelTarget?.totalAmount, currency)})?`}
        confirmLabel="Cancel Invoice"
        loading={confirmBusy}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={`Permanently delete invoice ${deleteTarget?.invoiceNumber}? This action is audited and cannot be undone.`}
        confirmLabel="Delete Invoice"
        loading={confirmBusy}
      />
    </section>
  );
};
