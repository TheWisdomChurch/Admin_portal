'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import {
  CheckCircle2,
  Clipboard,
  ClipboardList,
  ExternalLink,
  IdCard,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type { AdminForm, CreateFormRequest, WorkforceMember, WorkforceStatsResponse, WorkforceStatus } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const WORKFORCE_FORM_SLUG = 'workforce-profile';
const DEPARTMENTS = ['Protocol', 'Choir', 'Ushering', 'Media', 'Technical', 'Sanitation', 'Children', 'Prayer', 'Hospitality', 'Security'];

const statusLabels: Record<WorkforceStatus, string> = {
  pending: 'Pending review',
  new: 'New worker',
  serving: 'Currently serving',
  not_serving: 'No longer serving',
};

type SectionKey = 'serving' | 'new' | 'not_serving' | 'all';

function buildWorkforceFormPayload(): CreateFormRequest {
  return {
    title: 'Workforce Service Profile',
    description: 'External profile form for current workers and new workforce applicants.',
    slug: WORKFORCE_FORM_SLUG,
    fields: [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
      { key: 'email', label: 'Email Address', type: 'email', required: true, order: 2 },
      { key: 'phone', label: 'Phone Number', type: 'tel', required: true, order: 3 },
      {
        key: 'service_status',
        label: 'Service Status',
        type: 'select',
        required: true,
        order: 4,
        options: [
          { label: 'Currently serving', value: 'serving' },
          { label: 'New worker', value: 'new' },
          { label: 'No longer serving', value: 'not_serving' },
        ],
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        required: true,
        order: 5,
        options: DEPARTMENTS.map((department) => ({ label: department, value: department })),
      },
      { key: 'notes', label: 'Service Notes', type: 'textarea', required: false, order: 6, validation: { maxWords: 300 } },
    ],
    settings: {
      formType: 'workforce',
      submissionTarget: 'workforce',
      responseEmailEnabled: false,
      successTitle: 'Workforce profile received',
      successSubtitle: 'Thank you. Your service profile has been submitted.',
      successMessage: 'The administration team will review and organise workforce records by department.',
      introTitle: 'Workforce Service Profile',
      introSubtitle: 'Help us keep an accurate, department-by-department workforce record.',
      introBullets: ['Current service status', 'Department tracking', 'Administration review'],
      introBulletSubtexts: ['Serving, new, or no longer serving', 'Accurate departmental counts', 'Stored in church records'],
      layoutMode: 'split',
      submitButtonText: 'Submit Workforce Profile',
      submitButtonIcon: 'send',
      formHeaderNote: 'Use the same email and phone number known to the administration team.',
    },
  };
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
    }
  }
  return [];
}

function isWorkforceForm(form: AdminForm): boolean {
  const surface = `${form.slug || ''} ${form.title || ''}`.toLowerCase();
  return form.settings?.formType === 'workforce' || form.settings?.submissionTarget?.startsWith('workforce') || surface.includes('workforce');
}

function getCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function workerName(item: WorkforceMember): string {
  return `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed worker';
}

function statusVariant(status: WorkforceStatus): 'success' | 'warning' | 'primary' | 'outline' {
  if (status === 'serving') return 'success';
  if (status === 'not_serving') return 'warning';
  if (status === 'pending') return 'primary';
  return 'outline';
}

export default function WorkforcePage() {
  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [stats, setStats] = useState<WorkforceStatsResponse | null>(null);
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);
  const [section, setSection] = useState<SectionKey>('serving');
  const [query, setQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<WorkforceMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [workforceRes, statsRes, formsRes] = await Promise.allSettled([
        apiClient.listWorkforce({ page: 1, limit: 500 }),
        apiClient.getWorkforceStats(),
        apiClient.getAdminForms({ page: 1, limit: 300 }),
      ]);

      setWorkforce(workforceRes.status === 'fulfilled' ? toArray<WorkforceMember>(workforceRes.value) : []);
      setStats(statsRes.status === 'fulfilled' ? statsRes.value : null);
      setForms(formsRes.status === 'fulfilled' && Array.isArray(formsRes.value.data) ? formsRes.value.data : []);

      if ([workforceRes, statsRes, formsRes].some((result) => result.status === 'rejected')) {
        toast.error('Some workforce records could not be loaded');
      }
    } catch (error) {
      console.error('Failed to load workforce dashboard:', error);
      toast.error('Unable to load workforce dashboard');
      setWorkforce([]);
      setStats(null);
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const workforceForms = useMemo(() => forms.filter(isWorkforceForm), [forms]);
  const primaryForm = workforceForms.find((form) => form.slug === WORKFORCE_FORM_SLUG) || workforceForms[0] || null;
  const publicFormUrl = primaryForm ? buildPublicFormUrl(primaryForm.slug, primaryForm.publicUrl) : '';

  const byStatus = useMemo(() => {
    if (stats?.byStatus) return stats.byStatus;
    return workforce.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }, [stats, workforce]);

  const byDepartment = useMemo(() => {
    if (stats?.byDepartment) return stats.byDepartment;
    return workforce.reduce<Record<string, number>>((acc, item) => {
      const department = item.department || 'Unassigned';
      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {});
  }, [stats, workforce]);

  const groupedByDepartment = useMemo(() => {
    return workforce.reduce<Record<string, WorkforceMember[]>>((acc, item) => {
      const department = item.department || 'Unassigned';
      acc[department] = acc[department] || [];
      acc[department].push(item);
      return acc;
    }, {});
  }, [workforce]);

  const visibleWorkers = useMemo(() => {
    const source = workforce.filter((item) => {
      if (section === 'serving') return item.status === 'serving';
      if (section === 'new') return item.status === 'new' || item.status === 'pending';
      if (section === 'not_serving') return item.status === 'not_serving';
      return true;
    });
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((item) => `${workerName(item)} ${item.department} ${item.email || ''} ${item.phone || ''}`.toLowerCase().includes(needle));
  }, [query, section, workforce]);

  const deptLabels = Object.keys(byDepartment).sort((a, b) => getCount(byDepartment[b]) - getCount(byDepartment[a])).slice(0, 10);
  const departmentChart = {
    labels: deptLabels,
    datasets: [
      {
        label: 'Workers',
        data: deptLabels.map((department) => byDepartment[department]),
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
    ],
  };
  const statusChart = {
    labels: ['Serving', 'New/Pending', 'Not serving'],
    datasets: [
      {
        data: [getCount(byStatus.serving), getCount(byStatus.new) + getCount(byStatus.pending), getCount(byStatus.not_serving)],
        backgroundColor: ['#059669', '#2563eb', '#d97706'],
        borderWidth: 0,
      },
    ],
  };

  const createWorkforceForm = async () => {
    setCreatingForm(true);
    try {
      const fresh = await apiClient.getAdminForms({ page: 1, limit: 300 });
      const existing = Array.isArray(fresh.data)
        ? fresh.data.find((form) => form.slug === WORKFORCE_FORM_SLUG) || fresh.data.find(isWorkforceForm)
        : null;

      let nextForm = existing || (await apiClient.createAdminForm(buildWorkforceFormPayload()));

      if (!nextForm.isPublished && nextForm.status !== 'published') {
        const published = await apiClient.publishAdminForm(nextForm.id);
        nextForm = {
          ...nextForm,
          isPublished: true,
          slug: published.slug || nextForm.slug,
          publicUrl: published.publicUrl || nextForm.publicUrl,
          publishedAt: published.publishedAt || nextForm.publishedAt,
          status: published.status || 'published',
        };
      }

      toast.success('Workforce form is ready');
      await loadData();

      const url = buildPublicFormUrl(nextForm.slug, nextForm.publicUrl);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to create workforce form:', error);
      toast.error('Unable to prepare workforce form');
    } finally {
      setCreatingForm(false);
    }
  };

  const copyFormLink = async () => {
    if (!publicFormUrl) return;
    await navigator.clipboard.writeText(publicFormUrl);
    toast.success('Workforce form link copied');
  };

  const requestDelete = async (item: WorkforceMember) => {
    if (!window.confirm(`Send ${workerName(item)} for super-admin delete approval?`)) return;
    setDeletingId(item.id);
    try {
      await apiClient.deleteWorkforce(item.id);
      toast.success('Delete request sent to super admin');
      await loadData();
    } catch (error) {
      console.error('Failed to request workforce delete:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to request delete approval');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workforce"
        subtitle="Serving workers, new workforce applications, department coverage, and governed profile removal."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={createWorkforceForm} loading={creatingForm}>
              Prepare Form
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total workforce" value={stats?.total ?? workforce.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Currently serving" value={getCount(byStatus.serving)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="New / pending" value={getCount(byStatus.new) + getCount(byStatus.pending)} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="No longer serving" value={getCount(byStatus.not_serving)} icon={<Shield className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title="Workers by department"
          actions={<Badge variant="outline">{deptLabels.length} departments</Badge>}
        >
          <div className="h-[300px]">
            {deptLabels.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">{loading ? 'Loading chart...' : 'No department data yet.'}</p>
            ) : (
              <Bar
                data={departmentChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                }}
              />
            )}
          </div>
        </Card>

        <Card title="Service status">
          <div className="mx-auto h-[220px] max-w-[260px]">
            <Pie
              data={statusChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
              }}
            />
          </div>
        </Card>
      </div>

      <Card
        title="External workforce form"
        actions={
          <div className="flex flex-wrap gap-2">
            {publicFormUrl && (
              <>
                <Button size="sm" variant="outline" icon={<Clipboard className="h-4 w-4" />} onClick={() => void copyFormLink()}>
                  Copy Link
                </Button>
                <Button size="sm" variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(publicFormUrl, '_blank', 'noopener,noreferrer')}>
                  Open Form
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{primaryForm?.title || 'No workforce form connected yet'}</p>
            <p className="mt-1 break-all text-sm text-[var(--color-text-tertiary)]">
              {publicFormUrl || 'Create and publish the form to share a workforce intake link.'}
            </p>
          </div>
          <Badge variant={primaryForm ? 'success' : 'warning'}>{primaryForm ? 'Form active' : 'Setup needed'}</Badge>
        </div>
      </Card>

      <Card title="Department sections">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groupedByDepartment)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([department, items]) => {
              const serving = items.filter((item) => item.status === 'serving').length;
              const incoming = items.filter((item) => item.status === 'new' || item.status === 'pending').length;
              return (
                <details key={department} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
                    {department} <span className="text-[var(--color-text-tertiary)]">({items.length})</span>
                  </summary>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniCount label="Serving" value={serving} />
                    <MiniCount label="New" value={incoming} />
                    <MiniCount label="Inactive" value={items.length - serving - incoming} />
                  </div>
                </details>
              );
            })}
        </div>
      </Card>

      <Card
        title="Workforce profiles"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workers..." className="pl-10" />
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <SectionButton active={section === 'serving'} onClick={() => setSection('serving')}>Currently Serving</SectionButton>
          <SectionButton active={section === 'new'} onClick={() => setSection('new')}>New Members</SectionButton>
          <SectionButton active={section === 'not_serving'} onClick={() => setSection('not_serving')}>No Longer Serving</SectionButton>
          <SectionButton active={section === 'all'} onClick={() => setSection('all')}>All</SectionButton>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="px-3 py-2 font-semibold">Profile</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Contact</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={5}>Loading workforce records...</td></tr>
              ) : visibleWorkers.length === 0 ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={5}>No workforce records in this section.</td></tr>
              ) : (
                visibleWorkers.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-background-secondary)]">
                    <td className="px-3 py-3">
                      <button className="flex items-center gap-2 text-left font-medium text-[var(--color-text-primary)]" onClick={() => setSelectedWorker(item)}>
                        <IdCard className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        {workerName(item)}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.department || 'Unassigned'}</td>
                    <td className="px-3 py-3"><Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge></td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.email || item.phone || 'No contact'}</td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Trash2 className="h-4 w-4" />}
                        loading={deletingId === item.id}
                        onClick={() => void requestDelete(item)}
                      >
                        Request Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedWorker && <ProfileCard worker={selectedWorker} onClose={() => setSelectedWorker(null)} />}
    </div>
  );
}

function SectionButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? 'primary' : 'outline'} onClick={onClick}>
      {children}
    </Button>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2 py-2">
      <p className="text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ProfileCard({ worker, onClose }: { worker: WorkforceMember; onClose: () => void }) {
  const initials = `${worker.firstName?.[0] || 'W'}${worker.lastName?.[0] || ''}`.toUpperCase();
  const birthday = worker.birthdayMonth && worker.birthdayDay
    ? `${String(worker.birthdayDay).padStart(2, '0')}/${String(worker.birthdayMonth).padStart(2, '0')}`
    : 'Not provided';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="bg-slate-950 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-xl font-black text-slate-950">
                {initials}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Workforce Profile</p>
                <h2 className="mt-1 text-xl font-bold">{workerName(worker)}</h2>
                <p className="mt-1 text-sm text-white/70">{worker.department || 'Unassigned department'}</p>
              </div>
            </div>
            <button className="rounded-[var(--radius-button)] p-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close profile card">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(worker.status)}>{statusLabels[worker.status]}</Badge>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70">ID {worker.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileTile label="Email" value={worker.email || 'Not provided'} />
            <ProfileTile label="Phone" value={worker.phone || 'Not provided'} />
            <ProfileTile label="Birthday" value={birthday} />
            <ProfileTile label="Department" value={worker.department || 'Unassigned'} />
          </div>

          {worker.notes && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Service notes</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--color-text-secondary)]">{worker.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
