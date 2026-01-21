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

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  error,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
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
          class: 'text-primary-600 underline hover:text-primary-700',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
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
      <div className="flex flex-wrap items-center gap-1 p-2 bg-white border border-secondary-300 rounded-t-lg">
        {/* Text Formatting */}
        <div className="flex items-center border-r border-secondary-200 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') && 'bg-primary-50 text-primary-700'
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
              editor.isActive('italic') && 'bg-primary-50 text-primary-700'
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
              editor.isActive('underline') && 'bg-primary-50 text-primary-700'
            )}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex items-center border-r border-secondary-200 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 1 }) && 'bg-primary-50 text-primary-700'
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
              editor.isActive('heading', { level: 2 }) && 'bg-primary-50 text-primary-700'
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
              editor.isActive('heading', { level: 3 }) && 'bg-primary-50 text-primary-700'
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
              editor.isActive('paragraph') && 'bg-primary-50 text-primary-700'
            )}
            title="Paragraph"
          >
            <Pilcrow className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center border-r border-secondary-200 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-primary-50 text-primary-700'
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
              editor.isActive('orderedList') && 'bg-primary-50 text-primary-700'
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
              editor.isActive('link') && 'bg-primary-50 text-primary-700'
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
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
          error ? 'border-red-500' : 'border-secondary-300',
          editor.isActive('link') && 'ring-2 ring-primary-500'
        )}
      >
        <EditorContent editor={editor} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Character Count */}
      <div className="flex justify-between items-center text-xs text-secondary-500">
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