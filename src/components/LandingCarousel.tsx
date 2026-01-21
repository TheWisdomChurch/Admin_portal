'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const slides = [
  {
    title: 'Admin Operations',
    copy: 'Create events, publish updates, and keep the community informed.',
  },
  {
    title: 'Super Admin Review',
    copy: 'Approve testimonials and monitor content quality in one place.',
  },
  {
    title: 'Registration Insights',
    copy: 'Track event registrations and engagement as they come in.',
  },
];

export function LandingCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-6">
      <div className="absolute right-4 top-4 text-xs text-[var(--color-text-tertiary)]">
        {index + 1}/{slides.length}
      </div>
      <div className="min-h-[120px]">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.title}
            className={cn(
              'transition-opacity duration-500',
              slideIndex === index ? 'opacity-100' : 'opacity-0 absolute inset-0'
            )}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">
              {slide.title}
            </p>
            <p className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">
              {slide.copy}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        {slides.map((_, dotIndex) => (
          <button
            key={dotIndex}
            type="button"
            aria-label={`Go to slide ${dotIndex + 1}`}
            className={cn(
              'h-2 w-2 rounded-full transition-all',
              dotIndex === index
                ? 'bg-[var(--color-accent-primary)] w-6'
                : 'bg-[var(--color-border-secondary)]'
            )}
            onClick={() => setIndex(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
