'use client';

import Link from 'next/link';
import { useMemo, useState, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Clipboard, Edit3, ExternalLink, FileText, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { withAuth } from '@/providers/withAuth';
import type { AdminForm, FormField, FormStatus } from '@/lib/types';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value?: number | null): string {
  return numberFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFormStatus(form: AdminForm): FormStatus {
  if (form.status) return form.status;
  return form.isPublished ? 'published' : 'draft';
}

function getFormSubmissionCount(form: AdminForm): number {
  return form.totalSubmissions ?? form.submissionCount ?? form.submissionsCount ?? form.responseCount ?? form.responsesCount ?? 0;
}

const statusBadgeVariant: Record<FormStatus, 'success' | 'default' | 'danger'> = {
  published: 'success',
  draft: 'default',
  invalid: 'danger',
};

function fieldOptionsLabel(field: FormField): string {
  if (Array.isArray(field.options)) return `${field.options.length} option${field.options.length === 1 ? '' : 's'}`;
  return '—';
}

function SlugPill({ form }: { form: AdminForm }) {
  const publicUrl = buildPublicFormUrl(form.slug, form.publicUrl);

  const copy = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  if (!form.slug) {
    return <span className="text-xs font-medium text-[var(--color-text-tertiary)]">No slug yet</span>;
  }

  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] py-1 pl-3 pr-1 text-xs">
      <span className="truncate font-mono text-[var(--color-text-secondary)]">/{form.slug}</span>
      <button
        type="button"
        onClick={copy}
        disabled={!publicUrl}
        aria-label="Copy public form link"
        className="rounded-full p-1.5 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
      >
        <Clipboard className="h-3.5 w-3.5" />
      </button>
      {publicUrl ? (
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label="Open public form"
          className="rounded-full p-1.5 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function FormAccordionRow({ form, deleting, onDelete }: { form: AdminForm; deleting: boolean; onDelete: (form: AdminForm) => void }) {
  const fields = [...(form.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const editHref = `/dashboard/forms/${encodeURIComponent(form.id)}/edit`;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={editHref}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)]"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Edit fields
      </Link>
      <button
        type="button"
        disabled={deleting}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete(form);
        }}
        className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-danger-border)] px-3 py-2 text-xs font-semibold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-surface)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );

  return (
    <details className="group bg-[var(--color-background-primary)]">
      {/* Mobile / tablet: a labeled stacked card — the desktop grid row below
          relies on column position to convey meaning, which breaks down once
          columns wrap, so this is a distinct layout, not a squeezed one. */}
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 transition hover:bg-[var(--color-background-hover)] lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition group-open:rotate-180" />
              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{form.title || 'Untitled form'}</p>
            </div>
            <p className="mt-1 line-clamp-2 pl-6 text-xs text-[var(--color-text-tertiary)]">{form.description || 'No description provided.'}</p>
          </div>
          <Badge variant={statusBadgeVariant[getFormStatus(form)]}>{getFormStatus(form)}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pl-6 text-xs">
          <div className="col-span-2">
            <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Public link</dt>
            <dd className="mt-1"><SlugPill form={form} /></dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Fields</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-text-primary)]">{formatNumber(fields.length)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Submissions</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-text-primary)]">{formatNumber(getFormSubmissionCount(form))}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Updated</dt>
            <dd className="mt-0.5 text-[var(--color-text-secondary)]">{formatDate(form.updatedAt || form.createdAt)}</dd>
          </div>
        </dl>

        <div className="pl-6">{actions}</div>
      </summary>

      {/* Desktop: the compact grid row. */}
      <summary className="hidden cursor-pointer list-none grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_0.7fr] items-center gap-3 px-4 py-4 transition hover:bg-[var(--color-background-hover)] lg:grid">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition group-open:rotate-180" />
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{form.title || 'Untitled form'}</p>
          </div>
          <p className="mt-1 line-clamp-1 pl-6 text-xs text-[var(--color-text-tertiary)]">{form.description || 'No description provided.'}</p>
        </div>

        <div className="min-w-0"><SlugPill form={form} /></div>

        <Badge variant={statusBadgeVariant[getFormStatus(form)]}>{getFormStatus(form)}</Badge>

        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          {formatNumber(fields.length)}
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">fields</span>
        </div>

        <div className="text-xs text-[var(--color-text-tertiary)]">
          {formatDate(form.updatedAt || form.createdAt)}
          <p className="mt-1">{formatNumber(getFormSubmissionCount(form))} submissions</p>
        </div>

        <div className="flex justify-end">{actions}</div>
      </summary>

      <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-4">
        {fields.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--color-border-secondary)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Label</th>
                  <th className="px-3 py-3 font-semibold">Key</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Required</th>
                  <th className="px-3 py-3 font-semibold">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-secondary)]">
                {fields.map((field, index) => (
                  <tr key={field.id || `${form.id}-field-${index}`}>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-tertiary)]">{field.order ?? index + 1}</td>
                    <td className="px-3 py-3 font-medium text-[var(--color-text-primary)]">{field.label || 'Untitled field'}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{field.key || '—'}</td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{field.type || 'text'}</td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{field.required ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-tertiary)]">{fieldOptionsLabel(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="This form has no fields yet." description="Open the forms editor to add fields." />
        )}
      </div>
    </details>
  );
}

function FormsManagerPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: forms = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['forms', 'list'],
    queryFn: async () => (await apiClient.getAdminForms({ page: 1, limit: 100 })).data || [],
  });

  const [deleteTarget, setDeleteTarget] = useState<AdminForm | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (form: AdminForm) => apiClient.deleteAdminForm(form.id),
    onSuccess: (_result, form) => {
      toast.success('Form deleted');
      queryClient.setQueryData<AdminForm[]>(['forms', 'list'], (current) => (current || []).filter((item) => item.id !== form.id));
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete form');
    },
  });

  const handleDelete = (form: AdminForm) => {
    setDeleteTarget(form);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget);
  };

  const filteredForms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return forms;

    return forms.filter((form) => {
      const searchable = [form.title, form.slug, form.description, getFormStatus(form), ...(form.fields || []).flatMap((field) => [field.label, field.key, field.type])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [forms, search]);

  const publishedCount = forms.filter((form) => getFormStatus(form) === 'published').length;
  const totalFields = forms.reduce((total, form) => total + (form.fields?.length || 0), 0);
  const totalSubmissions = forms.reduce((total, form) => total + getFormSubmissionCount(form), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle="Review every form created in the system, inspect its fields, and manage submissions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Link href="/dashboard/forms/new">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Create form</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Forms" value={formatNumber(forms.length)} icon={<FileText className="h-5 w-5" />} tone="info" />
        <StatCard label="Published" value={formatNumber(publishedCount)} icon={<FileText className="h-5 w-5" />} tone="success" />
        <StatCard label="Fields" value={formatNumber(totalFields)} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Submissions" value={formatNumber(totalSubmissions)} icon={<FileText className="h-5 w-5" />} tone="warning" />
      </div>

      <Panel padded={false}>
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search forms, fields, status..." />
          </div>
        </div>

        <div className="overflow-hidden border-t border-[var(--color-border-secondary)]">
          <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_0.7fr] gap-3 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <span>Form</span>
            <span>Slug</span>
            <span>Status</span>
            <span>Fields</span>
            <span>Updated</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-[var(--color-border-secondary)]">
            {isLoading ? (
              <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading forms...</div>
            ) : filteredForms.length > 0 ? (
              filteredForms.map((form) => (
                <FormAccordionRow key={form.id} form={form} deleting={deleteMutation.isPending && deleteMutation.variables?.id === form.id} onDelete={handleDelete} />
              ))
            ) : (
              <div className="p-5">
                <EmptyState title={forms.length === 0 ? 'No forms have been created yet.' : 'No form matched your search.'} />
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} size="md" labelledBy="form-delete-title">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-secondary)] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="form-delete-title" className="text-lg font-black tracking-tight text-[var(--color-text-primary)]">
                Delete form
              </h2>
              <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">
                This removes the form and its saved fields immediately — it cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteMutation.isPending}
            className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {deleteTarget ? (
            <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <p className="truncate text-base font-black text-[var(--color-text-primary)]">{deleteTarget.title || 'Untitled form'}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-tertiary)]">
                {formatNumber(deleteTarget.fields?.length || 0)} fields · {formatNumber(getFormSubmissionCount(deleteTarget))} submissions on record
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border-secondary)] px-6 py-4">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} icon={<Trash2 className="h-4 w-4" />} onClick={confirmDelete}>
            Delete form
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default withAuth(FormsManagerPage, { requiredRole: 'admin' });
