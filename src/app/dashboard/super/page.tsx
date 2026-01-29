'use client';

import { useMemo, useState } from 'react';
import { BarChart3, CheckCircle, Clock, Filter, RefreshCcw, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { useSuperQueues, ApprovalItem } from '@/hooks/useSuperQueues';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';
import { useAuthContext } from '@/providers/AuthProviders';

function SuperDashboard() {
  const auth = useAuthContext();
  const { items, loading, refresh, approveItem, stats } = useSuperQueues();
  const { searchTerm, setSearchTerm } = useDashboardSearch('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'testimonial' | 'workforce'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items
      .filter((item) => (typeFilter === 'all' ? true : item.type === typeFilter))
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
  }, [items, searchTerm, typeFilter, sortBy]);

  const workforceSpotlight = filteredItems.filter((item) => item.type === 'workforce').slice(0, 3);

  const handleApprove = async (item: ApprovalItem) => {
    setApprovingId(item.id);
    await approveItem(item);
    setApprovingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Control"
        subtitle="Approve, prioritize, and analyze everything from one focused view."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 bg-gradient-to-br from-amber-50 via-white to-sky-50 border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500">Approvals</p>
              <p className="mt-2 text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">{stats.total}</p>
              <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">items awaiting decision</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-blue-500">Testimonials</p>
              <p className="mt-2 text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">{stats.testimonials}</p>
              <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">stories pending approval</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-emerald-50 via-white to-green-50 border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-500">Workforce</p>
              <p className="mt-2 text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">{stats.workforce}</p>
              <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">new joiners to review</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-slate-50 via-white to-amber-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Owner</p>
              <p className="mt-2 text-lg md:text-xl font-semibold text-[var(--color-text-primary)]">
                {auth.user?.first_name} {auth.user?.last_name}
              </p>
              <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">Super admin oversight</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Approval queue"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-sm text-[var(--color-text-tertiary)]">
              {filteredItems.length} showing
            </div>
            <label className="text-[11px] md:text-xs text-[var(--color-text-tertiary)] hidden sm:block">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-xs md:text-sm"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={typeFilter === 'all' ? 'primary' : 'ghost'}
              icon={<Filter className="h-4 w-4" />}
              onClick={() => setTypeFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={typeFilter === 'testimonial' ? 'primary' : 'ghost'}
              onClick={() => setTypeFilter('testimonial')}
            >
              Testimonials
            </Button>
            <Button
              size="sm"
              variant={typeFilter === 'workforce' ? 'primary' : 'ghost'}
              onClick={() => setTypeFilter('workforce')}
            >
              Workforce
            </Button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search approvals, names, departments..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">Loading queue...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">No approvals match this filter.</p>
          ) : (
            filteredItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 hover:-translate-y-0.5 hover:shadow-sm transition"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-11 w-11 rounded-[var(--radius-button)] flex items-center justify-center ${
                        item.type === 'testimonial'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.type === 'testimonial' ? (
                        <Sparkles className="h-5 w-5" />
                      ) : (
                        <Users className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm md:text-base font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                        <Badge variant="outline" size="sm">
                          {item.type === 'testimonial' ? 'Testimonial' : 'Workforce'}
                        </Badge>
                        <Badge
                          variant={item.status === 'pending' ? 'warning' : 'info'}
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] md:text-xs text-[var(--color-text-tertiary)] mt-1">
                        {new Date(item.submittedAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm md:text-base text-[var(--color-text-secondary)]">{item.summary}</p>
                      {item.department && (
                        <p className="mt-1 text-[11px] md:text-xs text-[var(--color-text-tertiary)]">Department: {item.department}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                    {item.email && (
                      <Badge variant="secondary" size="sm" className="text-[11px]">
                        {item.email}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item)}
                      loading={approvingId === item.id}
                      icon={<CheckCircle className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-right">
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reload queue
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Workforce spotlight">
          {workforceSpotlight.length === 0 ? (
            <p className="text-xs md:text-sm text-[var(--color-text-tertiary)]">No workforce submissions match the filters.</p>
          ) : (
            <div className="space-y-3">
              {workforceSpotlight.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm md:text-base font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                      <Badge variant="success" size="sm">High priority</Badge>
                    </div>
                    <p className="text-[11px] md:text-xs text-[var(--color-text-tertiary)] mt-1">
                      {new Date(item.submittedAt).toLocaleDateString()} • {item.department || 'General'}
                    </p>
                    <p className="mt-2 text-sm md:text-base text-[var(--color-text-secondary)]">{item.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                    <Button
                      size="sm"
                      variant="outline"
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
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Activity pulse">
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Super tools</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">New super-admin routes added for analytics, reports, and approvals.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3">
              <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Responsive sidebar</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Tablet-friendly icon rail with a super admin toggle and new settings entry.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Search-ready</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Navbar and page searches now filter the queues instantly.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(SuperDashboard, { requiredRole: 'super_admin' });
