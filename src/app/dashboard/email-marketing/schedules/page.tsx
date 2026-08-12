'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, History, Mail, Pause, Play, RefreshCw, Send, Trash2, TriangleAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { AdminEmailSchedule, AdminEmailScheduleStatus } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ConfirmationModal } from '@/ui/ConfirmationModal';
import { EmptyState } from '@/ui/EmptyState';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';

const STATUS_TONE: Record<AdminEmailScheduleStatus, 'success' | 'warning' | 'default' | 'danger' | 'info'> = {
  active: 'success', paused: 'warning', draft: 'default', completed: 'info', failed: 'danger',
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function recurrenceLabel(schedule: AdminEmailSchedule): string {
  if (schedule.recurrence === 'once') return 'One time';
  if (schedule.recurrence === 'weekly') return `Weekly · ${schedule.weekdays.map((day) => DAY_NAMES[day]).join(', ')}`;
  return `Monthly · day ${schedule.monthDays.join(', ')}`;
}
function displayDate(value?: string): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No future run';
}

function EmailSchedulesPage() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<AdminEmailSchedule | null>(null);
  const [deleting, setDeleting] = useState<AdminEmailSchedule | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-email-schedules', status], queryFn: () => apiClient.listAdminEmailSchedules({ page: 1, limit: 100, status: status || undefined }) });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'active' | 'paused' }) => apiClient.setAdminEmailScheduleStatus(id, next),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-email-schedules'] }); toast.success('Schedule updated.'); },
    onError: (error) => toast.error(getServerErrorMessage(error, 'Could not update schedule.')),
  });
  const schedules = query.data?.data ?? [];
  const runsQuery = useQuery({ queryKey: ['admin-email-schedule-runs', selected?.id], queryFn: () => apiClient.listAdminEmailScheduleRuns(selected!.id, 50), enabled: Boolean(selected) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => apiClient.deleteAdminEmailSchedule(id), onSuccess: async () => { setDeleting(null); await queryClient.invalidateQueries({ queryKey: ['admin-email-schedules'] }); toast.success('Schedule deleted.'); }, onError: (error) => toast.error(getServerErrorMessage(error, 'Could not delete schedule.')) });
  const active = schedules.filter((item) => item.status === 'active').length;
  const failures = schedules.filter((item) => item.status === 'failed').length;
  const totalRuns = schedules.reduce((sum, item) => sum + item.runCount, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-[var(--shadow-sm)]">
        <div className="border-b border-[var(--color-border-secondary)] p-6 sm:p-8">
          <Link href="/dashboard/email-marketing" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"><ArrowLeft className="h-4 w-4" />Email marketing studio</Link>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-accent-primary)]"><CalendarClock className="h-4 w-4" />Email automation</p><h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Campaign schedules</h1><p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">Control recurring and one-time sends. Recipient audiences are resolved at delivery time so new form submissions are automatically included.</p></div><Link href="/dashboard/email-marketing"><Button icon={<Mail className="h-4 w-4" />}>Compose a campaign</Button></Link></div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active schedules" value={active} icon={<Play className="h-5 w-5" />} />
        <StatCard label="Completed runs" value={totalRuns} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Needs attention" value={failures} icon={<TriangleAlert className="h-5 w-5" />} />
      </div>

      <section className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border-secondary)] p-5"><div><h2 className="font-semibold text-[var(--color-text-primary)]">All schedules</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Pause an automation instantly or reactivate it from its next valid occurrence.</p></div><div className="flex items-end gap-2"><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-40"><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="failed">Failed</option></Select><Button variant="ghost" onClick={() => void query.refetch()} loading={query.isFetching} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div></div>
        {query.isLoading ? <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">Loading schedules…</div> : schedules.length === 0 ? <div className="p-8"><EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No schedules yet" description="Compose an email campaign, preview it, then choose Schedule to create your first automation." /></div> : <div className="divide-y divide-[var(--color-border-secondary)]">{schedules.map((schedule) => (
          <article key={schedule.id} className="grid gap-5 p-5 transition-colors hover:bg-[var(--color-background-secondary)] lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
            <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-[var(--color-text-primary)]">{schedule.name}</h3><Badge variant={STATUS_TONE[schedule.status]}>{schedule.status}</Badge></div><p className="truncate text-sm text-[var(--color-text-secondary)]">{schedule.subject || 'Untitled campaign'}</p><p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{schedule.audienceLabel || 'Campaign audience'} · {schedule.timezone}</p>{schedule.lastError && <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-error)]">{schedule.lastError}</p>}</div>
            <div><p className="text-sm font-medium text-[var(--color-text-primary)]">{recurrenceLabel(schedule)} at {schedule.sendTime}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"><Clock3 className="h-3.5 w-3.5" />Next: {displayDate(schedule.nextRunAt)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]"><Send className="h-3.5 w-3.5" />{schedule.runCount} completed run{schedule.runCount === 1 ? '' : 's'}</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setSelected(schedule)} icon={<History className="h-4 w-4" />}>Runs</Button>{schedule.status === 'active' ? <Button variant="outline" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: schedule.id, next: 'paused' })} icon={<Pause className="h-4 w-4" />}>Pause</Button> : ['paused', 'draft', 'failed'].includes(schedule.status) ? <Button loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: schedule.id, next: 'active' })} icon={<Play className="h-4 w-4" />}>Activate</Button> : null}{schedule.status !== 'active' && <Button variant="ghost" aria-label={`Delete ${schedule.name}`} onClick={() => setDeleting(schedule)} icon={<Trash2 className="h-4 w-4" />}>Delete</Button>}</div>
          </article>
        ))}</div>}
      </section>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} size="lg" labelledBy="schedule-runs-title" className="max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-[var(--color-border-secondary)] p-5"><div><h2 id="schedule-runs-title" className="font-semibold text-[var(--color-text-primary)]">Delivery runs</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{selected?.name}</p></div><Button variant="ghost" aria-label="Close run history" onClick={() => setSelected(null)} icon={<X className="h-4 w-4" />} /></div>
        <div className="p-5">{runsQuery.isLoading ? <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Loading delivery runs…</p> : (runsQuery.data?.length ?? 0) === 0 ? <EmptyState icon={<History className="h-5 w-5" />} title="No runs yet" description="Execution attempts will appear here after the first scheduled time." /> : <div className="space-y-3">{runsQuery.data?.map((run) => <div key={run.id} className="rounded-xl border border-[var(--color-border-secondary)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant={run.status === 'completed' ? 'success' : run.status === 'partial' ? 'warning' : run.status === 'failed' ? 'danger' : 'info'}>{run.status}</Badge><span className="text-xs text-[var(--color-text-tertiary)]">Attempt {run.attempt}</span></div><span className="text-xs text-[var(--color-text-secondary)]">{displayDate(run.scheduledFor)}</span></div><p className="mt-3 text-sm text-[var(--color-text-secondary)]">Delivered {run.sent.toLocaleString()} · Failed {run.failed.toLocaleString()}</p>{run.error && <p className="mt-2 text-xs text-[var(--color-text-error)]">{run.error}</p>}</div>)}</div>}</div>
      </Modal>
      <ConfirmationModal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} title="Delete email schedule?" description={`This permanently removes “${deleting?.name ?? ''}” and its automation configuration. Delivery records remain available in campaign history.`} confirmText="Delete schedule" variant="danger" loading={deleteMutation.isPending} />
    </main>
  );
}

export default withAuth(EmailSchedulesPage, { requiredRole: 'admin' });
