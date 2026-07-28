import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  Check,
  ChevronRight,
  ClipboardCheck,
  HeartHandshake,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

const capabilities = [
  {
    icon: UsersRound,
    title: 'People care',
    description: 'Member, workforce, leadership, birthday, and anniversary records in one accountable workspace.',
  },
  {
    icon: ClipboardCheck,
    title: 'Intelligent forms',
    description: 'Build structured intake journeys, review responses, and export leadership-ready information.',
  },
  {
    icon: CalendarCheck2,
    title: 'Church operations',
    description: 'Coordinate events, attendance, ministries, cell groups, approvals, and service activity.',
  },
  {
    icon: MessagesSquare,
    title: 'Communication',
    description: 'Deliver relevant campaigns, notifications, greetings, and follow-up from trusted data.',
  },
];

const operationalRows = [
  { label: 'Member engagement', value: 'Connected', tone: 'bg-emerald-500' },
  { label: 'Volunteer care', value: 'Visible', tone: 'bg-amber-500' },
  { label: 'Follow-up workflow', value: 'Ready', tone: 'bg-sky-500' },
];

export default function HomePage() {
  return (
    <div className="public-form-light min-h-screen overflow-x-clip bg-[#f7f6f2] text-[#171511]">
      <header className="relative z-40 border-b border-black/[0.07] bg-[#f7f6f2]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[var(--content-max-width)] items-center justify-between px-4 min-[390px]:px-5 sm:h-20 sm:px-8 lg:px-12">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Wisdom Church administration home">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#171511] shadow-sm">
              <Image src="/OIP.webp" alt="" width={44} height={44} priority className="h-full w-full object-cover" />
            </div>
            <div className="hidden min-w-0 leading-none min-[360px]:block">
              <p className="truncate text-sm font-bold tracking-[-0.02em]">The Wisdom Church</p>
              <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[#746f65]">Administration</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="mr-2 hidden items-center gap-2 text-xs font-semibold text-[#746f65] lg:flex">
              <ShieldCheck className="h-4 w-4 text-[#9b741b]" /> Secure staff access
            </div>
            <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm font-bold transition hover:border-black/20 hover:bg-[#fbfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88920]">
              Sign in
            </Link>
            <Link href="/register" className="hidden h-11 items-center justify-center gap-2 rounded-xl bg-[#171511] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#302d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88920] sm:inline-flex">
              Request access <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#b88920]/40 to-transparent" />
            <div className="absolute -right-40 top-8 h-[520px] w-[520px] rounded-full bg-[#d6b45d]/12 blur-3xl" />
            <div className="absolute -left-48 bottom-0 h-[420px] w-[420px] rounded-full bg-[#8da5a0]/10 blur-3xl" />
          </div>

          <div className="relative mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-[var(--content-max-width)] items-center gap-12 px-4 py-12 min-[390px]:px-5 sm:min-h-[calc(100svh-80px)] sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,0.88fr)_minmax(560px,1.12fr)] lg:gap-14 lg:px-12 lg:py-24 xl:grid-cols-[minmax(0,0.9fr)_minmax(620px,1.1fr)]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b88920]/25 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#785711] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> Ministry operations, elevated
              </div>
              <h1 className="mt-7 font-display text-[clamp(2.55rem,11vw,5.8rem)] font-semibold leading-[0.97] tracking-[-0.05em] text-[#171511] sm:text-[clamp(3.4rem,7vw,5.8rem)] lg:text-[clamp(3.4rem,5.6vw,5.8rem)]">
                Lead with clarity. <span className="text-[#9b741b]">Care with intention.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#5e594f] sm:text-lg">
                One secure command centre for the people, communication, governance, and daily operations behind The Wisdom Church.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#171511] px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgba(23,21,17,0.18)] transition hover:-translate-y-0.5 hover:bg-[#302d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88920]">
                  Enter administration <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/register" className="inline-flex h-13 items-center justify-center rounded-2xl border border-black/10 bg-white/75 px-6 text-sm font-bold text-[#29261f] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88920]">
                  Request an account
                </Link>
              </div>

              <div className="mt-10 grid gap-3 border-t border-black/[0.08] pt-6 sm:grid-cols-3">
                {['Role-based access', 'Protected member data', 'Auditable approvals'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs font-bold text-[#5e594f]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ece5d2] text-[#785711]"><Check className="h-3 w-3" /></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto min-w-0 w-full max-w-3xl lg:mx-0" aria-label="Administration interface preview">
              <div className="absolute -inset-4 rounded-[40px] border border-[#b88920]/15 bg-white/35 shadow-[0_35px_100px_rgba(47,40,24,0.12)] backdrop-blur-sm" />
              <div className="relative overflow-hidden rounded-[30px] border border-black/10 bg-[#171511] p-2 shadow-2xl">
                <div className="rounded-[23px] bg-[#fdfcf9]">
                  <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-[#d5d0c7]" /><span className="h-2.5 w-2.5 rounded-full bg-[#d5d0c7]" /><span className="h-2.5 w-2.5 rounded-full bg-[#b88920]" /></div>
                      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b857a] sm:inline">Operations overview</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</div>
                  </div>

                  <div className="grid sm:min-h-[490px] sm:grid-cols-[140px_1fr] xl:grid-cols-[150px_1fr]">
                    <aside className="hidden border-r border-black/[0.07] bg-[#f8f6f1] p-4 sm:block">
                      <div className="mb-6 flex items-center gap-2 px-2"><Image src="/OIP.webp" alt="" width={26} height={26} className="h-7 w-7 rounded-lg object-cover" /><span className="text-[10px] font-semibold">WISDOM HQ</span></div>
                      {['Overview', 'People', 'Forms', 'Events', 'Campaigns'].map((item, index) => (
                        <div key={item} className={`mb-1 rounded-xl px-3 py-2.5 text-[11px] font-bold ${index === 0 ? 'bg-[#171511] text-white' : 'text-[#777166]'}`}>{item}</div>
                      ))}
                      <div className="mt-8 rounded-2xl border border-[#b88920]/20 bg-[#f3eddf] p-3">
                        <ShieldCheck className="h-4 w-4 text-[#9b741b]" />
                        <p className="mt-2 text-[10px] font-semibold text-[#4a4130]">Protected workspace</p>
                        <p className="mt-1 text-[9px] leading-4 text-[#777166]">Security and governance are active.</p>
                      </div>
                    </aside>

                    <div className="min-w-0 p-3 min-[390px]:p-4 sm:p-5 xl:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b741b]">Secure workspace</p><h2 className="mt-1 text-lg font-bold tracking-tight min-[390px]:text-xl">Ministry at a glance</h2></div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eee9de]"><BarChart3 className="h-4 w-4 text-[#665e50]" /></div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                        {[['People', 'Unified'], ['Events', 'Planned'], ['Responses', 'Tracked'], ['Serving', 'Visible']].map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-2xl border border-black/[0.07] bg-white p-3 shadow-sm"><p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#8b857a]">{label}</p><p className="mt-2 truncate text-sm font-bold tracking-tight min-[390px]:text-base">{value}</p></div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Operational readiness</p><p className="mt-1 text-[9px] text-[#8b857a]">Live after secure sign-in</p></div><span className="rounded-full bg-[#f3eddf] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#785711]">Connected</span></div>
                          <div className="mt-5 space-y-4">
                            {operationalRows.map((row) => (
                              <div key={row.label}>
                                <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-[#6f695f]"><span>{row.label}</span><span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${row.tone}`} />{row.value}</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[#201d18] p-4 text-white shadow-sm">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10"><HeartHandshake className="h-4 w-4 text-[#e7c76f]" /></div>
                          <p className="mt-4 text-xs font-semibold">People care today</p>
                          <p className="mt-1 text-[9px] leading-4 text-white/55">Keep important moments and follow-up visible.</p>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2 text-[9px]"><span>Birthdays</span><b>Live</b></div>
                            <div className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2 text-[9px]"><span>Anniversaries</span><b>Live</b></div>
                            <div className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2 text-[9px]"><span>Approval requests</span><b>Live</b></div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#b88920]/20 bg-[#f5efe1] p-3">
                        <div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ded1ae]"><Sparkles className="h-4 w-4 text-[#785711]" /></span><div className="min-w-0"><p className="text-[10px] font-semibold">Leadership intelligence</p><p className="mt-0.5 truncate text-[9px] text-[#777166]">Recommendations generated from current operational data.</p></div></div>
                        <ChevronRight className="h-4 w-4 text-[#9b741b]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-3 hidden rounded-2xl border border-black/10 bg-white p-3 shadow-xl sm:flex sm:items-center sm:gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-4 w-4" /></div>
                <div><p className="text-[10px] font-semibold">Secure by design</p><p className="mt-0.5 text-[9px] text-[#777166]">MFA · permissions · audit history</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.07] bg-white">
          <div className="mx-auto grid w-full max-w-[var(--content-max-width)] gap-px bg-black/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article key={title} className="bg-white px-6 py-9 sm:px-8 lg:py-11">
                <Icon className="h-5 w-5 text-[#9b741b]" />
                <h2 className="mt-5 text-sm font-bold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#746f65]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#171511] px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b85f]">Authorized personnel only</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ready to continue the work?</h2>
              <p className="mt-3 text-sm leading-7 text-white/60">Access is protected by role permissions, multi-factor authentication, secure sessions, and auditable governance.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#d7b85f] px-6 text-sm font-bold text-[#171511] transition hover:bg-[#e4ca80]">Sign in securely <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 px-6 text-sm font-bold text-white transition hover:bg-white/10">Request access</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.07] bg-[#f7f6f2] px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-4 text-xs text-[#746f65] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} The Wisdom Church. Internal administration system.</p>
          <div className="flex items-center gap-5"><Link href="/login" className="font-bold hover:text-[#171511]">Sign in</Link><Link href="/register" className="font-bold hover:text-[#171511]">Request access</Link></div>
        </div>
      </footer>
    </div>
  );
}
