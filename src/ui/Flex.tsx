import { forwardRef, type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

const alignClass: Record<FlexAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyClass: Record<FlexJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

// Explicit map, not a template-literal `gap-${n}` — Tailwind's compiler only
// picks up class names it can find as literal strings in source, so a
// dynamically-built class name would silently generate no CSS at all.
const gapClass = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5',
  6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12', 16: 'gap-16', 20: 'gap-20', 24: 'gap-24',
} as const;

interface FlexProps {
  as?: ElementType;
  direction?: 'row' | 'col';
  align?: FlexAlign;
  justify?: FlexJustify;
  gap?: keyof typeof gapClass;
  wrap?: boolean;
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Flexbox layout primitive — use instead of a raw `<div className="flex ...">`
 * so alignment/spacing intent reads from props, not a class string every
 * caller has to re-derive. Anything not covered by these props (arbitrary
 * spacing, colors, etc.) still goes through `className`.
 */
export const Flex = forwardRef<HTMLElement, FlexProps & ComponentPropsWithoutRef<'div'>>(
  ({ as: Component = 'div', direction = 'row', align, justify, gap, wrap, inline, className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          inline ? 'inline-flex' : 'flex',
          direction === 'col' && 'flex-col',
          align && alignClass[align],
          justify && justifyClass[justify],
          wrap && 'flex-wrap',
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
Flex.displayName = 'Flex';
