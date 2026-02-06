'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';

export interface PresenceUser {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  is_typing: boolean;
  last_seen_at: string;
}

interface PresenceRow {
  ticket_id: string;
  user_id: string;
  is_typing: boolean;
  last_seen_at: string;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface UseTicketPresenceOptions {
  ticketId: string;
  enabled?: boolean;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PRESENCE_TIMEOUT = 60000; // 60 seconds - consider stale after this

export function useTicketPresence({ ticketId, enabled = true }: UseTicketPresenceOptions) {
  const { profile } = useAuth();
  const [otherViewers, setOtherViewers] = useState<PresenceUser[]>([]);
  const [isTyping, setIsTypingState] = useState(false);
  const supabase = createClient();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Update presence in database (upsert)
  const updatePresence = useCallback(async (typing: boolean = false) => {
    if (!profile?.id || !enabled) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('ticket_presence')
        .upsert({
          ticket_id: ticketId,
          user_id: profile.id,
          last_seen_at: new Date().toISOString(),
          is_typing: typing,
        }, {
          onConflict: 'ticket_id,user_id',
        });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [supabase, ticketId, profile?.id, enabled]);

  // Remove presence from database
  const removePresence = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('ticket_presence')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('user_id', profile.id);
    } catch (error) {
      console.error('Failed to remove presence:', error);
    }
  }, [supabase, ticketId, profile?.id]);

  // Fetch current presence
  const fetchPresence = useCallback(async () => {
    if (!profile?.id || !enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - PRESENCE_TIMEOUT).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ticket_presence')
        .select(`
          user_id,
          is_typing,
          last_seen_at,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('ticket_id', ticketId)
        .gt('last_seen_at', cutoffTime)
        .neq('user_id', profile.id);

      if (error) {
        console.error('Failed to fetch presence:', error);
        return;
      }

      // Transform to PresenceUser format
      const rows = (data || []) as PresenceRow[];
      const others: PresenceUser[] = rows.map((row) => ({
        user_id: row.user_id,
        full_name: row.profiles?.full_name || null,
        email: row.profiles?.email || '',
        avatar_url: row.profiles?.avatar_url || null,
        is_typing: row.is_typing,
        last_seen_at: row.last_seen_at,
      }));

      setOtherViewers(others);
    } catch (error) {
      console.error('Failed to fetch presence:', error);
    }
  }, [supabase, ticketId, profile?.id, enabled]);

  // Set typing status
  const setIsTyping = useCallback((typing: boolean) => {
    isTypingRef.current = typing;
    setIsTypingState(typing);
    updatePresence(typing);
  }, [updatePresence]);

  // Initial setup and heartbeat
  useEffect(() => {
    if (!profile?.id || !enabled) return;

    // Initial presence update
    updatePresence(false);
    fetchPresence();

    // Start heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(isTypingRef.current);
      fetchPresence();
    }, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or navigation
    const handleBeforeUnload = () => {
      removePresence();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      removePresence();
    };
  }, [profile?.id, ticketId, enabled, updatePresence, fetchPresence, removePresence]);

  // Subscribe to realtime presence changes
  useEffect(() => {
    if (!profile?.id || !enabled) return;

    const channel = supabase
      .channel(`presence-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_presence',
        },
        () => {
          // Refetch presence on any change
          fetchPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, ticketId, profile?.id, enabled, fetchPresence]);

  return {
    otherViewers,
    isTyping,
    setIsTyping,
  };
}

// Lightweight hook just for checking if others are viewing (for ticket list)
export function useTicketListPresence(ticketIds: string[]) {
  const { profile } = useAuth();
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUser[]>>(new Map());
  const supabase = createClient();

  const fetchAllPresence = useCallback(async () => {
    if (!profile?.id || ticketIds.length === 0) return;

    try {
      const cutoffTime = new Date(Date.now() - PRESENCE_TIMEOUT).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ticket_presence')
        .select(`
          ticket_id,
          user_id,
          is_typing,
          last_seen_at,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .in('ticket_id', ticketIds)
        .gt('last_seen_at', cutoffTime)
        .neq('user_id', profile.id);

      if (error) {
        console.error('Failed to fetch list presence:', error);
        return;
      }

      // Group by ticket_id
      const map = new Map<string, PresenceUser[]>();
      const rows = (data || []) as PresenceRow[];

      for (const row of rows) {
        const ticketId = row.ticket_id;

        if (!row.profiles) continue;

        const viewer: PresenceUser = {
          user_id: row.user_id,
          full_name: row.profiles.full_name,
          email: row.profiles.email,
          avatar_url: row.profiles.avatar_url,
          is_typing: row.is_typing,
          last_seen_at: row.last_seen_at,
        };

        if (!map.has(ticketId)) {
          map.set(ticketId, []);
        }
        map.get(ticketId)!.push(viewer);
      }

      setPresenceMap(map);
    } catch (error) {
      console.error('Failed to fetch list presence:', error);
    }
  }, [supabase, ticketIds, profile?.id]);

  useEffect(() => {
    fetchAllPresence();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAllPresence, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchAllPresence]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('ticket-list-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_presence',
        },
        () => {
          fetchAllPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profile?.id, fetchAllPresence]);

  return presenceMap;
}
