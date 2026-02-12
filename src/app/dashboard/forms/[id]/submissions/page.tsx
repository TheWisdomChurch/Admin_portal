// src/app/dashboard/forms/[id]/submissions/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { DataTable } from '@/components/DateTable';
import { apiClient } from '@/lib/api';
import type { AdminForm, FormSubmission, FormSubmissionDailyStat } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type RangeOption = 7 | 30;

function toISODateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start, end };
}

function fillDailySeries(range: RangeOption, raw: FormSubmissionDailyStat[]) {
  const { start, end } = buildDateRange(range);
  const cursor = new Date(start);
  const map = new Map<string, number>();
  raw.forEach((row) => {
    const key = toISODateOnly(new Date(row.date));
    map.set(key, row.count);
  });

  const labels: string[] = [];
  const values: number[] = [];
  while (cursor <= end) {
    const key = toISODateOnly(cursor);
    labels.push(key);
    values.push(map.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { labels, values };
}

function SubmissionsPage() {
  const router = useRouter();
  const params = useParams();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [stats, setStats] = useState<FormSubmissionDailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState<RangeOption>(7);

  const load = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);

      const [formRes, submissionsRes, statsRes] = await Promise.all([
        apiClient.getAdminForm(formId),
        apiClient.getFormSubmissions(formId, { page, limit }),
        apiClient.getFormSubmissionStats(formId),
      ]);

      setForm(formRes);
      setSubmissions(submissionsRes.data || []);
      setTotal(submissionsRes.total || 0);
      setStats(Array.isArray(statsRes) ? statsRes : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load submissions';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [formId, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const chartSeries = useMemo(() => fillDailySeries(range, stats), [range, stats]);

  const chartData = useMemo(
    () => ({
      labels: chartSeries.labels,
      datasets: [
        {
          label: 'Registrations',
          data: chartSeries.values,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    }),
    [chartSeries]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Name',
        cell: (row: FormSubmission) => row.name || '—',
      },
      {
        key: 'email' as keyof FormSubmission,
        header: 'Email',
        cell: (row: FormSubmission) => row.email || '—',
      },
      {
        key: 'registrationCode' as keyof FormSubmission,
        header: 'Registration Code',
        cell: (row: FormSubmission) => row.registrationCode || '—',
      },
      {
        key: 'createdAt' as keyof FormSubmission,
        header: 'Submitted',
        cell: (row: FormSubmission) => new Date(row.createdAt).toLocaleString(),
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Form Submissions"
          subtitle={form ? form.title : 'Registrations and daily counts'}
        />
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <Card title="Registrations Over Time">
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            variant={range === 7 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setRange(7)}
          >
            Last 7 days
          </Button>
          <Button
            variant={range === 30 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setRange(30)}
          >
            Last 30 days
          </Button>
        </div>
        <div className="h-[260px]">
          <Line data={chartData} options={{ maintainAspectRatio: false, responsive: true }} />
        </div>
      </Card>

      <Card className="p-0">
        <DataTable
          data={submissions}
          columns={columns}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          isLoading={false}
        />
      </Card>
    </div>
  );
}

export default withAuth(SubmissionsPage, { requiredRole: 'admin' });
