import { buildPaginationCells } from '@/lib/pagination';

type PaginationControlsProps = Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
}>;

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  const cells = buildPaginationCells(page, totalPages, 1, 1);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={isFirst || disabled}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Previous
      </button>
      {cells.map((cell, idx) =>
        cell === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <button
            key={cell}
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(cell)}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors ${
              cell === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent'
            } disabled:pointer-events-none disabled:opacity-50`}
          >
            {cell}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={isLast || disabled}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
