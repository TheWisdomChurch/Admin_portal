// src/app/layout.tsx (updated with ThemeProvider & AuthProvider)
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProviders';
import { ThemeProvider } from '@/providers/ThemeProviders';
import { bodyFont, fontVariables } from '@/styles/fonts';

export const metadata: Metadata = {
  title: 'Wisdom Church Admin Portal',
  description: 'Church administration portal for managing content and members',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.className} ${fontVariables}`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
