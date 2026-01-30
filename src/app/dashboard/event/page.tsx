'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import toast from 'react-hot-toast';

type PublicationStatus = 'published' | 'needs_approval';
type TimingStatus = 'upcoming' | 'happening' | 'past';

type DraftEvent = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  time: string;
  registrationLink: string;
  sessions: Array<{ id: string; title: string; date: string; time: string }>;
  publicationStatus: PublicationStatus;
  bannerImage?: string;
};

type EventWithStatus = DraftEvent & {
  id: string;
  timingStatus: TimingStatus;
  createdAt: string;
};

function statusFromDates(ev: DraftEvent): TimingStatus {
  const now = new Date();
  const start = ev.startDate ? new Date(ev.startDate) : now;
  const end = ev.endDate ? new Date(ev.endDate) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'upcoming';
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'happening';
}

function EventPage() {
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    time: '',
    registrationLink: '',
    sessions: [
      { id: 'sess-morning', title: 'Morning session', date: '', time: '' },
      { id: 'sess-evening', title: 'Evening session', date: '', time: '' },
    ],
    publicationStatus: 'needs_approval',
    bannerImage: '',
  });
  const [events, setEvents] = useState<EventWithStatus[]>([]);
  const [preview, setPreview] = useState<EventWithStatus | null>(null);

  const grouped = useMemo(() => {
    return events.reduce(
      (acc, ev) => {
        acc[ev.timingStatus].push(ev);
        return acc;
      },
      { upcoming: [] as EventWithStatus[], happening: [] as EventWithStatus[], past: [] as EventWithStatus[] }
    );
  }, [events]);

  const resetDraft = () =>
    setDraft({
      title: '',
      description: '',
      location: '',
      startDate: '',
      endDate: '',
      time: '',
      registrationLink: '',
      sessions: [
        { id: `sess-${Date.now()}`, title: 'Session 1', date: '', time: '' },
      ],
      publicationStatus: 'needs_approval',
      bannerImage: '',
    });

  const updateSession = (id: string, key: 'title' | 'date' | 'time', value: string) => {
    setDraft((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    }));
  };

  const addSession = () => {
    setDraft((prev) => ({
      ...prev,
      sessions: [
        ...prev.sessions,
        { id: `sess-${Date.now()}`, title: `Session ${prev.sessions.length + 1}`, date: prev.startDate, time: '' },
      ],
    }));
  };

  const removeSession = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== id),
    }));
  };

  const handleCreate = () => {
    if (!draft.title || !draft.startDate || !draft.time) {
      toast.error('Title, start date, and time are required');
      return;
    }
    if (!draft.location) {
      toast.error('Location is required');
      return;
    }
    const timingStatus = statusFromDates(draft);
    setEvents((prev) => [
      { ...draft, id: `evt-${Date.now()}`, timingStatus, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    toast.success('Event created');
    resetDraft();
    setShowModal(false);
  };

  const handlePreview = () => {
    if (!draft.title) {
      toast.error('Add a title before previewing');
      return;
    }
    const timingStatus = statusFromDates(draft);
    setPreview({
      ...draft,
      id: 'preview',
      timingStatus,
      createdAt: new Date().toISOString(),
    });
    toast.success('Preview generated');
  };

  const handleBannerFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, bannerImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create events with start/end dates. They auto-group into Upcoming, Happening, and Past."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Create event
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(['upcoming', 'happening', 'past'] as const).map((bucket) => (
          <Card key={bucket} title={bucket === 'happening' ? 'Happening now' : bucket === 'upcoming' ? 'Upcoming' : 'Past'}>
            {grouped[bucket].length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No {bucket} events.</p>
            ) : (
              <ul className="space-y-2">
                {grouped[bucket].map((ev) => (
                  <li key={ev.id} className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate">{ev.title}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                      {ev.startDate} {ev.endDate ? `→ ${ev.endDate}` : ''} • {ev.time}
                    </p>
                    {ev.registrationLink && (
                      <p className="text-xs text-[var(--color-accent-primary)] truncate mt-1">{ev.registrationLink}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

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
              Location
              <Input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="Location"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Start date
              <Input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              End date
              <Input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
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
              Registration link
              <Input
                value={draft.registrationLink}
                onChange={(e) => setDraft((d) => ({ ...d, registrationLink: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Status
              <select
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                value={draft.publicationStatus}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    publicationStatus: e.target.value as DraftEvent['publicationStatus'],
                  }))
                }
              >
                <option value="published">Published</option>
                <option value="needs_approval">Needs approval</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Banner image URL
              <Input
                value={draft.bannerImage || ''}
                onChange={(e) => setDraft((d) => ({ ...d, bannerImage: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Or upload banner
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleBannerFile(e.target.files?.[0])}
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
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={addSession}>
              Add session
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              Preview
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              Save event
            </Button>
            <Button variant="ghost" onClick={resetDraft}>
              Reset
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Sessions</p>
            <div className="space-y-3">
              {draft.sessions.map((sess, idx) => (
                <div
                  key={sess.id}
                  className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] items-end rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3"
                >
                  <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
                    Title
                    <Input
                      value={sess.title}
                      onChange={(e) => updateSession(sess.id, 'title', e.target.value)}
                      placeholder={`Session ${idx + 1}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
                    Date
                    <Input
                      type="date"
                      value={sess.date}
                      onChange={(e) => updateSession(sess.id, 'date', e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
                    Time
                    <Input
                      type="time"
                      value={sess.time}
                      onChange={(e) => updateSession(sess.id, 'time', e.target.value)}
                    />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeSession(sess.id)} disabled={draft.sessions.length <= 1}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview && (
        <Card title="Preview">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{preview.title}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {preview.startDate} {preview.endDate ? `→ ${preview.endDate}` : ''} • {preview.time} • {preview.location}
            </p>
            {preview.bannerImage ? (
              <Image
                src={preview.bannerImage}
                alt="Banner"
                width={1200}
                height={400}
                className="w-full max-h-64 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
                unoptimized
              />
            ) : null}
            <p className="text-sm text-[var(--color-text-secondary)]">{preview.description}</p>
            {preview.sessions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-tertiary)] mb-1">Sessions</p>
                <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                  {preview.sessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)]" />
                      <span className="font-medium text-[var(--color-text-primary)]">{s.title}</span>
                      <span className="text-[var(--color-text-tertiary)]">
                        {s.date || preview.startDate} • {s.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.registrationLink && (
              <a
                href={preview.registrationLink}
                className="text-sm text-[var(--color-accent-primary)] underline"
                target="_blank"
                rel="noreferrer"
              >
                Registration link
              </a>
            )}
            <div className="text-xs text-[var(--color-text-tertiary)]">
              Status: {preview.publicationStatus === 'published' ? 'Published' : 'Needs approval'} • Created{' '}
              {new Date(preview.createdAt).toLocaleString()}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default withAuth(EventPage, { requiredRole: 'admin' });
