'use client';

import { useState } from 'react';
import {
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  Headphones,
} from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, getInitials, formatDate } from '@/lib/utils';
import type { Message, Attachment } from '@/lib/supabase/types';

interface TicketMessageProps {
  message: Message;
  senderName?: string | null;
  senderAvatar?: string | null;
}

// Get file icon based on type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') return FileSpreadsheet;
  if (type.includes('pdf') || type.includes('document') || type.includes('word')) return FileText;
  return File;
}

// Format file size
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketMessage({ message, senderName, senderAvatar }: TicketMessageProps) {
  const isAgent = message.sender_type === 'agent';
  const isInternal = message.is_internal;
  const attachments = (message.attachments || []) as Attachment[];
  const [showFullEmail, setShowFullEmail] = useState(false);

  // Check if there's raw content that differs from the displayed content
  const hasRawContent = message.raw_content && message.raw_content !== message.content;

  // Simple: show raw_content when toggled, otherwise show content
  const displayContent = showFullEmail && message.raw_content
    ? message.raw_content
    : (message.content || '');

  // Card styling based on sender type
  const cardStyles = cn(
    'rounded-lg border p-4',
    isInternal
      ? 'border-dashed border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
      : isAgent
        ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20'
        : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
  );

  // Left border accent
  const accentStyles = cn(
    'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
    isInternal
      ? 'bg-yellow-400 dark:bg-yellow-600'
      : isAgent
        ? 'bg-blue-500 dark:bg-blue-600'
        : 'bg-zinc-300 dark:bg-zinc-600'
  );

  return (
    <div className={cn('relative', cardStyles)}>
      {/* Left accent border */}
      <div className={accentStyles} />

      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar
          src={senderAvatar}
          fallback={getInitials(senderName)}
          size="default"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sender type indicator */}
            {isAgent ? (
              <span className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400">
                <Headphones className="h-4 w-4" />
                {senderName || 'Agent'}
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                <User className="h-4 w-4" />
                {senderName || 'Customer'}
              </span>
            )}

            {isInternal && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                Internal Note
              </Badge>
            )}
            {message.source === 'new_email' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Badge>
            )}
            {message.source === 'merge' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">
                Merged
              </Badge>
            )}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(message.created_at)}
          </span>
        </div>
      </div>

      {/* Message content */}
      <div className="pl-13 ml-10">
        <div className="text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400">
          <Markdown
            rehypePlugins={[rehypeRaw]}
            components={{
              // Ensure links open in new tab
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              // Style inline images
              img: ({ src, alt }) => {
                const srcUrl = typeof src === 'string' ? src : undefined;
                return (
                  <a
                    href={srcUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="not-prose group relative my-2 block w-fit overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={srcUrl}
                      alt={alt || 'Image'}
                      className="max-h-64 max-w-full object-contain"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-xs font-medium text-white">View full size</span>
                    </div>
                  </a>
                );
              },
            }}
          >
            {displayContent}
          </Markdown>
        </div>

        {/* Show full email toggle */}
        {hasRawContent && (
          <button
            onClick={() => setShowFullEmail(!showFullEmail)}
            className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
          >
            <Mail className="h-3 w-3" />
            {showFullEmail ? (
              <>
                <span>Show cleaned version</span>
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>Show full email</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {/* Image attachments - show thumbnails */}
            {attachments.filter((a) => a.type.startsWith('image/')).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments
                  .filter((a) => a.type.startsWith('image/'))
                  .map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="h-24 w-auto max-w-48 object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="text-xs font-medium text-white">View</span>
                      </div>
                    </a>
                  ))}
              </div>
            )}

            {/* Non-image attachments - show as file chips */}
            {attachments.filter((a) => !a.type.startsWith('image/')).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments
                  .filter((a) => !a.type.startsWith('image/'))
                  .map((attachment) => {
                    const Icon = getFileIcon(attachment.type);
                    return (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={attachment.name}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        <Icon className="h-4 w-4 text-zinc-500" />
                        <span className="max-w-32 truncate">{attachment.name}</span>
                        <span className="text-xs text-zinc-400">
                          ({formatFileSize(attachment.size)})
                        </span>
                        <Download className="h-3.5 w-3.5 text-zinc-400" />
                      </a>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
