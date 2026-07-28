import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Select';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  cell?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  tableClassName?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Declarative data table with built-in loading/empty states — replaces the
 * hand-rolled <table> markup duplicated across list pages (members, forms
 * submissions, workforce, etc).
 */
export function Table<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  onRowClick,
  className,
  tableClassName,
  total,
  page = 1,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-[var(--color-text-tertiary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn('max-w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-primary)]', className)}>
      <div className="max-w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', tableClassName)}>
        <thead>
          <tr className="border-b border-[var(--color-border-primary)]">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]',
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-[var(--color-border-secondary)] last:border-0',
                onRowClick && 'cursor-pointer hover:bg-[var(--color-background-hover)]'
              )}
            >
              {columns.map((column) => (
                <td key={String(column.key)} className={cn('px-4 py-3 text-[var(--color-text-secondary)]', column.className)}>
                  {column.render ? column.render(row) : column.cell ? column.cell(row) : String((row as Record<string, unknown>)[String(column.key)] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {onPageChange ? (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total ?? data.length}
          pageSizeOptions={pageSizeOptions}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}

function TablePagination({ page, pageSize, total, pageSizeOptions, onPageChange, onPageSizeChange }: {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const first = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
        <span>Showing {first}–{last} of {total}</span>
        {onPageSizeChange ? (
          <Select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 min-w-32 py-1.5">
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option} per page</option>)}
          </Select>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button variant="outline" size="sm" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}>Previous</Button>
        <span className="min-w-20 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Page {safePage} of {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}>Next</Button>
      </div>
    </div>
  );
}
