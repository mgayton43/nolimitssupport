'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, ChevronDown, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { closeTicket, snoozeTicket, updateTicketStatus, type SnoozeDuration } from '@/lib/actions/tickets';
import { MergeTicketDialog } from '@/components/tickets/merge-ticket-dialog';
import { StatusBadge } from './status-badge';
import type { TicketStatus } from '@/lib/supabase/types';

interface TicketActionsProps {
  ticketId: string;
  ticketNumber: number;
  ticketStatus: TicketStatus;
}

const snoozeDurations: { value: SnoozeDuration; label: string }[] = [
  { value: '1-day', label: '1 day' },
  { value: '3-days', label: '3 days' },
  { value: '1-week', label: '1 week' },
];

export function TicketActions({ ticketId, ticketNumber, ticketStatus }: TicketActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const snoozeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (snoozeRef.current && !snoozeRef.current.contains(event.target as Node)) {
        setIsSnoozeOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClose = () => {
    startTransition(async () => {
      const result = await closeTicket(ticketId);
      if (!result.error) {
        router.push('/tickets?view=my-inbox');
      }
    });
  };

  const handleSnooze = (duration: SnoozeDuration) => {
    startTransition(async () => {
      const result = await snoozeTicket(ticketId, duration);
      if (!result.error) {
        setIsSnoozeOpen(false);
        router.push('/tickets?view=my-inbox');
      }
    });
  };

  const handleStatusChange = (status: TicketStatus) => {
    startTransition(async () => {
      await updateTicketStatus(ticketId, status);
      setIsStatusOpen(false);
    });
  };

  const statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Close and Snooze buttons - only show for non-closed tickets */}
      {ticketStatus !== 'closed' && (
        <>
          {/* Close Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleClose}
            className="text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {isPending ? 'Closing...' : 'Close'}
          </Button>

          {/* Snooze Button with Dropdown */}
          <div className="relative" ref={snoozeRef}>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setIsSnoozeOpen(!isSnoozeOpen)}
              className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-900/20"
            >
              <Clock className="mr-1.5 h-4 w-4" />
              Snooze
              <ChevronDown className="ml-1.5 h-3 w-3" />
            </Button>

            {isSnoozeOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 w-32 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {snoozeDurations.map((duration) => (
                  <button
                    key={duration.value}
                    type="button"
                    onClick={() => handleSnooze(duration.value)}
                    disabled={isPending}
                    className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {duration.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Merge Button - only show for non-closed tickets */}
      {ticketStatus !== 'closed' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setIsMergeOpen(true)}
          className="text-zinc-600 border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          <Merge className="mr-1.5 h-4 w-4" />
          Merge
        </Button>
      )}

      {/* Status Dropdown - compact, always visible */}
      <div className="relative" ref={statusRef}>
        <button
          type="button"
          onClick={() => setIsStatusOpen(!isStatusOpen)}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          <StatusBadge status={ticketStatus} size="sm" />
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        </button>

        {isStatusOpen && (
          <div className="absolute top-full right-0 z-50 mt-1 w-32 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusChange(option.value)}
                disabled={isPending || option.value === ticketStatus}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                <StatusBadge status={option.value} size="sm" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Merge Dialog */}
      <MergeTicketDialog
        ticketId={ticketId}
        ticketNumber={ticketNumber}
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
      />
    </div>
  );
}
