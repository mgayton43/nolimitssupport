import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { TicketSplitPane } from '@/components/tickets/ticket-split-pane';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { searchTickets } from '@/lib/actions/tickets';
import { getBrands } from '@/lib/actions/brands';
import type { TicketSearchResult, Profile, Tag } from '@/lib/supabase/types';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
    view?: string;
    agent?: string;
    channel?: string;
    brand?: string;
    sort?: string;
  }>;
}

// Priority order for sorting
const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// Helper function to sort tickets client-side (for search results)
function sortTickets(tickets: TicketSearchResult[], sortBy: string): TicketSearchResult[] {
  const sorted = [...tickets];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'last_message_newest':
      return sorted.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime();
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime();
        return bTime - aTime;
      });
    case 'last_message_oldest':
      return sorted.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime();
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime();
        return aTime - bTime;
      });
    case 'priority_high':
      return sorted.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
    case 'priority_low':
      return sorted.sort((a, b) => (priorityOrder[b.priority] ?? 3) - (priorityOrder[a.priority] ?? 3));
    default:
      return sorted;
  }
}

function getViewTitle(view: string | undefined, agentName?: string): string {
  switch (view) {
    case 'unassigned':
      return 'Unassigned Tickets';
    case 'my-inbox':
      return 'My Inbox';
    case 'my-snoozed':
      return 'My Snoozed Tickets';
    case 'my-closed':
      return 'My Closed Tickets';
    case 'agent':
      return agentName ? `${agentName}'s Inbox` : 'Agent Inbox';
    default:
      return 'All Tickets';
  }
}

type TicketReadRow = {
  ticket_id: string;
  last_read_at: string;
};

function getLatestTicketActivityAt(ticket: TicketSearchResult): string {
  return ticket.last_message_at || ticket.updated_at || ticket.created_at;
}

async function addUnreadState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tickets: TicketSearchResult[],
  currentUserId: string
): Promise<TicketSearchResult[]> {
  if (!tickets.length || !currentUserId) {
    return tickets.map((ticket) => ({ ...ticket, is_unread: false }));
  }

  const ticketIds = tickets.map((ticket) => ticket.id);

  const { data: readRows } = await supabase
    .from('ticket_reads')
    .select('ticket_id, last_read_at')
    .eq('user_id', currentUserId)
    .in('ticket_id', ticketIds);

  const readMap = new Map(
    ((readRows || []) as TicketReadRow[]).map((row) => [row.ticket_id, row.last_read_at])
  );

  return tickets.map((ticket) => {
    const activityAt = getLatestTicketActivityAt(ticket);
    const lastReadAt = readMap.get(ticket.id);
    const isUnread = !lastReadAt || new Date(activityAt).getTime() > new Date(lastReadAt).getTime();

    return {
      ...ticket,
      is_unread: isUnread,
    };
  });
}

async function TicketListContent({
  searchParams,
  agents,
  tags,
  currentUserId,
  isAdmin,
}: {
  searchParams: {
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
    view?: string;
    agent?: string;
    channel?: string;
    brand?: string;
    sort?: string;
  };
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: Tag[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const sortBy = searchParams.sort || 'newest';
  const supabase = await createClient();

  // Use enhanced search when search term is present
  if (searchParams.search) {
    const result = await searchTickets({
      search: searchParams.search,
      status: searchParams.status,
      priority: searchParams.priority,
      assignee: searchParams.assignee,
      channel: searchParams.channel,
      brand: searchParams.brand,
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
      filteredTickets = filteredTickets.filter(
        (t) => !t.assigned_agent_id && ['open', 'pending'].includes(t.status)
      );
    } else if (searchParams.view === 'my-inbox') {
      filteredTickets = filteredTickets.filter(
        (t) =>
          t.assigned_agent_id === currentUserId && ['open', 'pending'].includes(t.status)
      );
    } else if (searchParams.view === 'my-snoozed') {
      filteredTickets = filteredTickets.filter(
        (t) =>
          t.assigned_agent_id === currentUserId &&
          t.snoozed_until &&
          new Date(t.snoozed_until) > new Date()
      );
    } else if (searchParams.view === 'my-closed') {
      filteredTickets = filteredTickets.filter(
        (t) => t.assigned_agent_id === currentUserId && t.status === 'closed'
      );
    } else if (searchParams.view === 'agent' && searchParams.agent) {
      filteredTickets = filteredTickets.filter((t) => t.assigned_agent_id === searchParams.agent);
    }

    // Apply brand filter to search results
    if (searchParams.brand && searchParams.brand !== 'all') {
      filteredTickets = filteredTickets.filter((t) => t.brand_id === searchParams.brand);
    }

    // Apply sorting to search results
    filteredTickets = sortTickets(filteredTickets, sortBy);
    filteredTickets = await addUnreadState(supabase, filteredTickets, currentUserId);

    return <TicketSplitPane tickets={filteredTickets} agents={agents} tags={tags} isAdmin={isAdmin} />;
  }

  // Standard query without search
  // Try with brand first, fall back to without if brands table doesn't exist
  let query = supabase
    .from('tickets')
    .select(
      `
      *,
      customer:customers(*),
      assigned_agent:profiles!tickets_assigned_agent_id_fkey(*),
      assigned_team:teams(*)
    `
    );

  // Apply sorting based on sort parameter
  switch (sortBy) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'last_message_newest':
      query = query.order('last_message_at', { ascending: false, nullsFirst: false });
      break;
    case 'last_message_oldest':
      query = query.order('last_message_at', { ascending: true, nullsFirst: false });
      break;
    case 'priority_high':
      // Supabase doesn't support custom ordering, so we'll sort after fetch
      query = query.order('created_at', { ascending: false });
      break;
    case 'priority_low':
      // Supabase doesn't support custom ordering, so we'll sort after fetch
      query = query.order('created_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Apply view-specific filters
  if (searchParams.view === 'unassigned') {
    query = query
      .is('assigned_agent_id', null)
      .in('status', ['open', 'pending'])
      .is('snoozed_until', null);
  } else if (searchParams.view === 'my-inbox') {
    // Show open/pending tickets assigned to me (excluding snoozed if column exists)
    query = query.eq('assigned_agent_id', currentUserId).in('status', ['open', 'pending']);
  } else if (searchParams.view === 'my-snoozed') {
    // Show snoozed tickets assigned to me
    // This view requires the snooze migration to be run
    let snoozedTickets: TicketSearchResult[] = [];

    try {
      let snoozedQuery = supabase
        .from('tickets')
        .select(
          `
          *,
          customer:customers(*),
          assigned_agent:profiles!tickets_assigned_agent_id_fkey(*),
          assigned_team:teams(*)
        `
        )
        .eq('assigned_agent_id', currentUserId)
        .not('snoozed_until', 'is', null)
        .gt('snoozed_until', new Date().toISOString());

      // Apply sorting to snoozed query
      if (sortBy === 'oldest') {
        snoozedQuery = snoozedQuery.order('created_at', { ascending: true });
      } else if (sortBy === 'last_message_newest') {
        snoozedQuery = snoozedQuery.order('last_message_at', { ascending: false, nullsFirst: false });
      } else if (sortBy === 'last_message_oldest') {
        snoozedQuery = snoozedQuery.order('last_message_at', { ascending: true, nullsFirst: false });
      } else {
        snoozedQuery = snoozedQuery.order('created_at', { ascending: false });
      }

      const { data: snoozedData, error: snoozedError } = await snoozedQuery;

      if (!snoozedError) {
        // Apply priority sorting client-side if needed
        let sortedSnoozed = snoozedData || [];
        if (sortBy === 'priority_high') {
          sortedSnoozed = [...sortedSnoozed].sort(
            (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          );
        } else if (sortBy === 'priority_low') {
          sortedSnoozed = [...sortedSnoozed].sort(
            (a, b) => (priorityOrder[b.priority] ?? 3) - (priorityOrder[a.priority] ?? 3)
          );
        }

        snoozedTickets = await addUnreadState(
          supabase,
          sortedSnoozed as TicketSearchResult[],
          currentUserId
        );
      }
    } catch {
      // Return an empty snoozed list when the migration isn't available yet.
    }

    return <TicketSplitPane tickets={snoozedTickets} agents={agents} tags={tags} isAdmin={isAdmin} />;
  } else if (searchParams.view === 'my-closed') {
    query = query.eq('assigned_agent_id', currentUserId).eq('status', 'closed');
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

  if (searchParams.channel && searchParams.channel !== 'all') {
    query = query.eq('channel', searchParams.channel);
  }

  if (searchParams.brand && searchParams.brand !== 'all') {
    query = query.eq('brand_id', searchParams.brand);
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
    console.error('Tickets query error:', error);
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Error loading tickets
      </div>
    );
  }

  // Apply priority sorting client-side (Supabase doesn't support custom enum ordering)
  let sortedTickets = tickets || [];
  if (sortBy === 'priority_high') {
    sortedTickets = [...sortedTickets].sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
  } else if (sortBy === 'priority_low') {
    sortedTickets = [...sortedTickets].sort(
      (a, b) => (priorityOrder[b.priority] ?? 3) - (priorityOrder[a.priority] ?? 3)
    );
  }

  const ticketsWithUnread = await addUnreadState(
    supabase,
    sortedTickets as TicketSearchResult[],
    currentUserId
  );

  return <TicketSplitPane tickets={ticketsWithUnread} agents={agents} tags={tags} isAdmin={isAdmin} />;
}

function TicketListSkeleton() {
  return (
    <div className="flex h-full">
      {/* Left pane skeleton */}
      <div className="w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Right pane skeleton */}
      <div className="hidden flex-1 items-center justify-center lg:flex">
        <div className="text-center text-zinc-400 dark:text-zinc-500">
          <p className="text-lg">Select a ticket to preview</p>
          <p className="mt-1 text-sm">Click on a ticket from the list to view its details here</p>
        </div>
      </div>
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

  // Check if current user is admin
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

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

  // Fetch brands for filter dropdown
  const { brands } = await getBrands();

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
        <Suspense
          fallback={
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </div>
          }
        >
          <TicketFilters agents={agents || []} brands={brands} />
        </Suspense>
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<TicketListSkeleton />}>
          <TicketListContent
            searchParams={resolvedSearchParams}
            agents={agents || []}
            tags={tags || []}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
          />
        </Suspense>
      </div>
    </div>
  );
}
