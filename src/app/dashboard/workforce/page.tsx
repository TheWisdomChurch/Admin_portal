// src/app/dashboard/workforce/page.tsx
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
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  CheckCircle2,
  Clipboard,
  ClipboardList,
  ExternalLink,
  IdCard,
  LayoutGrid,
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
import { Input } from '@/ui/Input';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type {
  AdminForm,
  CreateFormRequest,
  WorkforceMember,
  WorkforceStatsResponse,
  WorkforceStatus,
} from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const WORKFORCE_FORM_SLUG = 'workforce-profile';
const PAGE_SIZE = 12;
const DEPARTMENTS = [
  'Protocol',
  'Choir',
  'Ushering',
  'Media',
  'Technical',
  'Sanitation',
  'Children',
  'Prayer',
  'Hospitality',
  'Security',
];

const statusLabels: Record<WorkforceStatus, string> = {
  pending: 'Pending review',
  new: 'New worker',
  serving: 'Currently serving',
  not_serving: 'No longer serving',
};

type SectionKey = 'serving' | 'new' | 'not_serving' | 'all';
type SortKey = 'name' | 'department' | 'status';

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
      {
        key: 'notes',
        label: 'Service Notes',
        type: 'textarea',
        required: false,
        order: 6,
        validation: { maxWords: 300 },
      },
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
      introBulletSubtexts: [
        'Serving, new, or no longer serving',
        'Accurate departmental counts',
        'Stored in church records',
      ],
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
  return (
    form.settings?.formType === 'workforce' ||
    form.settings?.submissionTarget?.startsWith('workforce') ||
    surface.includes('workforce')
  );
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

function initials(worker: WorkforceMember): string {
  return `${worker.firstName?.[0] || 'W'}${worker.lastName?.[0] || ''}`.toUpperCase();
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <ShellCard className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{caption}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          {icon}
        </div>
      </div>
    </ShellCard>
  );
}

function SectionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
        active
          ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)] shadow-sm'
          : 'border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-8 text-center text-sm text-[var(--color-text-tertiary)]">
      {label}
    </div>
  );
}

function Drawer({
  worker,
  onClose,
  onDelete,
  deleting,
}: {
  worker: WorkforceMember;
  onClose: () => void;
  onDelete: (worker: WorkforceMember) => void;
  deleting: boolean;
}) {
  const birthday =
    worker.birthdayMonth && worker.birthdayDay
      ? `${String(worker.birthdayDay).padStart(2, '0')}/${String(worker.birthdayMonth).padStart(2, '0')}`
      : 'Not provided';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Close profile drawer" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="bg-slate-950 px-5 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">
                {initials(worker)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Workforce Profile</p>
                <h2 className="mt-2 truncate text-2xl font-black">{workerName(worker)}</h2>
                <p className="mt-1 truncate text-sm text-white/70">{worker.department || 'Unassigned department'}</p>
              </div>
            </div>
            <button className="rounded-2xl p-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close profile drawer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(worker.status)}>{statusLabels[worker.status] || worker.status}</Badge>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white/70">
              ID {worker.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileTile label="Email" value={worker.email || 'Not provided'} />
            <ProfileTile label="Phone" value={worker.phone || 'Not provided'} />
            <ProfileTile label="Birthday" value={birthday} />
            <ProfileTile label="Department" value={worker.department || 'Unassigned'} />
          </div>

          {worker.notes ? (
            <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Service notes</p>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[var(--color-text-secondary)]">{worker.notes}</p>
            </div>
          ) : null}

          <div className="flex justify-end border-t border-[var(--color-border-secondary)] pt-5">
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} loading={deleting} onClick={() => onDelete(worker)}>
              Request Delete Approval
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProfileTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export default function WorkforcePage() {
  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [stats, setStats] = useState<WorkforceStatsResponse | null>(null);
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);
  const [section, setSection] = useState<SectionKey>('serving');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [query, section, sort]);

  const workforceForms = useMemo(() => forms.filter(isWorkforceForm), [forms]);
  const primaryForm = workforceForms.find((form) => form.slug === WORKFORCE_FORM_SLUG) || workforceForms[0] || null;

  // buildPublicFormUrl can return null. Keep this value as a safe string so APIs like
  // window.open() and clipboard.writeText() never receive null.
  const publicFormUrl = primaryForm ? buildPublicFormUrl(primaryForm.slug, primaryForm.publicUrl) ?? '' : '';

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
    const searched = needle
      ? source.filter((item) =>
          `${workerName(item)} ${item.department || ''} ${item.email || ''} ${item.phone || ''} ${item.status || ''}`
            .toLowerCase()
            .includes(needle),
        )
      : source;

    return searched.sort((a, b) => {
      if (sort === 'department') {
        return String(a.department || '').localeCompare(String(b.department || '')) || workerName(a).localeCompare(workerName(b));
      }

      if (sort === 'status') {
        return String(a.status || '').localeCompare(String(b.status || '')) || workerName(a).localeCompare(workerName(b));
      }

      return workerName(a).localeCompare(workerName(b));
    });
  }, [query, section, sort, workforce]);

  const totalPages = Math.max(1, Math.ceil(visibleWorkers.length / PAGE_SIZE));
  const paginated = visibleWorkers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deptLabels = Object.keys(byDepartment)
    .sort((a, b) => getCount(byDepartment[b]) - getCount(byDepartment[a]))
    .slice(0, 10);

  const departmentChart = {
    labels: deptLabels,
    datasets: [
      {
        label: 'Workers',
        data: deptLabels.map((department) => byDepartment[department]),
        backgroundColor: '#2563eb',
        borderRadius: 10,
      },
    ],
  };

  const statusChart = {
    labels: ['Serving', 'New/Pending', 'Not serving'],
    datasets: [
      {
        data: [
          getCount(byStatus.serving),
          getCount(byStatus.new) + getCount(byStatus.pending),
          getCount(byStatus.not_serving),
        ],
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

      const url = buildPublicFormUrl(nextForm.slug, nextForm.publicUrl) ?? '';
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
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

  const openPublicForm = () => {
    if (!publicFormUrl) return;
    window.open(publicFormUrl, '_blank', 'noopener,noreferrer');
  };

  const requestDelete = async (item: WorkforceMember) => {
    if (!window.confirm(`Send ${workerName(item)} for super-admin delete approval?`)) return;

    setDeletingId(item.id);

    try {
      await apiClient.deleteWorkforce(item.id);
      toast.success('Delete request sent to super admin');
      setSelectedWorker(null);
      await loadData();
    } catch (error) {
      console.error('Failed to request workforce delete:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to request delete approval');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce"
        subtitle="Serving workers, new applications, department coverage, and governed profile removal."
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

      <ShellCard className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Service intelligence</p>
                <h2 className="mt-2 text-xl font-black text-[var(--color-text-primary)]">Department-based workforce command center</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  Track current workers, incoming workforce profiles, inactive service records, and department strength from live ministry data.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 xl:border-l xl:border-t-0">
            <div className="min-w-0 rounded-2xl bg-[var(--color-background-primary)] p-4">
              <p className="text-xs font-black uppercase text-[var(--color-text-tertiary)]">Public form</p>
              <p className="mt-2 truncate text-sm font-bold text-[var(--color-text-primary)]">
                {primaryForm?.title || 'No workforce form connected'}
              </p>
              <p className="mt-2 break-all text-xs text-[var(--color-text-tertiary)]">
                {publicFormUrl || 'Prepare the form to generate an intake link.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={<Clipboard className="h-4 w-4" />} disabled={!publicFormUrl} onClick={() => void copyFormLink()}>
                  Copy
                </Button>
                <Button size="sm" variant="outline" icon={<ExternalLink className="h-4 w-4" />} disabled={!publicFormUrl} onClick={openPublicForm}>
                  Open
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ShellCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total workforce" value={stats?.total ?? workforce.length} caption="All workforce profiles" icon={<Users className="h-5 w-5" />} tone="bg-blue-500/10 text-blue-700" />
        <StatCard label="Currently serving" value={getCount(byStatus.serving)} caption="Active service records" icon={<CheckCircle2 className="h-5 w-5" />} tone="bg-emerald-500/10 text-emerald-700" />
        <StatCard label="New / pending" value={getCount(byStatus.new) + getCount(byStatus.pending)} caption="Incoming workers" icon={<ClipboardList className="h-5 w-5" />} tone="bg-indigo-500/10 text-indigo-700" />
        <StatCard label="No longer serving" value={getCount(byStatus.not_serving)} caption="Inactive records" icon={<Shield className="h-5 w-5" />} tone="bg-amber-500/10 text-amber-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ShellCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Workers by department</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Top departments by active profile count.</p>
            </div>
            <Badge variant="outline">{deptLabels.length} departments</Badge>
          </div>
          <div className="mt-6 h-[320px]">
            {deptLabels.length === 0 ? (
              <EmptyState label={loading ? 'Loading chart...' : 'No department data yet.'} />
            ) : (
              <Bar
                data={departmentChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <h2 className="text-lg font-black text-[var(--color-text-primary)]">Service status</h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Current distribution by service state.</p>
          <div className="mx-auto mt-6 h-[260px] max-w-[280px]">
            <Doughnut
              data={statusChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
              }}
            />
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">Department accordions</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Quick department-by-department coverage breakdown.</p>
          </div>
          <Badge variant="outline">{Object.keys(groupedByDepartment).length} sections</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groupedByDepartment)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([department, items]) => {
              const serving = items.filter((item) => item.status === 'serving').length;
              const incoming = items.filter((item) => item.status === 'new' || item.status === 'pending').length;

              return (
                <details
                  key={department}
                  className="group rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 transition open:bg-[var(--color-background-primary)] open:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[var(--color-text-primary)]">
                    <span className="min-w-0 truncate">{department}</span>
                    <span className="shrink-0 rounded-full bg-[var(--color-background-primary)] px-3 py-1 text-xs text-[var(--color-text-tertiary)]">
                      {items.length}
                    </span>
                  </summary>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniCount label="Serving" value={serving} />
                    <MiniCount label="New" value={incoming} />
                    <MiniCount label="Inactive" value={items.length - serving - incoming} />
                  </div>
                </details>
              );
            })}
          {Object.keys(groupedByDepartment).length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState label="No department records available yet." />
            </div>
          ) : null}
        </div>
      </ShellCard>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">Workforce profiles</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Search, sort, inspect, and request governed profile removal.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,280px)_160px]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workers..." className="pl-10" />
            </div>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="name">Sort: Name</option>
              <option value="department">Sort: Department</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <SectionButton active={section === 'serving'} onClick={() => setSection('serving')}>
            Currently Serving
          </SectionButton>
          <SectionButton active={section === 'new'} onClick={() => setSection('new')}>
            New / Pending
          </SectionButton>
          <SectionButton active={section === 'not_serving'} onClick={() => setSection('not_serving')}>
            No Longer Serving
          </SectionButton>
          <SectionButton active={section === 'all'} onClick={() => setSection('all')}>
            All
          </SectionButton>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[minmax(220px,1fr)_180px_170px_minmax(200px,1fr)_180px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Profile</div>
            <div>Department</div>
            <div>Status</div>
            <div>Contact</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-[var(--color-border-secondary)]">
            {loading ? <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading workforce records...</div> : null}
            {!loading && paginated.length === 0 ? (
              <div className="p-4">
                <EmptyState label="No workforce records in this section." />
              </div>
            ) : null}
            {!loading &&
              paginated.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 px-4 py-4 transition hover:bg-[var(--color-background-secondary)] lg:grid-cols-[minmax(220px,1fr)_180px_170px_minmax(200px,1fr)_180px] lg:items-center"
                >
                  <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedWorker(item)}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-sm font-black text-[var(--color-text-primary)]">
                      <IdCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{workerName(item)}</p>
                      <p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </button>
                  <div className="truncate text-sm font-semibold text-[var(--color-text-secondary)]">{item.department || 'Unassigned'}</div>
                  <div>
                    <Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge>
                  </div>
                  <div className="min-w-0 text-sm text-[var(--color-text-secondary)]">
                    <p className="truncate">{item.email || 'No email'}</p>
                    <p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.phone || 'No phone'}</p>
                  </div>
                  <div className="flex justify-start gap-2 lg:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setSelectedWorker(item)}>
                      View
                    </Button>
                    <Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} loading={deletingId === item.id} onClick={() => void requestDelete(item)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Showing {visibleWorkers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleWorkers.length)} of {visibleWorkers.length}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </Button>
            <span className="inline-flex items-center rounded-2xl border border-[var(--color-border-secondary)] px-3 text-sm font-bold text-[var(--color-text-secondary)]">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
              Next
            </Button>
          </div>
        </div>
      </ShellCard>

      {selectedWorker ? (
        <Drawer
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onDelete={(worker) => void requestDelete(worker)}
          deleting={deletingId === selectedWorker.id}
        />
      ) : null}
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2 py-3">
      <p className="truncate text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
