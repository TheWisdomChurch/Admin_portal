'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  ClipboardList,
  Command,
  Crown,
  Heart,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Store,
  UserRound,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/layouts';
import { Button } from '@/ui/Button';
import { StatCard, type StatCardTone } from '@/ui/StatCard';
import { withAuth } from '@/providers/withAuth';

import {
  apiPost,
  countThisYear,
  countUpcomingEvents,
  extractSubmissionTotal,
  lowStockCount,
  publishedCount,
  loadOverviewData,
  type DashboardTab,
  type PersonRecord,
  type SegmentKey,
  type TrackerMode,
} from './lib';
import { DashboardCharts } from './components/Charts';
import { SegmentAccordion, PeopleTable } from './components/PeopleDirectory';
import { TrackerList, TrackerModal } from './components/Celebrations';
import { Timeline } from './components/ActivityLog';
import { ProfileDrawer } from './components/ProfileDrawer';
import { CommandPalette } from './components/CommandPalette';

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People table' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'activity', label: 'Activity timeline' },
];

function AdminDashboardPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['administration', 'overview'],
    queryFn: loadOverviewData,
  });

  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [trackerMode, setTrackerMode] = useState<TrackerMode | null>(null);
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sendToday = useCallback(
    async (mode: TrackerMode, segment?: SegmentKey) => {
      const requests: string[] = [];

      if (mode === 'birthdays') {
        if (!segment || segment === 'leadership') requests.push('/api/v1/admin/leadership/birthdays/send-today');
        if (!segment || segment === 'members') requests.push('/api/v1/admin/members/birthdays/send-today');
        if (!segment || segment === 'workforce') requests.push('/api/v1/admin/workforce/birthdays/send-today');
      }

      if (mode === 'anniversaries') requests.push('/api/v1/admin/leadership/anniversaries/send-today');

      try {
        await Promise.all(requests.map((path) => apiPost(path)));
        toast.success(mode === 'birthdays' ? 'Birthday greetings triggered successfully.' : 'Anniversary greetings triggered successfully.');
        await refetch();
      } catch (sendError) {
        toast.error(sendError instanceof Error ? sendError.message : 'Failed to trigger greetings.');
      }
    },
    [refetch]
  );

  const trackerItems = trackerMode === 'birthdays' ? data?.upcomingBirthdays ?? [] : data?.upcomingAnniversaries ?? [];
  const auditEndpointAvailable = Boolean(data?.endpointHealth.find((item) => item.label === 'Audit logs')?.available);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { title: 'Profiles', value: data.allPeople.length, trend: `${countThisYear(data.allPeople)} added this year`, icon: Users, tone: 'default' as StatCardTone },
      { title: 'Members', value: data.members.length, trend: `${data.members.filter((item) => ['active', 'approved'].includes(item.status || '')).length} active/approved`, icon: UserRound, tone: 'info' as StatCardTone },
      { title: 'Workforce', value: data.workforce.length, trend: `${data.workforce.filter((item) => item.department).length} with departments`, icon: BriefcaseBusiness, tone: 'success' as StatCardTone },
      { title: 'Leadership', value: data.leadership.length, trend: `${data.leadership.filter((item) => item.anniversaryMonth).length} anniversary records`, icon: Crown, tone: 'warning' as StatCardTone },
      { title: 'Forms', value: data.forms.length, trend: `${publishedCount(data.forms)} live · ${extractSubmissionTotal(data.forms)} submissions`, icon: ClipboardList, tone: 'info' as StatCardTone },
      { title: 'Campaigns', value: data.campaigns.length, trend: `${publishedCount(data.campaigns)} active/live`, icon: Megaphone, tone: 'warning' as StatCardTone },
      { title: 'Events', value: countUpcomingEvents(data.events), trend: `${data.events.length} total records`, icon: CalendarDays, tone: 'info' as StatCardTone },
      { title: 'Store', value: data.storeItems.length, trend: `${lowStockCount(data.storeItems)} low stock items`, icon: Store, tone: 'danger' as StatCardTone },
    ];
  }, [data]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Administration"
        subtitle="People intelligence, celebrations, forms, events, campaigns, store, and audit activity in one workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPaletteOpen(true)} icon={<Command className="h-4 w-4" />}>
              Command palette
            </Button>
            <Button variant="outline" onClick={() => setTrackerMode('birthdays')} icon={<Cake className="h-4 w-4" />}>
              Birthdays
            </Button>
            <Button variant="outline" onClick={() => setTrackerMode('anniversaries')} icon={<Heart className="h-4 w-4" />}>
              Anniversaries
            </Button>
            <Button variant="outline" onClick={() => void refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        }
      />

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="System health" value={`${data.endpointHealth.filter((item) => item.available).length}/${data.endpointHealth.length}`} trend="connected data modules" icon={<ShieldCheck className="h-5 w-5" />} tone="info" />
          <StatCard label="Upcoming events" value={countUpcomingEvents(data.events)} trend={`${data.events.length} event records loaded`} icon={<CalendarDays className="h-5 w-5" />} tone="success" />
          <StatCard label="Form responses" value={extractSubmissionTotal(data.forms)} trend={`${publishedCount(data.forms)} live forms`} icon={<ClipboardList className="h-5 w-5" />} tone="default" />
          <StatCard label="Store low stock" value={lowStockCount(data.storeItems)} trend={`${data.storeItems.length} products loaded`} icon={<Store className="h-5 w-5" />} tone="warning" />
        </div>
      ) : null}

      <div className="sticky top-2 z-30 overflow-x-auto rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/85 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] p-5 text-sm font-medium text-[var(--color-danger-text)]">
          {error instanceof Error ? error.message : 'Failed to load dashboard overview.'}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--color-accent-primary)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--color-text-tertiary)]">Loading dashboard data...</p>
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          {tab === 'overview' ? (
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                  <StatCard key={kpi.title} label={kpi.title} value={kpi.value} trend={kpi.trend} icon={<kpi.icon className="h-5 w-5" />} tone={kpi.tone} />
                ))}
              </section>
              <DashboardCharts data={data} />
              <div className="grid gap-5 xl:grid-cols-2">
                <TrackerList
                  title="Upcoming birthdays"
                  items={data.upcomingBirthdays}
                  icon={<Cake className="h-5 w-5" />}
                  onOpen={(item) => {
                    const person = data.allPeople.find((profile) => profile.id === item.id.replace(`birthdays-${item.segment}-`, ''));
                    if (person) setSelectedPerson(person);
                  }}
                />
                <TrackerList
                  title="Upcoming wedding anniversaries"
                  items={data.upcomingAnniversaries}
                  icon={<Heart className="h-5 w-5" />}
                  onOpen={(item) => {
                    const person = data.allPeople.find((profile) => profile.id === item.id.replace(`anniversaries-${item.segment}-`, ''));
                    if (person) setSelectedPerson(person);
                  }}
                />
              </div>
              <SegmentAccordion data={data} onOpen={setSelectedPerson} />
            </div>
          ) : null}

          {tab === 'people' ? <PeopleTable people={data.allPeople} onOpen={setSelectedPerson} /> : null}
          {tab === 'analytics' ? <DashboardCharts data={data} /> : null}
          {tab === 'activity' ? <Timeline items={data.auditLogs} endpointAvailable={auditEndpointAvailable} /> : null}
        </>
      ) : null}

      <ProfileDrawer person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      <TrackerModal mode={trackerMode} items={trackerItems} onClose={() => setTrackerMode(null)} onSendToday={sendToday} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onRefresh={() => void refetch()} onTab={setTab} />
    </div>
  );
}

export default withAuth(AdminDashboardPage, { requiredRole: 'admin' });
