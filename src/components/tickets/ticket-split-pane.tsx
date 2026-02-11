'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TicketListItemCompact } from './ticket-list-item-compact';
import { BulkActionBar } from './bulk-action-bar';
import { TicketPreviewPane } from './ticket-preview-pane';
import { useTicketListPresence } from '@/lib/hooks/use-ticket-presence';
import { X } from 'lucide-react';
import type { TicketSearchResult, Profile, Tag } from '@/lib/supabase/types';

interface TicketSplitPaneProps {
  tickets: TicketSearchResult[];
  agents: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  tags: Tag[];
  isAdmin?: boolean;
}

export function TicketSplitPane({
  tickets,
  agents,
  tags,
  isAdmin = false,
}: TicketSplitPaneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTicketId = searchParams.get('selected');

  const [ticketItems, setTicketItems] = useState<TicketSearchResult[]>(tickets);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Schedule to avoid sync setState in effect
    void Promise.resolve().then(() => {
      setTicketItems(tickets);
    });
  }, [tickets]);

  // Get ticket IDs for presence tracking
  const ticketIds = useMemo(() => ticketItems.map((t) => t.id), [ticketItems]);
  const presenceMap = useTicketListPresence(ticketIds);

  const allSelected = ticketItems.length > 0 && selectedIds.size === ticketItems.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < ticketItems.length;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ticketItems.map((t) => t.id)));
    }
  }, [allSelected, ticketItems]);

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

  const handleTicketClick = useCallback(
    (ticketId: string) => {
      // Update URL with selected ticket
      const params = new URLSearchParams(searchParams.toString());
      params.set('selected', ticketId);
      router.push(`?${params.toString()}`, { scroll: false });

      // Mark as read locally
      setTicketItems((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, is_unread: false } : ticket
        )
      );
    },
    [router, searchParams]
  );

  const handleClosePreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('selected');
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  if (ticketItems.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
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

      {/* Split pane layout */}
      <div className="flex h-full">
        {/* Left pane - Ticket list */}
        <div
          className={`flex h-full flex-col border-r border-zinc-200 dark:border-zinc-800 ${
            selectedTicketId ? 'hidden w-[380px] lg:flex' : 'w-full lg:w-[380px]'
          }`}
        >
          {/* Select all header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
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
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </span>
            </label>
          </div>

          {/* Scrollable ticket list */}
          <div className="flex-1 overflow-auto">
            {ticketItems.map((ticket) => (
              <TicketListItemCompact
                key={ticket.id}
                ticket={ticket}
                isSelected={ticket.id === selectedTicketId}
                selected={selectedIds.has(ticket.id)}
                onSelect={handleSelectTicket}
                onClick={() => handleTicketClick(ticket.id)}
                viewers={presenceMap.get(ticket.id)}
              />
            ))}
          </div>
        </div>

        {/* Right pane - Ticket preview */}
        <div
          className={`flex-1 ${
            selectedTicketId ? 'flex' : 'hidden lg:flex'
          } flex-col bg-white dark:bg-zinc-950`}
        >
          {selectedTicketId ? (
            <>
              {/* Close button header for mobile */}
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2 lg:hidden dark:border-zinc-800">
                <button
                  onClick={handleClosePreview}
                  className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                  Back to list
                </button>
                <Link
                  href={`/tickets/${selectedTicketId}`}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Open full page
                </Link>
              </div>
              <TicketPreviewPane ticketId={selectedTicketId} />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
              <div className="text-center">
                <p className="text-lg">Select a ticket to preview</p>
                <p className="mt-1 text-sm">
                  Click on a ticket from the list to view its details here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        selectedTickets={ticketItems
          .filter((t) => selectedIds.has(t.id))
          .map((t) => ({ id: t.id, subject: t.subject, ticket_number: t.ticket_number }))}
        onClearSelection={handleClearSelection}
        onActionComplete={handleActionComplete}
        agents={agents}
        tags={tags}
        isAdmin={isAdmin}
      />
    </>
  );
}
