// src/app/dashboard/content/page.tsx
'use client';

import { FileText } from 'lucide-react';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/layouts';

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        subtitle="Manage website content and shared assets."
      />

      <Card>
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[var(--color-background-secondary)] p-2">
            <FileText className="h-5 w-5 text-[var(--color-text-secondary)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Content tools coming soon</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              This section will host sermon notes, announcements, and static site content.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
