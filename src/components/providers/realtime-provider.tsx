'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Create a general presence channel to track connection status
      channel = supabase.channel('app-status');

      channel
        .on('presence', { event: 'sync' }, () => {
          setIsConnected(true);
        })
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

// Hook for subscribing to ticket updates
export function useRealtimeTickets(onTicketUpdate: (payload: unknown) => void) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        onTicketUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onTicketUpdate]);
}

// Hook for subscribing to messages for a specific ticket
export function useRealtimeMessages(
  ticketId: string,
  onNewMessage: (message: unknown) => void
) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => onNewMessage(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, ticketId, onNewMessage]);
}
