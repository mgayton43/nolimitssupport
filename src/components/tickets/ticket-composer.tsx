'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Lock,
  FileText,
  Search,
  X,
  ChevronDown,
  CheckCircle,
  Clock,
  Library,
  Sparkles,
  Loader2,
  Paperclip,
  File,
  Image,
  FileSpreadsheet,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  ImagePlus,
  Upload,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { sendMessage, type SendAction, type SnoozeDuration } from '@/lib/actions/messages';
import { generateSuggestedReply } from '@/lib/actions/ai';
import {
  replaceTemplateVariables,
  type TemplateContext,
} from '@/lib/utils/template-variables';
import { ResourcePicker, formatResourceLink } from './resource-picker';
import { createClient } from '@/lib/supabase/client';
import type { CannedResponse, Resource, Attachment } from '@/lib/supabase/types';

interface TicketComposerProps {
  ticketId: string;
  ticketBrandId?: string | null;
  cannedResponses?: CannedResponse[];
  resources?: Resource[];
  templateContext?: TemplateContext;
  onTypingChange?: (isTyping: boolean) => void;
}

const snoozeDurations: { value: SnoozeDuration; label: string }[] = [
  { value: '1-day', label: '1 day' },
  { value: '3-days', label: '3 days' },
  { value: '1-week', label: '1 week' },
];

export function TicketComposer({
  ticketId,
  ticketBrandId,
  cannedResponses = [],
  resources = [],
  templateContext = {},
  onTypingChange,
}: TicketComposerProps) {
  // Filter canned responses by ticket brand (show brand-specific OR "All Brands" responses)
  const filteredCannedResponses = cannedResponses.filter(
    (r) => !r.brand_id || r.brand_id === ticketBrandId
  );

  // Filter resources by ticket brand (show brand-specific OR "All Brands" resources)
  const filteredResources = resources.filter(
    (r) => !r.brand_id || r.brand_id === ticketBrandId
  );
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const [isSnoozeMenuOpen, setIsSnoozeMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const resourcePickerRef = useRef<HTMLDivElement>(null);
  const snoozeMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate the new height (min 96px ~4 lines, max 400px or 50vh)
    const minHeight = 96;
    const maxHeight = Math.min(400, window.innerHeight * 0.5);
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));

    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust textarea height when content changes (including from canned responses, AI, etc.)
  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
        setSearchQuery('');
      }
      if (resourcePickerRef.current && !resourcePickerRef.current.contains(event.target as Node)) {
        setIsResourcePickerOpen(false);
      }
      if (snoozeMenuRef.current && !snoozeMenuRef.current.contains(event.target as Node)) {
        setIsSnoozeMenuOpen(false);
      }
      if (imageMenuRef.current && !imageMenuRef.current.contains(event.target as Node)) {
        setIsImageMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when picker opens
  useEffect(() => {
    if (isPickerOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isPickerOpen]);

  // Handle typing indicator with debounce
  const handleContentChange = (newContent: string) => {
    setContent(newContent);

    // Only track typing for non-internal replies with actual content
    if (onTypingChange && !isInternal && newContent.trim()) {
      onTypingChange(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set typing to false after 3 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        onTypingChange(false);
      }, 3000);
    } else if (onTypingChange && !newContent.trim()) {
      // Clear typing when content is empty
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTypingChange(false);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Filter responses based on search (from brand-filtered list)
  const searchFilteredResponses = filteredCannedResponses.filter((response) => {
    const query = searchQuery.toLowerCase();
    return (
      response.title.toLowerCase().includes(query) ||
      response.content.toLowerCase().includes(query) ||
      response.shortcut?.toLowerCase().includes(query) ||
      response.category?.toLowerCase().includes(query)
    );
  });

  // Group responses by category
  const groupedResponses = searchFilteredResponses.reduce(
    (acc, response) => {
      const category = response.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(response);
      return acc;
    },
    {} as Record<string, CannedResponse[]>
  );

  // File upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const supabase = createClient();
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const filePath = `${ticketId}/${fileId}.${fileExt}`;

      // Track upload progress
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      try {
        const { error } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        newAttachments.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          url: urlData.publicUrl,
          path: filePath,
        });

        setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsUploading(false);
    setUploadProgress({});

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = async (attachment: Attachment) => {
    const supabase = createClient();

    // Delete from storage
    await supabase.storage
      .from('attachments')
      .remove([attachment.path]);

    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') return FileSpreadsheet;
    if (type.includes('pdf') || type.includes('document') || type.includes('word')) return FileText;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleSend = (action: SendAction, snoozeDuration?: SnoozeDuration) => {
    if (!content.trim() && attachments.length === 0) return;

    startTransition(async () => {
      const result = await sendMessage({
        ticketId,
        content: content.trim(),
        isInternal,
        action,
        snoozeDuration,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (!result.error) {
        setContent('');
        setAttachments([]);
        setIsSnoozeMenuOpen(false);
        // Clear typing indicator when message is sent
        if (onTypingChange) {
          onTypingChange(false);
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;
    // Default form submit sends internal note or closes ticket
    if (isInternal) {
      handleSend('send');
    } else {
      handleSend('send-close');
    }
  };

  // Check if form can be submitted
  const canSubmit = content.trim() || attachments.length > 0;

  const handleCannedResponse = (response: CannedResponse) => {
    // Replace template variables with actual values
    const processedContent = replaceTemplateVariables(response.content, templateContext);

    // Append to existing content or set as new content
    setContent((prev) => (prev ? `${prev}\n\n${processedContent}` : processedContent));
    setIsPickerOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPickerOpen(false);
      setSearchQuery('');
    }
  };

  const handleResourceSelect = (resource: Resource) => {
    const text = formatResourceLink(resource);
    setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
  };

  // Format text with markdown syntax
  const applyFormat = useCallback((prefix: string, suffix: string, placeholder?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let newContent: string;
    let newCursorPos: number;

    if (selectedText) {
      // Wrap selected text
      newContent = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      // Insert with placeholder
      const insertText = placeholder || '';
      newContent = content.substring(0, start) + prefix + insertText + suffix + content.substring(end);
      newCursorPos = start + prefix.length + (placeholder ? insertText.length : 0);
    }

    setContent(newContent);

    // Restore focus and cursor position after state update
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      } else {
        // Position cursor inside the formatting marks
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  }, [content]);

  // Format handlers
  const handleBold = useCallback(() => applyFormat('**', '**'), [applyFormat]);
  const handleItalic = useCallback(() => applyFormat('*', '*'), [applyFormat]);
  const handleUnderline = useCallback(() => applyFormat('<u>', '</u>'), [applyFormat]);
  const handleBulletList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedText) {
      // Convert selected lines to bullet points
      const lines = selectedText.split('\n');
      const bulletedLines = lines.map(line => line.trim() ? `- ${line}` : line).join('\n');
      const newContent = content.substring(0, start) + bulletedLines + content.substring(textarea.selectionEnd);
      setContent(newContent);
    } else {
      // Insert a new bullet point
      const beforeCursor = content.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = needsNewline ? '\n- ' : '- ';
      const newContent = content.substring(0, start) + prefix + content.substring(start);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content]);

  const handleNumberedList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedText) {
      // Convert selected lines to numbered list
      const lines = selectedText.split('\n');
      const numberedLines = lines.map((line, i) => line.trim() ? `${i + 1}. ${line}` : line).join('\n');
      const newContent = content.substring(0, start) + numberedLines + content.substring(textarea.selectionEnd);
      setContent(newContent);
    } else {
      // Insert a new numbered item
      const beforeCursor = content.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = needsNewline ? '\n1. ' : '1. ';
      const newContent = content.substring(0, start) + prefix + content.substring(start);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content]);

  const handleLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText) {
      // If text is selected, prompt for URL
      const url = prompt('Enter URL:');
      if (url) {
        const linkMarkdown = `[${selectedText}](${url})`;
        const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
        setContent(newContent);
      }
    } else {
      // Insert empty link format
      const linkMarkdown = '[](url)';
      const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        // Position cursor inside the brackets for link text
        const cursorPos = start + 1;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  }, [content]);

  // Handle image upload
  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setIsImageMenuOpen(false);
    const supabase = createClient();
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart || content.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Only accept images
      if (!file.type.startsWith('image/')) continue;

      const fileId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const filePath = `${ticketId}/${fileId}.${fileExt}`;

      try {
        const { error } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (error) {
          console.error('Image upload error:', error);
          continue;
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        // Insert markdown image at cursor position
        const imageMarkdown = `![${file.name}](${urlData.publicUrl})`;
        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);
        const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
        const needsNewlineAfter = afterCursor.length > 0 && !afterCursor.startsWith('\n');

        const insertText = `${needsNewlineBefore ? '\n' : ''}${imageMarkdown}${needsNewlineAfter ? '\n' : ''}`;
        setContent((prev) => prev.substring(0, cursorPos) + insertText + prev.substring(cursorPos));
      } catch (err) {
        console.error('Image upload error:', err);
      }
    }

    setIsUploadingImage(false);

    // Clear the file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [content, ticketId]);

  // Handle image URL insertion
  const handleImageUrl = useCallback(() => {
    setIsImageMenuOpen(false);
    const url = prompt('Enter image URL:');
    if (!url) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart || content.length;

    // Extract filename from URL or use generic name
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'image';

    const imageMarkdown = `![${filename}](${url})`;
    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);
    const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
    const needsNewlineAfter = afterCursor.length > 0 && !afterCursor.startsWith('\n');

    const insertText = `${needsNewlineBefore ? '\n' : ''}${imageMarkdown}${needsNewlineAfter ? '\n' : ''}`;
    setContent((prev) => prev.substring(0, cursorPos) + insertText + prev.substring(cursorPos));

    // Focus textarea
    setTimeout(() => {
      textarea?.focus();
    }, 0);
  }, [content]);

  // Toggle image menu or trigger upload directly via keyboard
  const handleInsertImage = useCallback(() => {
    setIsImageMenuOpen((prev) => !prev);
  }, []);

  // Keyboard shortcuts for formatting
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.shiftKey && e.key === 'i') {
      e.preventDefault();
      handleInsertImage();
    } else if (isMod && e.key === 'b') {
      e.preventDefault();
      handleBold();
    } else if (isMod && e.key === 'i') {
      e.preventDefault();
      handleItalic();
    } else if (isMod && e.key === 'u') {
      e.preventDefault();
      handleUnderline();
    } else if (isMod && e.key === 'k') {
      e.preventDefault();
      handleLink();
    }
  }, [handleBold, handleItalic, handleUnderline, handleLink, handleInsertImage]);

  const handleSuggestReply = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const { suggestion, error } = await generateSuggestedReply(ticketId);

      if (error) {
        console.error('AI suggestion error:', error);
        alert('Failed to generate suggestion: ' + error);
        return;
      }

      if (suggestion) {
        // Replace content with suggestion (or append if there's existing content)
        setContent((prev) => (prev ? `${prev}\n\n${suggestion}` : suggestion));
      }
    } catch (err) {
      console.error('Error generating suggestion:', err);
      alert('Failed to generate suggestion');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative border-t border-zinc-200 p-4 dark:border-zinc-800"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json,.xml,.md,.html"
      />

      {/* Hidden file input for inline images */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files)}
        accept="image/jpeg,image/png,image/gif,image/webp"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/90 dark:bg-blue-900/50">
          <div className="text-center">
            <Paperclip className="mx-auto h-8 w-8 text-blue-500" />
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              Drop files to attach
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isInternal ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsInternal(!isInternal)}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {isInternal ? 'Internal Note' : 'Reply'}
            </Button>

            {/* AI Suggest Reply - only show for replies, not internal notes */}
            {!isInternal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggestReply}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:from-purple-100 hover:to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 dark:border-purple-800 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
                    Suggest Reply
                  </>
                )}
              </Button>
            )}

            {/* Attachment button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  Attach
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {filteredCannedResponses.length > 0 && (
              <div className="relative" ref={pickerRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Canned Responses
                </Button>

                {isPickerOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                  onKeyDown={handleKeyDown}
                >
                  {/* Search header */}
                  <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search responses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-8"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Response list */}
                  <div className="max-h-72 overflow-auto">
                    {searchFilteredResponses.length === 0 ? (
                      <div className="p-4 text-center text-sm text-zinc-500">
                        {searchQuery ? 'No matching responses' : 'No canned responses available'}
                      </div>
                    ) : (
                      Object.entries(groupedResponses).map(([category, responses]) => (
                        <div key={category}>
                          <div className="sticky top-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                            {category}
                          </div>
                          {responses.map((response) => (
                            <button
                              key={response.id}
                              type="button"
                              onClick={() => handleCannedResponse(response)}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{response.title}</span>
                                {response.shortcut && (
                                  <span className="text-xs text-zinc-400 font-mono">
                                    /{response.shortcut}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                                {response.content}
                              </p>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {filteredResources.length > 0 && (
            <div className="relative" ref={resourcePickerRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResourcePickerOpen(!isResourcePickerOpen)}
              >
                <Library className="mr-1.5 h-3.5 w-3.5" />
                Resources
              </Button>

              <ResourcePicker
                resources={filteredResources}
                isOpen={isResourcePickerOpen}
                onClose={() => setIsResourcePickerOpen(false)}
                onSelect={handleResourceSelect}
              />
            </div>
          )}
        </div>
        </div>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => {
              const Icon = getFileIcon(attachment.type);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-2 pr-1 text-sm dark:bg-zinc-800"
                >
                  <Icon className="h-4 w-4 text-zinc-500" />
                  <span className="max-w-32 truncate">{attachment.name}</span>
                  <span className="text-xs text-zinc-400">
                    ({formatFileSize(attachment.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment)}
                    className="ml-1 rounded-full p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Formatting toolbar + Textarea container */}
        <div className={`rounded-md border ${isInternal ? 'border-yellow-300 dark:border-yellow-700' : 'border-zinc-200 dark:border-zinc-800'}`}>
          {/* Formatting toolbar */}
          <div className={`flex items-center gap-0.5 border-b px-2 py-1 ${isInternal ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/10' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'}`}>
            <button
              type="button"
              onClick={handleBold}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Bold (Cmd+B)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleItalic}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Italic (Cmd+I)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleUnderline}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Underline (Cmd+U)"
            >
              <Underline className="h-4 w-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
            <button
              type="button"
              onClick={handleBulletList}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Bullet list"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNumberedList}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
            <button
              type="button"
              onClick={handleLink}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Insert link (Cmd+K)"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <div className="relative" ref={imageMenuRef}>
              <button
                type="button"
                onClick={handleInsertImage}
                disabled={isUploadingImage}
                className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                title="Insert image (Cmd+Shift+I)"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </button>

              {/* Image insert dropdown */}
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
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={isInternal ? 'Write an internal note...' : 'Write a reply...'}
            className={`min-h-24 max-h-[min(400px,50vh)] resize-none overflow-y-auto border-0 transition-[height] duration-150 ease-out focus-visible:ring-0 focus-visible:ring-offset-0 ${isInternal ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
          />
        </div>

        <div className="flex justify-end gap-2">
          {isInternal ? (
            <Button type="submit" disabled={isPending || !canSubmit}>
              <Send className="mr-2 h-4 w-4" />
              {isPending ? 'Adding...' : 'Add Note'}
            </Button>
          ) : (
            <>
              {/* Send & Close Button - Primary */}
              <Button
                type="button"
                disabled={isPending || !canSubmit}
                onClick={() => handleSend('send-close')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {isPending ? 'Sending...' : 'Send & Close'}
              </Button>

              {/* Send & Snooze Button - Secondary with dropdown */}
              <div className="relative" ref={snoozeMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || !canSubmit}
                  onClick={() => setIsSnoozeMenuOpen(!isSnoozeMenuOpen)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Send & Snooze
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>

                {/* Snooze duration dropdown */}
                {isSnoozeMenuOpen && (
                  <div className="absolute bottom-full right-0 z-50 mb-1 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {snoozeDurations.map((duration) => (
                      <button
                        key={duration.value}
                        type="button"
                        onClick={() => handleSend('send-snooze', duration.value)}
                        className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {duration.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
