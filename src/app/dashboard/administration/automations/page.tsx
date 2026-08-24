'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Cake, CalendarClock, CheckCircle2, History, Play, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { CelebrationAutomationConfig } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';

type ConfigDraft = Omit<CelebrationAutomationConfig, 'id' | 'updatedAt' | 'updatedByEmail' | 'lastWorkerHeartbeat' | 'lastWorkerId'>;

function AutomationPage() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ['celebration-automation-status'], queryFn: () => apiClient.getCelebrationAutomationStatus(), retry: false });
  const runsQuery = useQuery({ queryKey: ['celebration-automation-runs'], queryFn: () => apiClient.listCelebrationAutomationRuns({ page: 1, limit: 30 }), retry: false });
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  useEffect(() => {
    if (!draft && statusQuery.data?.config) {
      const config = statusQuery.data.config;
      setDraft({ enabled: config.enabled, birthdayEnabled: config.birthdayEnabled, anniversaryEnabled: config.anniversaryEnabled, timezone: config.timezone, sendTime: config.sendTime, feb29Policy: config.feb29Policy, maxAttempts: config.maxAttempts, retryMinutes: config.retryMinutes, birthdaySubject: config.birthdaySubject, anniversarySubject: config.anniversarySubject, birthdayTemplateKey: config.birthdayTemplateKey, anniversaryTemplateKey: config.anniversaryTemplateKey });
    }
  }, [draft, statusQuery.data]);

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['celebration-automation-status'] }),
    queryClient.invalidateQueries({ queryKey: ['celebration-automation-runs'] }),
  ]);
  const saveMutation = useMutation({ mutationFn: (payload: ConfigDraft) => apiClient.updateCelebrationAutomationConfig(payload), onSuccess: async () => { await refresh(); toast.success('Automation configuration saved.'); }, onError: (error) => toast.error(getServerErrorMessage(error, 'Could not save automation configuration.')) });
  const runMutation = useMutation({ mutationFn: () => apiClient.runCelebrationAutomationNow(), onSuccess: async (run) => { await refresh(); toast.success(`Run ${run.status}: ${run.sent} sent, ${run.suppressed} suppressed, ${run.failed} failed.`); }, onError: (error) => toast.error(getServerErrorMessage(error, 'Could not process today’s celebrations.')) });
  const runs = runsQuery.data?.data ?? [];
  const latest = runs[0];

  if (statusQuery.isLoading) return <main className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading automation control centre…</main>;

  if (statusQuery.isError || !draft) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
        <section className="rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-background-primary)] p-5 shadow-[var(--shadow-sm)] sm:p-7">
          <TriangleAlert className="h-7 w-7 text-[var(--color-text-error)]" />
          <h1 className="mt-4 text-xl font-bold text-[var(--color-text-primary)]">Celebration automation is unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">The server could not load the birthday and anniversary automation configuration. No greeting was sent or changed.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void statusQuery.refetch()} loading={statusQuery.isFetching} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button>
            <Link href="/dashboard/administration"><Button variant="outline">Back to administration</Button></Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <Link href="/dashboard/administration" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]"><ArrowLeft className="h-4 w-4" />Administration</Link>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-accent-primary)]"><CalendarClock className="h-4 w-4" />Automation control centre</p><h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Birthday and anniversary automation</h1><p className="mt-2 max-w-3xl text-[var(--color-text-secondary)]">One deduplicated delivery engine across members, workforce, and leadership—with consent suppression, retries, history, and leap-day policy.</p></div><Button onClick={() => runMutation.mutate()} loading={runMutation.isPending} icon={<Play className="h-4 w-4" />}>Process today now</Button></div>
      </section>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Automation" value={draft.enabled ? 'Active' : 'Paused'} icon={draft.enabled ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />} tone={draft.enabled ? 'success' : 'warning'} />
        <StatCard label="Next run" value={statusQuery.data?.nextRunAt ? new Date(statusQuery.data.nextRunAt).toLocaleString() : '—'} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Latest sent" value={latest?.sent ?? 0} icon={<Cake className="h-5 w-5" />} tone="info" />
        <StatCard label="Worker health" value={statusQuery.data?.workerHealthy ? 'Healthy' : 'No heartbeat'} trend={statusQuery.data?.config.lastWorkerHeartbeat ? `Last seen ${new Date(statusQuery.data.config.lastWorkerHeartbeat).toLocaleString()}` : 'Worker has not checked in'} icon={<ShieldCheck className="h-5 w-5" />} tone={statusQuery.data?.workerHealthy ? 'success' : 'danger'} />
      </div>

      <section className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-[var(--shadow-sm)]">
        <div className="border-b border-[var(--color-border-secondary)] p-5"><h2 className="font-semibold text-[var(--color-text-primary)]">Delivery policy</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Configuration is persisted in PostgreSQL and shared by every application replica.</p></div>
        <div className="space-y-6 p-5">
          <div className="grid gap-4 sm:grid-cols-3"><Checkbox label="Enable automatic delivery" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /><Checkbox label="Birthday greetings" checked={draft.birthdayEnabled} onChange={(event) => setDraft({ ...draft, birthdayEnabled: event.target.checked })} /><Checkbox label="Wedding anniversaries" checked={draft.anniversaryEnabled} onChange={(event) => setDraft({ ...draft, anniversaryEnabled: event.target.checked })} /></div>
          <div className="grid gap-4 md:grid-cols-3"><Input label="Timezone" value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} helperText="IANA timezone, e.g. Africa/Lagos" /><Input label="Daily send time" type="time" value={draft.sendTime} onChange={(event) => setDraft({ ...draft, sendTime: event.target.value })} /><Select label="29 February policy" value={draft.feb29Policy} onChange={(event) => setDraft({ ...draft, feb29Policy: event.target.value as ConfigDraft['feb29Policy'] })}><option value="feb28">Celebrate on 28 February</option><option value="mar1">Celebrate on 1 March</option><option value="leap_only">Leap years only</option></Select></div>
          <div className="grid gap-4 md:grid-cols-2"><Input label="Birthday subject" value={draft.birthdaySubject} onChange={(event) => setDraft({ ...draft, birthdaySubject: event.target.value })} /><Input label="Anniversary subject" value={draft.anniversarySubject} onChange={(event) => setDraft({ ...draft, anniversarySubject: event.target.value })} /><Input label="Birthday template key" value={draft.birthdayTemplateKey} onChange={(event) => setDraft({ ...draft, birthdayTemplateKey: event.target.value })} /><Input label="Anniversary template key" value={draft.anniversaryTemplateKey} onChange={(event) => setDraft({ ...draft, anniversaryTemplateKey: event.target.value })} /></div>
          <div className="grid gap-4 md:grid-cols-2"><Input label="Maximum attempts" type="number" min={1} max={10} value={draft.maxAttempts} onChange={(event) => setDraft({ ...draft, maxAttempts: Number(event.target.value) })} /><Input label="Retry delay (minutes)" type="number" min={1} max={1440} value={draft.retryMinutes} onChange={(event) => setDraft({ ...draft, retryMinutes: Number(event.target.value) })} /></div>
          <div className="flex justify-end"><Button onClick={() => saveMutation.mutate(draft)} loading={saveMutation.isPending}>Save automation policy</Button></div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] p-5"><div><h2 className="font-semibold text-[var(--color-text-primary)]">Execution history</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Durable daily runs and recovery attempts.</p></div><Button variant="ghost" onClick={() => void refresh()} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div>
        {runs.length === 0 ? <div className="p-8"><EmptyState icon={<History className="h-5 w-5" />} title="No automation runs" description="The first automatic or manual execution will appear here." /></div> : <div className="divide-y divide-[var(--color-border-secondary)]">{runs.map((run) => <article key={run.id} className="grid gap-4 p-5 md:grid-cols-[1fr_1.4fr_auto] md:items-center"><div><p className="font-semibold text-[var(--color-text-primary)]">{run.runDate}</p><p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{run.trigger} · attempt {run.attempt}</p></div><div className="text-sm text-[var(--color-text-secondary)]">{run.sent} sent · {run.suppressed} suppressed · {run.skipped} skipped · {run.failed} failed{run.lastError && <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-error)]">{run.lastError}</p>}</div><Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : run.status === 'partial' ? 'warning' : 'info'}>{run.status}</Badge></article>)}</div>}
      </section>
    </main>
  );
}

export default withAuth(AutomationPage, { requiredRole: 'admin' });
