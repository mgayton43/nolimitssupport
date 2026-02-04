'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from './status-badge';
import { PriorityBadge } from './priority-badge';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { TicketSearchResult, MatchField } from '@/lib/supabase/types';

interface TicketListItemProps {
  ticket: TicketSearchResult;
  matchField?: MatchField;
  selected?: boolean;
  onSelect?: (ticketId: string, selected: boolean) => void;
}

const matchFieldLabels: Record<MatchField, string> = {
  ticket_number: 'Matched in ticket number',
  subject: 'Matched in subject',
  customer_name: 'Matched in customer',
  customer_email: 'Matched in customer',
  message: 'Matched in message',
};

export function TicketListItem({
  ticket,
  matchField,
  selected = false,
  onSelect,
}: TicketListItemProps) {
  const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Toggle the current selection state
    onSelect?.(ticket.id, !selected);
  };

  return (
    <div
      className={`flex items-center gap-4 border-b border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${
        selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onClick={handleCheckboxClick}
        onChange={() => {}} // Controlled by onClick
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
      />

      {/* Ticket content - clickable link */}
      <Link
        href={`/tickets/${ticket.id}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <Avatar
          src={ticket.customer?.avatar_url}
          fallback={getInitials(ticket.customer?.full_name || ticket.customer?.email)}
          size="default"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              #{ticket.ticket_number}
            </span>
            <h3 className="truncate font-medium">{ticket.subject}</h3>
            {matchField && (
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {matchFieldLabels[matchField]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {ticket.customer?.full_name || ticket.customer?.email || 'Unknown'} ·{' '}
            {formatRelativeTime(ticket.created_at)}
            {ticket.assigned_agent && (
              <> · Assigned to {ticket.assigned_agent.full_name}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </Link>
    </div>
  );
}
