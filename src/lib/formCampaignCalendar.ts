import type { FormEmailCalendarEvent } from './formEmailTemplates';
import type { EventData } from './types';

type EventCalendarSource = Pick<
  EventData,
  'title' | 'shortDescription' | 'description' | 'location' | 'date' | 'time' | 'startDate' | 'endDate' | 'registerLink'
>;

function parseEventDateTime(dateValue?: string, timeValue?: string) {
  const rawDate = dateValue?.trim();
  if (!rawDate) return null;

  const candidate = timeValue?.trim() ? `${rawDate}T${timeValue.trim()}` : `${rawDate}T00:00`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEventDateValue(value?: string) {
  const raw = value?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildCampaignCalendarEventFromEventData(
  event?: EventCalendarSource | null,
  timeZone?: string
): FormEmailCalendarEvent | undefined {
  if (!event?.title?.trim()) return undefined;

  const startAt = parseEventDateValue(event.startDate) || parseEventDateTime(event.date, event.time);
  if (!startAt) return undefined;

  const endAt = parseEventDateValue(event.endDate);
  const summary = event.shortDescription?.trim() || event.description?.trim() || '';
  const registerLink = event.registerLink?.trim() || '';

  return {
    title: event.title.trim(),
    startAt: startAt.toISOString(),
    endAt: endAt ? endAt.toISOString() : undefined,
    location: event.location?.trim() || undefined,
    description: [summary, registerLink ? `More details: ${registerLink}` : ''].filter(Boolean).join('\n\n') || undefined,
    timeZone: timeZone?.trim() || undefined,
  };
}

export function buildCampaignDefaultCopy(formTitle: string, event?: Pick<EventData, 'title' | 'date' | 'time'> | null) {
  const baseTitle = event?.title?.trim() || formTitle.trim() || 'your event';
  const hasEventDateTime = Boolean(event?.date?.trim() && event?.time?.trim());

  return {
    subject: `Update for ${baseTitle}`,
    heading: `Everything you need before ${baseTitle}`,
    preheader: hasEventDateTime
      ? `Review the latest update for ${baseTitle} and save ${event!.date.trim()} at ${event!.time.trim()} in your calendar.`
      : `Review the latest update for ${baseTitle} and save the date in your calendar.`,
  };
}
