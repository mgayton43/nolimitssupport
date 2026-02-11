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
  // Display each message as its own card using sender_type from the database
  return (
    <div ref={containerRef} className="space-y-4 px-4 py-6">
      {messages.map((message) => {
        // Determine sender name and avatar based on database sender_type
        let senderName: string | null = null;
        let senderAvatar: string | null = null;

        if (message.sender_type === 'customer') {
          // Customer message - use customer info
          senderName = customer?.full_name || customer?.email || null;
          senderAvatar = customer?.avatar_url || null;
        } else if (message.sender_type === 'agent') {
          // Agent message - look up agent from profiles
          if (message.sender_id) {
            const agent = agents.get(message.sender_id);
            // Only use full_name for display, not email (emails look bad as names)
            // If no full_name, will fall back to "Agent" in the component
            senderName = agent?.full_name || null;
            senderAvatar = agent?.avatar_url || null;
          }
          // If no sender_id or no full_name, senderName stays null -> shows "Agent"
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
