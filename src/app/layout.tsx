// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProviders';
import { ThemeProvider } from '@/providers/ThemeProviders';
import { bodyFont, fontVariables } from '@/styles/fonts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://admin-portal.example.com';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'Administration Portal';
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
  'Secure internal administration portal for managing operational workflows.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },

  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,

  // ✅ Internal portal: keep out of Google/Bing
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-snippet': 0,
      'max-image-preview': 'none',
      'max-video-preview': 0,
    },
  },

  // Optional but clean
  applicationName: SITE_NAME,
  category: 'technology',

  // Optional: if you have a logo in /public/logo.webp
  // icons: {
  //   icon: '/favicon.ico',
  //   apple: '/apple-touch-icon.png',
  // },

  // Optional social previews (harmless even if noindex)
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: '/logo.webp',
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/logo.webp'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.className} ${fontVariables}`}>
        <ThemeProvider defaultTheme="light">
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
