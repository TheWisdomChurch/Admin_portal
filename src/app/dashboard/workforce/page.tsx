// src/app/dashboard/workforce/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ClipboardList,
  Edit3,
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
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { Modal } from '@/ui/Modal';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { getChartPalette } from '@/lib/charts/palette';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';
import type {
  AdminForm,
  CreateFormRequest,
  UpdateWorkforceRequest,
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

function formatDayMonth(day?: number, month?: number): string {
  if (!day || !month) return 'Not provided';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function toDayMonthInput(day?: number, month?: number): string {
  if (!day || !month) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
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

function Drawer({
  worker,
  onClose,
  onEdit,
  onDelete,
  deleting,
}: {
  worker: WorkforceMember;
  onClose: () => void;
  onEdit: (worker: WorkforceMember) => void;
  onDelete: (worker: WorkforceMember) => void;
  deleting: boolean;
}) {
  const birthday = formatDayMonth(worker.birthdayDay, worker.birthdayMonth);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-text-primary)]/50 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Close profile drawer" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="bg-[var(--color-text-primary)] px-5 py-6 text-[var(--color-text-inverse)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-inverse)] text-xl font-black text-[var(--color-text-primary)]">
                {initials(worker)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-inverse)]/55">Workforce Profile</p>
                <h2 className="mt-2 truncate text-2xl font-black">{workerName(worker)}</h2>
                <p className="mt-1 truncate text-sm text-[var(--color-text-inverse)]/70">{worker.department || 'Unassigned department'}</p>
              </div>
            </div>
            <button className="rounded-2xl p-2 text-[var(--color-text-inverse)]/70 hover:bg-[var(--color-text-inverse)]/10 hover:text-[var(--color-text-inverse)]" onClick={onClose} aria-label="Close profile drawer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(worker.status)}>{statusLabels[worker.status] || worker.status}</Badge>
            <span className="rounded-full border border-[var(--color-text-inverse)]/15 px-3 py-1 text-xs font-bold text-[var(--color-text-inverse)]/70">
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

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-secondary)] pt-5">
            <Button variant="outline" icon={<Edit3 className="h-4 w-4" />} onClick={() => onEdit(worker)}>
              Edit
            </Button>
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

function WorkforceEditModal({
  worker,
  saving,
  onClose,
  onSave,
}: {
  worker: WorkforceMember;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: UpdateWorkforceRequest) => void;
}) {
  const [draft, setDraft] = useState({
    firstName: worker.firstName || '',
    lastName: worker.lastName || '',
    email: worker.email || '',
    phone: worker.phone || '',
    department: worker.department || DEPARTMENTS[0],
    status: worker.status,
    notes: worker.notes || '',
    birthday: toDayMonthInput(worker.birthdayDay, worker.birthdayMonth),
  });

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();

    if (!firstName || !lastName) {
      toast.error('First name and last name are required');
      return;
    }

    onSave({
      firstName,
      lastName,
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      department: draft.department.trim() || 'Unassigned',
      status: draft.status,
      notes: draft.notes.trim(),
      birthday: draft.birthday.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-text-primary)]/50 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Close workforce editor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-secondary)] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Edit workforce profile</p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-text-primary)]">{workerName(worker)}</h2>
          </div>
          <button type="button" className="self-start rounded-2xl border border-[var(--color-border-secondary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label="Close workforce editor"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={draft.firstName} onChange={(event) => updateDraft({ firstName: event.target.value })} />
          <Input label="Last name" value={draft.lastName} onChange={(event) => updateDraft({ lastName: event.target.value })} />
          <Input label="Email" value={draft.email} onChange={(event) => updateDraft({ email: event.target.value })} />
          <Input label="Phone" value={draft.phone} onChange={(event) => updateDraft({ phone: event.target.value })} />
          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            <span>Department</span>
            <select value={draft.department} onChange={(event) => updateDraft({ department: event.target.value })} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]">
              {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            <span>Status</span>
            <select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as WorkforceStatus })} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]">
              {(Object.keys(statusLabels) as WorkforceStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <Input label="Birthday (DD/MM)" value={draft.birthday} onChange={(event) => updateDraft({ birthday: event.target.value })} />
          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-secondary)] sm:col-span-2">
            <span>Service notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => updateDraft({ notes: event.target.value })}
              rows={5}
              className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-secondary)] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}

function WorkforcePage() {
  const { resolvedTheme } = useTheme();
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
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
  const [editingWorker, setEditingWorker] = useState<WorkforceMember | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkforceMember | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

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

  const departmentChart = useMemo(() => ({
    labels: deptLabels,
    datasets: [
      {
        label: 'Workers',
        data: deptLabels.map((department) => byDepartment[department]),
        backgroundColor: chartPalette.series.blue.line,
        borderRadius: 10,
      },
    ],
  }), [deptLabels, byDepartment, chartPalette]);

  const statusChart = useMemo(() => ({
    labels: ['Serving', 'New/Pending', 'Not serving'],
    datasets: [
      {
        data: [
          getCount(byStatus.serving),
          getCount(byStatus.new) + getCount(byStatus.pending),
          getCount(byStatus.not_serving),
        ],
        backgroundColor: [chartPalette.series.emerald.line, chartPalette.series.blue.line, chartPalette.series.amber.line],
        borderWidth: 0,
      },
    ],
  }), [byStatus, chartPalette]);

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

  const saveWorkerEdits = async (id: string, payload: UpdateWorkforceRequest) => {
    setSavingId(id);
    try {
      const updated = await apiClient.updateWorkforce(id, payload);
      setWorkforce((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedWorker((prev) => (prev?.id === updated.id ? updated : prev));
      setEditingWorker(null);
      toast.success('Workforce profile updated');
    } catch (error) {
      console.error('Failed to update workforce profile:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update workforce profile');
    } finally {
      setSavingId(null);
    }
  };

  const openDeleteModal = (item: WorkforceMember) => {
    setDeleteTarget(item);
    setDeleteReason('');
  };

  const submitDeleteRequest = async () => {
    if (!deleteTarget) return;
    const reason = deleteReason.trim();
    if (!reason) {
      toast.error('State a reason for the super admin to review.');
      return;
    }

    setDeletingId(deleteTarget.id);

    try {
      await apiClient.deleteWorkforce(deleteTarget.id, reason);
      toast.success('Delete request sent to super admin');
      setSelectedWorker(null);
      setDeleteTarget(null);
      setDeleteReason('');
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

      <Panel className="overflow-hidden" padded={false}>
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
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total workforce" value={stats?.total ?? workforce.length} trend="All workforce profiles" icon={<Users className="h-5 w-5" />} tone="info" />
        <StatCard label="Currently serving" value={getCount(byStatus.serving)} trend="Active service records" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="New / pending" value={getCount(byStatus.new) + getCount(byStatus.pending)} trend="Incoming workers" icon={<ClipboardList className="h-5 w-5" />} tone="warning" />
        <StatCard label="No longer serving" value={getCount(byStatus.not_serving)} trend="Inactive records" icon={<Shield className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Workers by department</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Top departments by active profile count.</p>
            </div>
            <Badge variant="outline">{deptLabels.length} departments</Badge>
          </div>
          <div className="mt-6 h-[320px]">
            {deptLabels.length === 0 ? (
              <EmptyState title={loading ? 'Loading chart...' : 'No department data yet.'} />
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
        </Panel>

        <Panel>
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
        </Panel>
      </div>

      <Panel>
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
              <EmptyState title="No department records available yet." />
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
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
                <EmptyState title="No workforce records in this section." />
              </div>
            ) : null}
            {!loading &&
              paginated.map((item) => {
                const rowActions = (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setSelectedWorker(item)}>
                      View
                    </Button>
                    <Button size="sm" variant="outline" icon={<Edit3 className="h-4 w-4" />} onClick={() => setEditingWorker(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" icon={<Trash2 className="h-4 w-4" />} loading={deletingId === item.id} onClick={() => openDeleteModal(item)}>
                      Delete
                    </Button>
                  </>
                );

                return (
                  <div key={item.id} className="px-4 py-4 transition hover:bg-[var(--color-background-secondary)]">
                    {/* Below lg: a labeled card — the desktop grid's column
                        position is what conveys meaning (department vs.
                        status vs. contact), which is lost once columns
                        stack. */}
                    <div className="flex flex-col gap-3 lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedWorker(item)}>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-sm font-black text-[var(--color-text-primary)]">
                            <IdCard className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{workerName(item)}</p>
                            <p className="truncate text-xs text-[var(--color-text-tertiary)]">{item.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                        </button>
                        <Badge variant={statusVariant(item.status)}>{statusLabels[item.status] || item.status}</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Department</dt>
                          <dd className="mt-0.5 truncate font-semibold text-[var(--color-text-secondary)]">{item.department || 'Unassigned'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Contact</dt>
                          <dd className="mt-0.5 truncate font-semibold text-[var(--color-text-secondary)]">{item.email || item.phone || 'Not provided'}</dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap gap-2">{rowActions}</div>
                    </div>

                    {/* lg and up: the compact grid row. */}
                    <div className="hidden lg:grid lg:grid-cols-[minmax(220px,1fr)_180px_170px_minmax(200px,1fr)_180px] lg:items-center lg:gap-4">
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
                      <div className="flex justify-end gap-2">{rowActions}</div>
                    </div>
                  </div>
                );
              })}
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
      </Panel>

      {selectedWorker ? (
        <Drawer
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onEdit={(worker) => setEditingWorker(worker)}
          onDelete={(worker) => openDeleteModal(worker)}
          deleting={deletingId === selectedWorker.id}
        />
      ) : null}
      {editingWorker ? (
        <WorkforceEditModal
          key={editingWorker.id}
          worker={editingWorker}
          saving={savingId === editingWorker.id}
          onClose={() => setEditingWorker(null)}
          onSave={(payload) => void saveWorkerEdits(editingWorker.id, payload)}
        />
      ) : null}

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} size="lg" labelledBy="workforce-delete-title">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="workforce-delete-title" className="text-lg font-black tracking-tight text-[var(--color-text-primary)]">
                Request deletion
              </h2>
              <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">
                Sends a ticket for super admin review — nothing is removed yet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deletingId === deleteTarget?.id}
            className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {deleteTarget ? (
            <div className="flex items-center gap-4 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-base font-black text-[var(--color-background-primary)]">
                {initials(deleteTarget)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-[var(--color-text-primary)]">{workerName(deleteTarget)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--color-text-tertiary)]">
                  <span>{deleteTarget.department || 'Unassigned department'}</span>
                  {deleteTarget.email ? <span>{deleteTarget.email}</span> : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            This profile stays on record until a super admin approves this ticket. Be specific — your stated reason is what they&apos;ll base their decision on.
          </div>

          <label htmlFor="workforce-delete-reason" className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            Reason for removal
          </label>
          <textarea
            id="workforce-delete-reason"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            rows={6}
            placeholder="Why should this profile be removed? e.g. duplicate record, no longer with the church, entered in error..."
            className="mt-2 w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border-secondary)] px-6 py-4">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletingId === deleteTarget?.id}>Cancel</Button>
          <Button variant="danger" loading={deletingId === deleteTarget?.id} icon={<Trash2 className="h-4 w-4" />} onClick={() => void submitDeleteRequest()}>
            Send request
          </Button>
        </div>
      </Modal>
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

export default withAuth(WorkforcePage, { requiredRole: 'admin' });
