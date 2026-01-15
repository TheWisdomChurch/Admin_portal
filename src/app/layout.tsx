// src/app/layout.tsx (updated with AuthProvider)
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProviders';


const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}