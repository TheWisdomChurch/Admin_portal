// src/app/dashboard/event/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { apiClient } from '@/lib/api';
import type { EventCategory, EventData, EventPayload, EventStatus } from '@/lib/types';

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const categoryOptions: EventCategory[] = [
  'Outreach',
  'Conference',
  'Workshop',
  'Prayer',
  'Revival',
  'Summit',
];

const statusLabel: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  happening: 'Happening',
  past: 'Recent',
};

type DraftEvent = {
  title: string;
  shortDescription: string;
  description: string;
  location: string;
  date: string;
  time: string;
  registrationLink: string;
  category: EventCategory;
  bannerImage?: string;
};

const emptyDraft: DraftEvent = {
  title: '',
  shortDescription: '',
  description: '',
  location: '',
  date: '',
  time: '',
  registrationLink: '',
  category: 'Conference',
  bannerImage: '',
};

function deriveStatus(dateStr: string, now = new Date()): EventStatus {
  const trimmed = dateStr.trim();
  if (!trimmed) return 'upcoming';
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'upcoming';

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const eventDay = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));

  if (eventDay.getTime() === today.getTime()) return 'happening';
  if (eventDay.getTime() > today.getTime()) return 'upcoming';
  return 'past';
}

function EventPage() {
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return events.reduce(
      (acc, ev) => {
        const status = ev.status ?? deriveStatus(ev.date);
        acc[status].push(ev);
        return acc;
      },
      { upcoming: [] as EventData[], happening: [] as EventData[], past: [] as EventData[] }
    );
  }, [events]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getEvents({ page: 1, limit: 50 });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast.error('Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setBannerFile(null);
    setBannerPreview(null);
  };

  const handleBannerFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_BANNER_TYPES.includes(file.type)) {
      toast.error('Banner must be JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      toast.error(`Banner must be ${MAX_BANNER_MB}MB or smaller.`);
      return;
    }
    setBannerFile(file);
    const preview = URL.createObjectURL(file);
    setBannerPreview(preview);
  };

  const handleCreate = async () => {
    if (!draft.title.trim() || !draft.date || !draft.time) {
      toast.error('Title, date, and time are required');
      return;
    }
    if (!draft.location.trim()) {
      toast.error('Location is required');
      return;
    }
    if (!draft.shortDescription.trim()) {
      toast.error('Short description is required');
      return;
    }

    const payload: EventPayload = {
      title: draft.title.trim(),
      shortDescription: draft.shortDescription.trim(),
      description: draft.description.trim() || draft.shortDescription.trim(),
      date: draft.date,
      time: draft.time,
      location: draft.location.trim(),
      category: draft.category,
      status: deriveStatus(draft.date),
      isFeatured: false,
      tags: [],
      registerLink: draft.registrationLink.trim() || undefined,
      bannerImage: draft.bannerImage?.trim() || undefined,
    };

    try {
      setSaving(true);
      let created = await apiClient.createEvent(payload);

      if (bannerFile) {
        try {
          created = await apiClient.uploadEventBanner(created.id, bannerFile);
        } catch (uploadErr) {
          console.error('Banner upload failed:', uploadErr);
          toast.error('Event saved, but banner upload failed.');
        }
      }

      toast.success('Event created');
      setEvents((prev) => [created, ...prev]);
      resetDraft();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create events and keep the calendar in sync with the public site."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Create event
          </Button>
        }
      />

      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(['upcoming', 'happening', 'past'] as const).map((bucket) => (
            <Card key={bucket} title={statusLabel[bucket]}>
              {grouped[bucket].length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">No {statusLabel[bucket].toLowerCase()} events.</p>
              ) : (
                <ul className="space-y-2">
                  {grouped[bucket].map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                    >
                      <p className="font-semibold text-[var(--color-text-primary)] truncate">{ev.title}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                        {ev.date} • {ev.time} • {ev.location}
                      </p>
                      {ev.registerLink && (
                        <p className="text-xs text-[var(--color-accent-primary)] truncate mt-1">
                          {ev.registerLink}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
                        <span>{ev.category}</span>
                        <span className="uppercase tracking-[0.2em]">{ev.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Create event</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Title
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Event title"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Category
              <select
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value as EventCategory }))
                }
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)] md:col-span-2">
              Short description
              <Input
                value={draft.shortDescription}
                onChange={(e) => setDraft((d) => ({ ...d, shortDescription: e.target.value }))}
                placeholder="Quick summary for cards and highlights"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Date
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Time
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Location
              <Input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="Location"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Registration link
              <Input
                value={draft.registrationLink}
                onChange={(e) => setDraft((d) => ({ ...d, registrationLink: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Description
              <textarea
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="What is this event about?"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)] md:col-span-2">
              Banner image URL
              <Input
                value={draft.bannerImage || ''}
                onChange={(e) => setDraft((d) => ({ ...d, bannerImage: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)] md:col-span-2">
              Or upload banner
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleBannerFile(e.target.files?.[0])}
              />
            </label>
          </div>

          {bannerPreview && (
            <div className="mt-4">
              <Image
                src={bannerPreview}
                alt="Banner preview"
                width={1200}
                height={400}
                className="w-full max-h-64 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
                unoptimized
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={handleCreate} loading={saving} disabled={saving}>
              Save event
            </Button>
            <Button variant="outline" onClick={resetDraft} disabled={saving}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(EventPage, { requiredRole: 'admin' });
