'use client';

import { useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, error, placeholder }: RichTextEditorProps) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className={`w-full rounded-lg border ${
          error ? 'border-red-500' : 'border-gray-300'
        } px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}