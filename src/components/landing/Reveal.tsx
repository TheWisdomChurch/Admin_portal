import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  /** Entrance stagger in ms (applied as animation-delay). */
  delay?: number;
  className?: string;
  as?: ElementType;
}

/**
 * A staggered fade-and-rise entrance. Pure CSS (see `.lp-in` in globals.css)
 * — no IntersectionObserver, no client JS — so content can never be trapped
 * invisible by a missed observer, fast scroll, or scroll restoration. Below
 * the fold it simply finishes before the reader arrives. `prefers-reduced-
 * motion` disables it.
 */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: RevealProps) {
  const style: CSSProperties | undefined = delay ? { animationDelay: `${delay}ms` } : undefined;
  return (
    <Tag className={cn('lp-in', className)} style={style}>
      {children}
    </Tag>
  );
}
