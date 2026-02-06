'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  ImagePlus,
  Upload,
  Globe,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface FormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onContentChange: (content: string) => void;
  /** Optional ticket ID for image uploads - if not provided, uses generic path */
  uploadPath?: string;
  /** Whether to show the image button (default: true) */
  showImageButton?: boolean;
  /** Custom class for the toolbar container */
  className?: string;
}

export function FormattingToolbar({
  textareaRef,
  content,
  onContentChange,
  uploadPath,
  showImageButton = true,
  className = '',
}: FormattingToolbarProps) {
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Close image menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (imageMenuRef.current && !imageMenuRef.current.contains(event.target as Node)) {
        setIsImageMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format text with markdown syntax
  const applyFormat = useCallback(
    (prefix: string, suffix: string, placeholder?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      let newContent: string;
      let newCursorPos: number;

      if (selectedText) {
        newContent =
          content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
        newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      } else {
        const insertText = placeholder || '';
        newContent =
          content.substring(0, start) + prefix + insertText + suffix + content.substring(end);
        newCursorPos = start + prefix.length + (placeholder ? insertText.length : 0);
      }

      onContentChange(newContent);

      setTimeout(() => {
        textarea.focus();
        if (selectedText) {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } else {
          const cursorPos = start + prefix.length;
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [content, onContentChange, textareaRef]
  );

  const handleBold = useCallback(() => applyFormat('**', '**'), [applyFormat]);
  const handleItalic = useCallback(() => applyFormat('*', '*'), [applyFormat]);
  const handleUnderline = useCallback(() => applyFormat('<u>', '</u>'), [applyFormat]);

  const handleBulletList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedText) {
      const lines = selectedText.split('\n');
      const bulletedLines = lines.map((line) => (line.trim() ? `- ${line}` : line)).join('\n');
      const newContent =
        content.substring(0, start) + bulletedLines + content.substring(textarea.selectionEnd);
      onContentChange(newContent);
    } else {
      const beforeCursor = content.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = needsNewline ? '\n- ' : '- ';
      const newContent = content.substring(0, start) + prefix + content.substring(start);
      onContentChange(newContent);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content, onContentChange, textareaRef]);

  const handleNumberedList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedText) {
      const lines = selectedText.split('\n');
      const numberedLines = lines
        .map((line, i) => (line.trim() ? `${i + 1}. ${line}` : line))
        .join('\n');
      const newContent =
        content.substring(0, start) + numberedLines + content.substring(textarea.selectionEnd);
      onContentChange(newContent);
    } else {
      const beforeCursor = content.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = needsNewline ? '\n1. ' : '1. ';
      const newContent = content.substring(0, start) + prefix + content.substring(start);
      onContentChange(newContent);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content, onContentChange, textareaRef]);

  const handleLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText) {
      const url = prompt('Enter URL:');
      if (url) {
        const linkMarkdown = `[${selectedText}](${url})`;
        const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
        onContentChange(newContent);
      }
    } else {
      const linkMarkdown = '[](url)';
      const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
      onContentChange(newContent);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + 1;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content, onContentChange, textareaRef]);

  const handleImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsUploadingImage(true);
      setIsImageMenuOpen(false);
      const supabase = createClient();
      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart || content.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const fileId = crypto.randomUUID();
        const fileExt = file.name.split('.').pop();
        const basePath = uploadPath || 'editor-images';
        const filePath = `${basePath}/${fileId}.${fileExt}`;

        try {
          const { error } = await supabase.storage.from('attachments').upload(filePath, file);

          if (error) {
            console.error('Image upload error:', error);
            continue;
          }

          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

          const imageMarkdown = `![${file.name}](${urlData.publicUrl})`;
          const beforeCursor = content.substring(0, cursorPos);
          const afterCursor = content.substring(cursorPos);
          const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
          const needsNewlineAfter = afterCursor.length > 0 && !afterCursor.startsWith('\n');

          const insertText = `${needsNewlineBefore ? '\n' : ''}${imageMarkdown}${needsNewlineAfter ? '\n' : ''}`;
          onContentChange(content.substring(0, cursorPos) + insertText + content.substring(cursorPos));
        } catch (err) {
          console.error('Image upload error:', err);
        }
      }

      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    },
    [content, onContentChange, textareaRef, uploadPath]
  );

  const handleImageUrl = useCallback(() => {
    setIsImageMenuOpen(false);
    const url = prompt('Enter image URL:');
    if (!url) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart || content.length;

    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'image';

    const imageMarkdown = `![${filename}](${url})`;
    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);
    const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
    const needsNewlineAfter = afterCursor.length > 0 && !afterCursor.startsWith('\n');

    const insertText = `${needsNewlineBefore ? '\n' : ''}${imageMarkdown}${needsNewlineAfter ? '\n' : ''}`;
    onContentChange(content.substring(0, cursorPos) + insertText + content.substring(cursorPos));

    setTimeout(() => {
      textarea?.focus();
    }, 0);
  }, [content, onContentChange, textareaRef]);

  const buttonClass =
    'rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100';

  return (
    <div
      className={`flex items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {/* Hidden file input for images */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files)}
        accept="image/jpeg,image/png,image/gif,image/webp"
      />

      <button type="button" onClick={handleBold} className={buttonClass} title="Bold (Cmd+B)">
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" onClick={handleItalic} className={buttonClass} title="Italic (Cmd+I)">
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleUnderline}
        className={buttonClass}
        title="Underline (Cmd+U)"
      >
        <Underline className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

      <button type="button" onClick={handleBulletList} className={buttonClass} title="Bullet list">
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleNumberedList}
        className={buttonClass}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

      <button
        type="button"
        onClick={handleLink}
        className={buttonClass}
        title="Insert link (Cmd+K)"
      >
        <Link2 className="h-4 w-4" />
      </button>

      {showImageButton && (
        <div className="relative" ref={imageMenuRef}>
          <button
            type="button"
            onClick={() => setIsImageMenuOpen(!isImageMenuOpen)}
            disabled={isUploadingImage}
            className={`${buttonClass} disabled:opacity-50`}
            title="Insert image (Cmd+Shift+I)"
          >
            {isUploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </button>

          {isImageMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Upload className="h-4 w-4" />
                Upload Image
              </button>
              <button
                type="button"
                onClick={handleImageUrl}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Globe className="h-4 w-4" />
                Image URL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to add keyboard shortcuts for formatting
 */
export function useFormattingKeyboard(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  content: string,
  onContentChange: (content: string) => void
) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.metaKey || e.ctrlKey;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const applyFormat = (prefix: string, suffix: string) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);

        if (selectedText) {
          const newContent =
            content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
          onContentChange(newContent);
        } else {
          const newContent = content.substring(0, start) + prefix + suffix + content.substring(end);
          onContentChange(newContent);
          setTimeout(() => {
            textarea.focus();
            const cursorPos = start + prefix.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
          }, 0);
        }
      };

      if (isMod && e.key === 'b') {
        e.preventDefault();
        applyFormat('**', '**');
      } else if (isMod && e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        applyFormat('*', '*');
      } else if (isMod && e.key === 'u') {
        e.preventDefault();
        applyFormat('<u>', '</u>');
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        if (selectedText) {
          const url = prompt('Enter URL:');
          if (url) {
            const linkMarkdown = `[${selectedText}](${url})`;
            const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
            onContentChange(newContent);
          }
        } else {
          const linkMarkdown = '[](url)';
          const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
          onContentChange(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 1, start + 1);
          }, 0);
        }
      }
    },
    [content, onContentChange, textareaRef]
  );

  return handleKeyDown;
}
