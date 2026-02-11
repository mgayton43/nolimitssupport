'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Loader2, ExternalLink, Merge } from 'lucide-react';
import { TicketDetail } from './ticket-detail';
import { TicketSidebar } from './ticket-sidebar';
import { TicketActions } from './ticket-actions';
import { TicketTagsBar } from './ticket-tags-bar';
import { ChannelIcon } from './channel-icon';
import { BrandBadge } from '@/components/ui/brand-badge';
import { getTicketDetail } from '@/lib/actions/tickets';
import type { TicketWithRelations, Message, Tag, CannedResponse, Resource, Team, Profile, TicketActivity, Customer } from '@/lib/supabase/types';

interface TicketPreviewPaneProps {
  ticketId: string;
}

interface TicketDataState {
  ticket: TicketWithRelations;
  messages: Message[];
  tags: Tag[];
  activities: (TicketActivity & { actor: Pick<Profile, 'full_name' | 'avatar_url'> | null })[];
  agents: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>[];
  teams: Team[];
  allTags: Tag[];
  cannedResponses: CannedResponse[];
  resources: Resource[];
  customerTicketCount: number;
  currentAgentName: string | null;
  mergedIntoTicket: { id: string; ticket_number: number; subject: string } | null;
}

export function TicketPreviewPane({ ticketId }: TicketPreviewPaneProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<TicketDataState | null>(null);
  const isMountedRef = useRef(true);
  const currentTicketIdRef = useRef(ticketId);

  useEffect(() => {
    isMountedRef.current = true;
    currentTicketIdRef.current = ticketId;

    const fetchData = async () => {
      const result = await getTicketDetail(ticketId);

      // Check if component is still mounted and ticket ID hasn't changed
      if (!isMountedRef.current || currentTicketIdRef.current !== ticketId) {
        return;
      }

      if ('error' in result) {
        setError(result.error);
        setTicketData(null);
      } else {
        const { data } = result;
        setTicketData({
          ticket: {
            ...data.ticket,
            customer: data.ticket.customer as Customer | null,
            assigned_agent: data.ticket.assigned_agent as Profile | null,
            assigned_team: data.ticket.assigned_team,
            brand: data.ticket.brand,
            tags: data.tags,
            messages: data.messages,
          } as TicketWithRelations,
          messages: data.messages,
          tags: data.tags,
          activities: data.activities,
          agents: data.agents,
          teams: data.teams,
          allTags: data.allTags,
          cannedResponses: data.cannedResponses,
          resources: data.resources,
          customerTicketCount: data.customerTicketCount,
          currentAgentName: data.currentAgentName,
          mergedIntoTicket: data.mergedIntoTicket,
        });
        setError(null);
      }

      setIsLoading(false);
    };

    // Reset state when ticket changes - schedule to avoid sync setState in effect
    void Promise.resolve().then(() => {
      if (isMountedRef.current && currentTicketIdRef.current === ticketId) {
        setIsLoading(true);
        setError(null);
      }
    });
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [ticketId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !ticketData) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        <p>{error || 'Failed to load ticket'}</p>
      </div>
    );
  }

  const { ticket, messages, tags, activities, agents, teams, allTags, cannedResponses, resources, customerTicketCount, currentAgentName, mergedIntoTicket } = ticketData;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <ChannelIcon channel={ticket.channel || 'manual'} />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            #{ticket.ticket_number}
          </span>
          <BrandBadge brand={ticket.brand} size="md" />
          <span className="truncate text-zinc-600 dark:text-zinc-400">
            {ticket.subject}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/tickets/${ticketId}`}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <ExternalLink className="h-3 w-3" />
            Full page
          </Link>
          <TicketActions ticketId={ticket.id} ticketNumber={ticket.ticket_number} ticketStatus={ticket.status} />
        </div>
      </div>

      {/* Merged ticket banner */}
      {mergedIntoTicket && (
        <div className="flex shrink-0 items-center gap-2 border-b border-purple-100 bg-purple-50 px-4 py-2 dark:border-purple-800 dark:bg-purple-900/20">
          <Merge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm text-purple-700 dark:text-purple-300">
            Merged into{' '}
            <Link
              href={`/tickets/${mergedIntoTicket.id}`}
              className="font-medium underline hover:no-underline"
            >
              #{mergedIntoTicket.ticket_number}
            </Link>
          </span>
        </div>
      )}

      {/* Tags bar */}
      <div className="shrink-0">
        <TicketTagsBar ticketId={ticket.id} tags={tags} allTags={allTags} />
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content - ticket detail */}
        <div className="flex-1 overflow-auto">
          <TicketDetail
            ticket={{ ...ticket, tags, messages }}
            cannedResponses={cannedResponses}
            resources={resources}
            agentName={currentAgentName}
          />
        </div>

        {/* Sidebar - hidden on smaller screens */}
        <div className="hidden w-72 shrink-0 overflow-auto border-l border-zinc-200 xl:block dark:border-zinc-800">
          <TicketSidebar
            ticket={{ ...ticket, tags, customer: ticket.customer }}
            agents={agents as Profile[]}
            teams={teams}
            activities={activities}
            customerTicketCount={customerTicketCount}
          />
        </div>
      </div>
    </div>
  );
}
