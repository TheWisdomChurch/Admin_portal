import { HERO_MEDIA } from '@/lib/landing/content';

/**
 * The hero's living background. Always paints an animated aurora field
 * (drifting gold/stone glows + a masked grid + grain — all CSS, all
 * transform-based). If a same-origin hero clip is configured
 * (NEXT_PUBLIC_HERO_VIDEO_URL), it plays behind the aurora at low opacity as
 * a cinematic layer; otherwise the aurora stands alone. No JavaScript.
 */
export function HeroBackdrop() {
  const hasVideo = HERO_MEDIA.videoUrl.length > 0;

  return (
    <div
      className="lp-hero-field pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[var(--color-background-secondary)]"
      aria-hidden="true"
    >
      {hasVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-[0.12] [mix-blend-mode:luminosity]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_MEDIA.posterUrl || undefined}
        >
          <source src={HERO_MEDIA.videoUrl} />
        </video>
      ) : null}

      <span className="lp-glow lp-glow-a absolute -left-[16%] -top-[24%] h-[62vw] max-h-[720px] w-[62vw] max-w-[720px] bg-[radial-gradient(circle_at_center,var(--lp-gold-bright),transparent_66%)] opacity-[0.18]" />
      <span className="lp-glow lp-glow-b absolute -right-[12%] top-[6%] h-[48vw] max-h-[560px] w-[48vw] max-w-[560px] bg-[radial-gradient(circle_at_center,var(--brand-300),transparent_70%)] opacity-[0.14]" />
      <span className="lp-glow lp-glow-c absolute -bottom-[28%] left-[22%] h-[52vw] max-h-[620px] w-[52vw] max-w-[620px] bg-[radial-gradient(circle_at_center,var(--sky-300),transparent_72%)] opacity-[0.1]" />

      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--lp-gold-line)] to-transparent" />
      <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-background-secondary)]" />
    </div>
  );
}
