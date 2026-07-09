'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Activity,
  HeartHandshake,
  HandCoins,
  ImageIcon,
  Loader2,
  MailCheck,

  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import apiClient from '@/lib/api';
import MediaUploadField from '@/components/MediaUploadField';
import { uploadAsset } from '@/lib/uploads';
import { withAuth } from '@/providers/withAuth';
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

type TemplateStatus = { id?: string; active: boolean; version?: number };
type TabKey = 'homepage' | 'confession' | 'requests' | 'automation';

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
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function formatDate(value?: string): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchTemplateStatusMap(): Promise<Record<string, TemplateStatus>> {
  const rows = await Promise.all(
    AUTOMATION_TEMPLATE_DEFS.map(async (def) => {
      const response = await apiClient.listAdminEmailTemplates({ templateKey: def.key, limit: 20 });
      const templates = asArray<EmailTemplate>(response);
      const active = templates.find((item) => item.isActive) || null;
      const latest = templates[0] || null;
      return {
        key: def.key,
        id: active?.id ?? latest?.id,
        active: Boolean(active),
        version: active?.version ?? latest?.version,
      };
    }),
  );

  return rows.reduce<Record<string, TemplateStatus>>((acc, row) => {
    acc[row.key] = { id: row.id, active: row.active, version: row.version };
    return acc;
  }, {});
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <Input label={label} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function TextArea({ label, value, onChange, rows = 4, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold leading-7 text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] focus:ring-4 focus:ring-[var(--color-background-tertiary)]"
      />
    </label>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active ? 'bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
      {children}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${active ? 'bg-[var(--color-success-surface)] text-[var(--color-success-text)] ring-[var(--color-success-border)]' : 'bg-[var(--color-warning-surface)] text-[var(--color-warning-text)] ring-[var(--color-warning-border)]'}`}>
      {active ? 'Active' : 'Missing / inactive'}
    </span>
  );
}

function ContentPage() {
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
  const [activeTab, setActiveTab] = useState<TabKey>('homepage');

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [adRes, confessionRes, pastoralRes, givingRes, templateStatusMap] = await Promise.all([
        apiClient.getHomepageAdContent(),
        apiClient.getConfessionPopupContent(),
        apiClient.listPastoralCareRequests({ page: 1, limit: 10 }),
        apiClient.listGivingIntents({ page: 1, limit: 10 }),
        fetchTemplateStatusMap(),
      ]);

      setHomepageAd({ ...defaultHomepageAd, ...(adRes || {}) });
      setConfession({ ...defaultConfession, ...(confessionRes || {}) });
      setPastoralRequests(asArray<PastoralCareRequestAdmin>(pastoralRes));
      setGivingIntents(asArray<GivingIntentAdmin>(givingRes));
      setTemplateStatus(templateStatusMap);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load content dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContent(); }, [loadContent]);

  useEffect(() => () => { if (homepageAdImagePreview) URL.revokeObjectURL(homepageAdImagePreview); }, [homepageAdImagePreview]);

  const stats = useMemo(() => {
    const activeTemplates = AUTOMATION_TEMPLATE_DEFS.filter((def) => templateStatus[def.key]?.active).length;
    const now = Date.now();
    const start = new Date(homepageAd.startAt || 0).getTime();
    const end = new Date(homepageAd.endAt || 0).getTime();
    const adIsActive = Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
    return { pastoral: pastoralRequests.length, giving: givingIntents.length, templates: `${activeTemplates}/${AUTOMATION_TEMPLATE_DEFS.length}`, adState: adIsActive ? 'Live' : 'Scheduled' };
  }, [givingIntents.length, homepageAd.endAt, homepageAd.startAt, pastoralRequests.length, templateStatus]);

  const homepagePreviewImage = homepageAdImagePreview || homepageAd.image?.trim() || '';

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
        const uploaded = await uploadAsset(homepageAdImageFile, { kind: 'image', module: 'content', ownerType: 'homepage-ad', ownerId: homepageAd.id, folder: `content/homepage-ads/${homepageAd.id}/images` });
        image = uploaded.publicUrl || uploaded.url;
      }
      const saved = await apiClient.updateHomepageAdContent({ ...homepageAd, image });
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

  const ensureTemplate = async (key: string) => {
    const def = AUTOMATION_TEMPLATE_DEFS.find((item) => item.key === key);
    if (!def) return;
    setTemplateBusyKey(key);
    try {
      const listResponse = await apiClient.listAdminEmailTemplates({ templateKey: key, limit: 20 });
      const templates = asArray<EmailTemplate>(listResponse);
      const active = templates.find((item) => item.isActive);
      if (active) {
        setTemplateStatus(await fetchTemplateStatusMap());
        toast.success(`${def.title} already active.`);
        return;
      }
      if (templates.length === 0) {
        await apiClient.createAdminEmailTemplate({ templateKey: def.key, subject: def.subject, htmlBody: def.htmlBody, status: 'active', activate: true });
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
      for (const def of AUTOMATION_TEMPLATE_DEFS) await ensureTemplate(def.key);
      setTemplateStatus(await fetchTemplateStatusMap());
      toast.success('Automation templates synchronized.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to synchronize automation templates'));
    } finally {
      setSyncingTemplates(false);
      setTemplateBusyKey(null);
    }
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Content Control"
        subtitle="Manage homepage campaign content, confession popup messaging, request intake, and automation email readiness."
        actions={<Button variant="outline" icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={() => void loadContent()} loading={loading}>Refresh</Button>}
      />

      <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-text-primary)] shadow-xl">
        <div className="relative grid gap-6 p-6 text-[var(--color-text-inverse)] lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-end">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[var(--color-accent-primary)]/10 blur-3xl" />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-inverse)]/65"><ShieldCheck className="h-4 w-4" /> Website content operations</div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl xl:text-5xl">Publish consistent content across homepage, popups, and automated follow-up.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-inverse)]/65">This workspace keeps public-facing messaging and automation templates aligned.</p>
          </div>
          <div className="relative grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-inverse)]/50">Homepage ad</p>
              <p className="mt-2 text-2xl font-black">{stats.adState}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-inverse)]/55">{formatDate(homepageAd.startAt)} — {formatDate(homepageAd.endAt)}</p>
            </div>
            <div className="rounded-3xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-inverse)]/50">Templates</p>
              <p className="mt-2 text-2xl font-black">{stats.templates}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-inverse)]/55">required automations active</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<HeartHandshake className="h-5 w-5" />} label="Pastoral requests" value={stats.pastoral} trend="Latest pastoral care requests." />
        <StatCard icon={<HandCoins className="h-5 w-5" />} label="Giving intents" value={stats.giving} trend="Recent giving expressions and follow-up opportunities." tone="success" />
        <StatCard icon={<MailCheck className="h-5 w-5" />} label="Automation templates" value={stats.templates} trend="Confirmation templates needed by service workflows." tone="info" />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Content status" value={stats.adState} trend="Homepage campaign status based on active date range." tone="warning" />
      </section>

      <section className="sticky top-2 z-20 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/85 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          <TabButton active={activeTab === 'homepage'} onClick={() => setActiveTab('homepage')}>Homepage ad</TabButton>
          <TabButton active={activeTab === 'confession'} onClick={() => setActiveTab('confession')}>Confession popup</TabButton>
          <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')}>Requests</TabButton>
          <TabButton active={activeTab === 'automation'} onClick={() => setActiveTab('automation')}>Automation</TabButton>
        </div>
      </section>

      {loading ? <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-10 shadow-sm"><div className="flex items-center justify-center gap-3 text-sm font-bold text-[var(--color-text-tertiary)]"><Loader2 className="h-5 w-5 animate-spin" /> Loading content dashboard...</div></section> : null}

      {activeTab === 'homepage' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <SectionCard title="Homepage campaign ad" subtitle="Edit the popup/hero promotion used to drive registration or announcements." icon={<Sparkles className="h-5 w-5" />} actions={<Button icon={<Save className="h-4 w-4" />} onClick={() => void saveHomepageAd()} loading={savingAd}>Save Ad</Button>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ID" value={homepageAd.id || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, id: value }))} />
              <Field label="CTA Label" value={homepageAd.ctaLabel || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, ctaLabel: value }))} />
              <Field label="Title" value={homepageAd.title || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, title: value }))} />
              <Field label="Headline" value={homepageAd.headline || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, headline: value }))} />
              <Field label="Register URL" value={homepageAd.registerUrl || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, registerUrl: value }))} />
              <Field label="Image URL" value={homepageAd.image || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, image: value }))} />
              <Field label="Start ISO" value={homepageAd.startAt || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, startAt: value }))} />
              <Field label="End ISO" value={homepageAd.endAt || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, endAt: value }))} />
              <Field label="Time" value={homepageAd.time || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, time: value }))} />
              <Field label="Location" value={homepageAd.location || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, location: value }))} />
              <div className="md:col-span-2"><MediaUploadField field={{ key: 'image', label: 'Homepage ad image', type: 'image', validation: { max: 10 } }} value={homepageAdImageFile} onChange={handleHomepageAdImageFile} /></div>
              <div className="md:col-span-2"><TextArea label="Description" value={homepageAd.description || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, description: value }))} /></div>
              <div className="md:col-span-2"><TextArea label="Note" value={homepageAd.note || ''} onChange={(value) => setHomepageAd((state) => ({ ...state, note: value }))} rows={3} /></div>
            </div>
          </SectionCard>

          <SectionCard title="Live website preview" subtitle="Review the visitor-facing campaign before saving." icon={<ImageIcon className="h-5 w-5" />}>
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
              <div className="relative h-60 bg-[var(--color-background-tertiary)]">
                {homepagePreviewImage ? <Image src={homepagePreviewImage} alt="Homepage ad image preview" fill className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]"><ImageIcon className="h-8 w-8" /></div>}
              </div>
              <div className="space-y-3 bg-[var(--color-background-primary)] p-5">
                <span className="inline-flex rounded-full bg-[var(--color-warning-surface)] px-3 py-1 text-xs font-black text-[var(--color-warning-text)] ring-1 ring-[var(--color-warning-border)]">{homepageAd.title || 'Campaign title'}</span>
                <h3 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">{homepageAd.headline || 'Campaign headline'}</h3>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{homepageAd.description || 'Campaign description appears here.'}</p>
                <div className="rounded-2xl bg-[var(--color-background-secondary)] p-3 text-xs font-bold text-[var(--color-text-tertiary)]">{homepageAd.time || 'Time'} · {homepageAd.location || 'Location'}</div>
                <div className="inline-flex rounded-2xl bg-[var(--color-text-primary)] px-4 py-2 text-sm font-black text-[var(--color-text-inverse)]">{homepageAd.ctaLabel || 'Register now'}</div>
              </div>
            </div>
          </SectionCard>
        </section>
      ) : null}

      {activeTab === 'confession' ? (
        <SectionCard title="Confession popup" subtitle="Edit the welcome modal and confession text." icon={<Wand2 className="h-5 w-5" />} actions={<Button icon={<Sparkles className="h-4 w-4" />} onClick={() => void saveConfession()} loading={savingConfession}>Save Confession</Button>}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <Field label="Welcome title" value={confession.welcomeTitle || ''} onChange={(value) => setConfession((state) => ({ ...state, welcomeTitle: value }))} />
              <TextArea label="Welcome message" value={confession.welcomeMessage || ''} onChange={(value) => setConfession((state) => ({ ...state, welcomeMessage: value }))} rows={5} />
              <TextArea label="Motto" value={confession.motto || ''} onChange={(value) => setConfession((state) => ({ ...state, motto: value }))} rows={3} />
              <TextArea label="Confession text" value={confession.confessionText || ''} onChange={(value) => setConfession((state) => ({ ...state, confessionText: value }))} rows={5} />
            </div>
            <div className="rounded-[1.7rem] border border-[var(--color-border-secondary)] bg-[var(--color-text-primary)] p-5 text-[var(--color-text-inverse)] shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Popup preview</p>
              <h3 className="mt-4 text-3xl font-black tracking-tight">{confession.welcomeTitle || 'Welcome Home'}</h3>
              <p className="mt-4 text-sm leading-7 text-[var(--color-text-inverse)]/65">{confession.welcomeMessage}</p>
              <div className="mt-5 rounded-3xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 p-4"><p className="text-sm font-bold leading-7 text-[var(--color-text-inverse)]">{confession.confessionText}</p></div>
              <p className="mt-4 text-xs font-semibold leading-6 text-[var(--color-text-inverse)]/45">{confession.motto}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === 'requests' ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Recent pastoral requests" subtitle="Latest care records submitted from public forms." icon={<HeartHandshake className="h-5 w-5" />}>
            <RequestList
              empty="No pastoral requests yet."
              items={pastoralRequests.map((item) => ({
                id: item.id,
                title: `${item.firstName} ${item.lastName}`,
                meta: item.email,
                detail: `${item.eventType} • ${item.eventDate || 'No date recorded'}`,
              }))}
            />
          </SectionCard>
          <SectionCard title="Recent giving intents" subtitle="Latest giving submissions and areas of interest." icon={<HandCoins className="h-5 w-5" />}>
            <RequestList
              empty="No giving intents yet."
              items={givingIntents.map((item) => ({
                id: item.id,
                title: item.title,
                meta: item.description || 'No description',
                detail: 'Giving intent',
              }))}
            />
          </SectionCard>
        </section>
      ) : null}

      {activeTab === 'automation' ? (
        <SectionCard title="Automation email templates" subtitle="Keep required confirmation templates active for workflows." icon={<ShieldCheck className="h-5 w-5" />} actions={<Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => void ensureAllTemplates()} loading={syncingTemplates}>Activate Required Templates</Button>}>
          <div className="grid gap-4 lg:grid-cols-2">
            {AUTOMATION_TEMPLATE_DEFS.map((def) => {
              const state = templateStatus[def.key];
              const isActive = Boolean(state?.active);
              return (
                <article key={def.key} className="rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 transition hover:bg-[var(--color-background-primary)] hover:shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-[var(--color-text-primary)]">{def.title}</h3><StatusPill active={isActive} /></div>
                      <p className="mt-2 break-all text-xs font-semibold text-[var(--color-text-tertiary)]">{def.key}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--color-text-tertiary)]">{state?.version ? `Version ${state.version}` : 'No version detected'}</p>
                    </div>
                    <Button size="sm" variant={isActive ? 'outline' : 'primary'} onClick={() => void ensureTemplate(def.key)} loading={templateBusyKey === def.key}>{isActive ? 'Re-check' : 'Activate'}</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </main>
  );
}

function RequestList({ items, empty }: { items: Array<{ id: string; title: string; meta: string; detail: string }>; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 transition hover:bg-[var(--color-background-primary)] hover:shadow-sm">
          <p className="text-sm font-black text-[var(--color-text-primary)]">{item.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-tertiary)]">{item.meta}</p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-text-tertiary)]">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

export default withAuth(ContentPage, { requiredRole: 'admin' });
