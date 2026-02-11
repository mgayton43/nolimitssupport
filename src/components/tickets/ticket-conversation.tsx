'use client';

import { useEffect, useRef } from 'react';
import { TicketMessage } from './ticket-message';
import type { Message, Profile, Customer } from '@/lib/supabase/types';

interface TicketConversationProps {
  messages: Message[];
  customer: Customer | null;
  agents: Map<string, Profile>;
}

export function TicketConversation({ messages, customer, agents }: TicketConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

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

  if (messages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-zinc-500 dark:text-zinc-400">
        No messages yet
      </div>
    );
  }

  // Messages are ordered by created_at ASC from the database (oldest first)
  return (
    <div ref={containerRef} className="bg-white dark:bg-zinc-950">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 px-4">
        {messages.map((message) => {
          const isAgent = message.sender_type === 'agent';

          // Get sender name
          let senderName: string | null = null;
          if (isAgent) {
            if (message.sender_id) {
              const agent = agents.get(message.sender_id);
              senderName = agent?.full_name || null;
            }
          } else {
            senderName = customer?.full_name || customer?.email || null;
          }

          return (
            <TicketMessage
              key={message.id}
              message={message}
              senderName={senderName}
              isAgent={isAgent}
            />
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
