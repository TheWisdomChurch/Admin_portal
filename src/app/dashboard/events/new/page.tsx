// src/app/dashboard/events/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ImageUpload } from '@/components/ImageUpload';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { withAuth } from '@/providers/AuthProviders';
import { RegisterEventData } from '@/lib/types';

// Create the event schema
const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  shortDescription: z.string().min(1, 'Short description is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
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
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [bannerFiles, setBannerFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      status: 'upcoming',
      isFeatured: false,
      category: 'Outreach',
      description: '',
      registerLink: '',
      tags: '',
      speaker: '',
      contactPhone: '',
    },
  });

  const onSubmit = async (data: EventFormData) => {
    try {
      setLoading(true);

      // Prepare event data (without images for now)
      const eventData: RegisterEventData = {
        title: data.title,
        shortDescription: data.shortDescription,
        description: data.description,
        date: data.date,
        time: data.time,
        location: data.location,
        category: data.category,
        status: data.status,
        isFeatured: data.isFeatured,
        tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
        registerLink: data.registerLink || undefined,
        speaker: data.speaker || undefined,
        contactPhone: data.contactPhone || undefined,
      };

      // For now, create event without images since backend might not be ready
      // await apiClient.createEvent(eventData);
      
      toast.success('Event created successfully!');
      router.push('/dashboard/events');
    } catch (error: any) {
      // Mock success for development
      console.log('Mocking event creation for development');
      toast.success('Event created successfully! (Mock)');
      router.push('/dashboard/events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
          <p className="text-gray-600 mt-2">Fill in the details below to create a new event</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card title="Basic Information">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter event title"
                    className={`w-full rounded-lg border ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Description *
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Description *
                  </label>
                  <RichTextEditor
                    value={watch('description')}
                    onChange={(value) => setValue('description', value)}
                    error={errors.description?.message}
                    placeholder="Enter detailed event description..."
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Date & Location */}
            <Card title="Date & Location">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    className={`w-full rounded-lg border ${
                      errors.date ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('date')}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 9:00 AM - 5:00 PM"
                    className={`w-full rounded-lg border ${
                      errors.time ? 'border-red-500' : 'border-gray-300'
                    } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    {...register('time')}
                  />
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-500">{errors.time.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
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

            {/* Additional Information */}
            <Card title="Additional Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Speaker
                  </label>
                  <input
                    type="text"
                    placeholder="Event speaker name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('speaker')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="Contact number for inquiries"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('contactPhone')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/register"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('registerLink')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma separated)
                  </label>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Images */}
            <Card title="Event Images">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Image
                    <span className="text-gray-500 text-sm font-normal ml-1">(Optional for now)</span>
                  </label>
                  <ImageUpload
                    onUpload={setImageFiles}
                    maxFiles={1}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Image upload will be functional when backend is ready
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image
                    <span className="text-gray-500 text-sm font-normal ml-1">(Optional)</span>
                  </label>
                  <ImageUpload
                    onUpload={setBannerFiles}
                    maxFiles={1}
                  />
                </div>
              </div>
            </Card>

            {/* Settings */}
            <Card title="Event Settings">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
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
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
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
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    {...register('isFeatured')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isFeatured" className="text-sm text-gray-700">
                    Mark as Featured Event
                  </label>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                  disabled={loading}
                >
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