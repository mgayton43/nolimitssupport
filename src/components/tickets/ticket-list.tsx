'use client';

import { useState, useCallback, useMemo } from 'react';
import { TicketListItem } from './ticket-list-item';
import { BulkActionBar } from './bulk-action-bar';
import { useTicketListPresence } from '@/lib/hooks/use-ticket-presence';
import type { TicketSearchResult, Profile, Tag } from '@/lib/supabase/types';

interface TicketListProps {
  tickets: TicketSearchResult[];
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: Tag[];
}

export function TicketList({ tickets, agents, tags }: TicketListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get ticket IDs for presence tracking
  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets]);
  const presenceMap = useTicketListPresence(ticketIds);

  const allSelected = tickets.length > 0 && selectedIds.size === tickets.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tickets.length;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)));
    }
  }, [allSelected, tickets]);

  const handleSelectTicket = useCallback((ticketId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(ticketId);
      } else {
        next.delete(ticketId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleActionComplete = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  if (tickets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
        <p>No tickets found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <>
      {/* Success message toast */}
      {successMessage && (
        <div className="fixed right-6 top-20 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            {successMessage}
          </div>
        </div>
      )}

      {/* Select all header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={handleSelectAll}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : 'Select all'}
          </span>
        </label>
      </div>

      {/* Ticket list */}
      <div>
        {tickets.map((ticket) => (
          <TicketListItem
            key={ticket.id}
            ticket={ticket}
            matchField={ticket.match_field}
            selected={selectedIds.has(ticket.id)}
            onSelect={handleSelectTicket}
            viewers={presenceMap.get(ticket.id)}
          />
        ))}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={handleClearSelection}
        onActionComplete={handleActionComplete}
        agents={agents}
        tags={tags}
      />
    </>
  );
}
