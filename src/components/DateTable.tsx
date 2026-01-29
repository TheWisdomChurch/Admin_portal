// src/components/DataTable.tsx
'use client';

import React from 'react';
import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/ui/Button';

interface Column<T> {
  key: keyof T;
  header: string;
  cell?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data?: T[]; // <-- allow undefined safely
  columns: Column<T>[];
  total?: number; // <-- allow undefined safely
  page?: number;  // <-- allow undefined safely
  limit?: number; // <-- allow undefined safely
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  isLoading?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onEdit,
  onDelete,
  onView,
  isLoading,
}: DataTableProps<T>) {
  // Normalize inputs (prevents crashes + weird NaNs)
  const safeData = Array.isArray(data) ? data : [];
  const safeTotal = Number.isFinite(total as number) ? (total as number) : safeData.length;
  const safeLimit = Number.isFinite(limit as number) && (limit as number) > 0 ? (limit as number) : 10;
  const safePage = Number.isFinite(page as number) && (page as number) > 0 ? (page as number) : 1;

  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.header}
                </th>
              ))}
              {(onEdit || onDelete || onView) && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {safeData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + ((onEdit || onDelete || onView) ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            ) : (
              safeData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap">
                      {column.cell ? column.cell(item) : String(item[column.key])}
                    </td>
                  ))}

                  {(onEdit || onDelete || onView) && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(item)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
          >
            Next
          </Button>
        </div>

        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1}
              </span>{' '}
              to <span className="font-medium">{Math.min(safePage * safeLimit, safeTotal)}</span> of{' '}
              <span className="font-medium">{safeTotal}</span> results
            </p>

            <select
              value={safeLimit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded border-gray-300 text-sm"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                type="button"
                onClick={() => onPageChange(safePage - 1)}
                disabled={safePage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    type="button"
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      safePage === pageNum
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onPageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
