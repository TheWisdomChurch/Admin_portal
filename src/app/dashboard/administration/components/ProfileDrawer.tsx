import { Cake, CalendarDays, Heart, Mail, Phone, UserRound, X } from 'lucide-react';

import { dateLabel, formatDate, segmentMeta, titleCase, type PersonRecord } from '../lib';
import { Avatar } from './Avatar';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

export function ProfileDrawer({ person, onClose }: { person: PersonRecord | null; onClose: () => void }) {
  if (!person) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/45 backdrop-blur-sm">
      <button type="button" aria-label="Close profile drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-[var(--color-background-primary)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Profile drawer</p>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{person.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-[var(--color-border-primary)] p-2 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-[2rem] bg-[var(--color-text-primary)] p-5 text-[var(--color-text-inverse)]">
            <div className="flex items-start gap-4">
              <Avatar person={person} size="lg" />
              <div className="min-w-0">
                <h3 className="text-2xl font-bold">{person.name}</h3>
                <p className="mt-1 text-sm font-medium opacity-70">{segmentMeta[person.segment].label}</p>
                <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">{titleCase(person.status || 'Unknown')}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={person.email || 'Not provided'} />
            <InfoRow icon={Phone} label="Phone" value={person.phone || 'Not provided'} />
            <InfoRow icon={UserRound} label="Role / Department" value={person.role || person.department || 'Not provided'} />
            <InfoRow icon={Cake} label="Birthday" value={person.birthdayMonth && person.birthdayDay ? dateLabel(person.birthdayMonth, person.birthdayDay) : 'Not provided'} />
            <InfoRow icon={Heart} label="Wedding anniversary" value={person.anniversaryMonth && person.anniversaryDay ? dateLabel(person.anniversaryMonth, person.anniversaryDay) : 'Not provided'} />
            <InfoRow icon={CalendarDays} label="Created" value={formatDate(person.createdAt)} />
          </div>

          <div className="mt-5 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Record source</p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-[var(--color-text-primary)] p-4 text-xs leading-6 text-[var(--color-text-inverse)]">{JSON.stringify(person.source || {}, null, 2)}</pre>
          </div>
        </div>
      </aside>
    </div>
  );
}
