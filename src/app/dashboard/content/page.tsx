'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  RefreshCw,
  Save,
  Sparkles,
  MessageSquareText,
  HeartHandshake,
  HandCoins,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import apiClient from '@/lib/api';
import MediaUploadField from '@/components/MediaUploadField';
import { uploadAsset } from '@/lib/uploads';
import type {
  ConfessionPopupContent,
  EmailTemplate,
  GivingIntentAdmin,
  HomepageAdContent,
  PastoralCareRequestAdmin,
} from '@/lib/types';

const defaultHomepageAd: HomepageAdContent = {
  id: 'wpc-2026',
  title: 'Wisdom Power Conference 2026',
  headline: 'Have you registered for WPC 2026?',
  description:
    'Join three days of worship, impartation, and encounters designed to refresh your spirit and strengthen your walk.',
  startAt: '2026-03-20T18:00:00Z',
  endAt: '2026-03-22T20:00:00Z',
  time: 'Morning Session • Evening Session',
  location: 'Honor Gardens opposite Dominion City, Alasia Bus stop',
  image: '/OIP.webp',
  registerUrl: 'https://admin.wisdomchurchhq.org/forms/wpc26',
  ctaLabel: 'Register now',
  note: 'You will be returned to the main website after you finish.',
};

const defaultConfession: ConfessionPopupContent = {
  welcomeTitle: 'Welcome Home',
  welcomeMessage:
    'You are in a place of worship, truth, and transformation. Before you continue, take a moment with our confession and align your words with faith.',
  confessionText:
    'We begin to prosper, we continue to prosper, until we become very prosperous.',
  motto: 'We begin to prosper, we continue to prosper, until we become very prosperous.',
};

const AUTOMATION_TEMPLATE_DEFS = [
  {
    key: 'pastoral_care_request_confirmation',
    title: 'Pastoral Care Confirmation',
    subject: 'Pastoral care request received',
    htmlBody:
      '<h2>Pastoral Care Request Received</h2><p>Hello {{.RecipientName}}, we have received your request.</p><p>Reference: <strong>{{.ReferenceID}}</strong></p><p>Request type: {{.EventType}}</p><p>Date: {{.EventDate}}</p>',
  },
  {
    key: 'giving_intent_confirmation',
    title: 'Giving Intent Confirmation',
    subject: 'Giving request received',
    htmlBody:
      '<h2>Giving Request Received</h2><p>Hello {{.RecipientName}}, thank you for your willingness to give.</p><p>Reference: <strong>{{.ReferenceID}}</strong></p><p>Category: {{.Title}}</p>',
  },
  {
    key: 'workforce_application_confirmation',
    title: 'Workforce Application Confirmation',
    subject: 'Workforce registration received',
    htmlBody:
      '<h2>Workforce Registration Received</h2><p>Hello {{.RecipientName}}, your workforce application has been received.</p><p>Reference: <strong>{{.ReferenceID}}</strong></p><p>Department: {{.Department}}</p><p>Status: {{.StatusLabel}}</p>',
  },
  {
    key: 'workforce_serving_confirmation',
    title: 'Workforce Serving Confirmation',
    subject: 'Workforce serving profile received',
    htmlBody:
      '<h2>Serving Profile Received</h2><p>Hello {{.RecipientName}}, your serving profile has been recorded.</p><p>Reference: <strong>{{.ReferenceID}}</strong></p><p>Department: {{.Department}}</p><p>Status: {{.StatusLabel}}</p>',
  },
] as const;

type TemplateStatus = {
  id?: string;
  active: boolean;
  version?: number;
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const maybe = value as { data?: unknown; items?: unknown };

    if (Array.isArray(maybe.data)) return maybe.data as T[];
    if (Array.isArray(maybe.items)) return maybe.items as T[];

    if (maybe.data && typeof maybe.data === 'object') {
      const nested = maybe.data as { data?: unknown; items?: unknown };

      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
    }
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function fetchTemplateStatusMap(): Promise<Record<string, TemplateStatus>> {
  const rows = await Promise.all(
    AUTOMATION_TEMPLATE_DEFS.map(async (def) => {
      const response = await apiClient.listAdminEmailTemplates({
        templateKey: def.key,
        limit: 20,
      });
      const templates = asArray<EmailTemplate>(response);
      const active = templates.find((item) => item.isActive) || null;
      const latest = templates[0] || null;

      return {
        key: def.key,
        id: active?.id ?? latest?.id,
        active: Boolean(active),
        version: active?.version ?? latest?.version,
      };
    })
  );

  const next: Record<string, TemplateStatus> = {};
  rows.forEach((row) => {
    next[row.key] = {
      id: row.id,
      active: row.active,
      version: row.version,
    };
  });
  return next;
}

export default function ContentPage() {
  const [homepageAd, setHomepageAd] = useState<HomepageAdContent>(defaultHomepageAd);
  const [confession, setConfession] = useState<ConfessionPopupContent>(defaultConfession);
  const [pastoralRequests, setPastoralRequests] = useState<PastoralCareRequestAdmin[]>([]);
  const [givingIntents, setGivingIntents] = useState<GivingIntentAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAd, setSavingAd] = useState(false);
  const [savingConfession, setSavingConfession] = useState(false);
  const [homepageAdImageFile, setHomepageAdImageFile] = useState<File | null>(null);
  const [homepageAdImagePreview, setHomepageAdImagePreview] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<Record<string, TemplateStatus>>({});
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [templateBusyKey, setTemplateBusyKey] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);

    try {
      const [adRes, confessionRes, pastoralRes, givingRes] = await Promise.all([
        apiClient.getHomepageAdContent(),
        apiClient.getConfessionPopupContent(),
        apiClient.listPastoralCareRequests({ page: 1, limit: 10 }),
        apiClient.listGivingIntents({ page: 1, limit: 10 }),
        fetchTemplateStatusMap(),
      ]);

      setHomepageAd({ ...defaultHomepageAd, ...adRes });
      setConfession({ ...defaultConfession, ...confessionRes });
      setPastoralRequests(asArray<PastoralCareRequestAdmin>(pastoralRes));
      setGivingIntents(asArray<GivingIntentAdmin>(givingRes));
      setTemplateStatus(await fetchTemplateStatusMap());
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load content dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    return () => {
      if (homepageAdImagePreview) URL.revokeObjectURL(homepageAdImagePreview);
    };
  }, [homepageAdImagePreview]);

  const handleHomepageAdImageFile = (file: File | null) => {
    setHomepageAdImageFile(file);
    if (homepageAdImagePreview) URL.revokeObjectURL(homepageAdImagePreview);
    setHomepageAdImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const saveHomepageAd = async () => {
    setSavingAd(true);

    try {
      let image = homepageAd.image.trim();

      if (homepageAdImageFile) {
        const uploaded = await uploadAsset(homepageAdImageFile, {
          kind: 'image',
          module: 'content',
          ownerType: 'homepage-ad',
          ownerId: homepageAd.id,
          folder: `content/homepage-ads/${homepageAd.id}/images`,
        });
        image = uploaded.publicUrl || uploaded.url;
      }

      const saved = await apiClient.updateHomepageAdContent({
        ...homepageAd,
        image,
      });
      setHomepageAd(saved);
      setHomepageAdImageFile(null);
      if (homepageAdImagePreview) URL.revokeObjectURL(homepageAdImagePreview);
      setHomepageAdImagePreview(null);
      toast.success('Homepage ad updated');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save homepage ad'));
    } finally {
      setSavingAd(false);
    }
  };

  const saveConfession = async () => {
    setSavingConfession(true);

    try {
      const saved = await apiClient.updateConfessionPopupContent(confession);
      setConfession(saved);
      toast.success('Confession popup updated');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save confession popup'));
    } finally {
      setSavingConfession(false);
    }
  };

  const stats = useMemo(
    () => ({
      pastoral: pastoralRequests.length,
      giving: givingIntents.length,
    }),
    [pastoralRequests.length, givingIntents.length]
  );

  const ensureTemplate = async (key: string) => {
    const def = AUTOMATION_TEMPLATE_DEFS.find((item) => item.key === key);
    if (!def) return;

    setTemplateBusyKey(key);

    try {
      const listResponse = await apiClient.listAdminEmailTemplates({
        templateKey: key,
        limit: 20,
      });
      const templates = asArray<EmailTemplate>(listResponse);
      const active = templates.find((item) => item.isActive);

      if (active) {
        toast.success(`${def.title} already active.`);
        return;
      }

      if (templates.length === 0) {
        await apiClient.createAdminEmailTemplate({
          templateKey: def.key,
          subject: def.subject,
          htmlBody: def.htmlBody,
          status: 'active',
          activate: true,
        });
      } else {
        await apiClient.activateAdminEmailTemplate(templates[0].id);
      }

      setTemplateStatus(await fetchTemplateStatusMap());
      toast.success(`${def.title} activated.`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, `Failed to activate ${def.title}`));
    } finally {
      setTemplateBusyKey(null);
    }
  };

  const ensureAllTemplates = async () => {
    setSyncingTemplates(true);

    try {
      await Promise.all(
        AUTOMATION_TEMPLATE_DEFS.map(async (def) => {
          await ensureTemplate(def.key);
        })
      );

      setTemplateStatus(await fetchTemplateStatusMap());
      toast.success('Automation templates synchronized.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to synchronize automation templates'));
    } finally {
      setSyncingTemplates(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Control"
        subtitle="Manage homepage ad + confession popup and monitor incoming requests."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void loadContent()}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Pastoral Requests
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
            {stats.pastoral}
          </p>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Giving Intents
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
            {stats.giving}
          </p>
        </Card>
      </div>

      <Card
        title="Homepage Ad"
        actions={
          <Button
            icon={<Save className="h-4 w-4" />}
            onClick={() => void saveHomepageAd()}
            loading={savingAd}
          >
            Save Ad
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="ID"
            value={homepageAd.id}
            onChange={(v) => setHomepageAd((s) => ({ ...s, id: v }))}
          />
          <Field
            label="CTA Label"
            value={homepageAd.ctaLabel}
            onChange={(v) => setHomepageAd((s) => ({ ...s, ctaLabel: v }))}
          />
          <Field
            label="Title"
            value={homepageAd.title}
            onChange={(v) => setHomepageAd((s) => ({ ...s, title: v }))}
          />
          <Field
            label="Headline"
            value={homepageAd.headline}
            onChange={(v) => setHomepageAd((s) => ({ ...s, headline: v }))}
          />
          <Field
            label="Image URL"
            value={homepageAd.image}
            onChange={(v) => setHomepageAd((s) => ({ ...s, image: v }))}
          />
          <div className="space-y-3">
            <MediaUploadField
              field={{ key: 'image', label: 'Homepage ad image', type: 'image', validation: { max: 10 } }}
              value={homepageAdImageFile}
              onChange={handleHomepageAdImageFile}
            />
            {(homepageAdImagePreview || homepageAd.image.trim()) && (
              <Image
                src={homepageAdImagePreview || homepageAd.image.trim()}
                alt="Homepage ad image preview"
                width={960}
                height={540}
                className="h-40 w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] object-cover"
                unoptimized
              />
            )}
          </div>
          <Field
            label="Register URL"
            value={homepageAd.registerUrl}
            onChange={(v) => setHomepageAd((s) => ({ ...s, registerUrl: v }))}
          />
          <Field
            label="Start (ISO)"
            value={homepageAd.startAt}
            onChange={(v) => setHomepageAd((s) => ({ ...s, startAt: v }))}
          />
          <Field
            label="End (ISO)"
            value={homepageAd.endAt}
            onChange={(v) => setHomepageAd((s) => ({ ...s, endAt: v }))}
          />
          <Field
            label="Time"
            value={homepageAd.time}
            onChange={(v) => setHomepageAd((s) => ({ ...s, time: v }))}
          />
          <Field
            label="Location"
            value={homepageAd.location}
            onChange={(v) => setHomepageAd((s) => ({ ...s, location: v }))}
          />
        </div>

        <TextArea
          label="Description"
          value={homepageAd.description}
          onChange={(v) => setHomepageAd((s) => ({ ...s, description: v }))}
        />

        <TextArea
          label="Note"
          value={homepageAd.note}
          onChange={(v) => setHomepageAd((s) => ({ ...s, note: v }))}
        />
      </Card>

      <Card
        title="Confession Popup"
        actions={
          <Button
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => void saveConfession()}
            loading={savingConfession}
          >
            Save Confession
          </Button>
        }
      >
        <Field
          label="Welcome Title"
          value={confession.welcomeTitle}
          onChange={(v) => setConfession((s) => ({ ...s, welcomeTitle: v }))}
        />

        <TextArea
          label="Welcome Message"
          value={confession.welcomeMessage}
          onChange={(v) => setConfession((s) => ({ ...s, welcomeMessage: v }))}
        />

        <TextArea
          label="Motto"
          value={confession.motto}
          onChange={(v) => setConfession((s) => ({ ...s, motto: v }))}
        />

        <TextArea
          label="Confession Text"
          value={confession.confessionText}
          onChange={(v) => setConfession((s) => ({ ...s, confessionText: v }))}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title="Recent Pastoral Requests"
          actions={<HeartHandshake className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
        >
          <div className="space-y-3">
            {pastoralRequests.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No requests yet.</p>
            ) : (
              pastoralRequests.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.firstName} {item.lastName}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {item.eventType} • {item.eventDate} • {item.email}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Recent Giving Intents"
          actions={<HandCoins className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
        >
          <div className="space-y-3">
            {givingIntents.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No giving intents yet.</p>
            ) : (
              givingIntents.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.title}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                    <MessageSquareText className="h-3 w-3" />
                    {item.description || 'No description'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Automation Email Templates"
        actions={
          <Button
            icon={<ShieldCheck className="h-4 w-4" />}
            onClick={() => void ensureAllTemplates()}
            loading={syncingTemplates}
          >
            Activate Required Templates
          </Button>
        }
      >
        <div className="space-y-3">
          {AUTOMATION_TEMPLATE_DEFS.map((def) => {
            const state = templateStatus[def.key];
            const isActive = Boolean(state?.active);

            return (
              <div
                key={def.key}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {def.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{def.key}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Status: {isActive ? 'Active' : 'Missing/Inactive'}{' '}
                      {state?.version ? `• v${state.version}` : ''}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={isActive ? 'secondary' : 'primary'}
                    onClick={() => void ensureTemplate(def.key)}
                    loading={templateBusyKey === def.key}
                  >
                    {isActive ? 'Re-check' : 'Activate'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
      />
    </label>
  );
}
