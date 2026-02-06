'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Eye, EyeOff, Library } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  FormattingToolbar,
  useFormattingKeyboard,
} from '@/components/ui/formatting-toolbar';
import { ResourcePicker, formatResourceLink } from '@/components/tickets/resource-picker';
import type { Resource } from '@/lib/supabase/types';

export interface RichTextEditorProps {
  /** The current content value */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Name attribute for form submission */
  name?: string;
  /** Minimum height in pixels (default: 120) */
  minHeight?: number;
  /** Maximum height in pixels (default: 400) */
  maxHeight?: number;
  /** Whether field is required */
  required?: boolean;
  /** Whether to show preview toggle (default: true) */
  showPreview?: boolean;
  /** Whether to show resources button (default: false) */
  showResources?: boolean;
  /** Resources to show in picker */
  resources?: Resource[];
  /** Optional path for image uploads */
  uploadPath?: string;
  /** Whether to show image upload button (default: true) */
  showImageButton?: boolean;
  /** Custom class for the container */
  className?: string;
  /** ID for the textarea */
  id?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content...',
  name,
  minHeight = 120,
  maxHeight = 400,
  required = false,
  showPreview = true,
  showResources = false,
  resources = [],
  uploadPath,
  showImageButton = true,
  className = '',
  id,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resourcePickerRef = useRef<HTMLDivElement>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  // Adjust height when content changes
  useEffect(() => {
    if (!isPreviewMode) {
      adjustTextareaHeight();
    }
  }, [value, adjustTextareaHeight, isPreviewMode]);

  // Keyboard shortcuts
  const handleKeyDown = useFormattingKeyboard(textareaRef, value, onChange);

  // Handle resource selection
  const handleResourceSelect = (resource: Resource) => {
    const text = formatResourceLink(resource);
    onChange(value ? `${value}\n\n${text}` : text);
    setIsResourcePickerOpen(false);
  };

  // Close resource picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resourcePickerRef.current && !resourcePickerRef.current.contains(event.target as Node)) {
        setIsResourcePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`rounded-md border border-zinc-200 dark:border-zinc-800 ${className}`}>
      {/* Toolbar row */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <FormattingToolbar
          textareaRef={textareaRef}
          content={value}
          onContentChange={onChange}
          uploadPath={uploadPath}
          showImageButton={showImageButton}
          className="flex-1 border-b-0"
        />

        <div className="flex items-center gap-1 px-2">
          {/* Resources button */}
          {showResources && resources.length > 0 && (
            <div className="relative" ref={resourcePickerRef}>
              <button
                type="button"
                onClick={() => setIsResourcePickerOpen(!isResourcePickerOpen)}
                className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                title="Insert resource link"
              >
                <Library className="h-4 w-4" />
              </button>

              <ResourcePicker
                resources={resources}
                isOpen={isResourcePickerOpen}
                onClose={() => setIsResourcePickerOpen(false)}
                onSelect={handleResourceSelect}
              />
            </div>
          )}

          {/* Preview toggle */}
          {showPreview && (
            <>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="h-7 px-2 text-xs"
              >
                {isPreviewMode ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor / Preview area */}
      {isPreviewMode ? (
        <div
          className="prose prose-sm prose-zinc dark:prose-invert max-w-none p-3 overflow-auto prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400"
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
        >
          {value ? (
            <Markdown
              rehypePlugins={[rehypeRaw]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                img: ({ src, alt }) => {
                  const srcUrl = typeof src === 'string' ? src : undefined;
                  return (
                    <a
                      href={srcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="not-prose block w-fit overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={srcUrl}
                        alt={alt || 'Image'}
                        className="max-h-48 max-w-full object-contain"
                      />
                    </a>
                  );
                },
              }}
            >
              {value}
            </Markdown>
          ) : (
            <p className="text-zinc-400 dark:text-zinc-500 italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="resize-none overflow-y-auto border-0 transition-[height] duration-150 ease-out focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
        />
      )}
    </div>
  );
}
