'use client';

import {
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Mail,
} from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { cn, getInitials } from '@/lib/utils';
import type { Message, Attachment } from '@/lib/supabase/types';

interface TicketMessageProps {
  message: Message;
  senderName?: string | null;
  isAgent: boolean;
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

// Format timestamp like Gorgias: "01/05/2026" or "Today at 1:44 PM"
function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Strip quoted email content (previous replies) from customer messages
function stripQuotedContent(content: string): string {
  if (!content) return '';

  let result = content;

  // Remove "On [date], [person] wrote:" and everything after
  result = result.replace(/\n\s*On\s+[\s\S]{0,200}?\s+wrote:[\s\S]*$/i, '');

  // Remove "-------- Original Message --------" and everything after
  result = result.replace(/\n\s*-{3,}\s*Original Message\s*-{3,}[\s\S]*/i, '');

  // Remove "---------- Forwarded message ----------" and everything after
  result = result.replace(/\n\s*-{3,}\s*Forwarded message\s*-{3,}[\s\S]*/i, '');

  // Remove "---\n\n**Previous conversation:**" and everything after
  result = result.replace(/\n---\s*\n+\*?\*?Previous conversation:\*?\*?[\s\S]*/i, '');

  // Remove lines starting with > (quoted text)
  result = result.replace(/^>.*$/gm, '');

  // Remove "Sent from my iPhone/Android" signatures
  result = result.replace(/\n\s*Sent from my (?:iPhone|iPad|Android|Samsung|Galaxy|mobile device|phone)[\s\S]*/i, '');

  // Clean up multiple consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

export function TicketMessage({ message, senderName, isAgent }: TicketMessageProps) {
  const isInternal = message.is_internal;
  const attachments = (message.attachments || []) as Attachment[];

  // Strip quoted content from customer emails, show full content for agent messages
  const displayContent = isAgent
    ? (message.content || '')
    : stripQuotedContent(message.content || '');

  // Avatar colors: blue for agents, gray for customers
  const avatarColor = isAgent
    ? 'bg-blue-500 text-white'
    : 'bg-zinc-400 text-white';

  // Internal note styling
  const containerStyle = isInternal
    ? 'bg-yellow-50 border-l-4 border-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-600'
    : '';

  return (
    <div className={cn('py-4', containerStyle)}>
      {/* Header row: Avatar + Name + Email icon + Timestamp */}
      <div className="flex items-center gap-3 mb-2">
        {/* Avatar */}
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
          avatarColor
        )}>
          {getInitials(senderName)}
        </div>

        {/* Name + Email icon + Timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {senderName || (isAgent ? 'Agent' : 'Customer')}
          </span>

          {message.source === 'new_email' && (
            <Mail className="h-4 w-4 text-zinc-400" />
          )}

          {isInternal && (
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded">
              Internal Note
            </span>
          )}

          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatTimestamp(message.created_at)}
          </span>
        </div>
      </div>

      {/* Message content */}
      <div className="ml-12 text-sm text-zinc-700 dark:text-zinc-300">
        <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 whitespace-pre-wrap">
          <Markdown
            rehypePlugins={[rehypeRaw]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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
                    className="block my-2 w-fit"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={srcUrl}
                      alt={alt || 'Image'}
                      className="max-h-64 max-w-full rounded border border-zinc-200 dark:border-zinc-700"
                    />
                  </a>
                );
              },
            }}
          >
            {displayContent}
          </Markdown>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {/* Image attachments */}
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
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="h-20 w-auto rounded border border-zinc-200 dark:border-zinc-700 hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
              </div>
            )}

            {/* File attachments */}
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
                        className="flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        <Icon className="h-4 w-4 text-zinc-500" />
                        <span className="max-w-40 truncate">{attachment.name}</span>
                        <span className="text-xs text-zinc-400">
                          {formatFileSize(attachment.size)}
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
