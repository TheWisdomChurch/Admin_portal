import { Activity } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { formatDateTime, titleCase, type TimelineItem, type TimelineTone } from '../lib';

const toneVariant: Record<TimelineTone, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

export function Timeline({ items, endpointAvailable }: { items: TimelineItem[]; endpointAvailable: boolean }) {
  return (
    <SectionCard
      title="Activity timeline / audit log"
      subtitle={endpointAvailable ? 'Live audit activity.' : 'Showing a timeline derived from saved operational records.'}
      icon={<Activity className="h-5 w-5" />}
      actions={<Badge variant={endpointAvailable ? 'success' : 'warning'}>{endpointAvailable ? 'Audit connected' : 'Derived activity'}</Badge>}
    >
      <div className="space-y-3">
        {items.slice(0, 16).map((item) => (
          <div key={item.id} className="relative rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 transition hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-primary)] hover:shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={toneVariant[item.tone]}>{item.title}</Badge>
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{item.description}</p>
                {item.actor ? <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">By {item.actor}</p> : null}
              </div>
              {item.action ? <Badge>{titleCase(item.action)}</Badge> : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <EmptyState title="No activity records found." description="Connect an audit endpoint to show security and operations events here." /> : null}
      </div>
    </SectionCard>
  );
}
