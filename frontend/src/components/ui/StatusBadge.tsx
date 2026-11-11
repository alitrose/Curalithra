import React from 'react';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

const STYLE_MAP: Record<string, string> = {
  SCHEDULED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  CONFIRMED: 'border-horizon-emerald bg-horizon-emerald/20 text-horizon-accent',
  COMPLETED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  CANCELLED: 'border-red-500/40 bg-red-500/10 text-red-300',
  NO_SHOW: 'border-amber-500/40 bg-amber-500/10 text-amber-300',

  PAID: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  PENDING: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  PARTIALLY_PAID: 'border-sky-500/40 bg-sky-500/10 text-sky-300',

  ACTIVE: 'border-horizon-emerald bg-horizon-emerald/20 text-horizon-accent',
  DISPENSED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',

  ADMIN: 'border-horizon-accent/50 bg-horizon-accent/15 text-horizon-accent',
  DOCTOR: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  RECEPTIONIST: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const key = status.toUpperCase();
  const style = STYLE_MAP[key] || 'border-horizon-border bg-horizon-bg text-horizon-muted';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${style}`}
    >
      {label || status.replace(/_/g, ' ')}
    </span>
  );
};
