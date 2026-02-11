'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { Avatar } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriorityBadge } from './priority-badge';
import { TicketActivityLog } from './ticket-activity-log';
import { OrderHistory } from './order-history';
import { ReturnHistory } from './return-history';
import {
  updateTicketPriority,
  assignTicket,
  assignTicketToTeam,
} from '@/lib/actions/tickets';
import { fetchShopifyCustomerInfo } from '@/lib/actions/shopify';
import { getInitials, formatDate } from '@/lib/utils';
import { User, Users, Clock, Mail, Phone, ExternalLink, Ticket as TicketIcon, Copy, Check, MapPin } from 'lucide-react';

// Small copy button component
function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
      )}
    </button>
  );
}
import Link from 'next/link';
import type {
  Ticket,
  Profile,
  Team,
  Tag,
  TicketActivity,
  TicketPriority,
  Customer,
} from '@/lib/supabase/types';

interface TicketSidebarProps {
  ticket: Ticket & { tags: Tag[]; customer: Customer | null };
  agents: Profile[];
  teams: Team[];
  activities: (TicketActivity & { actor: Pick<Profile, 'full_name' | 'avatar_url'> | null })[];
  customerTicketCount?: number;
}

export function TicketSidebar({
  ticket,
  agents,
  teams,
  activities,
  customerTicketCount,
}: TicketSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(ticket.assigned_agent_id);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(ticket.assigned_team_id);
  const [shopifyCustomer, setShopifyCustomer] = useState<{
    id: number;
    adminUrl: string;
    location: string | null;
  } | null>(null);

  // Sync with ticket prop when it changes
  useEffect(() => {
    setCurrentAgentId(ticket.assigned_agent_id);
    setCurrentTeamId(ticket.assigned_team_id);
  }, [ticket.assigned_agent_id, ticket.assigned_team_id]);

  // Fetch Shopify customer info for location and admin link
  useEffect(() => {
    if (!ticket.customer?.email) {
      setShopifyCustomer(null);
      return;
    }

    let cancelled = false;

    const fetchCustomer = async () => {
      try {
        const result = await fetchShopifyCustomerInfo(ticket.customer!.email);
        if (!cancelled && result.customer) {
          setShopifyCustomer(result.customer);
        }
      } catch (error) {
        console.error('Failed to fetch Shopify customer:', error);
      }
    };

    fetchCustomer();

    return () => {
      cancelled = true;
    };
  }, [ticket.customer?.email]);

  const handlePriorityChange = (priority: TicketPriority) => {
    startTransition(async () => {
      await updateTicketPriority(ticket.id, priority);
    });
  };

  const handleAgentChange = (agentId: string) => {
    const newAgentId = agentId === 'unassigned' ? null : agentId;
    // Optimistic update
    setCurrentAgentId(newAgentId);

    startTransition(async () => {
      const result = await assignTicket(ticket.id, newAgentId);
      if (result.error) {
        // Revert on error
        setCurrentAgentId(ticket.assigned_agent_id);
        console.error('Failed to assign ticket:', result.error);
      }
    });
  };

  const handleTeamChange = (teamId: string) => {
    const newTeamId = teamId === 'none' ? null : teamId;
    // Optimistic update
    setCurrentTeamId(newTeamId);

    startTransition(async () => {
      const result = await assignTicketToTeam(ticket.id, newTeamId);
      if (result.error) {
        // Revert on error
        setCurrentTeamId(ticket.assigned_team_id);
        console.error('Failed to assign ticket to team:', result.error);
      }
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Customer */}
      {ticket.customer && (
        <div className="space-y-3">
          <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <User className="h-3.5 w-3.5" />
            Customer
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar
                src={ticket.customer.avatar_url}
                fallback={getInitials(ticket.customer.full_name || ticket.customer.email)}
                size="default"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="group flex items-center gap-1">
                  <p className="font-medium truncate">
                    {ticket.customer.full_name || 'Unknown'}
                  </p>
                  {ticket.customer.full_name && (
                    <CopyButton text={ticket.customer.full_name} />
                  )}
                </div>
                <div className="group flex items-center gap-1">
                  <a
                    href={`mailto:${ticket.customer.email}`}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400 truncate"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ticket.customer.email}</span>
                  </a>
                  <CopyButton text={ticket.customer.email} />
                </div>
                {shopifyCustomer?.location && (
                  <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{shopifyCustomer.location}</span>
                  </div>
                )}
              </div>
            </div>
            {ticket.customer.phone && (
              <a
                href={`tel:${ticket.customer.phone}`}
                className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <Phone className="h-3.5 w-3.5" />
                {ticket.customer.phone}
              </a>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <TicketIcon className="h-3.5 w-3.5" />
                {customerTicketCount ?? 0} ticket{customerTicketCount !== 1 ? 's' : ''}
              </span>
              {shopifyCustomer ? (
                <a
                  href={shopifyCustomer.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  View in Shopify
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  href={`/customers/${ticket.customer.id}`}
                  className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  View profile
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Priority */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Priority
        </label>
        <Select value={ticket.priority} onValueChange={handlePriorityChange} disabled={isPending}>
          <SelectTrigger>
            <SelectValue>
              <PriorityBadge priority={ticket.priority} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignee */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <User className="h-3.5 w-3.5" />
          Assignee
        </label>
        <Select
          value={currentAgentId || 'unassigned'}
          onValueChange={handleAgentChange}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <div className="flex items-center gap-2">
                  <Avatar
                    src={agent.avatar_url}
                    fallback={getInitials(agent.full_name || agent.email)}
                    size="sm"
                    className="h-5 w-5"
                  />
                  {agent.full_name || agent.email}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Team */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <Users className="h-3.5 w-3.5" />
          Team
        </label>
        <Select
          value={currentTeamId || 'none'}
          onValueChange={handleTeamChange}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="No team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No team</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timestamps */}
      <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <Clock className="h-3.5 w-3.5" />
          Timeline
        </label>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd>{formatDate(ticket.created_at)}</dd>
          </div>
          {ticket.first_response_at && (
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">First response</dt>
              <dd>{formatDate(ticket.first_response_at)}</dd>
            </div>
          )}
          {ticket.resolved_at && (
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Resolved</dt>
              <dd>{formatDate(ticket.resolved_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Order History (Shopify) */}
      <OrderHistory customerEmail={ticket.customer?.email || null} />

      {/* Return History (Return Logic) */}
      <ReturnHistory customerEmail={ticket.customer?.email || null} />

      {/* Activity Log */}
      {activities.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Activity
          </label>
          <TicketActivityLog activities={activities} />
        </div>
      )}
    </div>
  );
}
