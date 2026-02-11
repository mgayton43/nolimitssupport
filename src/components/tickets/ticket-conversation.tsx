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

// Parse embedded email thread content into separate turns
function parseEmailThread(content: string): { newContent: string; threadTurns: Array<{ senderType: 'customer' | 'agent'; content: string; senderHint?: string }> } | null {
  // Look for the "Previous conversation:" marker
  const threadMarker = /\n---\s*\n+\*?\*?Previous conversation:\*?\*?\s*\n/i;
  const match = content.match(threadMarker);

  if (!match || match.index === undefined) {
    return null;
  }

  const newContent = content.slice(0, match.index).trim();
  const threadContent = content.slice(match.index + match[0].length).trim();

  if (!threadContent) {
    return null;
  }

  // Parse thread turns - look for "On [date], [name] wrote:" patterns
  const turnPattern = /(?:^|\n)(?:>?\s*)?On\s+[\s\S]{0,200}?\s+wrote:\s*\n?/gi;
  const turns: Array<{ senderType: 'customer' | 'agent'; content: string; senderHint?: string }> = [];

  // Split by the "On ... wrote:" pattern
  const parts = threadContent.split(turnPattern);
  const matches = threadContent.match(turnPattern) || [];

  // The first part (if any) is continuation of previous content
  // Then alternate between headers and content
  for (let i = 0; i < parts.length; i++) {
    const partContent = parts[i]
      .replace(/^>+\s*/gm, '') // Remove quote markers
      .trim();

    if (!partContent) continue;

    // Try to determine sender type from the header (if we have one)
    let senderType: 'customer' | 'agent' = 'agent';
    let senderHint: string | undefined;

    if (i > 0 && matches[i - 1]) {
      const header = matches[i - 1];
      // Extract email/name from header
      const emailMatch = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const nameMatch = header.match(/On\s+[\s\S]{0,150}?,\s*([^<]+?)(?:\s*<|wrote)/i);

      if (emailMatch) {
        senderHint = emailMatch[1];
        // Simple heuristic: if email contains "support", "help", "team", "noreply" - it's likely an agent
        if (/support|help|team|noreply|admin/i.test(emailMatch[1])) {
          senderType = 'agent';
        } else {
          senderType = 'customer';
        }
      } else if (nameMatch) {
        senderHint = nameMatch[1].trim();
      }
    }

    turns.push({
      senderType,
      content: partContent,
      senderHint,
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
