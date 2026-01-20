// src/app/forms/[slug]/page.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import gsap from 'gsap';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import type { PublicFormPayload, FormField } from '@/lib/types';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';

type ValuesState = Record<string, string | boolean>;

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | undefined;
  onChange: (next: string | boolean) => void;
}) {
  const common =
    'w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (field.type === 'textarea') {
    return (
      <textarea
        className={common}
        rows={4}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={common}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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

  const fields = payload?.form?.fields ?? [];

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
        const init: ValuesState = {};
        (res.form.fields ?? []).forEach((f) => {
          init[f.key] = f.type === 'checkbox' ? false : '';
        });
        setValues(init);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || 'Failed to load registration form');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  // GSAP entrance
  useLayoutEffect(() => {
    if (!payload || loading) return;

    const ctx = gsap.context(() => {
      gsap.set([leftRef.current, rightRef.current], { opacity: 0, y: 18 });
      gsap.set(listRef.current?.children ?? [], { opacity: 0, y: 10 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.to(leftRef.current, { opacity: 1, y: 0, duration: 0.7 }, 0);
      tl.to(rightRef.current, { opacity: 1, y: 0, duration: 0.7 }, 0.05);
      tl.to(listRef.current?.children ?? [], { opacity: 1, y: 0, duration: 0.45, stagger: 0.06 }, 0.25);
    }, rootRef);

    return () => ctx.revert();
  }, [payload, loading]);

  const eventTitle = payload?.event?.title ?? payload?.form?.title ?? 'Event Registration';
  const eventSubtitle = payload?.event?.shortDescription ?? payload?.form?.description ?? 'Secure your spot by registering below.';

  // “What to Expect” list:
  // For now we derive it from event tags OR you can store it in form.settings later
  const whatToExpect = useMemo(() => {
    const tags = payload?.event?.tags ?? [];
    if (tags.length > 0) return tags.slice(0, 5);
    return ['Smooth check-in', 'Engaging sessions', 'Friendly community', 'Practical takeaways'];
  }, [payload]);

  const validateRequired = (): string | null => {
    for (const f of fields) {
      if (!f.required) continue;
      const v = values[f.key];

      if (f.type === 'checkbox') {
        if (!v) return `Please confirm: ${f.label}`;
      } else {
        if (typeof v !== 'string' || v.trim().length === 0) return `${f.label} is required`;
      }
    }
    return null;
  };

  const submit = async () => {
    if (!slug || !payload) return;

    const errMsg = validateRequired();
    if (errMsg) {
      toast.error(errMsg);
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.submitPublicForm(slug, { values });
      toast.success(payload.form.settings?.successMessage || 'Registration submitted successfully!');
      // Optionally clear:
      const cleared: ValuesState = {};
      fields.forEach((f) => (cleared[f.key] = f.type === 'checkbox' ? false : ''));
      setValues(cleared);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to submit registration');
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
    <div ref={rootRef} className="min-h-screen bg-gradient-to-b from-white via-secondary-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-secondary-200 bg-white px-3 py-1 text-xs text-secondary-600 shadow-sm">
            Registration
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-secondary-900">
            {eventTitle}
          </h1>
          <p className="mt-2 text-secondary-600 max-w-2xl">{eventSubtitle}</p>
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

              <div className="mt-6 space-y-4">
                {fields
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      {field.type !== 'checkbox' ? (
                        <label className="block text-sm font-medium text-secondary-700">
                          {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                        </label>
                      ) : null}

                      <FieldInput
                        field={field}
                        value={values[field.key]}
                        onChange={(next) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: next,
                          }))
                        }
                      />
                    </div>
                  ))}
              </div>

              <div className="mt-6">
                <Button className="w-full" loading={submitting} disabled={submitting} onClick={submit}>
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
