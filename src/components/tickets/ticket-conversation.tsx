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

  return (
    <div ref={containerRef} className="space-y-4 px-4 py-6">
      {messages.map((message) => {
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

        return (
          <TicketMessage
            key={message.id}
            message={message}
            senderName={senderName}
            senderAvatar={senderAvatar}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
