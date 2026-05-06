'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
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

function toBackendStatus(status?: EventStatus, dateStr = ''): EventStatus {
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
    status: toBackendStatus(event.status, event.date),
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

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value?: string): string {
  if (!value) return 'No time';

  const [hour, minute] = value.split(':');
  if (!hour || !minute) return value;

  const parsed = new Date();
  parsed.setHours(Number(hour), Number(minute), 0, 0);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusTone(status: NormalizedStatus): string {
  const tones: Record<NormalizedStatus, string> = {
    upcoming: 'bg-blue-50 text-blue-700 ring-blue-200',
    ongoing: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    completed: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return tones[status];
}

function bucketBorder(status: NormalizedStatus): string {
  const tones: Record<NormalizedStatus, string> = {
    upcoming: 'border-blue-200',
    ongoing: 'border-emerald-200',
    completed: 'border-slate-200',
  };

  return tones[status];
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <CalendarDays className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-black text-slate-800">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function EventCard({
  event,
  active,
  onPreview,
}: {
  event: EventData;
  active: boolean;
  onPreview: (event: EventData) => void;
}) {
  const normalized = normalizeStatus(event.status, event.date);
  const hasRegisterLink = Boolean(event.registerLink);
  const hasImage = Boolean(event.image);

  return (
    <button
      type="button"
      onClick={() => onPreview(event)}
      className={`group grid w-full gap-4 rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'border-slate-200 bg-white text-slate-950'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl ${active ? 'bg-white/10' : 'bg-slate-100'}`}>
          {hasImage ? (
            <Image src={event.image || ''} alt={event.title} fill className="object-cover" unoptimized />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${active ? 'text-white/50' : 'text-slate-400'}`}>
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${active ? 'bg-white/10 text-white ring-white/10' : statusTone(normalized)}`}>
              {normalizedStatusLabel[normalized]}
            </span>
            {event.isFeatured ? (
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${active ? 'bg-amber-400 text-slate-950 ring-amber-300' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                Featured
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-2 text-sm font-black">{event.title}</h3>
          <p className={`mt-1 line-clamp-2 text-xs font-semibold leading-5 ${active ? 'text-white/60' : 'text-slate-500'}`}>
            {event.shortDescription || event.description || 'No description recorded.'}
          </p>
        </div>
      </div>

      <div className={`grid gap-2 rounded-2xl p-3 text-xs font-bold ${active ? 'bg-white/10 text-white/65' : 'bg-slate-50 text-slate-500'}`}>
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {formatDate(event.date)} · {formatTime(event.time)}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{event.location || 'No location'}</span>
        </span>
        <span className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {event.category}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.14em]">
        <span className={hasRegisterLink ? (active ? 'text-emerald-300' : 'text-emerald-600') : active ? 'text-white/40' : 'text-slate-400'}>
          {hasRegisterLink ? 'CTA ready' : 'No CTA'}
        </span>
        <span className={hasImage ? (active ? 'text-blue-300' : 'text-blue-600') : active ? 'text-white/40' : 'text-slate-400'}>
          {hasImage ? 'Media set' : 'No media'}
        </span>
      </div>
    </button>
  );
}

function PreviewPanel({ event }: { event: EventData | null }) {
  if (!event) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <EmptyState
          title="Select an event"
          description="Click any event card to inspect its frontend preview, media state, and CTA readiness."
        />
      </section>
    );
  }

  const normalized = normalizeStatus(event.status, event.date);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Frontend preview</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{event.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This mirrors the public event card state that users will see from saved backend data.
        </p>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
          <div className="relative h-64 bg-slate-100">
            {event.image ? (
              <Image src={event.image} alt={event.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-4 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(normalized)}`}>
                {normalizedStatusLabel[normalized]}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                {event.category}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">{event.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {event.description || event.shortDescription || 'No event description provided.'}
              </p>
            </div>

            <div className="grid gap-3 text-sm font-semibold text-slate-600">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                {formatDate(event.date)} · {formatTime(event.time)}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                {event.location || 'No location recorded'}
              </span>
            </div>

            {event.registerLink ? (
              <a
                href={event.registerLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
              >
                <Link2 className="h-4 w-4" />
                Open registration link
              </a>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                Add a registration link if this event needs a public Register button.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Media</p>
            <p className="mt-2 text-sm font-bold text-slate-700">{event.image ? 'Image configured' : 'No image configured'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">CTA</p>
            <p className="mt-2 text-sm font-bold text-slate-700">{event.registerLink ? 'Registration link ready' : 'No registration link'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventPage() {
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
  const [openBuckets, setOpenBuckets] = useState<OpenBuckets>({
    upcoming: true,
    ongoing: true,
    completed: false,
  });

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

    return {
      total: events.length,
      upcoming,
      ongoing,
      completed,
      withCta,
    };
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
    if (!saving) {
      setShowComposer(false);
    }
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
      status: toBackendStatus(deriveStatus(draft.date), draft.date),
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
        created = await apiClient.updateEvent(
          created.id,
          toEventPayload(created, {
            image: uploadedImageURL,
          }),
        );
      }

      toast.success('Event created successfully');
      setEvents((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedEventId(created.id);
      resetDraft();
      setShowComposer(false);
      setOpenBuckets((current) => ({
        ...current,
        [normalizeStatus(created.status, created.date)]: true,
      }));
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
            <Button
              variant="outline"
              onClick={() => void loadEvents()}
              disabled={loading}
              icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            >
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setShowComposer(true)} icon={<Plus className="h-4 w-4" />}>
              Create event
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Total events"
          value={stats.total}
          hint="All event records returned by the backend."
        />
        <StatCard
          icon={Sparkles}
          label="Upcoming"
          value={stats.upcoming}
          hint="Future events that should remain visible to users."
        />
        <StatCard
          icon={Clock3}
          label="Ongoing"
          value={stats.ongoing}
          hint="Events happening today or marked as happening."
        />
        <StatCard
          icon={Link2}
          label="CTA ready"
          value={stats.withCta}
          hint="Events with a registration link configured."
        />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_440px]">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Event operations</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Events workspace</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Search, filter, inspect, and manage events by lifecycle status.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px] lg:min-w-[680px]">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, location, category..."
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | NormalizedStatus)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All statuses</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as 'all' | EventCategory)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {loading ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
              <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
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
                  <article key={bucket} className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm ${bucketBorder(bucket)}`}>
                    <button
                      type="button"
                      onClick={() => setOpenBuckets((current) => ({ ...current, [bucket]: !current[bucket] }))}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${statusTone(bucket)}`}>
                          {bucket === 'upcoming' ? <CalendarDays className="h-5 w-5" /> : bucket === 'ongoing' ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-950">{normalizedStatusLabel[bucket]}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {items.length} event{items.length === 1 ? '' : 's'} in this section
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(bucket)}`}>
                          {items.length}
                        </span>
                        <ChevronDown className={`h-5 w-5 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-slate-100 p-5">
                        {items.length === 0 ? (
                          <EmptyState
                            title={`No ${normalizedStatusLabel[bucket].toLowerCase()} events`}
                            description="Create a new event or adjust your filters to see more records."
                          />
                        ) : (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {items.map((event) => (
                              <EventCard
                                key={event.id}
                                event={event}
                                active={selectedEvent?.id === event.id}
                                onPreview={(item) => setSelectedEventId(item.id)}
                              />
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

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Publishing quality</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Frontend readiness</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A professional event should have media, a clear description, date/time, location, and CTA when registration is needed.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-black text-slate-800">Use event-specific media</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Upload a clear 16:9 event image instead of using generic artwork.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-black text-slate-800">Add CTA links only when needed</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">If an event needs registration, use the public form URL as the registration link.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <UsersRound className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-black text-slate-800">Keep the copy user-focused</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Short description should explain what the user gains from attending.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {showComposer ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Create event</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Event publishing studio</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Add event details, media, registration CTA, and preview the public card before saving.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetDraft} disabled={saving}>
                Reset
              </Button>
              <Button variant="ghost" onClick={closeComposer} disabled={saving}>
                Close
              </Button>
              <Button variant="primary" onClick={handleCreate} loading={saving} disabled={saving} icon={<UploadCloud className="h-4 w-4" />}>
                Save event
              </Button>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_430px]">
            <div className="space-y-5">
              <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Core details</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">These fields control the event title, display category, location, and schedule.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(normalizeStatus(previewStatus, draft.date))}`}>
                    {statusLabel[previewStatus]}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Input
                    label="Title"
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Event title"
                  />

                  <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
                    Category
                    <select
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                      value={draft.category}
                      onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as EventCategory }))}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Input
                    label="Short description"
                    value={draft.shortDescription}
                    onChange={(event) => setDraft((current) => ({ ...current, shortDescription: event.target.value }))}
                    placeholder="Quick summary for frontend cards"
                  />

                  <Input
                    label="Location"
                    value={draft.location}
                    onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                    placeholder="Event location"
                  />

                  <Input
                    label="Date"
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  />

                  <Input
                    label="Time"
                    type="time"
                    value={draft.time}
                    onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                  />
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-black text-slate-950">Registration and media</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Registration link powers the frontend CTA. Uploaded media is stored with your existing asset upload flow.
                </p>

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
                    <MediaUploadField
                      field={{ key: 'image', label: 'Event image', type: 'image', validation: { max: 10 } }}
                      value={imageFile}
                      onChange={handleImageFile}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-black text-slate-950">Full description</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Use this section to explain the event purpose, expectations, and who should attend.
                </p>

                <textarea
                  className="mt-5 min-h-[180px] w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-sm leading-7 outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What is this event about?"
                />
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Live Preview</p>

                <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                  <div className="relative h-56 bg-slate-100">
                    {previewMedia ? (
                      <Image src={previewMedia} alt="Event preview" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                        Upload image to preview the event card
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(normalizeStatus(previewStatus, draft.date))}`}>
                        {statusLabel[previewStatus]}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                        {draft.category}
                      </span>
                    </div>

                    <h4 className="text-xl font-black text-slate-950">{draft.title || 'Event title'}</h4>
                    <p className="text-sm leading-7 text-slate-600">
                      {(draft.description || draft.shortDescription || 'Event description will appear here.').trim()}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {draft.date || 'YYYY-MM-DD'} · {draft.time || 'HH:MM'} · {draft.location || 'Location'}
                    </p>
                    <Button size="sm" variant="outline" disabled>
                      {draft.registrationLink.trim() ? 'Register now' : 'Add registration link'}
                    </Button>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Quality checklist</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Before publishing</h3>

                <div className="mt-4 grid gap-3">
                  {checklist.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default withAuth(EventPage, { requiredRole: 'admin' });
