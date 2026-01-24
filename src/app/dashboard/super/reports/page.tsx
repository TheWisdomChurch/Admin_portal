'use client';

import { useState } from 'react';
import { FileDown, Calendar, BarChart2, CheckCircle } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { withAuth } from '@/providers/withAuth';
import toast from 'react-hot-toast';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Hook up to backend PDF export when ready
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.success(`Report for ${selectedMonth} is ready (connect PDF export).`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Reports</h1>
        <p className="text-sm text-[var(--color-text-tertiary)]">Download monthly summaries for events, workforce, and giving.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-background-tertiary)] flex items-center justify-center">
              <Calendar className="h-5 w-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Monthly report</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Includes events, registrations, workforce, testimonials.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <Button icon={<FileDown className="h-4 w-4" />} loading={downloading} disabled={downloading} onClick={handleDownload}>
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Events summary</p>
          <div className="mt-2 flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Total events</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">—</p>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Registrations</p>
          <div className="mt-2 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Form submissions</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">—</p>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Workforce</p>
          <div className="mt-2 flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">New approvals</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">—</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(ReportsPage, { requiredRole: 'super_admin' });
