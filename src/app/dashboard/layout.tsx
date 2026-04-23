import type { ReactNode } from 'react';
import DashboardLayoutClient from './layout-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
