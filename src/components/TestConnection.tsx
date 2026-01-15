// src/components/TestConnection.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

export default function TestConnection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testConnection = async () => {
    setStatus('loading');
    setError('');
    try {
      const result = await apiClient.testConnection();
      setData(result);
      setStatus('success');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const testTestimonials = async () => {
    try {
      const testimonials = await apiClient.getTestimonials();
      console.log('Testimonials:', testimonials);
      alert(`Fetched ${Array.isArray(testimonials) ? testimonials.length : testimonials.total} testimonials`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-bold mb-4">Backend Connection Test</h2>
      
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            status === 'loading' ? 'bg-yellow-500' :
            status === 'success' ? 'bg-green-500' :
            status === 'error' ? 'bg-red-500' : 'bg-gray-500'
          }`} />
          <span className="font-medium">
            Status: {status === 'loading' ? 'Connecting...' :
                   status === 'success' ? 'Connected' :
                   status === 'error' ? 'Failed' : 'Idle'}
          </span>
        </div>
        
        {data && (
          <div className="text-sm text-gray-600">
            <p>Backend: {data.service}</p>
            <p>Version: {data.version}</p>
            <p>Status: {data.status}</p>
          </div>
        )}
        
        {error && (
          <div className="text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Connection
        </button>
        
        <button
          onClick={testTestimonials}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Testimonials
        </button>
      </div>
    </div>
  );
}