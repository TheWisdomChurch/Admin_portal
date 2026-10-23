'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  initialFullName?: string;
  badgeSettings?: FormAttendingBadgeSettings;
  shareUrl?: string;
  onDownloaded?: () => void;
}

type FlyerFormat = 'status_9_16' | 'square_1_1';
type BadgeStyle = 'polaroid' | 'badge' | 'glass_card' | 'minimal';
type BuiltinTheme = 'event' | 'gold_majesty' | 'royal_midnight' | 'morning_glory' | 'sanctuary';
type FlyerFitMode = 'ambient_studio' | 'full_cover';

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

/**
 * Universal cross-browser rounded rectangle generator.
 * Works natively on ALL mobile WebViews and older browsers without relying on ctx.roundRect().
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | number[]
) {
  let tl = 0;
  let tr = 0;
  let br = 0;
  let bl = 0;

  if (typeof radius === 'number') {
    tl = tr = br = bl = radius;
  } else if (Array.isArray(radius)) {
    if (radius.length === 1) tl = tr = br = bl = radius[0];
    else if (radius.length === 2) {
      tl = br = radius[0];
      tr = bl = radius[1];
    } else if (radius.length === 4) {
      [tl, tr, br, bl] = radius;
    }
  }

  const maxR = Math.min(width / 2, height / 2);
  tl = Math.min(tl, maxR);
  tr = Math.min(tr, maxR);
  br = Math.min(br, maxR);
  bl = Math.min(bl, maxR);

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export function PersonalizedFlyerGenerator({
  flyerUrl: initialFlyerUrl = '',
  eventName: initialEventName,
  eventDate: initialEventDate = '',
  initialAttendeeName = '',
  initialFullName = '',
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

  useEffect(() => {
    if (initialAttendeeName) {
      setAttendeeName(initialAttendeeName);
    }
  }, [initialAttendeeName]);

  // Media states
  const [customTemplateSrc, setCustomTemplateSrc] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<BuiltinTheme>(
    initialFlyerUrl ? 'event' : 'gold_majesty'
  );
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  // Layout & Style states
  const [format, setFormat] = useState<FlyerFormat>('status_9_16');
  const [flyerFitMode, setFlyerFitMode] = useState<FlyerFitMode>('ambient_studio');
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>(
    badgeSettings?.templateStyle || 'polaroid'
  );
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
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.letterSpacing = '5px';
    ctx.textAlign = 'center';
    ctx.fillText('THE WISDOM CHURCH', width * 0.5, height * 0.07);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.letterSpacing = '3px';
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
    ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(eventName, width * 0.5, titleY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Date & Venue Pill
    const metaY = titleY + 54;
    const metaText = [eventDate, venueText].filter(Boolean).join('  ·  ');
    if (metaText) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      drawRoundedRect(ctx, width * 0.5 - 280, metaY - 24, 560, 48, 24);
      ctx.fill();

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, width * 0.5 - 280, metaY - 24, 560, 48, 24);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
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

      // 1. Draw Background Canvas
      let drawnBase = false;
      if (activeFlyerUrl) {
        try {
          const flyerImg = await loadImage(activeFlyerUrl);
          const imgAspect = flyerImg.width / flyerImg.height;
          const canvasAspect = canvasWidth / canvasHeight;

          if (isStatus && flyerFitMode === 'ambient_studio') {
            // === AMBIENT STUDIO SHOWCASE MODE (Recommended for standard landscape/square flyers) ===
            // Layer 1: Ambient Blurred Backdrop covering full canvas
            let bgW = canvasWidth;
            let bgH = canvasHeight;
            let bgX = 0;
            let bgY = 0;
            if (imgAspect > canvasAspect) {
              bgW = canvasHeight * imgAspect;
              bgX = -(bgW - canvasWidth) / 2;
            } else {
              bgH = canvasWidth / imgAspect;
              bgY = -(bgH - canvasHeight) / 2;
            }

            // Draw blurred base
            ctx.save();
            ctx.drawImage(flyerImg, bgX, bgY, bgW, bgH);
            ctx.restore();

            // Dark ambient atmospheric wash overlay
            const darkWash = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            darkWash.addColorStop(0, 'rgba(8, 12, 22, 0.82)');
            darkWash.addColorStop(0.5, 'rgba(8, 12, 22, 0.76)');
            darkWash.addColorStop(1, 'rgba(5, 8, 16, 0.94)');
            ctx.fillStyle = darkWash;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Subtle gold ambient glow in center
            const ambientGlow = ctx.createRadialGradient(
              canvasWidth * 0.5,
              canvasHeight * 0.32,
              60,
              canvasWidth * 0.5,
              canvasHeight * 0.32,
              canvasWidth * 0.8
            );
            ambientGlow.addColorStop(0, 'rgba(217, 119, 6, 0.18)');
            ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = ambientGlow;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Layer 2: Top Church Brand Letterhead
            ctx.save();
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.letterSpacing = '6px';
            ctx.textAlign = 'center';
            ctx.fillText('THE WISDOM CHURCH', canvasWidth * 0.5, 68);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.font = '600 13px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.letterSpacing = '3px';
            ctx.fillText('OFFICIAL PROGRAM INVITATION & ATTENDEE E-FLYER', canvasWidth * 0.5, 96);
            ctx.restore();

            // Layer 3: Pristine, Unclipped Event Poster
            // Preserves 100% of the flyer without cropping titles or speakers
            const maxPosterW = 940;
            const maxPosterH = 880;
            const posterTopY = 125;
            let posterW = maxPosterW;
            let posterH = posterW / imgAspect;

            if (posterH > maxPosterH) {
              posterH = maxPosterH;
              posterW = posterH * imgAspect;
            }

            const posterX = (canvasWidth - posterW) / 2;
            const posterY = posterTopY + (maxPosterH - posterH) / 2;

            // Poster Card Shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 20;
            ctx.fillStyle = '#0f172a';
            drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 20);
            ctx.fill();
            ctx.restore();

            // Poster Image
            ctx.save();
            drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 20);
            ctx.clip();
            ctx.drawImage(flyerImg, posterX, posterY, posterW, posterH);
            ctx.restore();

            // Poster Elegant Border
            ctx.save();
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
            ctx.lineWidth = 2.5;
            drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 20);
            ctx.stroke();
            ctx.restore();

            drawnBase = true;
          } else {
            // === FULL BLEED COVER MODE ===
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

            // High-contrast vignette wash
            const vignette = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            vignette.addColorStop(0, 'rgba(5, 10, 20, 0.55)');
            vignette.addColorStop(0.35, 'rgba(5, 10, 20, 0.15)');
            vignette.addColorStop(0.7, 'rgba(5, 10, 20, 0.45)');
            vignette.addColorStop(1, 'rgba(5, 10, 20, 0.88)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            drawnBase = true;
          }
        } catch (e) {
          console.warn('Could not load flyer image, falling back to theme', e);
        }
      }

      if (!drawnBase) {
        drawThemeBackground(ctx, canvasWidth, canvasHeight, selectedTheme);
      }

      // 2. Load Attendee Photo
      let attendeeImg: HTMLImageElement | null = null;
      if (photoSrc) {
        try {
          attendeeImg = await loadImage(photoSrc);
        } catch {
          attendeeImg = null;
        }
      }

      const displayName = attendeeName.trim() || 'Special Guest';

      // 3. Render Badges & Callout
      if (badgeStyle === 'polaroid') {
        // --- POLAROID BADGE ---
        const isAmbientMode = isStatus && activeFlyerUrl && flyerFitMode === 'ambient_studio';

        // Position polaroid in lower half for ambient mode, or upper-center for cover mode
        const frameCenterX = isStatus
          ? isAmbientMode
            ? canvasWidth * 0.60
            : canvasWidth * 0.62
          : canvasWidth * 0.66;

        const frameCenterY = isStatus
          ? isAmbientMode
            ? 1420
            : canvasHeight * 0.36
          : canvasHeight * 0.40;

        const frameWidth = isStatus ? 420 : 360;
        const frameHeight = isStatus ? 510 : 440;
        const rotationAngle = (-4.5 * Math.PI) / 180;

        ctx.save();
        ctx.translate(frameCenterX, frameCenterY);
        ctx.rotate(rotationAngle);

        // Realistic Polaroid Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 36;
        ctx.shadowOffsetX = 12;
        ctx.shadowOffsetY = 24;

        // White Polaroid Frame
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight, 14);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Photo area cut-out
        const margin = 20;
        const photoW = frameWidth - margin * 2;
        const photoH = frameHeight - margin * 2 - 80;
        const photoX = -frameWidth / 2 + margin;
        const photoY = -frameHeight / 2 + margin;

        ctx.save();
        drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 4);
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
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 24px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Tap to Upload Photo', photoX + photoW / 2, photoY + photoH / 2);
        }

        // Golden Corner Sash Ribbon across photo: "✦ ATTENDING ✦"
        ctx.save();
        ctx.translate(photoX - 10, photoY + 28);
        ctx.rotate((-42 * Math.PI) / 180);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-60, -14, 180, 28);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-60, -14, 180, 28);
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 13px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦ ATTENDING ✦', 30, 0);
        ctx.restore();

        ctx.restore();

        // Top Washi Tape on Polaroid
        ctx.save();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 8;
        drawRoundedRect(ctx, -50, -frameHeight / 2 - 14, 100, 26, 4);
        ctx.fill();
        ctx.restore();

        // Attendee Name at bottom of Polaroid
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(displayName, 0, frameHeight / 2 - 42);

        // Verification Pill below Name
        ctx.fillStyle = '#eab308';
        drawRoundedRect(ctx, -60, frameHeight / 2 - 22, 120, 16, 8);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = '900 10px -apple-system, sans-serif';
        ctx.fillText('CONFIRMED GUEST', 0, frameHeight / 2 - 14);

        ctx.restore();

        // High-Contrast "I WILL BE ATTENDING" Callout Badge & Directional Arrow
        ctx.save();
        const calloutWidth = 340;
        const calloutHeight = 64;

        // Position callout with guaranteed safe margin from left edge
        const textX = isStatus
          ? isAmbientMode
            ? 250
            : 240
          : 220;

        const textY = isStatus
          ? isAmbientMode
            ? frameCenterY - 140
            : frameCenterY - 90
          : frameCenterY - 70;

        // Obsidian Glass Shadow & Glow
        ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;

        // Obsidian Gradient Pill Body
        const pillGrad = ctx.createLinearGradient(
          textX - calloutWidth / 2,
          textY - calloutHeight / 2,
          textX + calloutWidth / 2,
          textY + calloutHeight / 2
        );
        pillGrad.addColorStop(0, '#090d16');
        pillGrad.addColorStop(0.5, '#121824');
        pillGrad.addColorStop(1, '#090d16');
        ctx.fillStyle = pillGrad;
        drawRoundedRect(
          ctx,
          textX - calloutWidth / 2,
          textY - calloutHeight / 2,
          calloutWidth,
          calloutHeight,
          calloutHeight / 2
        );
        ctx.fill();

        // Dual Metallic Gold Border
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        drawRoundedRect(
          ctx,
          textX - calloutWidth / 2,
          textY - calloutHeight / 2,
          calloutWidth,
          calloutHeight,
          calloutHeight / 2
        );
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Radiant Gold Typography
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText(`✦  ${badgeText.toUpperCase()}  ✦`, textX, textY);

        // Sweeping Curved Gold Arrow pointing to the polaroid
        const arrowStartX = textX + calloutWidth / 2 - 20;
        const arrowStartY = textY + 14;
        const arrowTargetX = frameCenterX - frameWidth * 0.42;
        const arrowTargetY = frameCenterY - 30;

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(arrowStartX, arrowStartY);
        ctx.quadraticCurveTo(
          arrowStartX + 90,
          arrowStartY + 45,
          arrowTargetX,
          arrowTargetY
        );
        ctx.stroke();

        // Arrow head
        const arrowAngle = Math.atan2(
          arrowTargetY - (arrowStartY + 45),
          arrowTargetX - (arrowStartX + 90)
        );
        ctx.beginPath();
        ctx.moveTo(arrowTargetX, arrowTargetY);
        ctx.lineTo(
          arrowTargetX - 20 * Math.cos(arrowAngle - Math.PI / 6),
          arrowTargetY - 20 * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.moveTo(arrowTargetX, arrowTargetY);
        ctx.lineTo(
          arrowTargetX - 20 * Math.cos(arrowAngle + Math.PI / 6),
          arrowTargetY - 20 * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.stroke();
        ctx.restore();
      } else if (badgeStyle === 'badge') {
        // --- ROYAL GOLD VIP BADGE ---
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.62 : canvasHeight * 0.48;
        const r = isStatus ? 180 : 150;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 40;

        // Outer Double Gold Ring
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 18, 0, Math.PI * 2);
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
        drawRoundedRect(ctx, cx - 180, cy + r - 28, 360, 64, 32);
        ctx.fill();

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, cx - 180, cy + r - 28, 360, 64, 32);
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(displayName, cx, cy + r + 4);

        // Tagline Pill above
        ctx.fillStyle = '#090d16';
        drawRoundedRect(ctx, cx - 170, cy - r - 32, 340, 52, 26);
        ctx.fill();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        drawRoundedRect(ctx, cx - 170, cy - r - 32, 340, 52, 26);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = '900 18px -apple-system, sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText(`✦ ${badgeText.toUpperCase()} ✦`, cx, cy - r - 6);

        ctx.restore();
      } else if (badgeStyle === 'glass_card') {
        // --- FROSTED GLASS VIP PASS ---
        const cw = isStatus ? 520 : 440;
        const ch = isStatus ? 620 : 500;
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.65 : canvasHeight * 0.50;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 45;

        // Card glass background
        ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
        drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 30);
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 2.5;
        drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 30);
        ctx.stroke();

        // Header inside card
        ctx.fillStyle = '#fef08a';
        ctx.font = '900 20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        ctx.fillText(`✦  ${badgeText.toUpperCase()}  ✦`, cx, cy - ch / 2 + 46);

        // Photo circle
        const pr = 130;
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
          ctx.font = 'bold 22px sans-serif';
          ctx.fillText('Your Photo', cx, py);
        }
        ctx.restore();

        // Gold border around photo
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, py, pr, 0, Math.PI * 2);
        ctx.stroke();

        // Attendee Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(displayName, cx, cy + ch / 2 - 82);

        // Verified Pill
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        drawRoundedRect(ctx, cx - 130, cy + ch / 2 - 54, 260, 38, 19);
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, cx - 130, cy + ch / 2 - 54, 260, 38, 19);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('✓ OFFICIAL VIP ATTENDEE', cx, cy + ch / 2 - 35);

        ctx.restore();
      } else {
        // --- MINIMAL BADGE ---
        const cx = canvasWidth * 0.5;
        const cy = isStatus ? canvasHeight * 0.62 : canvasHeight * 0.48;
        const r = 150;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 30;

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

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Tagline Pill above
        ctx.fillStyle = '#090d16';
        drawRoundedRect(ctx, cx - 160, cy - r - 30, 320, 50, 25);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx - 160, cy - r - 30, 320, 50, 25);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = '900 17px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`✦ ${badgeText.toUpperCase()} ✦`, cx, cy - r - 5);

        // Floating name pill below
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, cx - 160, cy + r - 24, 320, 56, 28);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, cx, cy + r + 4);

        ctx.restore();
      }

      // 4. Bottom Official Church Footer
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.textAlign = 'center';
      ctx.fillText(
        'THE WISDOM CHURCH  ·  wisdomchurchhq.org',
        canvasWidth * 0.5,
        canvasHeight - 34
      );
      ctx.restore();

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
    flyerFitMode,
    badgeStyle,
    badgeText,
    attendeeName,
    eventName,
    eventDate,
    venueText,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void compositeCanvas();
    }, 150);
    return () => clearTimeout(timer);
  }, [compositeCanvas]);

  const handleDownload = () => {
    if (!previewDataUrl) return;

    const safeName = (attendeeName || 'attendee')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const filename = `wisdom-church-${safeName}-${format === 'status_9_16' ? 'status-flyer' : 'profile-dp'}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = previewDataUrl;
    link.click();

    toast.success('Flyer downloaded! Ready to post on WhatsApp status');
    if (onDownloaded) onDownloaded();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🕊️ I'll be attending ${eventName} at The Wisdom Church!\n\n✨ Create your own personalized attendance flyer & register here:\n${
        shareUrl || window.location.href
      }`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl || window.location.href);
    toast.success('Registration & DP studio link copied!');
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
            Upload your photo, customize your name, and download a high-definition status flyer ready for WhatsApp Status & Instagram.
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDataUrl}
                alt="Personalized Flyer Preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/50 text-xs">
                Rendering flyer preview...
              </div>
            )}

            {isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
                <div className="rounded-xl bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                  Updating canvas...
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs font-medium text-(--color-text-tertiary)">
            High-Definition Output ({format === 'status_9_16' ? '1080 × 1920' : '1080 × 1080'})
          </p>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="space-y-6">
          {/* Section A: Template & Background Canvas */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                1. Base Canvas / Flyer Presentation
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

            {/* Template Upload Hidden Input */}
            {/* eslint-disable-next-line no-restricted-syntax -- hidden file input */}
            <input
              type="file"
              ref={templateInputRef}
              accept="image/*"
              onChange={handleTemplateSelect}
              className="hidden"
            />

            {customTemplateSrc ? (
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-(--lp-gold) bg-(--color-warning-surface) p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--lp-gold) text-white font-bold">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">Custom Canvas Active</p>
                    <p className="text-[11px] text-(--color-text-tertiary)">Custom background flyer loaded</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => templateInputRef.current?.click()}
                    className="text-xs"
                  >
                    Replace
                  </Button>
                  <button
                    type="button"
                    onClick={() => setCustomTemplateSrc(null)}
                    className="text-xs font-semibold text-(--color-danger-text) hover:underline p-1"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => templateInputRef.current?.click()}
                  icon={<Upload className="h-4 w-4" />}
                  className="flex-1 justify-center"
                >
                  Upload Custom Event Canvas / Flyer
                </Button>
              </div>
            )}

            {/* Presentation Mode Toggle when flyer is present */}
            {activeFlyerUrl && format === 'status_9_16' && (
              <div className="mt-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-(--color-text-tertiary)">
                  Flyer Layout Mode
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFlyerFitMode('ambient_studio')}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      flyerFitMode === 'ambient_studio'
                        ? 'border-(--lp-gold) bg-(--color-warning-surface) ring-2 ring-(--lp-gold)'
                        : 'border-(--color-border-primary) bg-(--color-background-secondary)'
                    }`}
                  >
                    <span className="block font-bold text-(--color-text-primary)">✨ Ambient Poster Fit</span>
                    <span className="mt-0.5 block text-[10px] text-(--color-text-tertiary)">
                      Full uncropped flyer + blurred ambient backdrop
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlyerFitMode('full_cover')}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      flyerFitMode === 'full_cover'
                        ? 'border-(--lp-gold) bg-(--color-warning-surface) ring-2 ring-(--lp-gold)'
                        : 'border-(--color-border-primary) bg-(--color-background-secondary)'
                    }`}
                  >
                    <span className="block font-bold text-(--color-text-primary)">🖼️ Full-Bleed Cover</span>
                    <span className="mt-0.5 block text-[10px] text-(--color-text-tertiary)">
                      Scales flyer to fill entire vertical canvas
                    </span>
                  </button>
                </div>
              </div>
            )}

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
              2. Your Picture / Photo
            </label>
            {/* eslint-disable-next-line no-restricted-syntax -- hidden file input */}
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {!photoSrc ? (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--color-border-secondary) bg-(--color-background-primary) p-5 text-center cursor-pointer transition hover:border-(--lp-gold) hover:bg-(--color-warning-surface)/20"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-(--lp-gold-surface) text-(--lp-gold)">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="mt-2 text-xs font-bold text-(--color-text-primary)">Tap to Upload Your Photo</span>
                <span className="mt-0.5 text-[11px] text-(--color-text-tertiary)">Select a clear portrait picture to frame in your badge</span>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-(--color-border-primary) bg-(--color-background-primary) p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoSrc}
                    alt="Preview"
                    className="h-11 w-11 rounded-full object-cover border border-(--color-border-secondary)"
                  />
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">Photo Attached</p>
                    <p className="text-[11px] text-(--color-text-tertiary)">Framed inside your badge</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs"
                  >
                    Change
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPhotoSrc(null)}
                    className="text-xs font-semibold text-(--color-danger-text) hover:underline p-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section C: Attendee Name & Display Name */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                  3. Display Name (on Flyer)
                </label>
                {initialAttendeeName && (
                  <span className="text-[10px] font-semibold text-(--lp-gold)">
                    Fetched from form
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                This is the name rendered on your badge. Pick your first name, full name, or enter any title.
              </p>

              {/* Quick Display Name Preset Chips */}
              {(initialAttendeeName || initialFullName) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-(--color-text-tertiary)">Presets:</span>
                  {initialAttendeeName && (
                    <button
                      type="button"
                      onClick={() => setAttendeeName(initialAttendeeName)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        attendeeName.toLowerCase() === initialAttendeeName.toLowerCase()
                          ? 'bg-(--lp-gold) text-white'
                          : 'border border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary) hover:border-(--lp-gold)'
                      }`}
                    >
                      First Name ({initialAttendeeName})
                    </button>
                  )}
                  {initialFullName && initialFullName !== initialAttendeeName && (
                    <button
                      type="button"
                      onClick={() => setAttendeeName(initialFullName)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        attendeeName.toLowerCase() === initialFullName.toLowerCase()
                          ? 'bg-(--lp-gold) text-white'
                          : 'border border-(--color-border-secondary) bg-(--color-background-secondary) text-(--color-text-secondary) hover:border-(--lp-gold)'
                      }`}
                    >
                      Full Name ({initialFullName})
                    </button>
                  )}
                </div>
              )}

              <div className="mt-2">
                <Input
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  placeholder="e.g. Sister Grace"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text-secondary)">
                Announcement Tagline
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
