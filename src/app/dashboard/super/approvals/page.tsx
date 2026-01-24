'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';
import { useSuperQueues, ApprovalItem } from '@/hooks/useSuperQueues';
import { CheckCircle, Clock, Filter, RefreshCcw, Search, ShieldCheck, Users, XCircle } from 'lucide-react';

function ApprovalsPage() {
  const { items, loading, refresh, approveItem } = useSuperQueues();
  const { searchTerm, setSearchTerm } = useDashboardSearch('');

  const [typeFilter, setTypeFilter] = useState<'all' | 'testimonial' | 'workforce'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'new' | 'flagged'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items
      .filter((item) => (typeFilter === 'all' ? true : item.type === typeFilter))
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;
        const haystack = `${item.name} ${item.summary} ${item.department ?? ''} ${item.email ?? ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'oldest') {
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        }
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [items, searchTerm, statusFilter, typeFilter, sortBy]);

  const handleApprove = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    await approveItem(item);
    setApprovingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Deep dive into every testimonial and workforce approval."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs px-3" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
            <Button variant="outline" size="sm" className="text-xs px-3" onClick={refresh} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={typeFilter === 'all' ? 'primary' : 'ghost'}
              icon={<Filter className="h-4 w-4" />}
              onClick={() => setTypeFilter('all')}
            >
              All types
            </Button>
            <Button
              size="sm"
              variant={typeFilter === 'testimonial' ? 'primary' : 'ghost'}
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => setTypeFilter('testimonial')}
            >
              Testimonials
            </Button>
            <Button
              size="sm"
              variant={typeFilter === 'workforce' ? 'primary' : 'ghost'}
              icon={<Users className="h-4 w-4" />}
              onClick={() => setTypeFilter('workforce')}
            >
              Workforce
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'pending' ? 'primary' : 'ghost'}
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'new' ? 'primary' : 'ghost'}
              onClick={() => setStatusFilter('new')}
            >
              New
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'flagged' ? 'primary' : 'ghost'}
              onClick={() => setStatusFilter('flagged')}
            >
              Flagged
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatusFilter('all')}
              icon={<XCircle className="h-4 w-4" />}
            >
              Reset filters
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, department, story..."
                className="pl-10"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-xs md:text-sm"
            >
              <option value="recent">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm md:text-base">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border-secondary)]">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Summary</th>
                <th className="py-3 pr-4">Submitted</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-6 text-center text-[var(--color-text-tertiary)]" colSpan={6}>
                    Loading approvals...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-[var(--color-text-tertiary)]" colSpan={6}>
                    No approvals found for these filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--color-border-secondary)] last:border-0 hover:bg-[var(--color-background-hover)] transition-colors"
                  >
                    <td className="py-3 pr-4 font-semibold text-[var(--color-text-primary)]">{item.name}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" size="sm">
                        {item.type === 'testimonial' ? 'Testimonial' : 'Workforce'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)] max-w-lg">
                      <div className="line-clamp-2">{item.summary}</div>
                      {item.email && (
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{item.email}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-tertiary)]">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {new Date(item.submittedAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={item.status === 'pending' ? 'warning' : 'info'} size="sm">
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSearchTerm(item.department || item.name)}
                        >
                          Filter similar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item)}
                          loading={approvingId === item.id}
                          icon={<CheckCircle className="h-4 w-4" />}
                        >
                          Approve
                        </Button>
                      </div>
                    </td>
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

export default withAuth(ApprovalsPage, { requiredRole: 'super_admin' });
