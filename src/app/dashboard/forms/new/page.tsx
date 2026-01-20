// src/app/(dashboard)/dashboard/forms/new/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';

import { apiClient } from '@/lib/api';
import type { CreateFormRequest, FormFieldType } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

type FieldDraft = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
};

export default withAuth(function NewFormPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const authBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // minimal v1: create a draft with at least one field
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
  ]);

  const save = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const payload: CreateFormRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      fields: fields.map((f) => ({
        key: f.key.trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: undefined,
        order: f.order,
      })),
      settings: {
        successMessage: 'Thanks! Your registration has been received.',
      },
    };

    try {
      setSaving(true);
      const created = await apiClient.createAdminForm(payload);
      toast.success('Form created');
      router.push(`/dashboard/forms/${created.id}/edit`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create form');
    } finally {
      setSaving(false);
    }
  };

  if (authBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-secondary-900">Create Form</h1>
        <p className="text-secondary-600 mt-2">
          Create a draft registration form. You can add/edit fields on the next screen.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Title *</label>
          <input
            className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Youth Summit Registration"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Description</label>
          <textarea
            className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional short intro"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Create Draft
          </Button>
        </div>
      </Card>
    </div>
  );
}, { requiredRole: 'admin' });
