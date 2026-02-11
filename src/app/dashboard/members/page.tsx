'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Search, Mail, Phone } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { GridLayout, PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type { Member } from '@/lib/types';

export default function MembersPage() {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.listMembers({ page: 1, limit: 200 });
        const data = Array.isArray(res) ? res : (res as { data?: Member[] }).data;
        setMembers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      members.filter((member) =>
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(query.toLowerCase())
      ),
    [members, query]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Manage member profiles, roles, and communication."
        actions={(
          <Button icon={<UserPlus className="h-4 w-4" />}>Add Member</Button>
        )}
      />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
            <div className="h-10 w-10 rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] flex items-center justify-center">
              <Users className="h-5 w-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <p className="text-[var(--color-text-secondary)] font-semibold">Community snapshot</p>
              <p className="text-xs">Active members, volunteers, and recent joins.</p>
            </div>
          </div>
          <div className="w-full md:max-w-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search members..."
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      <GridLayout columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" gap="lg">
        {loading ? (
          <Card>
            <div className="text-sm text-[var(--color-text-tertiary)]">Loading members...</div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-sm text-[var(--color-text-tertiary)]">No members found.</div>
          </Card>
        ) : (
          filtered.map((member) => (
            <Card key={member.id} className="h-full">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-[var(--color-text-tertiary)]">Member</p>
                  </div>
                  <Badge variant={member.isActive ? 'success' : 'warning'}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {member.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    {member.phone || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">View</Button>
                  <Button size="sm" variant="secondary">Message</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </GridLayout>
    </div>
  );
}
