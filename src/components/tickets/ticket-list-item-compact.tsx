'use client';

import { Clock, CheckCircle, Eye } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from './status-badge';
import { PriorityBadge } from './priority-badge';
import { ChannelIcon } from './channel-icon';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { TicketSearchResult } from '@/lib/supabase/types';
import type { PresenceUser } from '@/lib/hooks/use-ticket-presence';

function formatSnoozeTime(snoozedUntil: string): string {
  const date = new Date(snoozedUntil);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins > 0 ? `${diffMins}m` : 'soon';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

interface TicketListItemCompactProps {
  ticket: TicketSearchResult;
  isSelected?: boolean;
  selected?: boolean;
  onSelect?: (ticketId: string, selected: boolean) => void;
  onClick?: () => void;
  viewers?: PresenceUser[];
  messagePreview?: string;
}

export function TicketListItemCompact({
  ticket,
  isSelected = false,
  selected = false,
  onSelect,
  onClick,
  viewers = [],
  messagePreview,
}: TicketListItemCompactProps) {
  const isUnread = ticket.is_unread ?? false;

  const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(ticket.id, !selected);
  };

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-3 border-b border-zinc-200 p-3 transition-colors dark:border-zinc-800 ${
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900/40'
          : selected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : isUnread
              ? 'border-l-4 border-l-blue-500 bg-white pl-2 dark:bg-zinc-950'
              : 'bg-zinc-100/50 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onClick={handleCheckboxClick}
        onChange={() => {}}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
      />

      {/* Avatar */}
      <Avatar
        src={ticket.customer?.avatar_url}
        fallback={getInitials(ticket.customer?.full_name || ticket.customer?.email)}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Top row: Customer name and time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChannelIcon channel={ticket.channel || 'manual'} size="sm" />
            <span
              className={`truncate text-sm ${
                isUnread
                  ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                  : 'font-medium text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {ticket.customer?.full_name || ticket.customer?.email || 'Unknown'}
            </span>
            {isUnread && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Unread" />
            )}
          </div>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {formatRelativeTime(ticket.created_at)}
          </span>
        </div>

        {/* Subject */}
        <p
          className={`mt-0.5 truncate text-sm ${
            isUnread
              ? 'font-medium text-zinc-800 dark:text-zinc-200'
              : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          {ticket.subject}
        </p>

        {/* Message preview */}
        {messagePreview && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-500">
            {truncateText(messagePreview, 100)}
          </p>
        )}

        {/* Bottom row: Status badges */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={ticket.priority} size="sm" />
          <StatusBadge status={ticket.status} size="sm" />

          {/* Viewing indicator */}
          {viewers.length > 0 && (
            <span
              className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title={viewers.map((v) => v.full_name || v.email).join(', ')}
            >
              <Eye className="h-3 w-3" />
              {viewers.length}
            </span>
          )}

          {/* Snooze indicator */}
          {ticket.snoozed_until && new Date(ticket.snoozed_until) > new Date() && (
            <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Clock className="h-3 w-3" />
              {formatSnoozeTime(ticket.snoozed_until)}
            </span>
          )}

          {/* Closed indicator */}
          {ticket.status === 'closed' && ticket.resolved_at && (
            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
            </span>
          )}

          {/* Ticket number */}
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
            #{ticket.ticket_number}
          </span>
        </div>
      </div>
    </div>
  );
}
