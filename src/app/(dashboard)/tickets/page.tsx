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
import type { TicketSearchResult } from '@/lib/supabase/types';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
  }>;
}

async function TicketListContent({
  searchParams,
}: {
  searchParams: {
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
  };
}) {
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

    return <TicketList tickets={result.tickets} />;
  }

  // Standard query without search
  const supabase = await createClient();

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

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams.priority && searchParams.priority !== 'all') {
    query = query.eq('priority', searchParams.priority);
  }

  if (searchParams.assignee && searchParams.assignee !== 'all') {
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

  return <TicketList tickets={tickets || []} />;
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

  // Fetch agents for filter dropdown
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true);

  return (
    <div className="flex h-full flex-col">
      <Header title="Tickets">
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
          <TicketListContent searchParams={resolvedSearchParams} />
        </Suspense>
      </div>
    </div>
  );
}
