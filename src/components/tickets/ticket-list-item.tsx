'use client';

import Link from 'next/link';
import { Clock, CheckCircle, Eye } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { BrandBadge } from '@/components/ui/brand-badge';
import { StatusBadge } from './status-badge';
import { PriorityBadge } from './priority-badge';
import { ChannelIcon } from './channel-icon';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { TicketSearchResult, MatchField } from '@/lib/supabase/types';
import type { PresenceUser } from '@/lib/hooks/use-ticket-presence';

function formatSnoozeTime(snoozedUntil: string): string {
  const date = new Date(snoozedUntil);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `Wakes in ${diffDays}d`;
  } else if (diffHours > 0) {
    return `Wakes in ${diffHours}h`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins > 0 ? `Wakes in ${diffMins}m` : 'Waking soon';
  }
}

interface TicketListItemProps {
  ticket: TicketSearchResult;
  matchField?: MatchField;
  selected?: boolean;
  onSelect?: (ticketId: string, selected: boolean) => void;
  onOpen?: (ticketId: string) => void;
  viewers?: PresenceUser[];
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
  onOpen,
  viewers = [],
}: TicketListItemProps) {
  const isUnread = ticket.is_unread ?? false;

  const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Toggle the current selection state
    onSelect?.(ticket.id, !selected);
  };

  return (
    <div
      className={`flex items-center gap-4 border-b border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${
        selected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : isUnread
            ? 'border-l-4 border-l-blue-500 bg-white pl-3 dark:bg-zinc-950'
            : 'bg-zinc-200/65 dark:bg-zinc-900/70'
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
        onClick={() => onOpen?.(ticket.id)}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <Avatar
          src={ticket.customer?.avatar_url}
          fallback={getInitials(ticket.customer?.full_name || ticket.customer?.email)}
          size="default"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ChannelIcon channel={ticket.channel || 'manual'} size="sm" />
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              #{ticket.ticket_number}
            </span>
            {!selected && isUnread && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
                title="Unread"
              />
            )}
            <BrandBadge brand={ticket.brand} />
            <h3
              className={`truncate ${
                isUnread
                  ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                  : 'font-medium text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {ticket.subject}
            </h3>
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
              <> · Assigned to {ticket.assigned_agent.full_name || ticket.assigned_agent.email}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewing indicator */}
          {viewers.length > 0 && (
            <span
              className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title={viewers.map((v) => v.full_name || v.email).join(', ')}
            >
              <Eye className="h-3 w-3" />
              {viewers.length === 1 ? (
                <Avatar
                  src={viewers[0].avatar_url}
                  fallback={getInitials(viewers[0].full_name || viewers[0].email)}
                  size="sm"
                  className="h-4 w-4"
                />
              ) : (
                <span>{viewers.length}</span>
              )}
            </span>
          )}
          {/* Snooze indicator */}
          {ticket.snoozed_until && new Date(ticket.snoozed_until) > new Date() && (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Clock className="h-3 w-3" />
              {formatSnoozeTime(ticket.snoozed_until)}
            </span>
          )}
          {/* Closed indicator */}
          {ticket.status === 'closed' && ticket.resolved_at && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              Closed {formatRelativeTime(ticket.resolved_at)}
            </span>
          )}
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </Link>
    </div>
  );
}
