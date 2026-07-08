import { initials, type PersonRecord, type TrackerItem } from '../lib';

export function Avatar({ person, size = 'md' }: { person: PersonRecord | TrackerItem; size?: 'sm' | 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';

  if (person.imageUrl) {
    return (
      <div className={`${dimension} shrink-0 overflow-hidden rounded-2xl bg-[var(--color-background-tertiary)] ring-1 ring-[var(--color-border-primary)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] font-semibold text-[var(--color-text-inverse)]`}>
      {initials(person.name)}
    </div>
  );
}
