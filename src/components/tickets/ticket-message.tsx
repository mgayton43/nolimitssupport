'use client';

import { useState, useMemo } from 'react';
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
  Megaphone,
  MessageSquareReply,
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

// Check if a URL is a tracking/redirect URL
function isTrackingUrl(url: string): boolean {
  const trackingPatterns = [
    /klclick\.com/i,
    /klaviyo/i,
    /utm_/i,
    /\/click\//i,
    /\/track\//i,
    /\/trk\//i,
    /\/ctrk\//i,
    /\/redirect\//i,
    /mailchimp/i,
    /sendgrid/i,
    /constantcontact/i,
    /campaign-archive/i,
    /list-manage/i,
    /email\.mg\./i,
    /click\.pstmrk/i,
    /mandrillapp/i,
    /\/_t\/c\//i,        // Strikeman and similar tracking paths
    /\/_t\/v\d+\//i,     // Versioned tracking paths like /_t/v3/
    /\/e\/c\//i,         // Email click tracking
    /\/l\/[a-zA-Z0-9]+/i, // Link tracking with IDs
  ];

  // Also check for very long random-looking URLs (tracking URLs tend to have long base64/hex strings)
  if (url.length > 100 && /[A-Za-z0-9]{30,}/.test(url)) {
    return true;
  }

  return trackingPatterns.some(pattern => pattern.test(url));
}

// Check if a line is marketing noise
function isMarketingNoiseLine(line: string): boolean {
  const trimmed = line.trim();

  // Empty lines are fine (we'll handle consecutive empties elsewhere)
  if (!trimmed) return false;

  // Image placeholders - match anywhere in line
  if (/\[image:[^\]]*\]/i.test(trimmed)) return true;

  // Unsubscribe footers
  if (/unsubscribe|opt.out|opt-out|email.preferences|manage.*subscription|no longer wish to receive/i.test(trimmed)) return true;

  // Lines that are just URLs (tracking or not - if it's JUST a URL, it's noise)
  if (/^https?:\/\/\S+$/.test(trimmed)) return true;

  // View in browser links
  if (/view.*in.*browser|view.*online|web.*version|having trouble viewing/i.test(trimmed)) return true;

  // Copyright/legal footers
  if (/^©|copyright|all rights reserved/i.test(trimmed)) return true;

  // Address footers (common in marketing emails)
  if (/^\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr)/i.test(trimmed)) return true;

  // Social media links section
  if (/^(facebook|twitter|instagram|linkedin|youtube|tiktok)\s*$/i.test(trimmed)) return true;

  // Lines that are mostly just markdown links with tracking URLs
  const linkMatches = trimmed.match(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g);
  if (linkMatches && linkMatches.length > 0) {
    // Check if ALL links in the line are tracking URLs
    const allTracking = linkMatches.every(match => {
      const urlMatch = match.match(/\((https?:\/\/[^)]+)\)/);
      return urlMatch && isTrackingUrl(urlMatch[1]);
    });
    // If the line is mostly just tracking links, it's noise
    if (allTracking && trimmed.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '').trim().length < 20) {
      return true;
    }
  }

  return false;
}

// Clean marketing noise from content
function cleanMarketingContent(content: string): { cleaned: string; noiseRemoved: number } {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let noiseRemoved = 0;

  for (const line of lines) {
    // Check if entire line is noise
    if (isMarketingNoiseLine(line)) {
      noiseRemoved++;
      continue;
    }

    let cleanedLine = line;

    // Remove [image: ...] placeholders from within lines
    cleanedLine = cleanedLine.replace(/\[image:[^\]]*\]/gi, '');

    // Remove standalone tracking URLs
    cleanedLine = cleanedLine.replace(
      /https?:\/\/\S+/g,
      (url) => {
        if (isTrackingUrl(url)) {
          noiseRemoved++;
          return '';
        }
        return url;
      }
    );

    // Clean markdown links with tracking URLs - keep text, remove URL
    cleanedLine = cleanedLine.replace(
      /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
      (match, text, url) => {
        if (isTrackingUrl(url)) {
          noiseRemoved++;
          // Keep the link text if it's meaningful
          return text && text.length > 2 ? text : '';
        }
        return match;
      }
    );

    // Clean up multiple spaces
    cleanedLine = cleanedLine.replace(/\s{2,}/g, ' ').trim();

    cleanedLines.push(cleanedLine);
  }

  // Remove consecutive empty lines (more than 2)
  const finalLines: string[] = [];
  let emptyCount = 0;
  for (const line of cleanedLines) {
    if (line.trim() === '') {
      emptyCount++;
      if (emptyCount <= 1) {
        finalLines.push(line);
      }
    } else {
      emptyCount = 0;
      finalLines.push(line);
    }
  }

  // Remove leading/trailing empty lines
  while (finalLines.length > 0 && finalLines[0].trim() === '') {
    finalLines.shift();
  }
  while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === '') {
    finalLines.pop();
  }

  return {
    cleaned: finalLines.join('\n').trim(),
    noiseRemoved
  };
}

// Split content into main message and quoted/previous content
function splitQuotedContent(content: string): {
  main: string;
  quoted: string | null;
  isMarketingEmail: boolean;
} {
  const normalizedContent = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Common patterns for quoted content
  const patterns = [
    /^([\s\S]*?)(?:\n---+\s*\n|\n_{3,}\s*\n)(Previous conversation:[\s\S]*)$/i,
    /^([\s\S]*?)(?:\n---+\s*\n|\n_{3,}\s*\n)(On [\s\S]{0,320}?\s+wrote:[\s\S]*)$/i,
    /^([\s\S]*?)(\n\s*On [\s\S]{0,320}?\s+wrote:[\s\S]*)$/i,
    /^([\s\S]*?)((?:^>.*\n?)+)/m,
    /^([\s\S]*?)(\n-{3,}\s*Original Message\s*-{3,}[\s\S]*)$/i,
    /^([\s\S]*?)(\n-{3,}\s*Forwarded message\s*-{3,}[\s\S]*)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match && match[1] && match[2]) {
      const rawMain = match[1].trim();
      const rawQuoted = match[2].trim();

      // Only split if main content exists and quoted is substantial
      if (rawMain.length > 0 && rawQuoted.length > 50) {
        // Clean both main and quoted
        const { cleaned: cleanedMain, noiseRemoved: mainNoise } = cleanMarketingContent(rawMain);
        const { cleaned: cleanedQuoted, noiseRemoved: quotedNoise } = cleanMarketingContent(rawQuoted);

        const totalNoise = mainNoise + quotedNoise;
        const isMarketingEmail = totalNoise > 5 ||
          (cleanedQuoted.length < 50 && quotedNoise > 2);

        return {
          main: cleanedMain,
          quoted: cleanedQuoted.length > 10 ? cleanedQuoted : null,
          isMarketingEmail
        };
      }
    }
  }

  // No quoted content found - clean the main content
  const { cleaned, noiseRemoved } = cleanMarketingContent(normalizedContent);
  const isMarketingEmail = noiseRemoved > 5;

  return { main: cleaned, quoted: null, isMarketingEmail };
}

export function TicketMessage({ message, senderName, senderAvatar }: TicketMessageProps) {
  const isAgent = message.sender_type === 'agent';
  const isInternal = message.is_internal;
  const attachments = (message.attachments || []) as Attachment[];
  const [showRawContent, setShowRawContent] = useState(false);

  // Check if there's raw content that differs from the displayed content
  const hasRawContent = message.raw_content && message.raw_content !== message.content;

  const normalizedDisplayContent = useMemo(
    () =>
      (message.content || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n'),
    [message.content]
  );

  // For customer messages, strip quoted content entirely (agent replies already exist as separate messages)
  // For agent messages, show full content as-is
  const { main: parsedMain, quoted: hasQuotedContent, isMarketingEmail } = useMemo(
    () => splitQuotedContent(normalizedDisplayContent),
    [normalizedDisplayContent]
  );

  const mainContent = useMemo(() => {
    if (showRawContent && message.raw_content) {
      // Show raw content but still strip quoted portions
      const { main: rawMain } = splitQuotedContent(message.raw_content);
      return rawMain;
    }

    // For customer messages, use the stripped main content (no quoted replies)
    // For agent messages, show the full cleaned content
    if (isAgent) {
      const { cleaned } = cleanMarketingContent(normalizedDisplayContent);
      return cleaned;
    }

    // Customer message - use parsedMain which has quoted content stripped
    return parsedMain;
  }, [showRawContent, message.raw_content, parsedMain, normalizedDisplayContent, isAgent]
  );

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
            {isMarketingEmail && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700">
                <Megaphone className="h-3 w-3 mr-1" />
                Reply to marketing
              </Badge>
            )}
            {hasQuotedContent && !isAgent && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-300 dark:text-zinc-400 dark:border-zinc-600">
                <MessageSquareReply className="h-3 w-3 mr-1" />
                Reply
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
              // Style inline images with click-to-view
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
            {mainContent}
          </Markdown>
        </div>

        {/* Quoted content is stripped from customer messages since agent replies exist as separate messages */}

        {/* Show full email toggle for messages with raw_content */}
        {hasRawContent && (
          <button
            onClick={() => setShowRawContent(!showRawContent)}
            className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
          >
            <Mail className="h-3 w-3" />
            {showRawContent ? (
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
