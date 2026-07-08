import { useEffect, useMemo, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartConfiguration,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js';
import { Activity, BarChart3, Cake, TrendingUp, Users } from 'lucide-react';

import { SectionCard } from '@/ui/SectionCard';
import { useTheme } from '@/providers/ThemeProviders';
import { getChartPalette } from '@/lib/charts/palette';
import { extractSubmissionTotal, MONTH_LABELS, PEOPLE_DISTRIBUTION_LABELS, makeMonthlyGrowth, type DashboardData } from '../lib';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
);

function ChartCanvas<T extends ChartType>({
  type,
  data,
  options,
  className,
}: {
  type: T;
  data: ChartData<T>;
  options?: ChartOptions<T>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS<T> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    chartRef.current?.destroy();

    const defaultPlugins = {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { usePointStyle: true, boxWidth: 8, padding: 18 },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 12,
      },
    };

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' as const },
      plugins: defaultPlugins,
    };

    const mergedOptions = {
      ...defaultOptions,
      ...(options ?? {}),
      plugins: { ...defaultPlugins, ...(options?.plugins ?? {}) },
    } as ChartOptions<T>;

    chartRef.current = new ChartJS(canvas, { type, data, options: mergedOptions } as ChartConfiguration<T>);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [type, data, options]);

  return (
    <div className={`relative min-h-[280px] ${className || ''}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  const growth = useMemo(() => makeMonthlyGrowth(data.allPeople, data.forms, data.events), [data.allPeople, data.forms, data.events]);
  const peopleValues = useMemo(() => [data.leadership.length, data.members.length, data.workforce.length], [data.leadership.length, data.members.length, data.workforce.length]);
  const submissions = useMemo(() => extractSubmissionTotal(data.forms), [data.forms]);
  const birthdayMonthValues = useMemo(() => data.birthdayMonths.map((item) => item.count), [data.birthdayMonths]);
  const anniversaryMonthValues = useMemo(() => data.anniversaryMonths.map((item) => item.count), [data.anniversaryMonths]);
  const growthValues = useMemo(() => growth.map((item) => item.count), [growth]);
  const operationsValues = useMemo(
    () => [data.forms.length, data.campaigns.length, data.events.length, submissions, data.storeItems.length],
    [data.forms.length, data.campaigns.length, data.events.length, submissions, data.storeItems.length]
  );

  const doughnutData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: [...PEOPLE_DISTRIBUTION_LABELS],
      datasets: [
        {
          data: peopleValues,
          backgroundColor: palette.categorical.slice(0, 3),
          borderColor: palette.surface,
          borderWidth: 4,
          hoverOffset: 12,
        },
      ],
    }),
    [peopleValues, palette]
  );

  const monthBarData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: MONTH_LABELS,
      datasets: [
        { label: 'Birthdays', data: birthdayMonthValues, backgroundColor: palette.series.rose.fill, borderRadius: 12 },
        { label: 'Anniversaries', data: anniversaryMonthValues, backgroundColor: palette.series.amber.fill, borderRadius: 12 },
      ],
    }),
    [birthdayMonthValues, anniversaryMonthValues, palette]
  );

  const growthLineData = useMemo<ChartData<'line'>>(
    () => ({
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Recorded growth activity',
          data: growthValues,
          borderColor: palette.series.brand.line,
          backgroundColor: palette.series.brand.fill,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 7,
          tension: 0.42,
          fill: true,
        },
      ],
    }),
    [growthValues, palette]
  );

  const operationsData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: ['Forms', 'Campaigns', 'Events', 'Submissions', 'Products'],
      datasets: [
        {
          label: 'Operations volume',
          data: operationsValues,
          backgroundColor: palette.categorical,
          borderRadius: 14,
        },
      ],
    }),
    [operationsValues, palette]
  );

  const barAxisOptions = useMemo<ChartOptions<'bar'>>(() => ({ scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }), []);
  const lineAxisOptions = useMemo<ChartOptions<'line'>>(() => ({ scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }), []);
  const operationsOptions = useMemo<ChartOptions<'bar'>>(() => ({ ...barAxisOptions, plugins: { legend: { display: false } } }), [barAxisOptions]);
  const doughnutOptions = useMemo<ChartOptions<'doughnut'>>(() => ({ cutout: '66%' }), []);

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SectionCard title="People distribution" subtitle="Live split between leadership, members, and workforce." icon={<Users className="h-5 w-5" />}>
        <ChartCanvas type="doughnut" data={doughnutData} className="min-h-[320px]" options={doughnutOptions} />
      </SectionCard>

      <div className="xl:col-span-3">
        <SectionCard title="Growth intelligence" subtitle="Monthly growth activity from saved profiles, forms, and events for the current year." icon={<TrendingUp className="h-5 w-5" />}>
          <ChartCanvas type="line" data={growthLineData} className="min-h-[320px]" options={lineAxisOptions} />
        </SectionCard>
      </div>

      <div className="xl:col-span-1">
        <SectionCard title="Today" subtitle="Celebration queue." icon={<Cake className="h-5 w-5" />}>
          <div className="space-y-3">
            <MiniMetric label="Birthdays" value={data.todayBirthdays.length} />
            <MiniMetric label="Anniversaries" value={data.todayAnniversaries.length} />
            <MiniMetric label="Upcoming" value={data.upcomingBirthdays.length + data.upcomingAnniversaries.length} />
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-3">
        <SectionCard title="Birthday and anniversary distribution" subtitle="Month-by-month record intelligence from profile data." icon={<BarChart3 className="h-5 w-5" />}>
          <ChartCanvas type="bar" data={monthBarData} className="min-h-[330px]" options={barAxisOptions} />
        </SectionCard>
      </div>

      <div className="xl:col-span-2">
        <SectionCard title="Operations volume" subtitle="Forms, campaigns, events, submissions, and store records from connected endpoints." icon={<Activity className="h-5 w-5" />}>
          <ChartCanvas type="bar" data={operationsData} className="min-h-[330px]" options={operationsOptions} />
        </SectionCard>
      </div>
    </div>
  );
}
