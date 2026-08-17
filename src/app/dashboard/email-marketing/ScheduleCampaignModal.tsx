'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { AdminEmailRecurrence, AdminEmailScheduleDetail, SendAdminComposeEmailRequest } from '@/lib/types';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  open: boolean;
  onClose: () => void;
  compose: SendAdminComposeEmailRequest;
  estimatedRecipients: number;
  schedule?: AdminEmailScheduleDetail;
  onSaved?: () => void | Promise<void>;
}

export function ScheduleCampaignModal({ open, onClose, compose, estimatedRecipients, schedule, onSaved }: Props) {
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<AdminEmailRecurrence>('weekly');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos');
  const [sendTime, setSendTime] = useState('09:00');
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([0]);
  const [monthDays, setMonthDays] = useState('1');
  const [saving, setSaving] = useState<'draft' | 'active' | null>(null);

  useEffect(() => {
    if (!open || !schedule) return;
    setName(schedule.name || '');
    setDescription(schedule.description || '');
    setRecurrence(schedule.recurrence);
    setTimezone(schedule.timezone || 'Africa/Lagos');
    setSendTime(schedule.sendTime || '09:00');
    setStartDate(schedule.startDate || tomorrow);
    setEndDate(schedule.endDate || '');
    setWeekdays(schedule.weekdays?.length ? schedule.weekdays : [0]);
    setMonthDays(schedule.monthDays?.length ? schedule.monthDays.join(', ') : '1');
  }, [open, schedule, tomorrow]);

  async function save(status: 'draft' | 'active') {
    if (!name.trim()) { toast.error('Give this schedule a clear name.'); return; }
    if (recurrence === 'weekly' && weekdays.length === 0) { toast.error('Select at least one weekday.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { toast.error('Choose a valid start date.'); return; }
    if (endDate && endDate < startDate) { toast.error('The end date cannot be before the start date.'); return; }
    const parsedMonthDays = monthDays.split(',').map((value) => Number(value.trim())).filter(Number.isInteger);
    if (recurrence === 'monthly' && (parsedMonthDays.length === 0 || parsedMonthDays.some((day) => day < 1 || day > 31))) {
      toast.error('Enter valid month days from 1 to 31.'); return;
    }
    setSaving(status);
    try {
      const payload = {
        name: name.trim(), description: description.trim() || undefined, status, recurrence, timezone, sendTime,
        weekdays: recurrence === 'weekly' ? weekdays : undefined,
        monthDays: recurrence === 'monthly' ? parsedMonthDays : undefined,
        startDate,
        endDate: endDate || undefined,
        audienceLabel: estimatedRecipients > 0
          ? `Approximately ${estimatedRecipients.toLocaleString()} recipients`
          : schedule?.audienceLabel || 'Selected campaign audience',
        compose,
      };
      if (schedule) await apiClient.updateAdminEmailSchedule(schedule.id, payload);
      else await apiClient.createAdminEmailSchedule(payload);
      await onSaved?.();
      toast.success(schedule ? 'Schedule updated.' : status === 'active' ? 'Schedule activated.' : 'Schedule saved as draft.');
      onClose();
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Could not save the schedule.'));
    } finally { setSaving(null); }
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" labelledBy="schedule-campaign-title" className="max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between border-b border-[var(--color-border-secondary)] p-6">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-primary)]">Delivery automation</p><h2 id="schedule-campaign-title" className="text-xl font-bold text-[var(--color-text-primary)]">{schedule ? 'Edit campaign schedule' : 'Schedule this campaign'}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Times are stored safely in UTC and continue to follow the selected timezone.</p></div>
        <Button type="button" variant="ghost" onClick={onClose} aria-label="Close schedule editor" icon={<X className="h-4 w-4" />} />
      </div>
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Schedule name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Sunday service invitation" />
          <Select label="Frequency" value={recurrence} onChange={(event) => setRecurrence(event.target.value as AdminEmailRecurrence)}><option value="once">Send once</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select>
        </div>
        <Textarea label="Internal description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Purpose and owner of this automation" />
        {recurrence === 'weekly' && <div><p className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Send on</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{WEEKDAYS.map((day, index) => <Checkbox key={day} label={day} checked={weekdays.includes(index)} onChange={() => setWeekdays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} />)}</div></div>}
        {recurrence === 'monthly' && <Input label="Days of the month" helperText="Comma-separated, for example 1, 15, 28. Months without a selected day are skipped." value={monthDays} onChange={(event) => setMonthDays(event.target.value)} />}
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Send time" type="time" required value={sendTime} onChange={(event) => setSendTime(event.target.value)} />
          <Input label="IANA timezone" required value={timezone} onChange={(event) => setTimezone(event.target.value)} helperText="For example Africa/Lagos or Europe/London" />
          <Input label={recurrence === 'once' ? 'Send date' : 'Starts on'} type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          {recurrence !== 'once' && <Input label="Ends on (optional)" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} />}
        </div>
        <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-sm text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text-primary)]">Ready to automate:</strong> {compose.subject} · {estimatedRecipients.toLocaleString()} estimated recipients. Recipient lists are resolved fresh at each send.</div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border-secondary)] p-6"><Button type="button" variant="outline" onClick={() => void save('draft')} loading={saving === 'draft'}>{schedule ? 'Save as draft' : 'Save draft'}</Button><Button type="button" onClick={() => void save('active')} loading={saving === 'active'} icon={<CalendarClock className="h-4 w-4" />}>{schedule ? 'Save and activate' : 'Activate schedule'}</Button></div>
    </Modal>
  );
}
