import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-horizon-border bg-horizon-bg/40 px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-horizon-border bg-horizon-card text-horizon-muted">
      <Inbox className="h-6 w-6" />
    </div>
    <h3 className="mt-4 font-display text-base font-semibold text-horizon-text">{title}</h3>
    <p className="mt-1 max-w-md text-xs text-horizon-muted">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
