'use client';

import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Image as ImageIcon,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { EditorialTemplateConfig, StoryCardItem } from '@/lib/email/editorialTemplate';
import { Button } from '@/ui/Button';

import styles from './email-marketing.module.scss';

interface Props {
  config: EditorialTemplateConfig;
  onChange: (next: EditorialTemplateConfig) => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function VisualEditorialStudio({ config, onChange }: Props) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadIndexRef = useRef<number | null>(null);

  function updateField<K extends keyof EditorialTemplateConfig>(key: K, value: EditorialTemplateConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function updateStory(index: number, patch: Partial<StoryCardItem>) {
    const nextStories = config.stories.map((story, i) => (i === index ? { ...story, ...patch } : story));
    onChange({ ...config, stories: nextStories });
  }

  function addStory() {
    const newStory: StoryCardItem = {
      id: `story-${Date.now()}`,
      badge: 'UPDATE',
      imageUrl: '',
      imageAlt: '',
      title: 'New Story Headline',
      description: 'Write a compelling description highlighting this announcement, event, or ministry update.',
      buttonText: 'Learn more',
      buttonUrl: 'https://wisdomchurchhq.org',
      buttonStyle: 'arrow',
    };
    onChange({ ...config, stories: [...config.stories, newStory] });
    toast.success('New story card added.');
  }

  function duplicateStory(index: number) {
    const target = config.stories[index];
    if (!target) return;
    const duplicated: StoryCardItem = {
      ...target,
      id: `story-${Date.now()}`,
      title: `${target.title} (Copy)`,
    };
    const next = [...config.stories];
    next.splice(index + 1, 0, duplicated);
    onChange({ ...config, stories: next });
    toast.success('Story card duplicated.');
  }

  function removeStory(index: number) {
    if (config.stories.length <= 1) {
      toast.error('Keep at least one story card in your campaign.');
      return;
    }
    const next = config.stories.filter((_, i) => i !== index);
    onChange({ ...config, stories: next });
    toast.success('Story card removed.');
  }

  function moveStory(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.stories.length) return;
    const next = [...config.stories];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onChange({ ...config, stories: next });
  }

  function triggerImageUpload(index: number) {
    activeUploadIndexRef.current = index;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const index = activeUploadIndexRef.current;
    if (!file || index === null) return;

    if (!file.type.startsWith('image/')) {
      toast.error('The selected file must be an image (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be 8MB or smaller.');
      return;
    }

    setUploadingIndex(index);
    try {
      const uploaded = await apiClient.uploadAsset(file, { kind: 'image', module: 'email-marketing' });
      const url = uploaded.publicUrl || uploaded.public_url || uploaded.url;
      updateStory(index, { imageUrl: url, imageAlt: file.name });
      toast.success('Story picture uploaded successfully.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to upload story picture.'));
    } finally {
      setUploadingIndex(null);
      activeUploadIndexRef.current = null;
    }
  }

  return (
    <div className={styles.visualBuilder}>
      {/* Hidden file input for story picture uploads */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelected} />

      {/* 1. Header & Theme Setup */}
      <section className={styles.visualSection}>
        <div className={styles.visualSectionHeader}>
          <h3>
            <Palette className="h-4 w-4 text-[var(--color-accent-primary)]" />
            Newsletter Header & Style
          </h3>
          <span>Matches the luxury editorial format with crisp typography.</span>
        </div>

        <div className={styles.visualFieldRow}>
          <div className={styles.visualInputGroup}>
            <label htmlFor="vis-theme">Theme Appearance</label>
            <select
              id="vis-theme"
              value={config.theme}
              onChange={(e) => updateField('theme', e.target.value as 'dark' | 'light')}
            >
              <option value="dark">Obsidian Dark (Apple Developer Style)</option>
              <option value="light">Executive Ivory (Clean Light)</option>
            </select>
          </div>

          <div className={styles.visualInputGroup}>
            <label htmlFor="vis-eyebrow">Edition Tag / Eyebrow</label>
            <input
              id="vis-eyebrow"
              type="text"
              placeholder="e.g. NOVEMBER 2026 or SPECIAL ANNOUNCEMENT"
              value={config.editionEyebrow}
              onChange={(e) => updateField('editionEyebrow', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.visualInputGroup}>
          <label htmlFor="vis-headline">Main Newsletter Headline</label>
          <input
            id="vis-headline"
            type="text"
            placeholder="e.g. Hello Wisdom Family"
            value={config.mainHeadline}
            onChange={(e) => updateField('mainHeadline', e.target.value)}
          />
        </div>

        <div className={styles.visualInputGroup}>
          <label htmlFor="vis-intro">Intro / Summary Blurb</label>
          <textarea
            id="vis-intro"
            placeholder="In this packed edition: highlight upcoming events, announcements, or pastor's letter..."
            rows={2}
            value={config.introBlurb}
            onChange={(e) => updateField('introBlurb', e.target.value)}
          />
        </div>
      </section>

      {/* 2. In-Body Story Cards */}
      <section className={styles.visualSection}>
        <div className={styles.visualSectionHeader}>
          <h3>
            <Sparkles className="h-4 w-4 text-[var(--color-accent-primary)]" />
            In-Body Story Cards ({config.stories.length})
          </h3>
          <span>Each story has its own picture, title, summary, and action link inside the email body.</span>
        </div>

        <div className={styles.storyCardsList}>
          {config.stories.map((story, index) => {
            const isUploading = uploadingIndex === index;
            return (
              <div key={story.id || index} className={styles.storyCardItem}>
                <div className={styles.storyCardTopBar}>
                  <div className={styles.storyBadgeTag}>
                    <span>Story #{index + 1}</span>
                    {story.badge && (
                      <span className="rounded bg-[var(--color-accent-surface)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--color-accent-primary)]">
                        {story.badge}
                      </span>
                    )}
                  </div>

                  <div className={styles.storyActions}>
                    <button
                      type="button"
                      title="Move card up"
                      disabled={index === 0}
                      onClick={() => moveStory(index, 'up')}
                    >
                      <ArrowUp className="h-3.5 w-3.5" /> Up
                    </button>
                    <button
                      type="button"
                      title="Move card down"
                      disabled={index === config.stories.length - 1}
                      onClick={() => moveStory(index, 'down')}
                    >
                      <ArrowDown className="h-3.5 w-3.5" /> Down
                    </button>
                    <button
                      type="button"
                      title="Duplicate this card"
                      onClick={() => duplicateStory(index)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button
                      type="button"
                      title="Delete card"
                      onClick={() => removeStory(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className={styles.storyCardBody}>
                  {/* Story Picture / Photo Manager */}
                  <div className={styles.storyImageUploader}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        In-Body Picture (Top of Card)
                      </span>
                      {story.imageUrl && (
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => updateStory(index, { imageUrl: '' })}
                        >
                          Clear image
                        </button>
                      )}
                    </div>

                    {story.imageUrl ? (
                      <div className={styles.storyImagePreviewBox}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={story.imageUrl} alt={story.imageAlt || story.title} />
                        <button
                          type="button"
                          className={styles.removeImageBtn}
                          onClick={() => updateStory(index, { imageUrl: '' })}
                          aria-label="Remove picture"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}

                    <div className={styles.storyImageActionRow}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => triggerImageUpload(index)}
                        loading={isUploading}
                        icon={<Upload className="h-3.5 w-3.5" />}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Picture'}
                      </Button>
                      <input
                        type="text"
                        placeholder="Or paste image URL (e.g. https://...)"
                        value={story.imageUrl}
                        onChange={(e) => updateStory(index, { imageUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Story Badge & Headline */}
                  <div className={styles.visualFieldRow}>
                    <div className={styles.visualInputGroup}>
                      <label>Category Badge (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. FEATURED EVENT, ACADEMY, OUTREACH"
                        value={story.badge || ''}
                        onChange={(e) => updateStory(index, { badge: e.target.value })}
                      />
                    </div>

                    <div className={styles.visualInputGroup}>
                      <label>Story Headline</label>
                      <input
                        type="text"
                        placeholder="e.g. Discover Holy Festival 26"
                        value={story.title}
                        onChange={(e) => updateStory(index, { title: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Story Description */}
                  <div className={styles.visualInputGroup}>
                    <label>Story Description / Article Text</label>
                    <textarea
                      placeholder="Write your article summary, dates, or announcement details..."
                      rows={3}
                      value={story.description}
                      onChange={(e) => updateStory(index, { description: e.target.value })}
                    />
                  </div>

                  {/* CTA Link / Button */}
                  <div className={styles.visualFieldRow}>
                    <div className={styles.visualInputGroup}>
                      <label>Button / Link Text</label>
                      <input
                        type="text"
                        placeholder="e.g. Join us at the service >"
                        value={story.buttonText}
                        onChange={(e) => updateStory(index, { buttonText: e.target.value })}
                      />
                    </div>

                    <div className={styles.visualInputGroup}>
                      <label>Action Target URL</label>
                      <input
                        type="text"
                        placeholder="https://wisdomchurchhq.org/..."
                        value={story.buttonUrl}
                        onChange={(e) => updateStory(index, { buttonUrl: e.target.value })}
                      />
                    </div>

                    <div className={styles.visualInputGroup}>
                      <label>Link Style</label>
                      <select
                        value={story.buttonStyle || 'arrow'}
                        onChange={(e) =>
                          updateStory(index, { buttonStyle: e.target.value as 'arrow' | 'button' })
                        }
                      >
                        <option value="arrow">Apple Style Arrow Link (&rsaquo;)</option>
                        <option value="button">Solid Pill Button (&rarr;)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" className={styles.addStoryBtn} onClick={addStory}>
            <Plus className="h-5 w-5" />
            Add Another In-Body Picture Story Card
          </button>
        </div>
      </section>

      {/* 3. Scripture Quote / Inspiration */}
      <section className={styles.visualSection}>
        <div className={styles.visualSectionHeader}>
          <h3>Scripture Callout / Pull Quote (Optional)</h3>
          <span>Renders as an elegant callout box between the stories and the footer.</span>
        </div>

        <div className={styles.visualFieldRow}>
          <div className={styles.visualInputGroup} style={{ flex: 2 }}>
            <label>Scripture or Quote Text</label>
            <input
              type="text"
              placeholder='e.g. "For the earth will be filled with the knowledge..."'
              value={config.quoteText || ''}
              onChange={(e) => updateField('quoteText', e.target.value)}
            />
          </div>

          <div className={styles.visualInputGroup}>
            <label>Reference / Author</label>
            <input
              type="text"
              placeholder="e.g. Habakkuk 2:14"
              value={config.quoteAuthor || ''}
              onChange={(e) => updateField('quoteAuthor', e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
