'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Mail,
  Megaphone,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import type { AdminEmailMarketingSummary, DashboardAnalytics, EventData, FormStatsResponse } from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';

import styles from './dashboard.module.scss';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(value: string, max = 96): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function DashboardPage() {
  const auth = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [marketing, setMarketing] = useState<AdminEmailMarketingSummary | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      try {
        const [analyticsResult, eventsResult, formStatsResult, marketingResult] = await Promise.allSettled([
          apiClient.getAnalytics(),
          apiClient.getEvents({ limit: 4, page: 1 }),
          apiClient.getFormStats(),
          apiClient.getEmailMarketingSummary(),
        ]);

        if (!active) return;

        setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value : null);
        setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.data : []);
        setFormStats(formStatsResult.status === 'fulfilled' ? formStatsResult.value : null);
        setMarketing(marketingResult.status === 'fulfilled' ? marketingResult.value : null);
      } catch (error) {
        console.error(error);
        if (active) {
          toast.error('Failed to load dashboard data');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingOrb} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const firstName = auth.user?.first_name || 'Admin';
  const categoryEntries = Object.entries(analytics?.eventsByCategory ?? {}).sort((a, b) => b[1] - a[1]);
  const maxCategoryValue = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([, count]) => count)) : 1;
  const topForms = marketing?.topForms ?? [];
  const recentCampaigns = marketing?.recentCampaigns ?? [];
  const recentSubmissions = formStats?.recent ?? [];
  const maxAudience = topForms.length > 0 ? Math.max(...topForms.map((item) => item.uniqueRecipients)) : 1;

  const metricCards = [
    {
      label: 'Reachable recipients',
      value: formatNumber(marketing?.reachableRecipients ?? 0),
      hint: 'deduplicated emails collected from form submissions',
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Active forms',
      value: formatNumber(marketing?.publishedForms ?? 0),
      hint: `${formatNumber(marketing?.totalForms ?? 0)} forms currently tracked`,
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      label: 'Campaigns sent',
      value: formatNumber(Number(marketing?.totalCampaigns ?? 0)),
      hint: 'compose history stored by the backend',
      icon: <Megaphone className="h-5 w-5" />,
    },
    {
      label: 'Registrations captured',
      value: formatNumber(formStats?.totalSubmissions ?? 0),
      hint: 'fresh submissions ready for follow-up',
      icon: <Users className="h-5 w-5" />,
    },
  ];

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Wisdom Church Control Room</p>
          <h1>Turn fresh form responses into follow-up, outreach, and movement.</h1>
          <p className={styles.heroText}>
            Welcome back, {firstName}. Your admin workspace now ties form activity and email marketing
            together, so you can see who is responding and move straight into campaign delivery.
          </p>

          <div className={styles.actionRow}>
            <Link href="/dashboard/email-marketing" className={styles.primaryAction}>
              Launch Email Marketing
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/forms" className={styles.secondaryAction}>
              Open Form Builder
            </Link>
          </div>
        </div>

        <aside className={styles.heroPanel}>
          <p className={styles.panelKicker}>Live pulse</p>
          <div className={styles.heroMetric}>
            <span>Audience reach</span>
            <strong>{formatNumber(marketing?.reachableRecipients ?? 0)}</strong>
          </div>
          <div className={styles.heroMetric}>
            <span>Latest campaign</span>
            <strong>{recentCampaigns[0] ? truncate(recentCampaigns[0].subject, 42) : 'No campaigns yet'}</strong>
          </div>
          <div className={styles.heroMetric}>
            <span>Upcoming events</span>
            <strong>{formatNumber(analytics?.upcomingEvents ?? 0)}</strong>
          </div>
        </aside>
      </section>

      <section className={styles.metricGrid}>
        {metricCards.map((item) => (
          <article key={item.label} className={styles.metricCard}>
            <span className={styles.metricIcon}>{item.icon}</span>
            <p className={styles.metricLabel}>{item.label}</p>
            <strong className={styles.metricValue}>{item.value}</strong>
            <p className={styles.metricHint}>{item.hint}</p>
          </article>
        ))}
      </section>

      <div className={styles.storyGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Audience leaders</p>
              <h2>Forms with the strongest email reach</h2>
            </div>
            <Link href="/dashboard/email-marketing" className={styles.panelLink}>
              Review all
            </Link>
          </div>

          {topForms.length > 0 ? (
            <div className={styles.audienceList}>
              {topForms.map((form) => (
                <article key={form.formId} className={styles.audienceCard}>
                  <div className={styles.audienceTop}>
                    <div>
                      <h3>{form.formTitle}</h3>
                      <p>
                        {form.isPublished ? 'Published' : 'Draft'} · Updated {formatDate(form.updatedAt)}
                      </p>
                    </div>
                    <strong>{formatNumber(form.uniqueRecipients)}</strong>
                  </div>

                  <div className={styles.progressTrack}>
                    <span
                      className={styles.progressValue}
                      style={{ width: `${(form.uniqueRecipients / maxAudience) * 100}%` }}
                    />
                  </div>

                  <div className={styles.audienceMeta}>
                    <span>{formatNumber(form.totalSubmissions)} submissions</span>
                    <span>{formatNumber(form.validRecipients)} valid emails</span>
                    <span>{form.lastSubmissionAt ? `Last response ${formatDate(form.lastSubmissionAt)}` : 'No responses yet'}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No form audiences are available yet. Publish forms and collect registrations to build reach.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Campaign log</p>
              <h2>Recent email marketing activity</h2>
            </div>
            <span className={styles.panelLinkStatic}>{formatNumber(Number(marketing?.totalCampaigns ?? 0))} total</span>
          </div>

          {recentCampaigns.length > 0 ? (
            <div className={styles.campaignList}>
              {recentCampaigns.map((item) => (
                <article key={item.id} className={styles.campaignItem}>
                  <div className={styles.campaignHeader}>
                    <h3>{item.subject}</h3>
                    <span className={styles.statusChip} data-status={item.status}>
                      {item.status}
                    </span>
                  </div>
                  <p>{item.targeted} targeted · {item.sent} sent · {item.failed} failed</p>
                  <span className={styles.metaLine}>Started {formatDate(item.startedAt)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              Campaign history will appear here after the first marketing send.
            </p>
          )}
        </section>
      </div>

      <div className={styles.storyGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Submission pulse</p>
              <h2>Most recent form responses</h2>
            </div>
            <span className={styles.panelLinkStatic}>
              {formatNumber(formStats?.totalSubmissions ?? 0)} total
            </span>
          </div>

          {recentSubmissions.length > 0 ? (
            <div className={styles.timeline}>
              {recentSubmissions.slice(0, 6).map((item) => (
                <article key={item.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <div>
                    <h3>{item.formTitle || 'Untitled form'}</h3>
                    <p>{item.name || item.email || 'Anonymous response'}</p>
                  </div>
                  <span className={styles.metaLine}>{formatDate(item.createdAt)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No submission activity yet.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Event mix</p>
              <h2>What is filling the calendar</h2>
            </div>
            <Sparkles className="h-4 w-4" />
          </div>

          {categoryEntries.length > 0 ? (
            <div className={styles.categoryList}>
              {categoryEntries.map(([category, count]) => (
                <article key={category} className={styles.categoryItem}>
                  <div className={styles.categoryMeta}>
                    <span>{category}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className={styles.categoryTrack}>
                    <span
                      className={styles.categoryValue}
                      style={{ width: `${(count / maxCategoryValue) * 100}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              Analytics are not available yet.
            </p>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>Calendar watch</p>
            <h2>Recent and upcoming events</h2>
          </div>
          <span className={styles.panelLinkStatic}>
            {formatNumber(analytics?.totalEvents ?? 0)} tracked
          </span>
        </div>

        {events.length > 0 ? (
          <div className={styles.eventGrid}>
            {events.map((event) => (
              <article key={event.id} className={styles.eventCard}>
                <div className={styles.eventHeader}>
                  <span className={styles.eventIcon}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span className={styles.statusChip} data-status={event.status}>
                    {event.status}
                  </span>
                </div>
                <h3>{event.title}</h3>
                <p>{truncate(event.description || event.shortDescription || 'No description available.', 130)}</p>
                <div className={styles.eventMeta}>
                  <span>{formatDate(event.date || event.startDate)}</span>
                  <span>{event.location || 'Location TBD'}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>
            No event records are available yet.
          </p>
        )}
      </section>
    </div>
  );
}
