'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, MapPin, Calendar, Clock, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { apiClient } from '@/lib/api';
import { EventData } from '@/lib/types';
import toast from 'react-hot-toast';

function statusLabel(event: EventData) {
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : new Date(event.date);
  const end = event.endDate ? new Date(event.endDate) : start;
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'happening';
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.getEvents({ page: 1, limit: 20 }).catch(() => null);
        if (res && Array.isArray((res as any).data)) {
          setEvents((res as any).data);
        } else if (Array.isArray(res)) {
          setEvents(res);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Events</h1>
        <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/events/edit')}>
          Create Event
        </Button>
      </div>

      <Card>
        {loading && <p className="text-sm text-[var(--color-text-tertiary)]">Loading events...</p>}
        {!loading && events.length === 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-tertiary)]">No events yet.</p>
            <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/events/edit')}>
              Create your first event
            </Button>
          </div>
        )}
        <div className="space-y-3">
          {events.map((event) => {
            const isOpen = expanded[event.id];
            const badge = statusLabel(event);
            return (
              <div
                key={event.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]"
              >
                <button
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                  onClick={() => setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[var(--color-background-tertiary)] flex items-center justify-center text-[var(--color-text-secondary)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text-primary)] truncate">{event.title}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate">{event.shortDescription}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={badge === 'happening' ? 'success' : badge === 'upcoming' ? 'primary' : 'secondary'}>
                      {badge === 'happening' ? 'Happening now' : badge === 'upcoming' ? 'Upcoming' : 'Past'}
                    </Badge>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-xs">
                        <Calendar className="h-4 w-4" />
                        {event.startDate || event.date} {event.endDate ? `→ ${event.endDate}` : ''}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-xs">
                        <Clock className="h-4 w-4" />
                        {event.time}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-xs">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </span>
                    </div>
                    <p className="leading-relaxed">{event.description}</p>
                    {event.sessions && event.sessions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">Sessions</p>
                        <ul className="space-y-1">
                          {event.sessions.map((s, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)]" />
                              <span className="font-medium text-[var(--color-text-primary)]">{s.title}</span>
                              <span className="text-[var(--color-text-tertiary)]">• {s.time}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {event.registerLink && (
                      <div className="flex items-center gap-2 text-xs">
                        <LinkIcon className="h-4 w-4 text-[var(--color-text-secondary)]" />
                        <a
                          className="text-[var(--color-accent-primary)] underline"
                          href={event.registerLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Registration link
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
