// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-background-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-blue-300/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
