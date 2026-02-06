// src/app/forms/[slug]/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import type { PublicFormPayload, FormField } from '@/lib/types';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type ValuesState = Record<string, string | boolean | string[]>;

function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string | boolean | string[] | undefined;
  onChange: (next: string | boolean | string[]) => void;
  error?: string;
}) {
  const common =
    'w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const options = field.options ?? [];

  if (field.type === 'textarea') {
    return (
      <textarea
        className={common}
        rows={4}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
        required={field.required}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={common}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-secondary-700">
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              className="h-4 w-4 border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox' && options.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-secondary-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selected, opt.value]);
                  } else {
                    onChange(selected.filter((v) => v !== opt.value));
                  }
                }}
                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-secondary-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
        />
        <span>{field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === 'email' ? 'email' :
    field.type === 'tel' ? 'tel' :
    field.type === 'number' ? 'number' :
    field.type === 'date' ? 'date' :
    'text';

    return (
      <input
        type={inputType}
        className={common}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
        required={field.required}
      />
    );
  }

export default function PublicFormPage() {
  const params = useParams();
  const slug = useMemo(() => {
    const raw = params?.slug;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PublicFormPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<ValuesState>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const fields = payload?.form?.fields ?? [];
  const settings = payload?.form?.settings;

  const buildInitialValues = (formFields: FormField[]): ValuesState => {
    const init: ValuesState = {};
    formFields.forEach((f) => {
      if (f.type === 'checkbox' && (f.options?.length ?? 0) > 0) {
        init[f.key] = [];
      } else if (f.type === 'checkbox') {
        init[f.key] = false;
      } else {
        init[f.key] = '';
      }
    });
    return init;
  };

  const updateValue = (key: string, next: string | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (formError) {
      setFormError('');
    }
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Fetch
  useEffect(() => {
    if (!slug) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.getPublicForm(slug);
        if (!alive) return;

        setPayload(res);

        // init values
        setValues(buildInitialValues(res.form.fields ?? []));
        setFieldErrors({});
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Failed to load registration form';
        toast.error(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const eventTitle = payload?.event?.title ?? payload?.form?.title ?? 'Event Registration';
  const eventSubtitle = payload?.event?.shortDescription ?? payload?.form?.description ?? 'Secure your spot by registering below.';
  const bannerUrl =
    payload?.event?.bannerImage ||
    payload?.event?.image ||
    settings?.design?.coverImageUrl ||
    undefined;

  const parseDate = (value?: string) => {
    if (!value) return null;
    const t = new Date(value);
    return Number.isNaN(t.getTime()) ? null : t;
  };

  const closesAt = parseDate(settings?.closesAt);
  const expiresAt = parseDate(settings?.expiresAt);
  const now = new Date();
  const isClosed = (closesAt && now > closesAt) || (expiresAt && now > expiresAt);

  // “What to Expect” list:
  // For now we derive it from event tags OR you can store it in form.settings later
  const whatToExpect = useMemo(() => {
    const tags = payload?.event?.tags ?? [];
    if (tags.length > 0) return tags.slice(0, 5);
    return ['Smooth check-in', 'Engaging sessions', 'Friendly community', 'Practical takeaways'];
  }, [payload]);

  const validateClient = () => {
    const nextErrors: Record<string, string> = {};
    let anyFilled = false;

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRe = /^[0-9()+\-\s]{6,}$/;

    fields.forEach((f) => {
      const v = values[f.key];

      const markFilled = () => {
        anyFilled = true;
      };

      if (f.type === 'checkbox' && (f.options?.length ?? 0) > 0) {
        const list = Array.isArray(v) ? v : [];
        if (list.length === 0) {
          if (f.required) {
            nextErrors[f.key] = `${f.label} is required.`;
          }
        } else {
          markFilled();
        }
        return;
      }

      if (f.type === 'checkbox') {
        if (v === true) {
          markFilled();
        } else if (f.required) {
          nextErrors[f.key] = `${f.label} is required.`;
        }
        return;
      }

      if (typeof v !== 'string' || v.trim() === '') {
        if (f.required) {
          nextErrors[f.key] = `${f.label} is required.`;
        }
        return;
      }

      const trimmed = v.trim();
      if (trimmed !== '') {
        markFilled();
      }

      if (f.type === 'email' && !emailRe.test(trimmed)) {
        nextErrors[f.key] = 'Please enter a valid email address.';
        return;
      }

      if (f.type === 'tel' && !phoneRe.test(trimmed)) {
        nextErrors[f.key] = 'Please enter a valid phone number.';
        return;
      }

      if (f.type === 'number' && Number.isNaN(Number(trimmed))) {
        nextErrors[f.key] = 'Please enter a valid number.';
        return;
      }

      if (f.type === 'date' && Number.isNaN(new Date(trimmed).getTime())) {
        nextErrors[f.key] = 'Please enter a valid date.';
      }
    });

    setFieldErrors(nextErrors);
    if (!anyFilled) {
      setFormError('Please enter at least one field before submitting.');
      return false;
    }
    setFormError('');
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!slug || !payload) return;

    try {
      if (isClosed) {
        toast.error('This registration is closed.');
        return;
      }
      setFormError('');
      if (!validateClient()) {
        toast.error('Please complete the required fields.');
        return;
      }
      setSubmitting(true);
      await apiClient.submitPublicForm(slug, { values });
      setFieldErrors({});
      toast.success(payload.form.settings?.successMessage || 'Registration submitted successfully!');
      // Optionally clear:
      setValues(buildInitialValues(fields));
    } catch (err) {
      console.error(err);
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }
      const message = getServerErrorMessage(err, 'Failed to submit registration');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="p-6 max-w-lg w-full">
          <h1 className="text-xl font-semibold text-secondary-900">Form not available</h1>
          <p className="text-secondary-600 mt-2">This registration link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-gradient-to-b from-white via-secondary-50 to-white transition-opacity duration-500">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-secondary-200 bg-white px-3 py-1 text-xs text-secondary-600 shadow-sm">
            Registration
          </div>
          {bannerUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm">
              <div className="relative h-48 sm:h-64">
                <Image
                  src={bannerUrl}
                  alt={eventTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 900px"
                  priority
                />
              </div>
            </div>
          ) : null}
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-secondary-900">
            {eventTitle}
          </h1>
          <p className="mt-2 text-secondary-600 max-w-2xl">{eventSubtitle}</p>
          {isClosed ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Registration is closed for this form.
            </div>
          ) : null}
        </div>

        {/* 1 col on mobile, 2 cols on tablet+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left: event details */}
          <div ref={leftRef} className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-secondary-900">What to Expect</h2>
              <p className="text-sm text-secondary-600 mt-1">
                Here’s a quick overview of what your experience will look like.
              </p>

              <ul ref={listRef} className="mt-4 space-y-3">
                {whatToExpect.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex items-start gap-3 rounded-xl border border-secondary-100 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-600" />
                    <div className="text-sm text-secondary-800">{item}</div>
                  </li>
                ))}
              </ul>
            </Card>

            {payload.event ? (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-secondary-900">Event Details</h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-secondary-100 bg-white p-4">
                    <div className="text-secondary-500">Date</div>
                    <div className="mt-1 font-medium text-secondary-900">
                      {new Date(payload.event.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-secondary-100 bg-white p-4">
                    <div className="text-secondary-500">Time</div>
                    <div className="mt-1 font-medium text-secondary-900">{payload.event.time}</div>
                  </div>
                  <div className="rounded-xl border border-secondary-100 bg-white p-4 sm:col-span-2">
                    <div className="text-secondary-500">Location</div>
                    <div className="mt-1 font-medium text-secondary-900">{payload.event.location}</div>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          {/* Right: the form */}
          <div ref={rightRef}>
            <Card className="p-6 md:p-7 shadow-lg">
              <h2 className="text-xl font-semibold text-secondary-900">{payload.form.title}</h2>
              {payload.form.description ? (
                <p className="mt-2 text-sm text-secondary-600">{payload.form.description}</p>
              ) : null}
              {settings?.formHeaderNote ? (
                <p className="mt-3 rounded-lg border border-secondary-100 bg-secondary-50 px-3 py-2 text-xs text-secondary-600">
                  {settings.formHeaderNote}
                </p>
              ) : null}

              <div className="mt-6 space-y-4">
                {fields
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((field) => {
                    const checkboxWithOptions = field.type === 'checkbox' && (field.options?.length ?? 0) > 0;
                    const showLabel = field.type !== 'checkbox' || checkboxWithOptions;
                    return (
                    <div key={field.key} className="space-y-1.5">
                      {showLabel ? (
                        <label className="block text-sm font-medium text-secondary-700">
                          {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                        </label>
                      ) : null}

                      <FieldInput
                        field={field}
                        value={values[field.key]}
                        onChange={(next) => updateValue(field.key, next)}
                        error={fieldErrors[field.key]}
                      />
                      {fieldErrors[field.key] && (
                        <p className="text-xs text-red-600">{fieldErrors[field.key]}</p>
                      )}
                    </div>
                  )})}
              </div>

              <div className="mt-6">
                {formError && (
                  <p className="mb-3 text-xs text-red-600">{formError}</p>
                )}
                <Button className="w-full" loading={submitting} disabled={submitting || isClosed} onClick={submit}>
                  Submit Registration
                </Button>

                <p className="mt-3 text-xs text-secondary-500 text-center">
                  By submitting, you confirm your details are accurate.
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-10 text-center text-xs text-secondary-500">
          Powered by Wisdom House Registration
        </div>
      </div>
    </div>
  );
}
