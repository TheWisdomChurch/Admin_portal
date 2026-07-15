'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HandCoins, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { Pagination } from '@/ui/Pagination';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/withAuth';
import type { GivingTransactionAdmin, GivingTransactionStatus, GivingMonthlySummaryRow } from '@/lib/types';

function formatMoney(amountKobo: number, currency: string): string {
  const major = amountKobo / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'NGN', maximumFractionDigits: 0 }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

const statusVariant: Record<GivingTransactionStatus, 'warning' | 'success' | 'danger' | 'secondary'> = {
  pending: 'warning',
  success: 'success',
  failed: 'danger',
  reversed: 'secondary',
};

const statusLabel: Record<GivingTransactionStatus, string> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  reversed: 'Reversed',
};

function GivingPage() {
  const [transactions, setTransactions] = useState<GivingTransactionAdmin[]>([]);
  const [summary, setSummary] = useState<GivingMonthlySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | GivingTransactionStatus>('all');

  const loadData = useCallback(async (targetPage: number, status: 'all' | GivingTransactionStatus) => {
    setLoading(true);
    try {
      const [txRes, summaryRes] = await Promise.all([
        apiClient.listGivingTransactions({ page: targetPage, limit: 20, ...(status !== 'all' ? { status } : {}) }),
        apiClient.getGivingMonthlySummary({}),
      ]);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setTotalPages(txRes.totalPages || 1);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
    } catch (error) {
      console.error('Failed to load giving data:', error);
      toast.error('Unable to load giving records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(page, statusFilter); }, [loadData, page, statusFilter]);

  const currentCurrency = transactions[0]?.currency || 'NGN';

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    let thisMonthTotal = 0;
    let allTimeTotal = 0;
    for (const row of summary) {
      allTimeTotal += row.total_kobo;
      if (row.year === thisYear && row.month === thisMonth) {
        thisMonthTotal += row.total_kobo;
      }
    }
    return { thisMonthTotal, allTimeTotal };
  }, [summary]);

  const monthlySeries = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const row of summary) {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + row.total_kobo);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [summary]);

  const columns: TableColumn<GivingTransactionAdmin>[] = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.given_at) },
    { key: 'giver', header: 'Giver', render: (row) => <span className="font-black text-[var(--color-text-primary)]">{row.giver_name || 'Anonymous'}</span> },
    { key: 'category', header: 'Category', render: (row) => row.category?.name || '—' },
    { key: 'channel', header: 'Channel', render: (row) => <span className="uppercase text-xs font-bold">{row.channel}</span> },
    { key: 'provider', header: 'Provider', render: (row) => <span className="capitalize">{row.payment_provider}</span> },
    { key: 'amount', header: 'Amount', className: 'text-right', headerClassName: 'text-right', render: (row) => <span className="font-black tabular-nums">{formatMoney(row.amount_kobo, row.currency)}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant[row.status]}>{statusLabel[row.status]}</Badge> },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Giving"
        subtitle="Every recorded transaction — pending, successful, failed, and reversed."
        actions={
          <Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadData(page, statusFilter)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="This month" value={formatMoney(monthlyTotals.thisMonthTotal, currentCurrency)} icon={<HandCoins className="h-5 w-5" />} tone="success" />
        <StatCard label="All-time (successful)" value={formatMoney(monthlyTotals.allTimeTotal, currentCurrency)} icon={<Wallet className="h-5 w-5" />} tone="info" />
        <StatCard label="Transactions shown" value={transactions.length} icon={<TrendingUp className="h-5 w-5" />} />
      </section>

      {monthlySeries.length > 0 ? (
        <SectionCard title="Recent months" subtitle="Total successful giving by month." icon={<TrendingUp className="h-5 w-5" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {monthlySeries.map(([key, total]) => (
              <div key={key} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--color-text-tertiary)]">{key}</p>
                <p className="mt-2 text-sm font-black tabular-nums text-[var(--color-text-primary)]">{formatMoney(total, currentCurrency)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Transactions"
        icon={<HandCoins className="h-5 w-5" />}
        actions={
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value as 'all' | GivingTransactionStatus); }}
            className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        }
      >
        <Table
          columns={columns}
          data={transactions}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="No giving transactions found"
        />
        {totalPages > 1 ? (
          <div className="mt-4 flex justify-center">
            <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </SectionCard>
    </main>
  );
}

export default withAuth(GivingPage, { requiredRole: 'admin' });
