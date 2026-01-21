// src/app/(dashboard)/reels/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Eye } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DataTable } from '@/components/DateTable';
import { ImageUpload } from '@/components/ImageUpload';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { ReelData } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { PageHeader } from '@/layouts';

function ReelsPage() {
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadReels();
  }, [page, limit]);

  const loadReels = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getReels({ page, limit });
      setReels(response.data);
      setTotal(response.total);
    } catch (error) {
      toast.error('Failed to load reels');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reel: ReelData) => {
    if (!confirm(`Are you sure you want to delete "${reel.title}"?`)) {
      return;
    }

    try {
      await apiClient.deleteReel(reel.id);
      toast.success('Reel deleted successfully');
      loadReels();
    } catch (error) {
      toast.error('Failed to delete reel');
      console.error(error);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('video', files[0]);
      formData.append('title', 'New Reel');
      formData.append('duration', '0:00');

      await apiClient.createReel(formData);
      toast.success('Reel uploaded successfully');
      setShowUploadModal(false);
      loadReels();
    } catch (error) {
      toast.error('Failed to upload reel');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      key: 'thumbnail' as keyof ReelData,
      header: 'Thumbnail',
      cell: (reel: ReelData) => (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden">
          <img
            src={reel.thumbnail}
            alt={reel.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Play className="h-6 w-6 text-white" />
          </div>
        </div>
      ),
    },
    {
      key: 'title' as keyof ReelData,
      header: 'Title',
      cell: (reel: ReelData) => (
        <div>
          <div className="font-medium text-secondary-900">{reel.title}</div>
          <div className="text-sm text-secondary-500">
            {new Date(reel.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'duration' as keyof ReelData,
      header: 'Duration',
    },
    {
      key: 'createdAt' as keyof ReelData,
      header: 'Uploaded',
      cell: (reel: ReelData) => (
        <div className="text-sm text-secondary-600">
          {new Date(reel.createdAt).toLocaleDateString()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Reels"
        subtitle="Manage video highlights and reels."
        actions={(
          <Button onClick={() => setShowUploadModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Reel
          </Button>
        )}
      />

      <DataTable
        data={reels}
        columns={columns}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onDelete={handleDelete}
        isLoading={loading}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold text-secondary-900 mb-4">Upload New Reel</h2>
              
              <ImageUpload
                onUpload={handleUpload}
                maxFiles={1}
                maxSize={100} // 100MB for videos
                accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] }}
              />

              <div className="mt-6 flex items-center gap-3">
                <Button
                  onClick={() => handleUpload([])}
                  loading={uploading}
                  disabled={uploading}
                >
                  Upload
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withAuth(ReelsPage, { requiredRole: 'admin' });
