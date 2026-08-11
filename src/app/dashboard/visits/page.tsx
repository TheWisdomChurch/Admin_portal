"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

import { PageHeader } from "@/layouts";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { Pagination } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { StatCard } from "@/ui/StatCard";
import { apiClient } from "@/lib/api";
import type { VisitRequestAdmin, VisitStatus } from "@/lib/types";
import { withAuth } from "@/providers/withAuth";

const statuses: VisitStatus[] = [
  "new",
  "confirmed",
  "contacted",
  "arrived",
  "no_show",
  "completed",
  "cancelled",
];

const nextStatuses: Record<VisitStatus, VisitStatus[]> = {
  new: ["confirmed", "contacted", "cancelled"],
  confirmed: ["contacted", "arrived", "no_show", "cancelled"],
  contacted: ["arrived", "no_show", "completed", "cancelled"],
  arrived: ["completed"],
  no_show: ["contacted", "completed"],
  completed: [],
  cancelled: [],
};

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function PlannedVisitsPage() {
  const [items, setItems] = useState<VisitRequestAdmin[]>([]);
  const [status, setStatus] = useState<VisitStatus | "">("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.listVisits({
        page,
        limit: 20,
        status: status || undefined,
      });
      setItems(result.data);
      setTotal(result.total);
      setPages(result.totalPages || 1);
    } catch (error) {
      console.error("Unable to load planned visits", error);
      toast.error("Unable to load the visit pipeline.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () => ({
      action: items.filter(
        (item) => item.status === "new" || item.status === "confirmed",
      ).length,
      arriving: items.filter((item) => item.status === "arrived").length,
      reminders: items.filter((item) => item.reminderSentAt).length,
    }),
    [items],
  );

  const updateStatus = async (visit: VisitRequestAdmin, next: VisitStatus) => {
    setSaving(visit.id);
    try {
      const updated = await apiClient.updateVisit(visit.id, {
        status: next,
        contacted: next === "contacted",
      });
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success("Visit workflow updated.");
    } catch (error) {
      console.error("Unable to update visit", error);
      toast.error("The visit update was not saved.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Planned Visits"
        subtitle="A durable welcome pipeline from registration through arrival and follow-up."
        actions={
          <Button
            variant="outline"
            icon={
              <RefreshCw
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            }
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total visits"
          value={total}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Needs action"
          value={summary.action}
          icon={<Clock3 className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Checked in"
          value={summary.arriving}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Reminders sent"
          value={summary.reminders}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="info"
        />
      </section>

      <SectionCard
        title="Welcome queue"
        subtitle="Filter, contact, and advance each visitor through a recorded lifecycle."
        icon={<CalendarCheck className="h-5 w-5" />}
      >
        <div className="mb-5 max-w-xs">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as VisitStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </Select>
        </div>
        {loading ? (
          <div className="grid min-h-52 place-items-center text-sm text-[var(--color-text-tertiary)]">
            Loading visit pipeline…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title="No planned visits"
            description="New website visit requests will appear here immediately."
          />
        ) : (
          <div className="space-y-4">
            {items.map((visit) => (
              <article
                key={visit.id}
                className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                        {visit.firstName} {visit.lastName}
                      </h3>
                      <Badge variant="outline">{humanize(visit.status)}</Badge>
                      <Badge>{visit.serviceType}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                      {formatDate(visit.serviceAt)} · {visit.attendance}{" "}
                      {visit.attendance === 1 ? "guest" : "guests"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-text-tertiary)]">
                      <a
                        className="inline-flex items-center gap-1.5 hover:underline"
                        href={`mailto:${visit.email}`}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {visit.email}
                      </a>
                      {visit.phone ? (
                        <a
                          className="inline-flex items-center gap-1.5 hover:underline"
                          href={`tel:${visit.phone}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {visit.phone}
                        </a>
                      ) : null}
                    </div>
                    {visit.notes ? (
                      <p className="mt-4 rounded-2xl bg-[var(--color-background-secondary)] p-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {visit.notes}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                      <span>
                        Confirmation:{" "}
                        {visit.confirmationSentAt ? "sent" : "pending"}
                      </span>
                      <span>•</span>
                      <span>
                        Reminder:{" "}
                        {!visit.reminderOptIn
                          ? "opted out"
                          : visit.reminderSentAt
                          ? formatDate(visit.reminderSentAt)
                          : "scheduled"}
                      </span>
                      <span>•</span>
                      <span>
                        Follow-up:{" "}
                        {visit.followUpNotifiedAt
                          ? "escalated"
                          : formatDate(visit.nextFollowUpAt)}
                      </span>
                      <span>•</span>
                      <span>Ref: {visit.id}</span>
                    </div>
                  </div>
                  <div className="w-full xl:w-56">
                    <Select
                      aria-label={`Update ${visit.firstName}'s visit status`}
                      value={visit.status}
                      disabled={saving === visit.id}
                      onChange={(event) =>
                        void updateStatus(
                          visit,
                          event.target.value as VisitStatus,
                        )
                      }
                    >
                      {[visit.status, ...nextStatuses[visit.status]].map((value) => (
                        <option key={value} value={value}>
                          {humanize(value)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {pages > 1 ? (
          <div className="mt-5 flex justify-center">
            <Pagination page={page} pageCount={pages} onPageChange={setPage} />
          </div>
        ) : null}
      </SectionCard>
    </main>
  );
}

export default withAuth(PlannedVisitsPage, { requiredRole: "admin" });
