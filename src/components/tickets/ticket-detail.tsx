'use client';

import { useEffect, useState } from 'react';
import { TicketConversation } from './ticket-conversation';
import { TicketComposer } from './ticket-composer';
import { TicketPresenceBanner } from './ticket-presence-banner';
import { useTicketPresence } from '@/lib/hooks/use-ticket-presence';
import { createClient } from '@/lib/supabase/client';
import type { TicketWithRelations, Message, Profile, CannedResponse, Resource, PromoCode, Product } from '@/lib/supabase/types';

interface TicketDetailProps {
  ticket: TicketWithRelations;
  cannedResponses: CannedResponse[];
  resources: Resource[];
  promoCodes?: PromoCode[];
  products?: Product[];
  agentName?: string | null;
}

export function TicketDetail({ ticket, cannedResponses, resources, promoCodes = [], products = [], agentName }: TicketDetailProps) {
  const [messages, setMessages] = useState<Message[]>(ticket.messages || []);
  const [agents, setAgents] = useState<Map<string, Profile>>(new Map());
  const supabase = createClient();

  // Track presence for collision detection
  const { otherViewers, setIsTyping } = useTicketPresence({ ticketId: ticket.id });

  // Fetch agents for message display
  useEffect(() => {
    async function fetchAgents() {
      const agentIds = new Set(
        messages
          .filter((m) => m.sender_type === 'agent' && m.sender_id)
          .map((m) => m.sender_id!)
      );

      if (agentIds.size === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(agentIds));

      if (data) {
        const agentMap = new Map((data as Profile[]).map((a) => [a.id, a]));
        setAgents(agentMap);
      }
    }

    fetchAgents();
  }, [messages, supabase]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, supabase]);

  return (
    <div className="flex h-full flex-col">
      {/* Presence banner - shows when others are viewing/typing */}
      <TicketPresenceBanner viewers={otherViewers} />

      <div className="flex-1 overflow-auto">
        <TicketConversation
          messages={messages}
          customer={ticket.customer}
          agents={agents}
        />
      </div>
      <TicketComposer
        ticketId={ticket.id}
        ticketBrandId={ticket.brand_id}
        cannedResponses={cannedResponses}
        resources={resources}
        promoCodes={promoCodes}
        products={products}
        templateContext={{
          customerName: ticket.customer?.full_name,
          customerEmail: ticket.customer?.email,
          ticketNumber: ticket.ticket_number,
          agentName: agentName,
        }}
        onTypingChange={setIsTyping}
      />
    </div>
  );
}
