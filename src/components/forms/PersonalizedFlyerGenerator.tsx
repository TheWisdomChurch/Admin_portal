'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowDownToLine,
  Camera,
  Copy,
  Share2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import type { FormAttendingBadgeSettings } from '@/lib/types';

interface PersonalizedFlyerGeneratorProps {
  flyerUrl: string;
  eventName: string;
  eventDate?: string;
  initialAttendeeName?: string;
  badgeSettings?: FormAttendingBadgeSettings;
  shareUrl?: string;
  onDownloaded?: () => void;
}

type FlyerFormat = 'status_9_16' | 'square_1_1';
type BadgeStyle = 'polaroid' | 'badge' | 'minimal';

export function PersonalizedFlyerGenerator({
  flyerUrl,
  eventName,
  eventDate,
  initialAttendeeName = '',
  badgeSettings,
  shareUrl,
  onDownloaded,
}: PersonalizedFlyerGeneratorProps) {
  const [attendeeName, setAttendeeName] = useState(initialAttendeeName);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [format, setFormat] = useState<FlyerFormat>('status_9_16');
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>(badgeSettings?.templateStyle || 'polaroid');
  const badgeText = badgeSettings?.badgeText || 'I Will Be Attending';
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG or WebP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image size must be less than 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const compositeCanvas = useCallback(async () => {
    if (!flyerUrl) return;
    setIsGenerating(true);

    try {
      const isStatus = format === 'status_9_16';
      const canvasWidth = 1080;
      const canvasHeight = isStatus ? 1920 : 1080;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Enable smooth high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Draw base event flyer
      const flyerImg = await loadImage(flyerUrl);
      ctx.drawImage(flyerImg, 0, 0, canvasWidth, canvasHeight);

      // 2. If photo is uploaded, composite attendee badge
      if (photoSrc) {
        const attendeeImg = await loadImage(photoSrc);

        if (badgeStyle === 'polaroid') {
          // --- POLAROID BADGE (Matches reference image!) ---
          // Position: upper-right quadrant
          const frameCenterX = isStatus ? canvasWidth * 0.62 : canvasWidth * 0.68;
          const frameCenterY = isStatus ? canvasHeight * 0.24 : canvasHeight * 0.28;
          const frameWidth = isStatus ? 360 : 320;
          const frameHeight = isStatus ? 430 : 380;
          const rotationAngle = (-4.5 * Math.PI) / 180; // slight jaunty angle

          ctx.save();
          ctx.translate(frameCenterX, frameCenterY);
          ctx.rotate(rotationAngle);

          // Realistic Polaroid Paper Shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 28;
          ctx.shadowOffsetX = 10;
          ctx.shadowOffsetY = 16;

          // White Polaroid Card
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight, 10);
          ctx.fill();

          // Reset shadow for photo & text
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          // Photo cut-out inside polaroid
          const photoMargin = 20;
          const photoAreaWidth = frameWidth - photoMargin * 2;
          const photoAreaHeight = frameHeight - photoMargin * 2 - 60; // extra room at bottom for name
          const photoAreaX = -frameWidth / 2 + photoMargin;
          const photoAreaY = -frameHeight / 2 + photoMargin;

          // Inner dark border around photo
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(photoAreaX - 1, photoAreaY - 1, photoAreaWidth + 2, photoAreaHeight + 2);

          // Draw attendee photo clipped into photoArea
          ctx.save();
          ctx.beginPath();
          ctx.rect(photoAreaX, photoAreaY, photoAreaWidth, photoAreaHeight);
          ctx.clip();

          // Cover fit calculation
          const imgAspect = attendeeImg.width / attendeeImg.height;
          const areaAspect = photoAreaWidth / photoAreaHeight;
          let drawW = photoAreaWidth;
          let drawH = photoAreaHeight;
          let drawX = photoAreaX;
          let drawY = photoAreaY;

          if (imgAspect > areaAspect) {
            drawW = photoAreaHeight * imgAspect;
            drawX = photoAreaX - (drawW - photoAreaWidth) / 2;
          } else {
            drawH = photoAreaWidth / imgAspect;
            drawY = photoAreaY - (drawH - photoAreaHeight) / 2;
          }

          ctx.drawImage(attendeeImg, drawX, drawY, drawW, drawH);
          ctx.restore();

          // Tape / Pin at top of Polaroid
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.shadowColor = 'rgba(0,0,0,0.15)';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.roundRect(-45, -frameHeight / 2 - 12, 90, 24, 4);
          ctx.fill();
          ctx.restore();

          // Stamped Attendee Name at bottom of Polaroid
          const displayName = attendeeName.trim() || 'Special Guest';
          ctx.fillStyle = '#1e293b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(displayName, 0, frameHeight / 2 - 32);

          ctx.restore();

          // "I WILL BE ATTENDING" Script with curved directional arrow pointing to polaroid
          ctx.save();
          const textX = isStatus ? canvasWidth * 0.22 : canvasWidth * 0.28;
          const textY = isStatus ? canvasHeight * 0.21 : canvasHeight * 0.25;

          // Glowing backdrop pill for readability
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.roundRect(textX - 110, textY - 32, 220, 64, 32);
          ctx.fill();

          // Script text
          ctx.fillStyle = '#facc15';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(badgeText, textX, textY);

          // Curved decorative arrow pointing from text to polaroid
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(textX + 90, textY + 10);
          ctx.quadraticCurveTo(textX + 160, textY + 30, frameCenterX - 110, frameCenterY);
          ctx.stroke();

          // Arrowhead
          const headAngle = Math.atan2(frameCenterY - (textY + 30), frameCenterX - 110 - (textX + 160));
          ctx.beginPath();
          ctx.moveTo(frameCenterX - 110, frameCenterY);
          ctx.lineTo(
            frameCenterX - 110 - 16 * Math.cos(headAngle - Math.PI / 6),
            frameCenterY - 16 * Math.sin(headAngle - Math.PI / 6)
          );
          ctx.moveTo(frameCenterX - 110, frameCenterY);
          ctx.lineTo(
            frameCenterX - 110 - 16 * Math.cos(headAngle + Math.PI / 6),
            frameCenterY - 16 * Math.sin(headAngle + Math.PI / 6)
          );
          ctx.stroke();
          ctx.restore();
        } else if (badgeStyle === 'badge') {
          // --- MODERN CIRCULAR BADGE ---
          const centerX = isStatus ? canvasWidth * 0.5 : canvasWidth * 0.5;
          const centerY = isStatus ? canvasHeight * 0.32 : canvasHeight * 0.35;
          const radius = isStatus ? 140 : 120;

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 32;

          // Outer Gold Ring
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
          ctx.stroke();

          // Clipped circular photo
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(attendeeImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
          ctx.restore();

          // Badge pill underneath
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.roundRect(centerX - 130, centerY + radius - 20, 260, 48, 24);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 20px -apple-system, sans-serif';
          ctx.fillText(attendeeName.trim() || 'Attending', centerX, centerY + radius + 4);
          ctx.restore();
        } else {
          // --- MINIMAL CARD ---
          const cardX = canvasWidth * 0.55;
          const cardY = isStatus ? canvasHeight * 0.22 : canvasHeight * 0.26;
          const cardW = 320;
          const cardH = 340;

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 24;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 16);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cardX - cardW / 2 + 12, cardY - cardH / 2 + 12, cardW - 24, cardH - 80, 10);
          ctx.clip();
          ctx.drawImage(attendeeImg, cardX - cardW / 2 + 12, cardY - cardH / 2 + 12, cardW - 24, cardH - 80);
          ctx.restore();

          ctx.fillStyle = '#111827';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(attendeeName.trim() || 'Special Guest', cardX, cardY + cardH / 2 - 28);
          ctx.restore();
        }
      }

      const outputDataUrl = canvas.toDataURL('image/png', 0.95);
      setPreviewDataUrl(outputDataUrl);
    } catch (err) {
      console.error('Error rendering personalized flyer:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [flyerUrl, photoSrc, format, badgeStyle, badgeText, attendeeName]);

  // Re-render when inputs change
  useEffect(() => {
    compositeCanvas();
  }, [compositeCanvas]);

  const handleDownload = () => {
    if (!previewDataUrl) return;

    const link = document.createElement('a');
    const safeName = (attendeeName || 'attending').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeName}_${eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${format}.png`;
    link.download = filename;
    link.href = previewDataUrl;
    link.click();

    toast.success('Flyer downloaded! Ready to post on WhatsApp status');
    if (onDownloaded) onDownloaded();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🎉 I am attending ${eventName}! Join me there: ${shareUrl || window.location.href}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl || window.location.href);
    toast.success('Registration & DP generator link copied!');
  };

  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 shadow-xl sm:p-8">
      {/* Title & Introduction */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning-surface)] px-3 py-1 text-xs font-bold text-[var(--color-warning-text)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--lp-gold)]" /> Personalized Status Flyer
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Create Your &ldquo;I Will Be Attending&rdquo; Flyer
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            {eventDate ? `${eventName} (${eventDate})` : eventName} — Upload your photo to generate a high-definition badge flyer to share on your WhatsApp status and social media.
          </p>
        </div>

        {/* Format Selector: 9:16 Status vs 1:1 Square */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-background-secondary)] p-1 border border-[var(--color-border-primary)]">
          <button
            type="button"
            onClick={() => setFormat('status_9_16')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              format === 'status_9_16'
                ? 'bg-[var(--lp-ink)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            📱 Status (9:16)
          </button>
          <button
            type="button"
            onClick={() => setFormat('square_1_1')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              format === 'square_1_1'
                ? 'bg-[var(--lp-ink)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            🖼️ Square DP (1:1)
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
        {/* Left Column: Interactive Live Preview */}
        <div className="flex flex-col items-center">
          <div
            className={`relative overflow-hidden rounded-2xl border-2 border-[var(--color-border-secondary)] bg-black shadow-2xl transition-all duration-200 ${
              format === 'status_9_16' ? 'aspect-[9/16] w-full max-w-[320px]' : 'aspect-square w-full max-w-[380px]'
            }`}
          >
            {previewDataUrl ? (
              <Image
                src={previewDataUrl}
                alt="Personalized flyer preview"
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
                Rendering preview...
              </div>
            )}

            {isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                <span className="rounded-full bg-black/80 px-4 py-2 text-xs font-bold text-white">Updating...</span>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs font-medium text-[var(--color-text-tertiary)]">
            High-Resolution {format === 'status_9_16' ? '1080 × 1920' : '1080 × 1080'} HD Output
          </p>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="space-y-5">
          {/* 1. Photo Upload */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              1. Your Photo
            </label>
            {/* eslint-disable-next-line no-restricted-syntax -- hidden file input triggered programmatically via Button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                icon={<Camera className="h-4 w-4" />}
                className="flex-1"
              >
                {photoSrc ? 'Change Photo' : 'Upload Your Photo'}
              </Button>
              {photoSrc && (
                <button
                  type="button"
                  onClick={() => setPhotoSrc(null)}
                  className="rounded-xl border border-[var(--color-border-primary)] p-2.5 text-xs text-[var(--color-danger-text)] hover:bg-[var(--color-danger-surface)]"
                  title="Remove photo"
                >
                  Remove
                </button>
              )}
            </div>
            {!photoSrc && (
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                Tip: A portrait headshot facing forward works best!
              </p>
            )}
          </div>

          {/* 2. Attendee Display Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              2. Your Name on Flyer
            </label>
            <div className="mt-1.5">
              <Input
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                placeholder="e.g. Anuoluwapo"
              />
            </div>
          </div>

          {/* 3. Badge Style Options */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              3. Badge Style
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBadgeStyle('polaroid')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'polaroid'
                    ? 'border-[var(--lp-gold)] bg-[var(--color-warning-surface)] text-[var(--color-text-primary)] ring-2 ring-[var(--lp-gold)]'
                    : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'
                }`}
              >
                📸 Polaroid
              </button>
              <button
                type="button"
                onClick={() => setBadgeStyle('badge')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'badge'
                    ? 'border-[var(--lp-gold)] bg-[var(--color-warning-surface)] text-[var(--color-text-primary)] ring-2 ring-[var(--lp-gold)]'
                    : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'
                }`}
              >
                ⭐ Gold Badge
              </button>
              <button
                type="button"
                onClick={() => setBadgeStyle('minimal')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'minimal'
                    ? 'border-[var(--lp-gold)] bg-[var(--color-warning-surface)] text-[var(--color-text-primary)] ring-2 ring-[var(--lp-gold)]'
                    : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'
                }`}
              >
                ✨ Minimal
              </button>
            </div>
          </div>

          {/* 4. Action Buttons */}
          <div className="pt-4 border-t border-[var(--color-border-primary)] space-y-2.5">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleDownload}
              icon={<ArrowDownToLine className="h-5 w-5" />}
              className="w-full justify-center shadow-lg font-bold"
              disabled={!previewDataUrl}
            >
              Download {format === 'status_9_16' ? 'Status Flyer (HD)' : 'Profile DP (HD)'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleWhatsAppShare}
                icon={<Share2 className="h-4 w-4 text-[#25D366]" />}
                className="justify-center"
              >
                Share to WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleCopyLink}
                icon={<Copy className="h-4 w-4" />}
                className="justify-center"
              >
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
