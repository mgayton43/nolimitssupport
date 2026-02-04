import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { TicketList } from '@/components/tickets/ticket-list';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { searchTickets } from '@/lib/actions/tickets';
import type { TicketSearchResult, Profile, Tag } from '@/lib/supabase/types';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
    view?: string;
    agent?: string;
  }>;
}

function getViewTitle(view: string | undefined, agentName?: string): string {
  switch (view) {
    case 'unassigned':
      return 'Unassigned Tickets';
    case 'my-inbox':
      return 'My Inbox';
    case 'agent':
      return agentName ? `${agentName}'s Inbox` : 'Agent Inbox';
    default:
      return 'All Tickets';
  }
}

async function TicketListContent({
  searchParams,
  agents,
  tags,
  currentUserId,
}: {
  searchParams: {
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
    view?: string;
    agent?: string;
  };
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: Tag[];
  currentUserId: string;
}) {
  const supabase = await createClient();

  // Use enhanced search when search term is present
  if (searchParams.search) {
    const result = await searchTickets({
      search: searchParams.search,
      status: searchParams.status,
      priority: searchParams.priority,
      assignee: searchParams.assignee,
    });

    if ('error' in result) {
      return (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Error searching tickets
        </div>
      );
    }

    // Apply view filters to search results
    let filteredTickets = result.tickets;

    if (searchParams.view === 'unassigned') {
      filteredTickets = filteredTickets.filter((t) => !t.assigned_agent_id);
    } else if (searchParams.view === 'my-inbox') {
      filteredTickets = filteredTickets.filter((t) => t.assigned_agent_id === currentUserId);
    } else if (searchParams.view === 'agent' && searchParams.agent) {
      filteredTickets = filteredTickets.filter((t) => t.assigned_agent_id === searchParams.agent);
    }

    return <TicketList tickets={filteredTickets} agents={agents} tags={tags} />;
  }

  // Standard query without search
  let query = supabase
    .from('tickets')
    .select(
      `
      *,
      customer:customers(*),
      assigned_agent:profiles(*),
      assigned_team:teams(*)
    `
    )
    .order('created_at', { ascending: false });

  // Apply view-specific filters
  if (searchParams.view === 'unassigned') {
    query = query.is('assigned_agent_id', null);
  } else if (searchParams.view === 'my-inbox') {
    query = query.eq('assigned_agent_id', currentUserId);
  } else if (searchParams.view === 'agent' && searchParams.agent) {
    query = query.eq('assigned_agent_id', searchParams.agent);
  }

  // Apply additional filters
  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams.priority && searchParams.priority !== 'all') {
    query = query.eq('priority', searchParams.priority);
  }

  // Only apply assignee filter if not using a view that already filters by assignee
  if (
    searchParams.assignee &&
    searchParams.assignee !== 'all' &&
    !['unassigned', 'my-inbox', 'agent'].includes(searchParams.view || '')
  ) {
    if (searchParams.assignee === 'unassigned') {
      query = query.is('assigned_agent_id', null);
    } else {
      query = query.eq('assigned_agent_id', searchParams.assignee);
    }
  }

  const { data: tickets, error } = await query;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Error loading tickets
      </div>
    );
  }

  return <TicketList tickets={tickets || []} agents={agents} tags={tags} />;
}

function TicketListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch agents for filter dropdown and bulk actions
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true);

  // Fetch tags for bulk actions
  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .order('name');

  // Get agent name if viewing a specific agent's inbox
  let agentName: string | undefined;
  if (resolvedSearchParams.view === 'agent' && resolvedSearchParams.agent) {
    const agent = agents?.find((a) => a.id === resolvedSearchParams.agent);
    agentName = agent?.full_name || agent?.email;
  }

  const title = getViewTitle(resolvedSearchParams.view, agentName);

  return (
    <div className="flex h-full flex-col">
      <Header title={title}>
        <Link href="/tickets/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </Link>
      </Header>

      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <TicketFilters agents={agents || []} />
      </div>

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<TicketListSkeleton />}>
          <TicketListContent
            searchParams={resolvedSearchParams}
            agents={agents || []}
            tags={tags || []}
            currentUserId={user?.id || ''}
          />
        </Suspense>
      </div>
    </div>
  );
}
