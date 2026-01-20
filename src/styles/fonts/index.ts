import { Fraunces, Manrope } from 'next/font/google';

export const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

export const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

export const fontVariables = `${bodyFont.variable} ${displayFont.variable}`;
