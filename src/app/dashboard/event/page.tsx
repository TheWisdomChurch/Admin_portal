'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { Modal } from '@/ui/Modal';
import { apiClient } from '@/lib/api';
import MediaUploadField from '@/components/MediaUploadField';
import { uploadAsset } from '@/lib/uploads';
import type { EventCategory, EventData, EventPayload, EventStatus } from '@/lib/types';

type DraftEvent = {
  title: string;
  shortDescription: string;
  description: string;
  location: string;
  date: string;
  time: string;
  registrationLink: string;
  category: EventCategory;
  imageUrl: string;
};

type NormalizedStatus = 'upcoming' | 'ongoing' | 'completed';

type OpenBuckets = Record<NormalizedStatus, boolean>;

const categoryOptions: EventCategory[] = ['Outreach', 'Conference', 'Workshop', 'Prayer', 'Revival', 'Summit'];

const statusLabel: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  completed: 'Completed',
  happening: 'Happening',
  past: 'Recent',
};

const normalizedStatusLabel: Record<NormalizedStatus, string> = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  completed: 'Completed',
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
  imageUrl: '',
};

function deriveStatus(dateStr: string, now = new Date()): EventStatus {
  const trimmed = dateStr.trim();
  if (!trimmed) return 'upcoming';

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'upcoming';

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const eventDay = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));

  if (eventDay.getTime() === today.getTime()) return 'ongoing';
  if (eventDay.getTime() > today.getTime()) return 'upcoming';
  return 'completed';
}

function normalizeStatus(status?: EventStatus, dateStr = ''): NormalizedStatus {
  if (status === 'ongoing' || status === 'happening') return 'ongoing';
  if (status === 'completed' || status === 'past') return 'completed';
  if (status === 'upcoming') return 'upcoming';

  const derived = deriveStatus(dateStr);
  if (derived === 'ongoing' || derived === 'happening') return 'ongoing';
  if (derived === 'completed' || derived === 'past') return 'completed';
  return 'upcoming';
}

function toRemoteStatus(status?: EventStatus, dateStr = ''): EventStatus {
  const normalized = normalizeStatus(status, dateStr);
  if (normalized === 'ongoing') return 'happening';
  if (normalized === 'completed') return 'past';
  return 'upcoming';
}

function isValidHttpURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toEventPayload(event: EventData, overrides?: Partial<EventPayload>): EventPayload {
  return {
    title: event.title,
    shortDescription: event.shortDescription,
    description: event.description,
    date: event.date,
    time: event.time,
    location: event.location,
    category: event.category,
    status: toRemoteStatus(event.status, event.date),
    isFeatured: event.isFeatured,
    tags: Array.isArray(event.tags) ? event.tags : [],
    registerLink: event.registerLink,
    speaker: event.speaker,
    contactPhone: event.contactPhone,
    image: event.image,
    attendees: event.attendees,
    ...overrides,
  };
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value?: string): string {
  if (!value) return 'No time';

  const [hour, minute] = value.split(':');
  if (!hour || !minute) return value;

  const parsed = new Date();
  parsed.setHours(Number(hour), Number(minute), 0, 0);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const statusToneClass: Record<NormalizedStatus, string> = {
  upcoming: 'bg-[var(--color-info-surface)] text-[var(--color-info-text)] ring-[var(--color-info-border)]',
  ongoing: 'bg-[var(--color-success-surface)] text-[var(--color-success-text)] ring-[var(--color-success-border)]',
  completed: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] ring-[var(--color-border-secondary)]',
};

const bucketBorderClass: Record<NormalizedStatus, string> = {
  upcoming: 'border-[var(--color-info-border)]',
  ongoing: 'border-[var(--color-success-border)]',
  completed: 'border-[var(--color-border-secondary)]',
};

function EventCard({ event, active, onPreview }: { event: EventData; active: boolean; onPreview: (event: EventData) => void }) {
  const normalized = normalizeStatus(event.status, event.date);
  const hasRegisterLink = Boolean(event.registerLink);
  const hasImage = Boolean(event.image);

  return (
    <button
      type="button"
      onClick={() => onPreview(event)}
      className={`group grid w-full gap-4 rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-lg'
          : 'border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-primary)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl ${active ? 'bg-[var(--color-text-inverse)]/10' : 'bg-[var(--color-background-tertiary)]'}`}>
          {hasImage ? (
            <Image src={event.image || ''} alt={event.title} fill className="object-cover" unoptimized />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${active ? 'text-[var(--color-text-inverse)]/50' : 'text-[var(--color-text-tertiary)]'}`}>
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${active ? 'bg-[var(--color-text-inverse)]/10 text-[var(--color-text-inverse)] ring-[var(--color-text-inverse)]/10' : statusToneClass[normalized]}`}>
              {normalizedStatusLabel[normalized]}
            </span>
            {event.isFeatured ? (
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${active ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)] ring-transparent' : 'bg-[var(--color-warning-surface)] text-[var(--color-warning-text)] ring-[var(--color-warning-border)]'}`}>
                Featured
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-2 text-sm font-black">{event.title}</h3>
          <p className={`mt-1 line-clamp-2 text-xs font-semibold leading-5 ${active ? 'text-[var(--color-text-inverse)]/60' : 'text-[var(--color-text-tertiary)]'}`}>
            {event.shortDescription || event.description || 'No description recorded.'}
          </p>
        </div>
      </div>

      <div className={`grid gap-2 rounded-2xl p-3 text-xs font-bold ${active ? 'bg-[var(--color-text-inverse)]/10 text-[var(--color-text-inverse)]/65' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]'}`}>
        <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatDate(event.date)} · {formatTime(event.time)}</span>
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span className="truncate">{event.location || 'No location'}</span></span>
        <span className="flex items-center gap-2"><Tag className="h-4 w-4" />{event.category}</span>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.14em]">
        <span className={hasRegisterLink ? 'text-[var(--color-success-text)]' : active ? 'text-[var(--color-text-inverse)]/40' : 'text-[var(--color-text-tertiary)]'}>
          {hasRegisterLink ? 'CTA ready' : 'No CTA'}
        </span>
        <span className={hasImage ? 'text-[var(--color-info-text)]' : active ? 'text-[var(--color-text-inverse)]/40' : 'text-[var(--color-text-tertiary)]'}>
          {hasImage ? 'Media set' : 'No media'}
        </span>
      </div>
    </button>
  );
}

function PreviewPanel({ event }: { event: EventData | null }) {
  if (!event) {
    return (
      <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Select an event"
          description="Click any event card to inspect its frontend preview, media state, and CTA readiness."
        />
      </section>
    );
  }

  const normalized = normalizeStatus(event.status, event.date);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
      <div className="border-b border-[var(--color-border-secondary)] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Frontend preview</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text-primary)]">{event.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
          This mirrors the public event card state that users will see from saved event data.
        </p>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
          <div className="relative h-64 bg-[var(--color-background-tertiary)]">
            {event.image ? (
              <Image src={event.image} alt={event.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-4 bg-[var(--color-background-primary)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusToneClass[normalized]}`}>{normalizedStatusLabel[normalized]}</span>
              <span className="inline-flex rounded-full bg-[var(--color-background-tertiary)] px-3 py-1 text-xs font-black text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border-secondary)]">{event.category}</span>
            </div>

            <div>
              <h3 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">{event.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                {event.description || event.shortDescription || 'No event description provided.'}
              </p>
            </div>

            <div className="grid gap-3 text-sm font-semibold text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--color-text-tertiary)]" />{formatDate(event.date)} · {formatTime(event.time)}</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" />{event.location || 'No location recorded'}</span>
            </div>

            {event.registerLink ? (
              <a
                href={event.registerLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-text-primary)] px-4 py-2 text-sm font-black text-[var(--color-text-inverse)] transition hover:opacity-90"
              >
                <Link2 className="h-4 w-4" />
                Open registration link
              </a>
            ) : (
              <div className="rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-4 py-3 text-sm font-bold text-[var(--color-warning-text)]">
                Add a registration link if this event needs a public Register button.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Media</p>
            <p className="mt-2 text-sm font-bold text-[var(--color-text-secondary)]">{event.image ? 'Image configured' : 'No image configured'}</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">CTA</p>
            <p className="mt-2 text-sm font-bold text-[var(--color-text-secondary)]">{event.registerLink ? 'Registration link ready' : 'No registration link'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventPage() {
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NormalizedStatus>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [openBuckets, setOpenBuckets] = useState<OpenBuckets>({ upcoming: true, ongoing: true, completed: false });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [requestingDelete, setRequestingDelete] = useState(false);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter((event) => {
      const status = normalizeStatus(event.status, event.date);

      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      return `${event.title} ${event.shortDescription || ''} ${event.description || ''} ${event.location || ''} ${event.category || ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [categoryFilter, events, query, statusFilter]);

  const grouped = useMemo(() => {
    return filteredEvents.reduce(
      (acc, event) => {
        const status = normalizeStatus(event.status, event.date);
        acc[status].push(event);
        return acc;
      },
      { upcoming: [] as EventData[], ongoing: [] as EventData[], completed: [] as EventData[] },
    );
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const upcoming = events.filter((event) => normalizeStatus(event.status, event.date) === 'upcoming').length;
    const ongoing = events.filter((event) => normalizeStatus(event.status, event.date) === 'ongoing').length;
    const completed = events.filter((event) => normalizeStatus(event.status, event.date) === 'completed').length;
    const withCta = events.filter((event) => Boolean(event.registerLink)).length;

    return { total: events.length, upcoming, ongoing, completed, withCta };
  }, [events]);

  const selectedEvent = useMemo(() => {
    return events.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? events[0] ?? null;
  }, [events, filteredEvents, selectedEventId]);

  const previewStatus = useMemo(() => deriveStatus(draft.date), [draft.date]);
  const previewMedia = imagePreview || draft.imageUrl.trim() || '';

  const checklist = useMemo(() => {
    const registerLink = draft.registrationLink.trim();
    const imageUrl = draft.imageUrl.trim();

    return [
      { label: 'Title added', done: Boolean(draft.title.trim()) },
      { label: 'Date and time selected', done: Boolean(draft.date && draft.time) },
      { label: 'Location added', done: Boolean(draft.location.trim()) },
      { label: 'Short description ready', done: Boolean(draft.shortDescription.trim()) },
      { label: 'Media attached', done: Boolean(imageFile || imageUrl) },
      { label: 'Registration link valid or empty', done: !registerLink || isValidHttpURL(registerLink) },
    ];
  }, [draft, imageFile]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getEvents({ page: 1, limit: 80 });
      const list = Array.isArray(res.data) ? res.data : [];
      setEvents(list);
      setSelectedEventId((current) => current || list[0]?.id || '');
    } catch (error) {
      console.error('Failed to load events:', error);
      toast.error('Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const openDeleteModal = useCallback(() => {
    setDeleteReason('');
    setDeleteModalOpen(true);
  }, []);

  const submitDeleteRequest = useCallback(async () => {
    if (!selectedEvent) return;
    const reason = deleteReason.trim();
    if (!reason) {
      toast.error('State a reason for the super admin to review.');
      return;
    }
    setRequestingDelete(true);
    try {
      await apiClient.requestDeleteEvent(selectedEvent.id, reason);
      toast.success('Delete request sent for super admin approval.');
      setDeleteModalOpen(false);
      setDeleteReason('');
    } catch (error) {
      console.error('Failed to request event deletion:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to send delete request');
    } finally {
      setRequestingDelete(false);
    }
  }, [selectedEvent, deleteReason]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const resetDraft = useCallback(() => {
    setDraft(emptyDraft);
    setImageFile(null);

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }, [imagePreview]);

  const closeComposer = () => {
    if (!saving) setShowComposer(false);
  };

  const handleImageFile = (file: File | null) => {
    setImageFile(file);

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    if (!file) {
      setImagePreview(null);
      return;
    }

    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!draft.title.trim() || !draft.date || !draft.time) {
      toast.error('Title, date, and time are required.');
      return;
    }

    if (!draft.location.trim()) {
      toast.error('Location is required.');
      return;
    }

    if (!draft.shortDescription.trim()) {
      toast.error('Short description is required.');
      return;
    }

    const registerLink = draft.registrationLink.trim();
    if (registerLink && !isValidHttpURL(registerLink)) {
      toast.error('Registration link must be a valid http(s) URL.');
      return;
    }

    const imageUrl = draft.imageUrl.trim();
    if (imageUrl && !isValidHttpURL(imageUrl)) {
      toast.error('Image URL must be a valid http(s) URL.');
      return;
    }

    const createPayload: EventPayload = {
      title: draft.title.trim(),
      shortDescription: draft.shortDescription.trim(),
      description: draft.description.trim() || draft.shortDescription.trim(),
      date: draft.date,
      time: draft.time,
      location: draft.location.trim(),
      category: draft.category,
      status: toRemoteStatus(deriveStatus(draft.date), draft.date),
      isFeatured: false,
      tags: [],
      registerLink: registerLink || undefined,
      image: imageUrl || undefined,
    };

    try {
      setSaving(true);

      let created = await apiClient.createEvent(createPayload);
      let uploadedImageURL = createPayload.image;

      if (imageFile) {
        const uploaded = await uploadAsset(imageFile, {
          kind: 'image',
          module: 'events',
          ownerType: 'event',
          ownerId: created.id,
          folder: `events/${created.id}/images`,
        });

        uploadedImageURL = uploaded.publicUrl || uploaded.url;
      }

      if (uploadedImageURL && uploadedImageURL !== created.image) {
        created = await apiClient.updateEvent(created.id, toEventPayload(created, { image: uploadedImageURL }));
      }

      toast.success('Event created successfully');
      setEvents((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedEventId(created.id);
      resetDraft();
      setShowComposer(false);
      setOpenBuckets((current) => ({ ...current, [normalizeStatus(created.status, created.date)]: true }));
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'snapshot'] });
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create, organize, and publish church events with a professional media and registration flow."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadEvents()} disabled={loading} icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setShowComposer(true)} icon={<Plus className="h-4 w-4" />}>
              Create event
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Total events" value={stats.total} trend="All saved event records." />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Upcoming" value={stats.upcoming} tone="info" trend="Future events that should remain visible." />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Ongoing" value={stats.ongoing} tone="success" trend="Happening today or marked as happening." />
        <StatCard icon={<Link2 className="h-5 w-5" />} label="CTA ready" value={stats.withCta} tone="warning" trend="Events with a registration link configured." />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_440px]">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Event operations</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text-primary)]">Events workspace</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">Search, filter, inspect, and manage events by lifecycle status.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px] lg:min-w-[680px]">
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2">
                  <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, location, category..."
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--color-text-tertiary)]"
                  />
                  {query ? (
                    <button type="button" onClick={() => setQuery('')} className="rounded-xl p-1 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | NormalizedStatus)}
                  className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]"
                >
                  <option value="all">All statuses</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as 'all' | EventCategory)}
                  className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-border-focus)]"
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {loading ? (
            <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-10 shadow-sm">
              <div className="flex items-center justify-center gap-3 text-sm font-bold text-[var(--color-text-tertiary)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading events...
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              {(['upcoming', 'ongoing', 'completed'] as const).map((bucket) => {
                const isOpen = openBuckets[bucket];
                const items = grouped[bucket];

                return (
                  <article key={bucket} className={`overflow-hidden rounded-[2rem] border bg-[var(--color-background-primary)] shadow-sm ${bucketBorderClass[bucket]}`}>
                    <button
                      type="button"
                      onClick={() => setOpenBuckets((current) => ({ ...current, [bucket]: !current[bucket] }))}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[var(--color-background-hover)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${statusToneClass[bucket]}`}>
                          {bucket === 'upcoming' ? <CalendarDays className="h-5 w-5" /> : bucket === 'ongoing' ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-[var(--color-text-primary)]">{normalizedStatusLabel[bucket]}</h3>
                          <p className="mt-1 text-sm font-semibold text-[var(--color-text-tertiary)]">{items.length} event{items.length === 1 ? '' : 's'} in this section</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusToneClass[bucket]}`}>{items.length}</span>
                        <ChevronDown className={`h-5 w-5 text-[var(--color-text-tertiary)] transition ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-[var(--color-border-secondary)] p-5">
                        {items.length === 0 ? (
                          <EmptyState
                            icon={<CalendarDays className="h-5 w-5" />}
                            title={`No ${normalizedStatusLabel[bucket].toLowerCase()} events`}
                            description="Create a new event or adjust your filters to see more records."
                          />
                        ) : (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {items.map((event) => (
                              <EventCard key={event.id} event={event} active={selectedEvent?.id === event.id} onPreview={(item) => setSelectedEventId(item.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <PreviewPanel event={selectedEvent} />

          {selectedEvent ? (
            <section className="rounded-[2rem] border border-[var(--color-danger-border,theme(colors.red.200))] bg-[var(--color-background-primary)] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Danger zone</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--color-text-primary)]">Remove this event</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
                This does not delete the event immediately — it sends a ticket to a super admin with your stated reason. The event stays live until they approve it.
              </p>
              <Button variant="outline" className="mt-4 border-red-300 text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={openDeleteModal}>
                Request deletion
              </Button>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Publishing quality</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text-primary)]">Frontend readiness</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
              A professional event should have media, a clear description, date/time, location, and CTA when registration is needed.
            </p>

            <div className="mt-5 grid gap-3">
              {[
                { icon: ImageIcon, title: 'Use event-specific media', body: 'Upload a clear 16:9 event image instead of using generic artwork.' },
                { icon: Link2, title: 'Add CTA links only when needed', body: 'If an event needs registration, use the public form URL as the registration link.' },
                { icon: UsersRound, title: 'Keep the copy user-focused', body: 'Short description should explain what the user gains from attending.' },
              ].map((tip) => (
                <div key={tip.title} className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <div className="flex items-center gap-3">
                    <tip.icon className="h-5 w-5 text-[var(--color-text-tertiary)]" />
                    <div>
                      <p className="text-sm font-black text-[var(--color-text-primary)]">{tip.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">{tip.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      {showComposer ? (
        <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-xl">
          <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 p-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Create event</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-primary)]">Event publishing studio</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">Add event details, media, registration CTA, and preview the public card before saving.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetDraft} disabled={saving}>Reset</Button>
              <Button variant="ghost" onClick={closeComposer} disabled={saving}>Close</Button>
              <Button variant="primary" onClick={handleCreate} loading={saving} disabled={saving} icon={<UploadCloud className="h-4 w-4" />}>Save event</Button>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_430px]">
            <div className="space-y-5">
              <section className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-[var(--color-text-primary)]">Core details</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-tertiary)]">These fields control the event title, display category, location, and schedule.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusToneClass[normalizeStatus(previewStatus, draft.date)]}`}>{statusLabel[previewStatus]}</span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Input label="Title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Event title" />

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--color-text-secondary)]">
                    Category
                    <select
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                      value={draft.category}
                      onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as EventCategory }))}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>

                  <Input label="Short description" value={draft.shortDescription} onChange={(event) => setDraft((current) => ({ ...current, shortDescription: event.target.value }))} placeholder="Quick summary for frontend cards" />
                  <Input label="Location" value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Event location" />
                  <Input label="Date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
                  <Input label="Time" type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
                <h3 className="text-lg font-black text-[var(--color-text-primary)]">Registration and media</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-tertiary)]">Registration link powers the frontend CTA. Uploaded media is stored with your existing asset upload flow.</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Input
                    label="Registration link (CTA)"
                    value={draft.registrationLink}
                    onChange={(event) => setDraft((current) => ({ ...current, registrationLink: event.target.value }))}
                    placeholder="https://your-domain.com/forms/your-form-slug"
                    helperText="This becomes the Register button destination on frontend."
                  />

                  <Input
                    label="Image URL (optional)"
                    value={draft.imageUrl}
                    onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))}
                    placeholder="https://..."
                    helperText="Use this only when the image is already hosted."
                  />

                  <div className="md:col-span-2">
                    <MediaUploadField field={{ key: 'image', label: 'Event image', type: 'image', validation: { max: 10 } }} value={imageFile} onChange={handleImageFile} />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
                <h3 className="text-lg font-black text-[var(--color-text-primary)]">Full description</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-tertiary)]">Use this section to explain the event purpose, expectations, and who should attend.</p>

                <textarea
                  className="mt-5 min-h-[180px] w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-sm leading-7 outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What is this event about?"
                />
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Live Preview</p>

                <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                  <div className="relative h-56 bg-[var(--color-background-tertiary)]">
                    {previewMedia ? (
                      <Image src={previewMedia} alt="Event preview" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-[var(--color-text-tertiary)]">Upload image to preview the event card</div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusToneClass[normalizeStatus(previewStatus, draft.date)]}`}>{statusLabel[previewStatus]}</span>
                      <span className="inline-flex rounded-full bg-[var(--color-background-tertiary)] px-3 py-1 text-xs font-black text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border-secondary)]">{draft.category}</span>
                    </div>

                    <h4 className="text-xl font-black text-[var(--color-text-primary)]">{draft.title || 'Event title'}</h4>
                    <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{(draft.description || draft.shortDescription || 'Event description will appear here.').trim()}</p>
                    <p className="text-xs font-bold text-[var(--color-text-tertiary)]">{draft.date || 'YYYY-MM-DD'} · {draft.time || 'HH:MM'} · {draft.location || 'Location'}</p>
                    <Button size="sm" variant="outline" disabled>{draft.registrationLink.trim() ? 'Register now' : 'Add registration link'}</Button>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Quality checklist</p>
                <h3 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">Before publishing</h3>

                <div className="mt-4 grid gap-3">
                  {checklist.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.done ? 'bg-[var(--color-success-surface)] text-[var(--color-success-text)]' : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-[var(--color-text-secondary)]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      ) : null}

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} size="sm" labelledBy="delete-event-title">
        <div className="p-1">
          <h2 id="delete-event-title" className="text-lg font-black text-[var(--color-text-primary)]">
            Request deletion{selectedEvent ? `: ${selectedEvent.title}` : ''}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            A super admin will review this before the event comes off the site. Be specific — this ticket is what they&apos;ll base their decision on.
          </p>
          <textarea
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            rows={4}
            placeholder="Why should this event be removed?"
            className="mt-4 w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={requestingDelete}>Cancel</Button>
            <Button variant="danger" loading={requestingDelete} onClick={() => void submitDeleteRequest()}>Send request</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

export default withAuth(EventPage, { requiredRole: 'admin' });
