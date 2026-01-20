// src/app/dashboard/forms/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Link as LinkIcon } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { DataTable } from '@/components/DateTable';

import { apiClient } from '@/lib/api';
import type { AdminForm } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

export default withAuth(function FormsPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const authBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminForms({ page, limit });
      setForms(Array.isArray(res.data) ? res.data : []);
      setTotal(typeof res.total === 'number' ? res.total : 0);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to load forms');
      setForms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (authBlocked) return;
    load();
  }, [authBlocked, load]);

  const handlePublish = async (form: AdminForm) => {
    try {
      const res = await apiClient.publishAdminForm(form.id);
      toast.success('Form published');
      // optionally show link immediately
      const origin = window.location.origin;
      const url = `${origin}/forms/${res.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to publish form');
    }
  };

  const handleCopyLink = async (form: AdminForm) => {
    if (!form.slug) {
      toast.error('This form is not published yet');
      return;
    }
    try {
      const origin = window.location.origin;
      const url = `${origin}/forms/${form.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = async (form: AdminForm) => {
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return;

    try {
      await apiClient.deleteAdminForm(form.id);
      toast.success('Form deleted');
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to delete form');
    }
  };

  const handleEdit = (form: AdminForm) => {
    router.push(`/dashboard/forms/${form.id}/edit`);
  };

  const columns = useMemo(
    () => [
      {
        key: 'title' as keyof AdminForm,
        header: 'Title',
        cell: (f: AdminForm) => (
          <div className="space-y-1">
            <div className="font-medium text-secondary-900">{f.title}</div>
            <div className="text-xs text-secondary-500">
              {f.description ? f.description : 'No description'}
            </div>
          </div>
        ),
      },
      {
        key: 'isPublished' as keyof AdminForm,
        header: 'Status',
        cell: (f: AdminForm) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              f.isPublished
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-secondary-50 text-secondary-700 border border-secondary-200'
            }`}
          >
            {f.isPublished ? 'Published' : 'Draft'}
          </span>
        ),
      },
      {
        key: 'slug' as keyof AdminForm,
        header: 'Link',
        cell: (f: AdminForm) => (
          <div className="flex items-center gap-2">
            {f.slug ? (
              <>
                <span className="text-xs text-secondary-600 truncate max-w-[220px]">
                  /forms/{f.slug}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(f)}
                  className="inline-flex items-center gap-1 rounded-md border border-secondary-200 bg-white px-2 py-1 text-xs text-secondary-700 hover:bg-secondary-50"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Copy
                </button>
              </>
            ) : (
              <span className="text-xs text-secondary-500">Not published</span>
            )}
          </div>
        ),
      },
      {
        key: 'updatedAt' as keyof AdminForm,
        header: 'Updated',
        cell: (f: AdminForm) => (
          <span className="text-sm text-secondary-600">
            {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : '-'}
          </span>
        ),
      },
    ],
    []
  );

  if (authBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Forms</h1>
          <p className="text-secondary-600 mt-2">
            Create and publish event registration forms, then attach the link to an event.
          </p>
        </div>

        <Button onClick={() => router.push('/dashboard/forms/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      <Card className="p-0">
        <DataTable
          data={forms ?? []}
          columns={columns as any}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={(f: AdminForm) => {
            if (!f.isPublished) {
              handlePublish(f);
              return;
            }
            handleCopyLink(f);
          }}
          isLoading={loading}
        />
      </Card>

      {/* Quick actions row (optional) */}
      <div className="text-xs text-secondary-500">
        Tip: Click “View” action to publish (if draft) or copy link (if already published).
      </div>
    </div>
  );
}, { requiredRole: 'admin' });
