// src/app/(dashboard)/reels/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Play } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DataTable } from '@/components/DateTable';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { ReelData } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';

const MAX_VIDEO_MB = 5;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const MAX_THUMB_MB = 5;
const MAX_THUMB_BYTES = MAX_THUMB_MB * 1024 * 1024;
const ACCEPTED_THUMB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const formatDuration = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

function ReelsPage() {
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReelData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const loadReels = useCallback(async () => {
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
  }, [page, limit]);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [videoPreview, thumbnailPreview]);

  const resetUploadState = () => {
    setUploadTitle('');
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setThumbnailFile(null);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
  };

  const validateVideoFile = (file: File): string | null => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return 'Video must be MP4, WebM, or MOV.';
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return `Video must be ${MAX_VIDEO_MB}MB or smaller.`;
    }
    return null;
  };

  const validateThumbnailFile = (file: File): string | null => {
    if (!ACCEPTED_THUMB_TYPES.includes(file.type)) {
      return 'Thumbnail must be JPEG, PNG, or WebP.';
    }
    if (file.size > MAX_THUMB_BYTES) {
      return `Thumbnail must be ${MAX_THUMB_MB}MB or smaller.`;
    }
    return null;
  };

  const handleVideoSelect = (file?: File) => {
    if (!file) {
      setVideoFile(null);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
      return;
    }
    const error = validateVideoFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setVideoFile(file);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleThumbnailSelect = (file?: File) => {
    if (!file) {
      setThumbnailFile(null);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailPreview(null);
      return;
    }
    const error = validateThumbnailFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setThumbnailFile(file);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const getVideoDuration = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        URL.revokeObjectURL(video.src);
        resolve(formatDuration(duration));
      };
      video.onerror = () => resolve('0:00');
      video.src = URL.createObjectURL(file);
    });

  const requestDelete = (reel: ReelData) => {
    setDeleteTarget(reel);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiClient.deleteReel(deleteTarget.id);
      toast.success('Reel deleted successfully');
      setDeleteTarget(null);
      await loadReels();
    } catch (error) {
      toast.error('Failed to delete reel');
      console.error(error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, loadReels]);

  const deletePhrase = deleteTarget
    ? `DELETE ${deleteTarget.title || deleteTarget.id}`
    : 'DELETE';

  const uploadToPresignedUrl = async (url: string, file: File) => {
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    if (!res.ok) {
      throw new Error('Upload failed');
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !thumbnailFile) {
      toast.error('Please select a video and a thumbnail.');
      return;
    }

    try {
      setUploading(true);

      const [videoPresign, thumbPresign, duration] = await Promise.all([
        apiClient.createUploadPresign({
          filename: videoFile.name,
          contentType: videoFile.type,
          sizeBytes: videoFile.size,
          kind: 'video',
          folder: 'reels/videos',
        }),
        apiClient.createUploadPresign({
          filename: thumbnailFile.name,
          contentType: thumbnailFile.type,
          sizeBytes: thumbnailFile.size,
          kind: 'thumbnail',
          folder: 'reels/thumbnails',
        }),
        getVideoDuration(videoFile),
      ]);

      await Promise.all([
        uploadToPresignedUrl(videoPresign.uploadUrl, videoFile),
        uploadToPresignedUrl(thumbPresign.uploadUrl, thumbnailFile),
      ]);

      const completionJobs: Promise<unknown>[] = [];
      if (videoPresign.assetId) {
        completionJobs.push(apiClient.completeUploadAsset(videoPresign.assetId));
      }
      if (thumbPresign.assetId) {
        completionJobs.push(apiClient.completeUploadAsset(thumbPresign.assetId));
      }
      if (completionJobs.length > 0) {
        await Promise.all(completionJobs);
      }

      const payload = {
        title: uploadTitle.trim() || 'New Reel',
        videoUrl: videoPresign.publicUrl,
        thumbnail: thumbPresign.publicUrl,
        duration,
      };

      await apiClient.createReel(payload);
      toast.success('Reel uploaded successfully');
      setShowUploadModal(false);
      resetUploadState();
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
          <Image
            src={reel.thumbnail}
            alt={reel.title}
            width={80}
            height={80}
            className="w-full h-full object-cover"
            unoptimized
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
        onDelete={requestDelete}
        isLoading={loading}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold text-secondary-900 mb-4">Upload New Reel</h2>

              <div className="space-y-4">
                <Input
                  label="Title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Sunday Highlights"
                />

                <Input
                  label="Video file"
                  type="file"
                  accept={ACCEPTED_VIDEO_TYPES.join(',')}
                  onChange={(e) => handleVideoSelect(e.target.files?.[0])}
                  helperText={`MP4, WebM, or MOV up to ${MAX_VIDEO_MB}MB.`}
                />
                {videoPreview && (
                  <video
                    src={videoPreview}
                    controls
                    className="w-full max-h-64 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-black"
                  />
                )}

                <Input
                  label="Thumbnail image"
                  type="file"
                  accept={ACCEPTED_THUMB_TYPES.join(',')}
                  onChange={(e) => handleThumbnailSelect(e.target.files?.[0])}
                  helperText={`JPEG, PNG, or WebP up to ${MAX_THUMB_MB}MB.`}
                />
                {thumbnailPreview && (
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    width={960}
                    height={540}
                    className="w-full max-h-48 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
                    unoptimized
                  />
                )}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={uploading}
                >
                  Upload
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadState();
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <VerifyActionModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Reel"
        description="This action permanently removes the reel and its media references."
        confirmText="Delete Reel"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
        verifyText={deletePhrase}
      />
    </div>
  );
}

export default withAuth(ReelsPage, { requiredRole: 'admin' });
