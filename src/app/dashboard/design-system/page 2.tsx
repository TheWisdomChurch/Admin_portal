'use client';

import { useState } from 'react';
import { Users, Inbox } from 'lucide-react';
import { PageHeader } from '@/layouts';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/Input';
import { Checkbox } from '@/ui/Checkbox';
import { Panel } from '@/ui/Panel';
import { StatCard } from '@/ui/StatCard';
import { EmptyState } from '@/ui/EmptyState';
import { Table } from '@/ui/Table';
import { Pagination } from '@/ui/Pagination';
import { ConfirmationModal } from '@/ui/ConfirmationModal';
import { useTheme } from '@/providers/ThemeProviders';
import { withAuth } from '@/providers/withAuth';

const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'warning'] as const;

const sampleRows = [
  { id: '1', name: 'Grace Adeyemi', role: 'Usher' },
  { id: '2', name: 'Samuel Okoro', role: 'Choir' },
  { id: '3', name: 'Miriam Bello', role: 'Media' },
];

const scales: Array<{ name: string; prefix: string; steps: number[] }> = [
  { name: 'Brand (gold)', prefix: 'brand', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: 'Stone (warm neutral)', prefix: 'stone', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: 'Green (success)', prefix: 'green', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Amber (warning)', prefix: 'amber', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Red (danger)', prefix: 'red', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'Sky (info)', prefix: 'sky', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
];

const semanticSwatches: Array<{ label: string; token: string }> = [
  { label: 'Background primary', token: '--color-background-primary' },
  { label: 'Background secondary', token: '--color-background-secondary' },
  { label: 'Background tertiary', token: '--color-background-tertiary' },
  { label: 'Text primary', token: '--color-text-primary' },
  { label: 'Text secondary', token: '--color-text-secondary' },
  { label: 'Text tertiary', token: '--color-text-tertiary' },
  { label: 'Border primary', token: '--color-border-primary' },
  { label: 'Border secondary', token: '--color-border-secondary' },
  { label: 'Accent primary', token: '--color-accent-primary' },
  { label: 'Accent success', token: '--color-accent-success' },
  { label: 'Accent warning', token: '--color-accent-warning' },
  { label: 'Accent danger', token: '--color-accent-danger' },
  { label: 'Accent info', token: '--color-accent-info' },
];

const typeScale: Array<{ label: string; token: string }> = [
  { label: 'xs', token: '--font-size-xs' },
  { label: 'sm', token: '--font-size-sm' },
  { label: 'base', token: '--font-size-base' },
  { label: 'lg', token: '--font-size-lg' },
  { label: 'xl', token: '--font-size-xl' },
  { label: '2xl', token: '--font-size-2xl' },
  { label: '3xl', token: '--font-size-3xl' },
  { label: '4xl', token: '--font-size-4xl' },
  { label: '5xl', token: '--font-size-5xl' },
];

const spacingScale = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];

const shadowScale = ['sm', 'md', 'lg', 'xl', '2xl'];

function ColorSwatch({ varName, label }: { varName: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-14 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)]"
        style={{ background: `var(${varName})` }}
      />
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{varName}</span>
    </div>
  );
}

function DesignSystemPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design System"
        subtitle="Single source of truth for every color, type, spacing, and shadow token — defined in globals.css, nowhere else."
        actions={
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <Button
                key={mode}
                variant={theme === mode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTheme(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>
        }
      />

      <Card title={`Semantic tokens (resolved: ${resolvedTheme})`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {semanticSwatches.map((swatch) => (
            <ColorSwatch key={swatch.token} varName={swatch.token} label={swatch.label} />
          ))}
        </div>
      </Card>

      {scales.map((scale) => (
        <Card key={scale.prefix} title={scale.name}>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-11">
            {scale.steps.map((step) => (
              <ColorSwatch key={step} varName={`--${scale.prefix}-${step}`} label={String(step)} />
            ))}
          </div>
        </Card>
      ))}

      <Card
        title="Status badges"
        contentClassName="space-y-3"
      >
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
        </div>
      </Card>

      <Card title="Buttons">
        <div className="flex flex-wrap gap-3">
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>

      <Card title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" placeholder="e.g. Grace Adeyemi" />
          <Input label="Email" type="email" placeholder="you@example.com" error="This field is required" />
        </div>
        <div className="mt-4">
          <Checkbox label="I agree to the terms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        </div>
      </Card>

      <Card title="Panel & StatCard">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Members" value="1,204" icon={<Users className="h-5 w-5" />} tone="info" trend="+18 this month" />
          <StatCard label="Pending approvals" value="7" icon={<Inbox className="h-5 w-5" />} tone="warning" />
          <Panel>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Panel is the lighter-weight surface for content that doesn&apos;t need Card&apos;s title/actions bar.
            </p>
          </Panel>
        </div>
      </Card>

      <Card title="Table, empty state & pagination">
        <div className="space-y-4">
          <Table
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'role', header: 'Role' },
            ]}
            data={sampleRows}
            rowKey={(row) => row.id}
          />
          <Pagination page={page} pageCount={5} onPageChange={setPage} />
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)]">
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No submissions yet"
              description="New form submissions will show up here."
            />
          </div>
        </div>
      </Card>

      <Card title="Modal">
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          Open confirmation modal
        </Button>
        <ConfirmationModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Remove this record?"
          description="This is a live example of the shared Modal primitive every dialog in the app now composes."
          confirmText="Remove"
        />
      </Card>

      <Card title="Typography scale">
        <div className="space-y-3">
          {typeScale.map((row) => (
            <div key={row.token} className="flex items-baseline gap-4">
              <span className="w-16 shrink-0 font-mono text-xs text-[var(--color-text-tertiary)]">{row.label}</span>
              <span style={{ fontSize: `var(${row.token})` }} className="text-[var(--color-text-primary)]">
                The quick brown fox
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Spacing scale">
        <div className="flex flex-wrap items-end gap-3">
          {spacingScale.map((step) => (
            <div key={step} className="flex flex-col items-center gap-1.5">
              <div
                className="w-3 bg-[var(--color-accent-primary)]"
                style={{ height: `var(--spacing-${step})` }}
              />
              <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{step}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Shadows & radius">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {shadowScale.map((step) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div
                className="h-16 w-16 rounded-[var(--radius-card)] bg-[var(--color-background-primary)]"
                style={{ boxShadow: `var(--shadow-${step})` }}
              />
              <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">shadow-{step}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default withAuth(DesignSystemPage, { requiredRole: 'super_admin' });
