'use client';

import { MessageSquareText, Star, UserPlus } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { GridLayout, PageHeader } from '@/layouts';

const testimonials = [
  {
    id: 't1',
    name: 'Chinyere Okafor',
    message: 'The outreach team has been a blessing. I felt welcomed and supported.',
    rating: 5,
    status: 'Published',
    date: 'Mar 10, 2024',
  },
  {
    id: 't2',
    name: 'Michael Adeyemi',
    message: 'The conferences are well organized and spiritually uplifting.',
    rating: 4,
    status: 'Pending',
    date: 'Mar 08, 2024',
  },
  {
    id: 't3',
    name: 'Joy Mensah',
    message: 'Amazing worship nights. The community feels like family.',
    rating: 5,
    status: 'Published',
    date: 'Mar 02, 2024',
  },
];

export default function TestimonialsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        subtitle="Review feedback, publish highlights, and stay connected to members."
        actions={(
          <Button icon={<UserPlus className="h-4 w-4" />}>Invite Testimony</Button>
        )}
      />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
            <div className="h-10 w-10 rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] flex items-center justify-center">
              <MessageSquareText className="h-5 w-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <p className="text-[var(--color-text-secondary)] font-semibold">Stories from the community</p>
              <p className="text-xs">Publish the best testimonies and follow up quickly.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">12 Published</Badge>
            <Badge variant="warning">3 Pending</Badge>
          </div>
        </div>
      </Card>

      <GridLayout columns="grid-cols-1 lg:grid-cols-2" gap="lg">
        {testimonials.map((item) => (
          <Card key={item.id} className="h-full">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{item.date}</p>
                </div>
                <Badge variant={item.status === 'Published' ? 'success' : 'warning'}>{item.status}</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {item.message}
              </p>
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: item.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-amber-400" />
                ))}
                <span className="text-xs text-[var(--color-text-tertiary)] ml-2">
                  {item.rating}/5 rating
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm">Publish</Button>
              </div>
            </div>
          </Card>
        ))}
      </GridLayout>
    </div>
  );
}
