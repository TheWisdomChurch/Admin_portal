// src/app/(dashboard)/events/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ImageUpload } from '@/components/ImageUpload';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { EventData } from '@/lib/types';
import { withAuth } from '@/providers/AuthProviders';

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

function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id ? parseInt(params.id as string) : 0;
  
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [bannerFiles, setBannerFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
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

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    
    try {
      const data = await apiClient.getEvent(eventId);
      setEvent(data);
      
      // Reset form with event data
      reset({
        title: data.title || '',
        shortDescription: data.shortDescription || '',
        description: data.description || '',
        date: data.date || '',
        time: data.time || '',
        location: data.location || '',
        category: data.category || 'Outreach',
        status: data.status || 'upcoming',
        isFeatured: data.isFeatured || false,
        tags: data.tags?.join(', ') || '',
        registerLink: data.registerLink || '',
        speaker: data.speaker || '',
        contactPhone: data.contactPhone || '',
      });
    } catch (error) {
      toast.error('Failed to load event');
      router.push('/events');
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!eventId) return;
    
    try {
      setLoading(true);

      const formData = new FormData();
      
      // Append all form data
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'tags' && value) {
            const tagsArray = (value as string).split(',').map(tag => tag.trim());
            formData.append(key, JSON.stringify(tagsArray));
          } else if (key === 'isFeatured') {
            formData.append(key, value ? 'true' : 'false');
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // Append images if new ones are uploaded
      if (imageFiles[0]) {
        formData.append('image', imageFiles[0]);
      }
      if (bannerFiles[0]) {
        formData.append('bannerImage', bannerFiles[0]);
      }

      await apiClient.updateEvent(eventId, formData);
      toast.success('Event updated successfully!');
      router.push('/events');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update event');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId || !event) return;
    
    if (!confirm(`Are you sure you want to delete "${event?.title}"?`)) {
      return;
    }

    try {
      await apiClient.deleteEvent(eventId);
      toast.success('Event deleted successfully');
      router.push('/events');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event');
      console.error(error);
    }
  };

  if (!eventId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="mt-2 text-gray-600">Invalid event ID</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>
          <p className="text-gray-600 mt-2">Update the details of this event</p>
        </div>
        
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Event
        </Button>
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
            {/* Current Images */}
            <Card title="Current Images">
              <div className="space-y-4">
                {event.image && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Event Image
                    </label>
                    <img
                      src={event.image}
                      alt="Current event"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                
                {event.bannerImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Banner Image
                    </label>
                    <img
                      src={event.bannerImage}
                      alt="Current banner"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Update Images */}
            <Card title="Update Images">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Event Image (Optional)
                  </label>
                  <ImageUpload
                    onUpload={setImageFiles}
                    maxFiles={1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Banner Image (Optional)
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('category')}
                  >
                    <option value="Outreach">Outreach</option>
                    <option value="Conference">Conference</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Prayer">Prayer</option>
                    <option value="Revival">Revival</option>
                    <option value="Summit">Summit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('status')}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="happening">Happening Now</option>
                    <option value="past">Past Event</option>
                  </select>
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
                  Update Event
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

export default withAuth(EditEventPage, { requiredRole: 'admin' });