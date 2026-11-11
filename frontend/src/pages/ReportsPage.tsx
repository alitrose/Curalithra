import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileBarChart2, Printer, RefreshCw, Search } from 'lucide-react';
import { apiDownloadBlob, apiRequest, buildQueryString } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ReportResult, ReportType } from '../types/api';

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'PATIENT_REGISTRATION',
    label: 'Patient Registration Census',
    description: 'Registered patient roster filtered by registration date and demographics.',
  },
  {
    value: 'DOCTOR_ACTIVITY',
    label: 'Physician Workload & Activity',
    description: 'Consultation volume, completed appointments, and specialization metrics.',
  },
  {
    value: 'APPOINTMENTS',
    label: 'Detailed Appointment Ledger',
    description: 'Scheduled, completed, and cancelled visits across departments.',
  },
  {
    value: 'APPOINTMENT_STATUS',
    label: 'Appointment Status Breakdown',
    description: 'Aggregate distribution by booking status.',
  },
  {
    value: 'REVENUE',
    label: 'Financial & Invoice Revenue',
    description: 'Itemized invoice billing totals, collected cashflow, and balances.',
  },
];

export const ReportsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canExport = hasPermission('EXPORT_REPORTS');

  const [reportType, setReportType] = useState<ReportType>('PATIENT_REGISTRATION');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString({
        type: reportType,
        search: search.trim(),
        fromDate,
        toDate,
      });
      const res = await apiRequest<ReportResult>(`/reports${qs}`);
      setReport(res);
    } catch (err) {
      pushToast(
        'error',
        'Failed to generate report',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [reportType, search, fromDate, toDate, pushToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const qs = buildQueryString({
        type: reportType,
        search: search.trim(),
        fromDate,
        toDate,
      });
      await apiDownloadBlob(
        `/reports/export${qs}`,
        `curalithra-${reportType.toLowerCase()}.csv`
      );
      pushToast('success', 'CSV Export Ready', 'Report downloaded with formula-injection protection.');
    } catch (err) {
      pushToast(
        'error',
        'CSV Export Failed',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setExporting(false);
    }
  };

  const selectedMeta = REPORT_OPTIONS.find((r) => r.value === reportType);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-horizon-accent">
            Operational Analytics & Compliance Exports
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-horizon-text sm:text-3xl">
            Hospital Reports
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-horizon-border bg-horizon-card px-3.5 py-2 text-xs font-semibold text-horizon-text hover:border-horizon-emerald"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
          {canExport && (
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg bg-horizon-accent px-4 py-2 text-xs font-bold text-horizon-nav transition hover:bg-horizon-accent-hover disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Report Selector & Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-horizon-border bg-horizon-card p-4 sm:grid-cols-12 print:hidden">
        <div className="sm:col-span-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-horizon-muted">
            Report Type
          </label>
          <select
            aria-label="Report type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
          >
            {REPORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-horizon-muted">
            Keyword Filter
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-horizon-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter rows..."
              className="w-full rounded-lg border border-horizon-border bg-horizon-bg py-2 pl-9 pr-3 text-sm text-horizon-text focus:border-horizon-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-horizon-muted">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-horizon-muted">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-horizon-border bg-horizon-bg px-3 py-2 text-xs text-horizon-text focus:border-horizon-accent focus:outline-none"
          />
        </div>

        <div className="flex items-end sm:col-span-1">
          <button
            type="button"
            onClick={loadReport}
            title="Refresh report"
            className="inline-flex h-[38px] w-full items-center justify-center rounded-lg border border-horizon-border bg-horizon-bg text-horizon-accent hover:border-horizon-emerald"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Report Output */}
      <div className="print-sheet rounded-xl border border-horizon-border bg-horizon-card p-5 shadow-horizon">
        <div className="mb-4 flex flex-col justify-between gap-2 border-b border-horizon-border pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-horizon-accent" />
              <h2 className="font-display text-lg font-bold text-horizon-text">
                {report?.title || selectedMeta?.label}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-horizon-muted">{selectedMeta?.description}</p>
          </div>
          {(fromDate || toDate) && (
            <span className="rounded-lg border border-horizon-border bg-horizon-bg px-3 py-1 text-xs text-horizon-muted">
              Range: {fromDate || 'Beginning'} → {toDate || 'Present'}
            </span>
          )}
        </div>

        {report && Object.keys(report.summaryMetrics).length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(report.summaryMetrics).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-horizon-border bg-horizon-bg p-3.5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-horizon-muted">
                  {label}
                </p>
                <p className="mt-1 font-display text-xl font-bold text-horizon-accent">{value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-horizon-muted">Generating report...</p>
        ) : !report || report.rows.length === 0 ? (
          <EmptyState
            title="No data matches this report criteria"
            description="Broaden your date range or clear the keyword filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-horizon-border uppercase tracking-wider text-horizon-muted">
                  {report.headers.map((h) => (
                    <th key={h} className="px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-horizon-border/60">
                {report.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-horizon-card-hover/50">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3 py-2.5 ${
                          cIdx === 0 ? 'font-semibold text-horizon-text' : 'text-horizon-muted'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
