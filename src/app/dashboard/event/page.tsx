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

const MAX_IMAGE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type AssetKind = 'image' | 'banner';

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
  bannerImageUrl: string;
};

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
  bannerImageUrl: '',
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
    status: event.status ?? deriveStatus(event.date),
    isFeatured: event.isFeatured,
    tags: Array.isArray(event.tags) ? event.tags : [],
    registerLink: event.registerLink,
    speaker: event.speaker,
    contactPhone: event.contactPhone,
    image: event.image,
    bannerImage: event.bannerImage,
    attendees: event.attendees,
    ...overrides,
  };
}

function EventPage() {
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const previewStatus = useMemo(() => deriveStatus(draft.date), [draft.date]);
  const previewMedia =
    bannerPreview ||
    draft.bannerImageUrl.trim() ||
    imagePreview ||
    draft.imageUrl.trim() ||
    '';

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

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [imagePreview, bannerPreview]);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setBannerFile(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
  };

  const handleMediaFile = (kind: AssetKind, file?: File) => {
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Image must be JPEG, PNG, or WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image must be ${MAX_IMAGE_MB}MB or smaller.`);
      return;
    }

    const preview = URL.createObjectURL(file);

    if (kind === 'image') {
      setImageFile(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(preview);
      return;
    }

    setBannerFile(file);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(preview);
  };

  const uploadViaPresign = async (
    file: File,
    eventID: string,
    kind: AssetKind
  ): Promise<string> => {
    const presign = await apiClient.createUploadPresign({
      contentType: file.type,
      sizeBytes: file.size,
      ownerType: 'event',
      ownerId: eventID,
      kind,
      folder: `events/${kind}`,
    });

    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!putRes.ok) {
      throw new Error(`Failed to upload ${kind} to storage`);
    }

    if (presign.assetId) {
      await apiClient.completeUploadAsset(presign.assetId);
    }

    return presign.publicUrl;
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

    const bannerUrl = draft.bannerImageUrl.trim();
    if (bannerUrl && !isValidHttpURL(bannerUrl)) {
      toast.error('Banner URL must be a valid http(s) URL.');
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
      status: deriveStatus(draft.date),
      isFeatured: false,
      tags: [],
      registerLink: registerLink || undefined,
      image: imageUrl || undefined,
      bannerImage: bannerUrl || undefined,
    };

    try {
      setSaving(true);

      let created = await apiClient.createEvent(createPayload);
      let uploadedImageURL = createPayload.image;
      let uploadedBannerURL = createPayload.bannerImage;

      if (imageFile) {
        uploadedImageURL = await uploadViaPresign(imageFile, created.id, 'image');
      }

      if (bannerFile) {
        uploadedBannerURL = await uploadViaPresign(bannerFile, created.id, 'banner');
      }

      const hasAssetUpdates =
        uploadedImageURL !== created.image || uploadedBannerURL !== created.bannerImage;

      if (hasAssetUpdates) {
        created = await apiClient.updateEvent(
          created.id,
          toEventPayload(created, {
            image: uploadedImageURL,
            bannerImage: uploadedBannerURL,
          })
        );
      }

      toast.success('Event created successfully');
      setEvents((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      resetDraft();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create events with enterprise media flow and sync them to frontend."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Create event
          </Button>
        }
      />

      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(['upcoming', 'happening', 'past'] as const).map((bucket) => (
            <Card key={bucket} title={statusLabel[bucket]}>
              {grouped[bucket].length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  No {statusLabel[bucket].toLowerCase()} events.
                </p>
              ) : (
                <ul className="space-y-2">
                  {grouped[bucket].map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"
                    >
                      <p className="truncate font-semibold text-[var(--color-text-primary)]">{ev.title}</p>
                      <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                        {ev.date} • {ev.time} • {ev.location}
                      </p>
                      {ev.registerLink && (
                        <p className="mt-1 truncate text-xs text-[var(--color-accent-primary)]">
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
            <Input
              label="Title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Event title"
            />

            <label className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Category
              <select
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as EventCategory }))}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Short description"
              value={draft.shortDescription}
              onChange={(e) => setDraft((d) => ({ ...d, shortDescription: e.target.value }))}
              placeholder="Quick summary for cards"
            />

            <Input
              label="Location"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              placeholder="Event location"
            />

            <Input
              label="Date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />

            <Input
              label="Time"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
            />

            <Input
              label="Registration link (CTA)"
              value={draft.registrationLink}
              onChange={(e) => setDraft((d) => ({ ...d, registrationLink: e.target.value }))}
              placeholder="https://admin.wisdomchurchhq.org/forms/your-form-slug"
              helperText="This becomes the Register button destination on frontend."
            />

            <Input
              label="Image URL (optional)"
              value={draft.imageUrl}
              onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
              placeholder="https://..."
            />

            <Input
              label="Banner URL (optional)"
              value={draft.bannerImageUrl}
              onChange={(e) => setDraft((d) => ({ ...d, bannerImageUrl: e.target.value }))}
              placeholder="https://..."
            />

            <Input
              label="Upload image"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={(e) => handleMediaFile('image', e.target.files?.[0])}
              helperText={`JPEG/PNG/WebP up to ${MAX_IMAGE_MB}MB.`}
            />

            <Input
              label="Upload banner"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={(e) => handleMediaFile('banner', e.target.files?.[0])}
              helperText={`JPEG/PNG/WebP up to ${MAX_IMAGE_MB}MB.`}
            />

            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              Description
              <textarea
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                rows={4}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="What is this event about?"
              />
            </label>
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              Live Preview
            </p>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
              {previewMedia ? (
                <Image
                  src={previewMedia}
                  alt="Event preview"
                  width={1280}
                  height={460}
                  className="h-48 w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-tertiary)]">
                  Upload image/banner to preview the event card
                </div>
              )}

              <div className="space-y-2 p-4">
                <div className="inline-flex rounded-full bg-[var(--color-background-tertiary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {statusLabel[previewStatus]}
                </div>
                <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {draft.title || 'Event title'}
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {(draft.description || draft.shortDescription || 'Event description will appear here.').trim()}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {draft.date || 'YYYY-MM-DD'} • {draft.time || 'HH:MM'} • {draft.location || 'Location'}
                </p>
                <Button size="sm" variant="outline" disabled>
                  {draft.registrationLink.trim() ? 'Register now' : 'Add registration link'}
                </Button>
              </div>
            </div>
          </div>

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
