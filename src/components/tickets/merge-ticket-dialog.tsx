'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Merge, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/utils';
import {
  searchTicketsForMerge,
  mergeTickets,
  type MergeableTicket,
} from '@/lib/actions/tickets';

interface MergeTicketDialogProps {
  ticketId: string;
  ticketNumber: number;
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
};

export function MergeTicketDialog({
  ticketId,
  ticketNumber,
  isOpen,
  onClose,
}: MergeTicketDialogProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MergeableTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<MergeableTicket | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    const result = await searchTicketsForMerge(searchQuery, ticketId);
    setIsSearching(false);

    if ('error' in result) {
      setError(result.error);
    } else {
      setSearchResults(result.tickets);
      if (result.tickets.length === 0) {
        setError('No matching tickets found');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleMerge = () => {
    if (!selectedTicket) return;

    startTransition(async () => {
      // Merge selectedTicket INTO the current ticket (current ticket is primary)
      const result = await mergeTickets(ticketId, selectedTicket.id);

      if ('error' in result) {
        setError(result.error);
      } else {
        onClose();
        router.refresh();
      }
    });
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedTicket(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Ticket
          </DialogTitle>
          <DialogDescription>
            Search for a ticket to merge into this one (#{ticketNumber}). Messages from the
            selected ticket will be moved here, and that ticket will be closed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search by ticket # or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-auto">
              <p className="text-xs font-medium text-zinc-500">Select a ticket to merge:</p>
              {searchResults.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedTicket?.id === ticket.id
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      #{ticket.ticket_number} - {ticket.subject}
                    </span>
                    <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {ticket.customer?.full_name || ticket.customer?.email || 'Unknown'} ·{' '}
                    {formatRelativeTime(ticket.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected ticket confirmation */}
          {selectedTicket && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Merge ticket #{selectedTicket.ticket_number} into #{ticketNumber}?
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                All messages from #{selectedTicket.ticket_number} will be moved to this ticket, and
                #{selectedTicket.ticket_number} will be closed.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!selectedTicket || isPending}>
            {isPending ? 'Merging...' : 'Merge Tickets'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
