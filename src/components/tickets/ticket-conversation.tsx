'use client';

import { useEffect, useRef, useMemo } from 'react';
import { TicketMessage } from './ticket-message';
import type { Message, Profile, Customer } from '@/lib/supabase/types';

interface TicketConversationProps {
  messages: Message[];
  customer: Customer | null;
  agents: Map<string, Profile>;
}

// A display item represents either a real message or a parsed thread turn
interface DisplayItem {
  id: string;
  message: Message;
  senderName: string | null;
  senderAvatar: string | null;
  isParsedFromThread?: boolean;
}

// Patterns that indicate quoted content start
const QUOTED_START_PATTERNS = [
  // "Previous conversation:" with separator
  /\n---\s*\n+\*?\*?Previous conversation:\*?\*?\s*\n/i,
  // iPhone/Apple Mail: "On Jan 29, 2026, at 9:08 AM, Name <email> wrote:"
  /\n\s*On\s+\w{3}\s+\d{1,2},\s+\d{4},?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*[^<\n]*(?:<[^>]+>)?\s*wrote:/i,
  // Gmail: "On Mon, Feb 9, 2026 at 11:19 PM, Name <email> wrote:"
  /\n\s*On\s+\w{3},\s+\w{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*[^<\n]*(?:<[^>]+>)?\s*wrote:/i,
  // Outlook-style: "On 1/29/2026 9:08 AM, Name wrote:"
  /\n\s*On\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*[^:\n]{1,50}\s*wrote:/i,
  // Generic: "On [date string], [name/email] wrote:"
  /\n\s*On\s+[^\n]{10,80}\s+wrote:/i,
  // "-------- Original Message --------"
  /\n\s*-{3,}\s*Original Message\s*-{3,}/i,
  // "---------- Forwarded message ----------"
  /\n\s*-{3,}\s*Forwarded message\s*-{3,}/i,
  // Lines starting with > (quoted content block)
  /\n(?:>\s*[^\n]+\n){3,}/,
];

// Parse a single "On ... wrote:" header to extract sender info
function parseWriteHeader(header: string): { senderType: 'customer' | 'agent'; senderHint?: string } {
  const emailMatch = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const nameMatch = header.match(/,\s*([^<]+?)(?:\s*<|wrote)/i);

  let senderType: 'customer' | 'agent' = 'customer';
  let senderHint: string | undefined;

  if (emailMatch) {
    senderHint = emailMatch[1];
    // Heuristic: if email contains support-related terms, it's likely an agent
    if (/support|help|team|noreply|admin|service|care/i.test(emailMatch[1])) {
      senderType = 'agent';
    }
  } else if (nameMatch) {
    senderHint = nameMatch[1].trim();
  }

  return { senderType, senderHint };
}

// Parse embedded email thread content into separate turns
function parseEmailThread(content: string): { newContent: string; threadTurns: Array<{ senderType: 'customer' | 'agent'; content: string; senderHint?: string }> } | null {
  if (!content) return null;

  // Find where quoted content starts
  let splitIndex = content.length;
  let matchedPattern: RegExpMatchArray | null = null;

  for (const pattern of QUOTED_START_PATTERNS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined && match.index < splitIndex) {
      splitIndex = match.index;
      matchedPattern = match;
    }
  }

  // No quoted content found
  if (splitIndex === content.length) {
    return null;
  }

  const newContent = content.slice(0, splitIndex).trim();
  const threadContent = content.slice(splitIndex).trim();

  if (!threadContent || threadContent.length < 20) {
    return null;
  }

  // Parse thread turns - look for "On [date], [name] wrote:" patterns
  const turnPattern = /(?:^|\n)(?:>?\s*)?On\s+[\s\S]{0,200}?\s+wrote:\s*\n?/gi;
  const turns: Array<{ senderType: 'customer' | 'agent'; content: string; senderHint?: string }> = [];

  // Split by the "On ... wrote:" pattern
  const parts = threadContent.split(turnPattern);
  const headerMatches = threadContent.match(turnPattern) || [];

  // Process each part
  for (let i = 0; i < parts.length; i++) {
    let partContent = parts[i]
      .replace(/^>+\s*/gm, '') // Remove quote markers
      .replace(/^\*?\*?Previous conversation:\*?\*?\s*/i, '') // Remove "Previous conversation:" header
      .replace(/^-{3,}\s*/gm, '') // Remove separator lines
      .trim();

    if (!partContent || partContent.length < 5) continue;

    // Get sender info from the header that preceded this content
    let senderType: 'customer' | 'agent' = 'customer';
    let senderHint: string | undefined;

    if (i > 0 && headerMatches[i - 1]) {
      const parsed = parseWriteHeader(headerMatches[i - 1]);
      senderType = parsed.senderType;
      senderHint = parsed.senderHint;
    }

    turns.push({
      senderType,
      content: partContent,
      senderHint,
    });
  }

  // If we couldn't parse any turns, treat the whole thread as one block
  if (turns.length === 0 && threadContent.length > 20) {
    turns.push({
      senderType: 'agent', // Assume quoted content is from agent
      content: threadContent.replace(/^>+\s*/gm, '').trim(),
    });
  }

  // Reverse turns so oldest is first (threads are typically newest-first in quoted content)
  turns.reverse();

  return { newContent, threadTurns: turns };
}

// Expand messages into display items, parsing embedded threads
function expandMessages(
  messages: Message[],
  customer: Customer | null,
  agents: Map<string, Profile>
): DisplayItem[] {
  const items: DisplayItem[] = [];

  for (const message of messages) {
    // Check if this message contains an embedded thread
    const parsed = parseEmailThread(message.content || '');

    if (parsed && parsed.threadTurns.length > 0) {
      // First, add the parsed thread turns (oldest first)
      for (let i = 0; i < parsed.threadTurns.length; i++) {
        const turn = parsed.threadTurns[i];

        // Create a synthetic message for this turn
        const syntheticMessage: Message = {
          ...message,
          id: `${message.id}-thread-${i}`,
          content: turn.content,
          sender_type: turn.senderType,
          // Clear sender_id for synthetic messages since we don't know the exact sender
          sender_id: turn.senderType === 'customer' ? message.sender_id : null,
        };

        let senderName: string | null = turn.senderHint || null;
        let senderAvatar: string | null = null;

        if (turn.senderType === 'customer') {
          senderName = senderName || customer?.full_name || customer?.email || null;
          senderAvatar = customer?.avatar_url || null;
        }

        items.push({
          id: syntheticMessage.id,
          message: syntheticMessage,
          senderName,
          senderAvatar,
          isParsedFromThread: true,
        });
      }

      // Then add the new content as the final message
      if (parsed.newContent) {
        const mainMessage: Message = {
          ...message,
          content: parsed.newContent,
        };

        let senderName: string | null = null;
        let senderAvatar: string | null = null;

        if (message.sender_type === 'customer') {
          senderName = customer?.full_name || customer?.email || null;
          senderAvatar = customer?.avatar_url || null;
        } else if (message.sender_id) {
          const agent = agents.get(message.sender_id);
          senderName = agent?.full_name || agent?.email || null;
          senderAvatar = agent?.avatar_url || null;
        }

        items.push({
          id: message.id,
          message: mainMessage,
          senderName,
          senderAvatar,
        });
      }
    } else {
      // Regular message - just add it
      let senderName: string | null = null;
      let senderAvatar: string | null = null;

      if (message.sender_type === 'customer') {
        senderName = customer?.full_name || customer?.email || null;
        senderAvatar = customer?.avatar_url || null;
      } else if (message.sender_id) {
        const agent = agents.get(message.sender_id);
        senderName = agent?.full_name || agent?.email || null;
        senderAvatar = agent?.avatar_url || null;
      }

      items.push({
        id: message.id,
        message,
        senderName,
        senderAvatar,
      });
    }
  }

  return items;
}

export function TicketConversation({ messages, customer, agents }: TicketConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Expand messages into display items (parsing embedded threads)
  const displayItems = useMemo(
    () => expandMessages(messages, customer, agents),
    [messages, customer, agents]
  );

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  if (displayItems.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-zinc-500 dark:text-zinc-400">
        No messages yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4 px-4 py-6">
      {displayItems.map((item) => (
        <TicketMessage
          key={item.id}
          message={item.message}
          senderName={item.senderName}
          senderAvatar={item.senderAvatar}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
