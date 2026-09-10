'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  /** Stagger, in ms, applied as animation-delay once the element enters view. */
  delay?: number;
  className?: string;
  as?: ElementType;
}

/**
 * Fade-and-rise a block into view the first time it scrolls near the
 * viewport. Server-rendered content stays visible until this mounts (see the
 * `.is-armed` gate in globals.css), and `prefers-reduced-motion` disables the
 * effect entirely.
 */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('lp-reveal', armed && 'is-armed', className)}
      data-shown={shown ? 'true' : 'false'}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
