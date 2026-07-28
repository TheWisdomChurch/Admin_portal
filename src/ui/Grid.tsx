import { forwardRef, type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Literal maps, not template-literal `grid-cols-${n}` — Tailwind's compiler
// only picks up class names it can find as complete literal strings in
// source, so a dynamically-built class name would silently generate no CSS.
const colsClass = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
  5: 'grid-cols-5', 6: 'grid-cols-6', 12: 'grid-cols-12',
} as const;

const smColsClass = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' } as const;
const mdColsClass = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const;
const lgColsClass = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12' } as const;
const xlColsClass = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4' } as const;

const gapClass = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5',
  6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12', 16: 'gap-16',
} as const;

interface GridProps {
  as?: ElementType;
  cols?: keyof typeof colsClass;
  /** Responsive column-count overrides — e.g. `sm={1} lg={4}` for "1 column until desktop, then 4". */
  sm?: keyof typeof smColsClass;
  md?: keyof typeof mdColsClass;
  lg?: keyof typeof lgColsClass;
  xl?: keyof typeof xlColsClass;
  gap?: keyof typeof gapClass;
  className?: string;
  children?: ReactNode;
}

/**
 * CSS Grid layout primitive — use instead of a raw
 * `grid grid-cols-N gap-N` div so responsive column counts read from props.
 * For anything more specific than an even N-column grid (asymmetric tracks
 * like `grid-cols-[1.4fr_1fr_260px]`), just use a plain div with className —
 * this primitive covers the common case, not every possible grid.
 */
export const Grid = forwardRef<HTMLElement, GridProps & ComponentPropsWithoutRef<'div'>>(
  ({ as: Component = 'div', cols = 1, sm, md, lg, xl, gap, className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          'grid',
          colsClass[cols],
          sm !== undefined && smColsClass[sm],
          md !== undefined && mdColsClass[md],
          lg !== undefined && lgColsClass[lg],
          xl !== undefined && xlColsClass[xl],
          gap !== undefined && gapClass[gap],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Grid.displayName = 'Grid';
