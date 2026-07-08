import { useEffect, useState } from 'react';
import { Activity, BarChart3, Command, Download, LayoutDashboard, RefreshCw, Users, X } from 'lucide-react';

import { EmptyState } from '@/ui/EmptyState';
import type { DashboardTab } from '../lib';

export function CommandPalette({
  open,
  onClose,
  onRefresh,
  onTab,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onTab: (tab: DashboardTab) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  const actions = [
    { label: 'Refresh dashboard data', icon: RefreshCw, run: onRefresh },
    { label: 'Open overview', icon: LayoutDashboard, run: () => onTab('overview') },
    { label: 'Open people table', icon: Users, run: () => onTab('people') },
    { label: 'Open analytics charts', icon: BarChart3, run: () => onTab('analytics') },
    { label: 'Open activity timeline', icon: Activity, run: () => onTab('activity') },
    { label: 'Print or export dashboard', icon: Download, run: () => window.print() },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-3 py-20 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border-secondary)] px-4 py-3">
          <Command className="h-5 w-5 text-[var(--color-text-tertiary)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search commands..." className="w-full bg-transparent py-2 text-sm font-semibold outline-none placeholder:text-[var(--color-text-tertiary)]" />
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.run();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--color-background-hover)]"
              >
                <div className="rounded-xl bg-[var(--color-text-primary)] p-2 text-[var(--color-text-inverse)]"><Icon className="h-4 w-4" /></div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{action.label}</span>
              </button>
            );
          })}
          {actions.length === 0 ? <EmptyState title="No command found." /> : null}
        </div>
      </div>
    </div>
  );
}
