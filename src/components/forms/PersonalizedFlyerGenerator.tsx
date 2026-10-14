'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowDownToLine,
  Camera,
  Check,
  Copy,
  Image as ImageIcon,
  RotateCcw,
  Share2,
  Sparkles,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import type { FormAttendingBadgeSettings } from '@/lib/types';

interface PersonalizedFlyerGeneratorProps {
  flyerUrl?: string;
  eventName: string;
  eventDate?: string;
  initialAttendeeName?: string;
  badgeSettings?: FormAttendingBadgeSettings;
  shareUrl?: string;
  onDownloaded?: () => void;
}

type FlyerFormat = 'status_9_16' | 'square_1_1';
type BadgeStyle = 'polaroid' | 'badge' | 'glass_card' | 'minimal';
type BuiltinTheme = 'event' | 'gold_majesty' | 'royal_midnight' | 'morning_glory' | 'sanctuary';

const THEME_OPTIONS: { id: BuiltinTheme; label: string; desc: string; gradient: string }[] = [
  {
    id: 'event',
    label: 'Program Flyer',
    desc: 'Original uploaded event banner',
    gradient: 'from-amber-600 to-amber-950',
  },
  {
    id: 'gold_majesty',
    label: 'Golden Majesty',
    desc: 'Deep obsidian & radiant gold luxury',
    gradient: 'from-yellow-700 via-amber-900 to-black',
  },
  {
    id: 'royal_midnight',
    label: 'Royal Midnight',
    desc: 'Deep midnight navy with celestial gold',
    gradient: 'from-sky-900 via-indigo-950 to-black',
  },
  {
    id: 'morning_glory',
    label: 'Morning Glory',
    desc: 'Warm sunrise champagne glow',
    gradient: 'from-amber-500 via-orange-800 to-slate-950',
  },
  {
    id: 'sanctuary',
    label: 'Sanctuary',
    desc: 'Clean pearl slate & brushed gold',
    gradient: 'from-slate-700 via-zinc-800 to-zinc-950',
  },
];

export function PersonalizedFlyerGenerator({
  flyerUrl: initialFlyerUrl = '',
  eventName: initialEventName,
  eventDate: initialEventDate = '',
  initialAttendeeName = '',
  badgeSettings,
  shareUrl,
  onDownloaded,
}: PersonalizedFlyerGeneratorProps) {
  // Content states
  const [eventName, setEventName] = useState(initialEventName || 'Special Church Program');
  const [eventDate, setEventDate] = useState(initialEventDate || '');
  const [attendeeName, setAttendeeName] = useState(initialAttendeeName);
  const [badgeText, setBadgeText] = useState(badgeSettings?.badgeText || 'I Will Be Attending');
  const [venueText, setVenueText] = useState('Wisdom Church · Live & In-Person');

  // Media states
  const [customTemplateSrc, setCustomTemplateSrc] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<BuiltinTheme>(initialFlyerUrl ? 'event' : 'gold_majesty');
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  // Layout & Style states
  const [format, setFormat] = useState<FlyerFormat>('status_9_16');
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>(badgeSettings?.templateStyle || 'polaroid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const activeFlyerUrl = customTemplateSrc || (selectedTheme === 'event' ? initialFlyerUrl : null);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG or WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image template');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomTemplateSrc(e.target?.result as string);
      setSelectedTheme('event');
      toast.success('Custom flyer template loaded!');
    };
    reader.readAsDataURL(file);
  };

  const drawThemeBackground = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BuiltinTheme
  ) => {
    // Luxury custom gradient
    const grad = ctx.createLinearGradient(0, 0, width * 0.4, height);
    if (theme === 'royal_midnight') {
      grad.addColorStop(0, '#0c1a30');
      grad.addColorStop(0.5, '#070f1e');
      grad.addColorStop(1, '#020617');
    } else if (theme === 'morning_glory') {
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.45, '#451a03');
      grad.addColorStop(1, '#0c0a09');
    } else if (theme === 'sanctuary') {
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#020617');
    } else {
      // Golden majesty
      grad.addColorStop(0, '#1c1409');
      grad.addColorStop(0.45, '#0f0a04');
      grad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative radial gold lighting in upper center
    const radial = ctx.createRadialGradient(
      width * 0.5,
      height * 0.25,
      20,
      width * 0.5,
      height * 0.25,
      width * 0.7
    );
    radial.addColorStop(0, 'rgba(217, 169, 78, 0.22)');
    radial.addColorStop(0.6, 'rgba(217, 169, 78, 0.04)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // Subtle church emblem watermark
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.font = `900 ${width * 0.16}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WISDOM', width * 0.5, height * 0.45);
    ctx.restore();

    // Top Brand Bar
    ctx.save();
    ctx.fillStyle = '#d4af37';
    ctx.font = '700 24px -apple-system, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.textAlign = 'center';
    ctx.fillText('THE WISDOM CHURCH', width * 0.5, height * 0.07);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 16px -apple-system, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('SPECIAL CONVOCATION & WORSHIP EXPERIENCE', width * 0.5, height * 0.095);
    ctx.restore();

    // Event Title at bottom
    ctx.save();
    const titleY = height * 0.78;
    ctx.textAlign = 'center';

    // Title glow
    ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(eventName, width * 0.5, titleY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Date & Venue Pill
    const metaY = titleY + 54;
    const metaText = [eventDate, venueText].filter(Boolean).join('  ·  ');
    if (metaText) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 280, metaY - 24, 560, 48, 24);
      ctx.fill();

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = '700 18px -apple-system, sans-serif';
      ctx.fillText(metaText, width * 0.5, metaY + 6);
    }
    ctx.restore();
  };

  const compositeCanvas = useCallback(async () => {
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

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Draw base flyer or designer theme
      let drawnBase = false;
      if (activeFlyerUrl) {
        try {
          const flyerImg = await loadImage(activeFlyerUrl);
          // Scale to cover canvas
          const imgAspect = flyerImg.width / flyerImg.height;
          const canvasAspect = canvasWidth / canvasHeight;
          let drawW = canvasWidth;
          let drawH = canvasHeight;
          let drawX = 0;
          let drawY = 0;

          if (imgAspect > canvasAspect) {
            drawW = canvasHeight * imgAspect;
            drawX = -(drawW - canvasWidth) / 2;
          } else {
            drawH = canvasWidth / imgAspect;
            drawY = -(drawH - canvasHeight) / 2;
          }
          ctx.drawImage(flyerImg, drawX, drawY, drawW, drawH);

          // Subtle dark vignette at top/bottom to enhance text contrast
          const vignette = ctx.createLinearGradient(0, 0, 0, canvasHeight);
          vignette.addColorStop(0, 'rgba(0,0,0,0.4)');
          vignette.addColorStop(0.3, 'rgba(0,0,0,0)');
          vignette.addColorStop(0.7, 'rgba(0,0,0,0)');
          vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          drawnBase = true;
        } catch (e) {
          console.warn('Could not load flyer image, falling back to theme', e);
        }
      }

      if (!drawnBase) {
        drawThemeBackground(ctx, canvasWidth, canvasHeight, selectedTheme);
      }

      // 2. Load Attendee Photo or Placeholder
      let attendeeImg: HTMLImageElement | null = null;
      if (photoSrc) {
        try {
          attendeeImg = await loadImage(photoSrc);
        } catch {
          attendeeImg = null;
        }
      }

      const displayName = attendeeName.trim() || 'Special Guest';

      // 3. Render Badges
      if (badgeStyle === 'polaroid') {
        // --- POLAROID BADGE ---
        const frameCenterX = isStatus ? canvasWidth * 0.62 : canvasWidth * 0.66;
        const frameCenterY = isStatus ? canvasHeight * 0.32 : canvasHeight * 0.38;
        const frameWidth = isStatus ? 380 : 340;
        const frameHeight = isStatus ? 460 : 410;
        const rotationAngle = (-5 * Math.PI) / 180;

        ctx.save();
        ctx.translate(frameCenterX, frameCenterY);
        ctx.rotate(rotationAngle);

        // Realistic Polaroid Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetX = 12;
        ctx.shadowOffsetY = 20;

        // White Polaroid Frame
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight, 12);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Photo area cut-out
        const margin = 20;
        const photoW = frameWidth - margin * 2;
        const photoH = frameHeight - margin * 2 - 70;
        const photoX = -frameWidth / 2 + margin;
        const photoY = -frameHeight / 2 + margin;

        ctx.save();
        ctx.beginPath();
        ctx.rect(photoX, photoY, photoW, photoH);
        ctx.clip();

        if (attendeeImg) {
          const imgAspect = attendeeImg.width / attendeeImg.height;
          const photoAspect = photoW / photoH;
          let dw = photoW;
          let dh = photoH;
          let dx = photoX;
          let dy = photoY;

          if (imgAspect > photoAspect) {
            dw = photoH * imgAspect;
            dx = photoX - (dw - photoW) / 2;
          } else {
            dh = photoW / imgAspect;
            dy = photoY - (dh - photoH) / 2;
          }
          ctx.drawImage(attendeeImg, dx, dy, dw, dh);
        } else {
          // Placeholder
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(photoX, photoY, photoW, photoH);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Tap to Upload Photo', photoX + photoW / 2, photoY + photoH / 2);
        }
        ctx.restore();

        // Polaroid Top Pin / Tape
        ctx.save();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(-45, -frameHeight / 2 - 14, 90, 26, 4);
        ctx.fill();
        ctx.restore();

        // Stamped Attendee Name at bottom of Polaroid
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(displayName, 0, frameHeight / 2 - 36);

        ctx.restore();

        // Script Tagline Box with Curved Directional Arrow
        ctx.save();
        const textX = isStatus ? canvasWidth * 0.22 : canvasWidth * 0.26;
        const textY = isStatus ? canvasHeight * 0.29 : canvasHeight * 0.34;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#0a0e17';
        ctx.beginPath();
        ctx.roundRect(textX - 120, textY - 34, 240, 68, 34);
        ctx.fill();

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 22px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(badgeText, textX, textY);

        // Curved Arrow from badge script to polaroid
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(textX + 100, textY + 8);
        ctx.quadraticCurveTo(textX + 170, textY + 40, frameCenterX - 130, frameCenterY - 10);
        ctx.stroke();

        // Arrow head
        const arrowAngle = Math.atan2(
          frameCenterY - 10 - (textY + 40),
          frameCenterX - 130 - (textX + 170)
        );
        ctx.beginPath();
        ctx.moveTo(frameCenterX - 130, frameCenterY - 10);
        ctx.lineTo(
          frameCenterX - 130 - 18 * Math.cos(arrowAngle - Math.PI / 6),
          frameCenterY - 10 - 18 * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.moveTo(frameCenterX - 130, frameCenterY - 10);
        ctx.lineTo(
          frameCenterX - 130 - 18 * Math.cos(arrowAngle + Math.PI / 6),
          frameCenterY - 10 - 18 * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.stroke();
        ctx.restore();
      } else if (badgeStyle === 'badge') {
        // --- ROYAL GOLD VIP BADGE ---
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.38 : canvasHeight * 0.44;
        const r = isStatus ? 170 : 145;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 36;

        // Outer Double Gold Ring
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
        ctx.stroke();

        // Photo inside
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        if (attendeeImg) {
          ctx.drawImage(attendeeImg, cx - r, cy - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Your Photo', cx, cy);
        }
        ctx.restore();

        // Lower Badge Ribbon
        ctx.fillStyle = '#0b1120';
        ctx.beginPath();
        ctx.roundRect(cx - 170, cy + r - 26, 340, 60, 30);
        ctx.fill();

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(displayName, cx, cy + r + 4);

        // Tagline Pill above
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.roundRect(cx - 140, cy - r - 24, 280, 44, 22);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = '900 18px sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText(badgeText.toUpperCase(), cx, cy - r - 2);

        ctx.restore();
      } else if (badgeStyle === 'glass_card') {
        // --- FROSTED GLASS EDITORIAL PASS ---
        const cw = isStatus ? 480 : 420;
        const ch = isStatus ? 580 : 480;
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.4 : canvasHeight * 0.44;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 40;

        // Card glass background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 28);
        ctx.fill();

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Header inside card
        ctx.fillStyle = '#facc15';
        ctx.font = '900 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '3px';
        ctx.fillText(badgeText.toUpperCase(), cx, cy - ch / 2 + 42);

        // Photo circle
        const pr = 120;
        const py = cy - 20;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, py, pr, 0, Math.PI * 2);
        ctx.clip();

        if (attendeeImg) {
          ctx.drawImage(attendeeImg, cx - pr, py - pr, pr * 2, pr * 2);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText('Your Photo', cx, py);
        }
        ctx.restore();

        // Gold border around photo
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, py, pr, 0, Math.PI * 2);
        ctx.stroke();

        // Attendee Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(displayName, cx, cy + ch / 2 - 80);

        // Verified Pill
        ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
        ctx.beginPath();
        ctx.roundRect(cx - 110, cy + ch / 2 - 52, 220, 36, 18);
        ctx.fill();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('✓ CONFIRMED REGISTRATION', cx, cy + ch / 2 - 34);

        ctx.restore();
      } else {
        // --- MINIMAL BADGE ---
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.35 : canvasHeight * 0.4;
        const r = 135;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 24;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        if (attendeeImg) {
          ctx.drawImage(attendeeImg, cx - r, cy - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fill();
        }
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Floating name pill
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(cx - 150, cy + r - 20, 300, 52, 26);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, cx, cy + r + 6);

        ctx.restore();
      }

      const outputDataUrl = canvas.toDataURL('image/png', 0.95);
      setPreviewDataUrl(outputDataUrl);
    } catch (err) {
      console.error('Error rendering personalized flyer:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    activeFlyerUrl,
    selectedTheme,
    photoSrc,
    format,
    badgeStyle,
    badgeText,
    attendeeName,
    eventName,
    eventDate,
    venueText,
  ]);

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
      `🎉 ${badgeText}: ${eventName}! Get your customized flyer and register here: ${
        shareUrl || window.location.href
      }`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl || window.location.href);
    toast.success('Registration & DP generator link copied!');
  };

  return (
    <div className="rounded-3xl border border-(--color-border-secondary) bg-(--color-background-primary) p-6 shadow-xl sm:p-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-(--color-border-primary) pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-warning-surface) px-3 py-1 text-xs font-bold text-(--color-warning-text)">
            <Sparkles className="h-3.5 w-3.5 text-(--lp-gold)" /> Attendee E-Flyer & DP Studio
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-(--color-text-primary)">
            Create Your &ldquo;{badgeText}&rdquo; Status Flyer
          </h2>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            Upload your photo, personalize the event text and flyer template, then download in high definition for WhatsApp Status & Instagram.
          </p>
        </div>

        {/* Format Selector: 9:16 vs 1:1 */}
        <div className="flex items-center gap-1 rounded-xl bg-(--color-background-secondary) p-1 border border-(--color-border-primary) self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFormat('status_9_16')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              format === 'status_9_16'
                ? 'bg-(--lp-ink) text-white shadow-sm'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            📱 Status (9:16)
          </button>
          <button
            type="button"
            onClick={() => setFormat('square_1_1')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              format === 'square_1_1'
                ? 'bg-(--lp-ink) text-white shadow-sm'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            🖼️ Square DP (1:1)
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
        {/* Left Column: Live Canvas Preview */}
        <div className="flex flex-col items-center">
          <div
            className={`relative overflow-hidden rounded-2xl border-2 border-(--color-border-secondary) bg-black shadow-2xl transition-all duration-200 ${
              format === 'status_9_16' ? 'aspect-9/16 w-full max-w-85' : 'aspect-square w-full max-w-95'
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
                <span className="rounded-full bg-black/80 px-4 py-2 text-xs font-bold text-white">Updating Canvas...</span>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs font-medium text-(--color-text-tertiary)">
            High-Definition Output ({format === 'status_9_16' ? '1080 × 1920' : '1080 × 1080'})
          </p>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="space-y-6">
          {/* Section A: Template & Background */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                1. Flyer / Background Template
              </label>
              {customTemplateSrc && (
                <button
                  type="button"
                  onClick={() => setCustomTemplateSrc(null)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-(--color-danger-text) hover:underline"
                >
                  <RotateCcw className="h-3 w-3" /> Reset to Default
                </button>
              )}
            </div>

            {/* Template Upload Button */}
            {/* eslint-disable-next-line no-restricted-syntax -- hidden file input */}
            <input
              type="file"
              ref={templateInputRef}
              accept="image/*"
              onChange={handleTemplateSelect}
              className="hidden"
            />

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => templateInputRef.current?.click()}
                icon={<Upload className="h-4 w-4" />}
                className="flex-1 justify-center"
              >
                {customTemplateSrc ? 'Replace Template Image' : 'Upload Custom Flyer Template'}
              </Button>
            </div>

            {/* Built-in Theme Selector */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.filter((t) => t.id !== 'event' || Boolean(initialFlyerUrl)).map((theme) => {
                const isActive = !customTemplateSrc && selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setCustomTemplateSrc(null);
                      setSelectedTheme(theme.id);
                    }}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                      isActive
                        ? 'border-(--lp-gold) bg-(--color-warning-surface) ring-2 ring-(--lp-gold)'
                        : 'border-(--color-border-primary) bg-(--color-background-secondary) hover:border-(--color-border-focus)'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-bold text-(--color-text-primary)">{theme.label}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-(--lp-gold)" />}
                    </div>
                    <span className="mt-0.5 text-[10px] text-(--color-text-tertiary) line-clamp-1">{theme.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Attendee Photo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
              2. Your Photo
            </label>
            {/* eslint-disable-next-line no-restricted-syntax -- hidden file input */}
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                icon={<Camera className="h-4 w-4" />}
                className="flex-1 justify-center"
              >
                {photoSrc ? 'Change Your Photo' : 'Upload Your Photo'}
              </Button>
              {photoSrc && (
                <button
                  type="button"
                  onClick={() => setPhotoSrc(null)}
                  className="rounded-xl border border-(--color-border-primary) px-3 py-2 text-xs font-bold text-(--color-danger-text) hover:bg-(--color-danger-surface)"
                >
                  Remove
                </button>
              )}
            </div>
            {!photoSrc && (
              <p className="mt-1 text-[11px] text-(--color-text-tertiary)">
                Tip: A sharp portrait headshot or high-resolution picture works best.
              </p>
            )}
          </div>

          {/* Section C: Attendee Name & Tagline Script */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                3. Attendee Name
              </label>
              <div className="mt-1">
                <Input
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  placeholder="e.g. Sister Grace"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                Badge Tagline Script
              </label>
              <div className="mt-1">
                <Input
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="e.g. I Will Be Attending"
                />
              </div>
            </div>
          </div>

          {/* Section D: Event Details (Used in Built-in Themes) */}
          {selectedTheme !== 'event' && !customTemplateSrc && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-(--color-border-primary) bg-(--color-background-secondary) p-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-(--color-text-secondary)">
                  Program Title
                </label>
                <div className="mt-1">
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Event Name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-(--color-text-secondary)">
                  Date &amp; Venue
                </label>
                <div className="mt-1">
                  <Input
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="Date or Time"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section E: Badge Style Switcher */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
              4. Badge Style Preset
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setBadgeStyle('polaroid')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'polaroid'
                    ? 'border-(--lp-gold) bg-(--color-warning-surface) text-(--color-text-primary) ring-2 ring-(--lp-gold)'
                    : 'border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary)'
                }`}
              >
                📸 Polaroid
              </button>
              <button
                type="button"
                onClick={() => setBadgeStyle('badge')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'badge'
                    ? 'border-(--lp-gold) bg-(--color-warning-surface) text-(--color-text-primary) ring-2 ring-(--lp-gold)'
                    : 'border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary)'
                }`}
              >
                👑 Gold VIP
              </button>
              <button
                type="button"
                onClick={() => setBadgeStyle('glass_card')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'glass_card'
                    ? 'border-(--lp-gold) bg-(--color-warning-surface) text-(--color-text-primary) ring-2 ring-(--lp-gold)'
                    : 'border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary)'
                }`}
              >
                🪪 VIP Pass
              </button>
              <button
                type="button"
                onClick={() => setBadgeStyle('minimal')}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  badgeStyle === 'minimal'
                    ? 'border-(--lp-gold) bg-(--color-warning-surface) text-(--color-text-primary) ring-2 ring-(--lp-gold)'
                    : 'border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary)'
                }`}
              >
                ✨ Minimal
              </button>
            </div>
          </div>

          {/* Section F: Download & Share Actions */}
          <div className="pt-4 border-t border-(--color-border-primary) space-y-2.5">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleDownload}
              icon={<ArrowDownToLine className="h-5 w-5" />}
              className="w-full justify-center shadow-lg font-bold"
              disabled={!previewDataUrl}
            >
              Download {format === 'status_9_16' ? 'Status Flyer (HD PNG)' : 'Profile DP (HD PNG)'}
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
                WhatsApp Status
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
