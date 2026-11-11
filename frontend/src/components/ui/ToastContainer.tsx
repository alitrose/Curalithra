import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast, type ToastVariant } from '../../context/ToastContext';

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.FC<{ className?: string }> }> = {
  success: { border: 'border-horizon-emerald bg-horizon-card text-horizon-text', icon: CheckCircle2 },
  error: { border: 'border-red-500/60 bg-horizon-card text-horizon-text', icon: XCircle },
  warning: { border: 'border-amber-500/60 bg-horizon-card text-horizon-text', icon: AlertTriangle },
  info: { border: 'border-horizon-border bg-horizon-card text-horizon-text', icon: Info },
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: 'text-horizon-accent',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-sky-400',
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 print:hidden"
    >
      {toasts.map((toast) => {
        const { border, icon: Icon } = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-horizon backdrop-blur ${border}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_COLORS[toast.variant]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-horizon-text">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-horizon-muted">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-horizon-muted hover:bg-horizon-bg hover:text-horizon-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
