// src/components/admin/RichTextEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon, 
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { Button } from '@/ui/Button';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

type EditorLike = {
  getHTML: () => string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  error,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-4',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-4',
          },
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--color-accent-primary)] underline hover:text-[var(--color-accent-primaryhover)]',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }: { editor: EditorLike }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, {
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[var(--color-background-primary)] border border-[var(--color-border-primary)] rounded-t-lg">
        {/* Text Formatting */}
        <div className="flex items-center border-r border-[var(--color-border-secondary)] pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('italic') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('underline') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex items-center border-r border-[var(--color-border-secondary)] pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 1 }) && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 2 }) && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 3 }) && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('paragraph') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Paragraph"
          >
            <Pilcrow className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center border-r border-[var(--color-border-secondary)] pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Links */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('link') && 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]'
            )}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          {editor.isActive('link') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeLink}
              className="h-8 w-8 p-0 text-[var(--color-danger-text)] hover:opacity-80"
              title="Remove Link"
            >
              <RemoveFormatting className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div
        className={cn(
          'border rounded-b-lg overflow-hidden',
          error ? 'border-[var(--color-danger-border)]' : 'border-[var(--color-border-primary)]',
          editor.isActive('link') && 'ring-2 ring-[var(--color-accent-primary)]'
        )}
      >
        <EditorContent editor={editor} />
      </div>

      {error && <p className="text-sm text-[var(--color-danger-text)]">{error}</p>}

      {/* Character Count */}
      <div className="flex justify-between items-center text-xs text-[var(--color-text-tertiary)]">
        <span>
          {editor.storage.characterCount?.characters() || 0} characters
        </span>
        <span>
          {editor.storage.characterCount?.words() || 0} words
        </span>
      </div>
    </div>
  );
}
