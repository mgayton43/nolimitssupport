'use client';

import { TicketListItem } from './ticket-list-item';
import type { TicketSearchResult } from '@/lib/supabase/types';

interface TicketListProps {
  tickets: TicketSearchResult[];
}

export function TicketList({ tickets }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
        <p>No tickets found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      {tickets.map((ticket) => (
        <TicketListItem
          key={ticket.id}
          ticket={ticket}
          matchField={ticket.match_field}
        />
      ))}
    </div>
  );
}
