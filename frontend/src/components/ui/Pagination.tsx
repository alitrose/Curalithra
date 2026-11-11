import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (nextPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalElements,
  onPageChange,
}) => {
  if (totalElements === 0) return null;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-horizon-border pt-4 text-xs text-horizon-muted sm:flex-row">
      <span>
        Showing page <strong className="text-horizon-text">{page + 1}</strong> of{' '}
        <strong className="text-horizon-text">{Math.max(1, totalPages)}</strong> ({totalElements}{' '}
        total records)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-horizon-border bg-horizon-bg px-3 py-1.5 font-medium text-horizon-text transition hover:border-horizon-emerald disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Previous</span>
        </button>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-horizon-border bg-horizon-bg px-3 py-1.5 font-medium text-horizon-text transition hover:border-horizon-emerald disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
