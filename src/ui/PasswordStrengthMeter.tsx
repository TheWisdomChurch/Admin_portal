import { getPasswordStrength } from '@/lib/passwordStrength';
import { cn } from '@/lib/utils';

export function PasswordStrengthMeter({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  if (!password) return null;

  const { score, label, suggestions } = getPasswordStrength(password);
  const width = `${(score / 4) * 100}%`;

  const barClass =
    score <= 1
      ? 'bg-red-500'
      : score === 2
        ? 'bg-amber-500'
        : score === 3
          ? 'bg-emerald-500'
          : 'bg-green-600';

  return (
    <div className={cn('mt-2 space-y-2', className)}>
      <div className="h-2 w-full rounded-full bg-[var(--color-border-secondary)] overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', barClass)}
          style={{ width }}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--color-text-secondary)]">Strength: {label}</span>
        {suggestions.length > 0 && (
          <span className="text-[var(--color-text-tertiary)]">
            {suggestions.slice(0, 2).join(' | ')}
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
        Server validates final password policy
      </p>
    </div>
  );
}
