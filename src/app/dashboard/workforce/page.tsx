'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CheckCircle2, ClipboardList, ExternalLink, Plus, RefreshCw, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type { AdminForm, CreateFormRequest, WorkforceMember, WorkforceStatsResponse, WorkforceStatus } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const WORKFORCE_FORM_SLUG = 'workforce-profile';
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

function buildWorkforceFormPayload(): CreateFormRequest {
  return {
    title: 'Workforce Service Profile',
    description: 'Collect workforce service status and department records.',
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
          { label: 'No longer serving', value: 'not_serving' },
          { label: 'New worker', value: 'new' },
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
      introBulletSubtexts: ['Serving, new, or no longer serving', 'Accurate departmental counts', 'Stored through the backend workflow'],
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

export default function WorkforcePage() {
  const [workforce, setWorkforce] = useState<WorkforceMember[]>([]);
  const [stats, setStats] = useState<WorkforceStatsResponse | null>(null);
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);

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
    loadData();
  }, [loadData]);

  const workforceForms = useMemo(() => forms.filter(isWorkforceForm), [forms]);
  const primaryForm = workforceForms.find((form) => form.slug === WORKFORCE_FORM_SLUG) || workforceForms[0] || null;
  const publicFormUrl = primaryForm ? buildPublicFormUrl(primaryForm.slug, primaryForm.publicUrl) : '';

  const localByStatus = useMemo(
    () =>
      workforce.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
    [workforce]
  );

  const byStatus = stats?.byStatus || localByStatus;
  const byDepartment = stats?.byDepartment || workforce.reduce<Record<string, number>>((acc, item) => {
    const department = item.department || 'Unassigned';
    acc[department] = (acc[department] || 0) + 1;
    return acc;
  }, {});

  const deptLabels = Object.keys(byDepartment).sort((a, b) => getCount(byDepartment[b]) - getCount(byDepartment[a])).slice(0, 10);
  const chartData = {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce"
        subtitle="Backend-driven workforce records, service status, and department analytics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={loadData} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={createWorkforceForm} loading={creatingForm}>
              Prepare Workforce Form
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total workforce" value={stats?.total ?? workforce.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Currently serving" value={getCount(byStatus.serving)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="No longer serving" value={getCount(byStatus.not_serving)} icon={<Shield className="h-5 w-5" />} />
        <StatCard label="New / pending" value={getCount(byStatus.new) + getCount(byStatus.pending)} icon={<ClipboardList className="h-5 w-5" />} />
      </div>

      <Card
        title="Workforce intake form"
        actions={
          publicFormUrl ? (
            <Button variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(publicFormUrl, '_blank', 'noopener,noreferrer')}>
              Open Form
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {primaryForm?.title || 'No workforce form connected yet'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {publicFormUrl || 'Create and publish the workforce form to collect serving status and department data.'}
            </p>
          </div>
          <Badge variant={primaryForm ? 'success' : 'warning'}>{primaryForm ? 'Backend form active' : 'Setup needed'}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Workers by department">
          {deptLabels.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">{loading ? 'Loading chart...' : 'No department data yet.'}</p>
          ) : (
            <div className="h-[320px]">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                }}
              />
            </div>
          )}
        </Card>

        <Card title="Status breakdown">
          <div className="space-y-3">
            {(Object.keys(statusLabels) as WorkforceStatus[]).map((status) => (
              <div key={status} className="flex items-center justify-between rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{statusLabels[status]}</span>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{getCount(byStatus[status])}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Workforce records">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border-secondary)] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-secondary)]">
              {loading ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={4}>Loading workforce records...</td></tr>
              ) : workforce.length === 0 ? (
                <tr><td className="px-3 py-6 text-[var(--color-text-tertiary)]" colSpan={4}>No workforce records yet.</td></tr>
              ) : (
                workforce.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium text-[var(--color-text-primary)]">{item.firstName} {item.lastName}</td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.department || 'Unassigned'}</td>
                    <td className="px-3 py-3"><Badge variant={item.status === 'serving' ? 'success' : item.status === 'not_serving' ? 'warning' : 'primary'}>{statusLabels[item.status] || item.status}</Badge></td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.email || item.phone || 'No contact'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
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
