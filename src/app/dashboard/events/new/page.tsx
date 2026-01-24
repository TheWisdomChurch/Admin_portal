'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { Resolver, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ImageUpload } from '@/components/ImageUpload';
import { PageHeader } from '@/layouts';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

import type { EventPayload } from '@/lib/types';

// Schema
const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  shortDescription: z.string().min(1, 'Short description is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  sessions: z
    .array(
      z.object({
        title: z.string().min(1, 'Session title required'),
        time: z.string().min(1, 'Session time required'),
      })
    )
    .optional(),
  location: z.string().min(1, 'Location is required'),
  category: z.enum(['Outreach', 'Conference', 'Workshop', 'Prayer', 'Revival', 'Summit']),
  status: z.enum(['upcoming', 'happening', 'past']),
  isFeatured: z.boolean().default(false),
  tags: z.string().optional(),
  registerLink: z.string().url().optional().or(z.literal('')),
  speaker: z.string().optional(),
  contactPhone: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

function CreateEventPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [bannerFiles, setBannerFiles] = useState<File[]>([]);
  const [sessions, setSessions] = useState<{ title: string; time: string }[]>([{ title: 'Morning Session', time: '09:00 AM' }]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    /**
     * IMPORTANT:
     * This cast solves the "two different types exist" error when multiple RHF copies are installed.
     * It keeps full runtime validation, and keeps the form strongly typed.
     */
    resolver: zodResolver(eventSchema) as unknown as Resolver<EventFormData>,
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      date: '',
      time: '',
      startDate: '',
      endDate: '',
      registrationClosesAt: '',
      location: '',
      category: 'Outreach',
      status: 'upcoming',
      isFeatured: false,
      tags: '',
      registerLink: '',
      speaker: '',
      contactPhone: '',
    },
  });

  const pageBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  if (pageBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  const onSubmit: SubmitHandler<EventFormData> = async (data) => {
    try {
      setSubmitting(true);

      const payload: EventPayload = {
        title: data.title,
        shortDescription: data.shortDescription,
        description: data.description,
        date: data.date,
        time: data.time,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        registrationClosesAt: data.registrationClosesAt || undefined,
        sessions: sessions.filter((s) => s.title && s.time),
        location: data.location,
        category: data.category,
        status: data.status,
        isFeatured: data.isFeatured ?? false,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        registerLink: data.registerLink || undefined,
        speaker: data.speaker || undefined,
        contactPhone: data.contactPhone || undefined,
      };

      // Example:
      // await apiClient.createEvent(payload);

      // TEMP: mock success
      toast.success('Event created successfully!');
      router.push('/dashboard/events');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <PageHeader
          title="Create New Event"
          subtitle="Fill in the details below to create a new event."
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Basic Information">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                  <input
                    type="text"
                    placeholder="Enter event title"
                    className={`w-full rounded-lg border ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('title')}
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Description *</label>
                  <input
                    type="text"
                    placeholder="Brief description for cards and previews"
                    className={`w-full rounded-lg border ${
                      errors.shortDescription ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('shortDescription')}
                  />
                  {errors.shortDescription && (
                    <p className="mt-1 text-sm text-red-500">{errors.shortDescription.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Description *</label>
                  <RichTextEditor
                    value={watch('description')}
                    onChange={(value) => setValue('description', value, { shouldValidate: true })}
                    error={errors.description?.message}
                    placeholder="Enter detailed event description..."
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Date & Location">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    className={`w-full rounded-lg border ${
                      errors.date ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('date')}
                  />
                  {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input
                    type="text"
                    placeholder="e.g., 9:00 AM - 5:00 PM"
                    className={`w-full rounded-lg border ${
                      errors.time ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('time')}
                  />
                  {errors.time && <p className="mt-1 text-sm text-red-500">{errors.time.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date (range)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('startDate')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date (range)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('endDate')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration closes</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('registrationClosesAt')}
                  />
                  <p className="text-xs text-gray-500 mt-1">Link disconnects after this date.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    placeholder="Enter event location"
                    className={`w-full rounded-lg border ${
                      errors.location ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('location')}
                  />
                  {errors.location && (
                    <p className="mt-1 text-sm text-red-500">{errors.location.message}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Additional Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sessions (timeline)</label>
                  <div className="space-y-3">
                    {sessions.map((session, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={session.title}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s))
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Morning session"
                        />
                        <input
                          type="text"
                          value={session.time}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, time: e.target.value } : s))
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="09:00 AM - 11:00 AM"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSessions((prev) => [...prev, { title: 'New session', time: '12:00 PM' }])}
                      >
                        Add session
                      </Button>
                      {sessions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSessions((prev) => prev.slice(0, -1))}
                        >
                          Remove last
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Speaker</label>
                  <input
                    type="text"
                    placeholder="Event speaker name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('speaker')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="Contact number for inquiries"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('contactPhone')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Link</label>
                  <input
                    type="url"
                    placeholder="https://example.com/register"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('registerLink')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g., Youth, Leadership, Workshop"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('tags')}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Event Images">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Image <span className="text-gray-500 text-sm font-normal ml-1">(Optional for now)</span>
                  </label>
                  <ImageUpload onUpload={setImageFiles} maxFiles={1} />
                  <p className="mt-1 text-xs text-gray-500">Image upload will be functional when backend is ready</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image <span className="text-gray-500 text-sm font-normal ml-1">(Optional)</span>
                  </label>
                  <ImageUpload onUpload={setBannerFiles} maxFiles={1} />
                </div>
              </div>
            </Card>

            <Card title="Event Settings">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    className={`w-full rounded-lg border ${
                      errors.category ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('category')}
                  >
                    <option value="Outreach">Outreach</option>
                    <option value="Conference">Conference</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Prayer">Prayer</option>
                    <option value="Revival">Revival</option>
                    <option value="Summit">Summit</option>
                  </select>
                  {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    className={`w-full rounded-lg border ${
                      errors.status ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('status')}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="happening">Happening Now</option>
                    <option value="past">Past Event</option>
                  </select>
                  {errors.status && <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    {...register('isFeatured')}
                  />
                  <label htmlFor="isFeatured" className="text-sm text-gray-700">
                    Mark as Featured Event
                  </label>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
                  <Save className="h-4 w-4 mr-2" />
                  Create Event
                </Button>

                <Button type="button" variant="outline" className="w-full" onClick={() => router.back()} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

export default withAuth(CreateEventPage, { requiredRole: 'admin' });
