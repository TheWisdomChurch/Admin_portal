import { forwardRef, type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  as?: ElementType;
  /**
   * 'default' — dense/wide layouts (dashboard shell, homepage): `--content-max-width`.
   * 'narrow' — focused single-purpose layouts (login/register): `--content-max-width-narrow`.
   */
  size?: 'default' | 'narrow';
  /** Responsive horizontal padding, matching the padding already used by every top-level layout. */
  padded?: boolean;
  className?: string;
  children?: ReactNode;
}

// Literal per-branch class (not a template-literal built from `size`) so
// Tailwind's compiler can find both complete strings in source.
const sizeClass = {
  default: 'max-w-[var(--content-max-width)]',
  narrow: 'max-w-[var(--content-max-width-narrow)]',
} as const;

/**
 * Centered max-width primitive — use instead of a raw
 * `mx-auto max-w-[...]` div so every top-level layout draws from the same
 * two width tokens (see globals.css) instead of inventing its own cap.
 */
export const Container = forwardRef<HTMLElement, ContainerProps & ComponentPropsWithoutRef<'div'>>(
  ({ as: Component = 'div', size = 'default', padded = true, className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('mx-auto w-full', sizeClass[size], padded && 'px-4 sm:px-6 lg:px-8', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Container.displayName = 'Container';
