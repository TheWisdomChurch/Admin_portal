export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-6 py-5 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent-primary)] border-t-transparent" />
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Loading…</p>
      </div>
    </div>
  );
}
