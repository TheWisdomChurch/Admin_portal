'use client';

import { useState } from 'react';
import { Users, UserPlus, Search, Mail, Phone, MapPin } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/input';
import { GridLayout, Section } from '@/layouts';

const members = [
  {
    id: '1',
    name: 'Grace Daniels',
    role: 'Member',
    email: 'grace@wisdomchurch.org',
    phone: '+1 234 555 1122',
    location: 'Lagos, NG',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Samuel Okoro',
    role: 'Volunteer',
    email: 'samuel@wisdomchurch.org',
    phone: '+1 234 555 4412',
    location: 'Abuja, NG',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Naomi Boateng',
    role: 'Member',
    email: 'naomi@wisdomchurch.org',
    phone: '+1 234 555 9911',
    location: 'Accra, GH',
    status: 'Pending',
  },
  {
    id: '4',
    name: 'Ethan Brooks',
    role: 'Member',
    email: 'ethan@wisdomchurch.org',
    phone: '+1 234 555 7721',
    location: 'Nairobi, KE',
    status: 'Active',
  },
];

export default function MembersPage() {
  const [query, setQuery] = useState('');

  const filtered = members.filter((member) =>
    member.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Section
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
        {filtered.map((member) => (
          <Card key={member.id} className="h-full">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                    {member.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-tertiary)]">{member.role}</p>
                </div>
                <Badge variant={member.status === 'Active' ? 'success' : 'warning'}>{member.status}</Badge>
              </div>
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {member.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {member.phone}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  {member.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm" variant="secondary">Message</Button>
              </div>
            </div>
          </Card>
        ))}
      </GridLayout>
    </div>
  );
}
