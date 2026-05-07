'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Film, Plus, Play, RefreshCw, Search, Trash2, UploadCloud, X } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { apiClient } from '@/lib/api';
import { uploadAsset } from '@/lib/uploads';
import type { ReelData } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { PageHeader } from '@/layouts';

const MAX_VIDEO_MB = 5;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_THUMB_MB = 5;
const MAX_THUMB_BYTES = MAX_THUMB_MB * 1024 * 1024;
const ACCEPTED_THUMB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>{children}</section>;
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-8 text-center">
      <Film className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" />
      <p className="mt-3 text-sm font-black text-[var(--color-text-primary)]">No reels uploaded</p>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Upload a reel and thumbnail to start publishing media highlights.</p>
    </div>
  );
}

function ReelsPage() {
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [query, setQuery] = useState('');
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
      setReels(Array.isArray(response.data) ? response.data : []);
      setTotal(Number(response.total || 0));
    } catch (error) {
      toast.error('Failed to load reels');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { void loadReels(); }, [loadReels]);
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview); }, [videoPreview, thumbnailPreview]);

  const filteredReels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reels;
    return reels.filter((reel) => `${reel.title} ${reel.duration} ${reel.createdAt}`.toLowerCase().includes(needle));
  }, [query, reels]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

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
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) return 'Video must be MP4, WebM, or MOV.';
    if (file.size > MAX_VIDEO_BYTES) return `Video must be ${MAX_VIDEO_MB}MB or smaller.`;
    return null;
  };

  const validateThumbnailFile = (file: File): string | null => {
    if (!ACCEPTED_THUMB_TYPES.includes(file.type)) return 'Thumbnail must be JPEG, PNG, or WebP.';
    if (file.size > MAX_THUMB_BYTES) return `Thumbnail must be ${MAX_THUMB_MB}MB or smaller.`;
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
    if (error) { toast.error(error); return; }
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
    if (error) { toast.error(error); return; }
    setThumbnailFile(file);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const getVideoDuration = (file: File): Promise<string> => new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { const duration = Number.isFinite(video.duration) ? video.duration : 0; URL.revokeObjectURL(video.src); resolve(formatDuration(duration)); };
    video.onerror = () => resolve('0:00');
    video.src = URL.createObjectURL(file);
  });

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

  const handleUpload = async () => {
    if (!videoFile || !thumbnailFile) { toast.error('Please select a video and a thumbnail.'); return; }
    try {
      setUploading(true);
      const [uploadedVideo, uploadedThumbnail, duration] = await Promise.all([
        uploadAsset(videoFile, { kind: 'video', module: 'reels', folder: 'reels/videos', ownerType: 'reel' }),
        uploadAsset(thumbnailFile, { kind: 'image', module: 'reels', folder: 'reels/thumbnails', ownerType: 'reel' }),
        getVideoDuration(videoFile),
      ]);
      await apiClient.createReel({
        title: uploadTitle.trim() || 'New Reel',
        videoUrl: uploadedVideo.publicUrl || uploadedVideo.url,
        thumbnail: uploadedThumbnail.publicUrl || uploadedThumbnail.url,
        duration,
      });
      toast.success('Reel uploaded successfully');
      setShowUploadModal(false);
      resetUploadState();
      await loadReels();
    } catch (error) {
      toast.error('Failed to upload reel');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Reels"
        subtitle="Manage short video highlights, thumbnails, and media publishing records."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadReels()} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button><Button onClick={() => setShowUploadModal(true)} icon={<Plus className="h-4 w-4" />}>Upload Reel</Button></div>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total reels" value={total} />
        <Metric label="Loaded page" value={reels.length} />
        <Metric label="Page" value={`${page} / ${totalPages}`} />
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">Reel library</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Compact cards prevent table overflow on small screens.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input className="pl-9" placeholder="Search reels" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {loading ? <div className="text-sm text-[var(--color-text-tertiary)]">Loading reels...</div> : null}
          {!loading && filteredReels.map((reel) => (
            <article key={reel.id} className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
              <div className="relative aspect-video bg-black">
                <Image src={reel.thumbnail} alt={reel.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 360px" unoptimized />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black"><Play className="h-5 w-5" /></span></div>
              </div>
              <div className="space-y-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-[var(--color-text-primary)]">{reel.title}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{formatDate(reel.createdAt)} · {reel.duration || '0:00'}</p>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(reel)}>Delete</Button>
                </div>
              </div>
            </article>
          ))}
          {!loading && filteredReels.length === 0 ? <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4"><EmptyState /></div> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-tertiary)]">{total} total reels</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
            <select className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-sm" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              {[8, 12, 24, 48].map((value) => <option key={value} value={value}>{value}/page</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button>
          </div>
        </div>
      </ShellCard>

      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ShellCard className="max-h-[92vh] w-full max-w-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
              <div><h2 className="text-lg font-black text-[var(--color-text-primary)]">Upload New Reel</h2><p className="text-sm text-[var(--color-text-tertiary)]">Add video and thumbnail media.</p></div>
              <button className="rounded-2xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)]" onClick={() => { setShowUploadModal(false); resetUploadState(); }}><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 p-5">
              <Input label="Title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g., Sunday Highlights" />
              <UploadBox label="Video file" hint={`MP4, WebM, or MOV up to ${MAX_VIDEO_MB}MB.`} accept={ACCEPTED_VIDEO_TYPES.join(',')} onChange={handleVideoSelect} icon={<UploadCloud className="h-6 w-6" />} />
              {videoPreview ? <video src={videoPreview} controls className="max-h-72 w-full rounded-3xl border border-[var(--color-border-secondary)] bg-black" /> : null}
              <UploadBox label="Thumbnail image" hint={`JPEG, PNG, or WebP up to ${MAX_THUMB_MB}MB.`} accept={ACCEPTED_THUMB_TYPES.join(',')} onChange={handleThumbnailSelect} icon={<UploadCloud className="h-6 w-6" />} />
              {thumbnailPreview ? <Image src={thumbnailPreview} alt="Thumbnail preview" width={960} height={540} className="max-h-56 w-full rounded-3xl border border-[var(--color-border-secondary)] object-cover" unoptimized /> : null}
              <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border-secondary)] pt-5">
                <Button variant="outline" onClick={() => { setShowUploadModal(false); resetUploadState(); }} disabled={uploading}>Cancel</Button>
                <Button onClick={handleUpload} loading={uploading} disabled={uploading} icon={<UploadCloud className="h-4 w-4" />}>Upload Reel</Button>
              </div>
            </div>
          </ShellCard>
        </div>
      ) : null}

      <VerifyActionModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete Reel" description="This action permanently removes the reel and its media references." confirmText="Delete Reel" cancelText="Cancel" variant="danger" loading={deleteLoading} verifyText={deleteTarget ? `DELETE ${deleteTarget.title || deleteTarget.id}` : 'DELETE'} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <ShellCard className="p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p><p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p></ShellCard>;
}

function UploadBox({ label, hint, accept, onChange, icon }: { label: string; hint: string; accept: string; onChange: (file?: File) => void; icon: ReactNode }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-8 text-center transition hover:border-[var(--color-accent-primary)]">
      <span className="text-[var(--color-text-tertiary)]">{icon}</span>
      <span className="mt-2 text-sm font-black text-[var(--color-text-primary)]">{label}</span>
      <span className="mt-1 text-xs text-[var(--color-text-tertiary)]">{hint}</span>
      <input type="file" className="sr-only" accept={accept} onChange={(e) => onChange(e.target.files?.[0])} />
    </label>
  );
}

export default withAuth(ReelsPage, { requiredRole: 'admin' });
