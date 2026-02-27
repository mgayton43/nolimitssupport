'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Inbox,
  InboxIcon,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { unsnoozeExpiredTickets } from '@/lib/actions/messages';
import type { Profile } from '@/lib/supabase/types';

interface TicketViewCounts {
  unassigned: number;
  myInbox: number;
  mySnoozed: number;
  myClosed: number;
  all: number;
}

interface AgentInboxCount {
  agent: Pick<Profile, 'id' | 'full_name' | 'email'>;
  count: number;
}

function CountBadge({
  count,
  variant = 'default',
  icon,
}: {
  count: number;
  variant?: 'default' | 'muted' | 'orange' | 'green';
  icon?: React.ReactNode;
}) {
  if (count === 0) return null;

  const variantStyles = {
    default: 'bg-blue-500/20 text-blue-400',
    muted: 'bg-zinc-700 text-zinc-400',
    orange: 'bg-orange-500/20 text-orange-400',
    green: 'bg-green-500/20 text-green-400',
  };

  return (
    <span
      className={cn(
        'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantStyles[variant]
      )}
    >
      {icon}
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function TicketViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [counts, setCounts] = useState<TicketViewCounts>({
    unassigned: 0,
    myInbox: 0,
    mySnoozed: 0,
    myClosed: 0,
    all: 0,
  });
  const [agentCounts, setAgentCounts] = useState<AgentInboxCount[]>([]);
  const [isAgentInboxesOpen, setIsAgentInboxesOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const currentView = searchParams.get('view') || 'all';
  const currentAgent = searchParams.get('agent');
  const isTicketsPage = pathname === '/tickets' || pathname.startsWith('/tickets?');

  // Fetch counts on mount and when tickets change
  useEffect(() => {
    const fetchCounts = async () => {
      const supabase = createClient();

      // First, check and unsnooze any expired tickets
      await unsnoozeExpiredTickets();

      // Get unassigned count (exclude snoozed)
      const { count: unassignedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .is('assigned_agent_id', null)
        .in('status', ['open', 'pending'])
        .is('snoozed_until', null);

      // Get my inbox count (open/pending, not snoozed)
      const { count: myInboxCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', profile?.id || '')
        .in('status', ['open', 'pending'])
        .is('snoozed_until', null);

      // Get my snoozed count
      const { count: mySnoozedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', profile?.id || '')
        .not('snoozed_until', 'is', null)
        .gt('snoozed_until', new Date().toISOString());

      // Get my closed count
      const { count: myClosedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', profile?.id || '')
        .eq('status', 'closed');

      // Get all tickets count (open/pending)
      const { count: allCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'pending']);

      setCounts({
        unassigned: unassignedCount || 0,
        myInbox: myInboxCount || 0,
        mySnoozed: mySnoozedCount || 0,
        myClosed: myClosedCount || 0,
        all: allCount || 0,
      });

      // Fetch agent inbox counts for admins
      if (isAdmin) {
        const { data: agentsData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('role', ['admin', 'agent'])
          .eq('is_active', true)
          .order('full_name');

        const agents = agentsData as Pick<Profile, 'id' | 'full_name' | 'email'>[] | null;

        if (agents) {
          const agentCountsData: AgentInboxCount[] = [];
          for (const agent of agents) {
            const { count } = await supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('assigned_agent_id', agent.id)
              .in('status', ['open', 'pending']);

            agentCountsData.push({
              agent,
              count: count || 0,
            });
          }
          setAgentCounts(agentCountsData);
        }
      }

      setIsLoading(false);
    };

    if (profile) {
      fetchCounts();
    }

    // Set up real-time subscription for ticket changes
    const supabase = createClient();
    const channel = supabase
      .channel('ticket-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          if (profile) {
            fetchCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin]);

  const views = [
    {
      name: 'Unassigned',
      href: '/tickets?view=unassigned',
      icon: InboxIcon,
      count: counts.unassigned,
      view: 'unassigned',
      badgeVariant: 'default' as const,
    },
    {
      name: 'My Inbox',
      href: '/tickets?view=my-inbox',
      icon: Inbox,
      count: counts.myInbox,
      view: 'my-inbox',
      badgeVariant: 'default' as const,
    },
    {
      name: 'My Snoozed',
      href: '/tickets?view=my-snoozed',
      icon: Clock,
      count: counts.mySnoozed,
      view: 'my-snoozed',
      badgeVariant: 'orange' as const,
    },
    {
      name: 'My Closed',
      href: '/tickets?view=my-closed',
      icon: CheckCircle,
      count: counts.myClosed,
      view: 'my-closed',
      badgeVariant: 'green' as const,
    },
    {
      name: 'All Tickets',
      href: '/tickets?view=all',
      icon: Users,
      count: counts.all,
      view: 'all',
      badgeVariant: 'muted' as const,
    },
  ];

  return (
    <div className="space-y-1">
      <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Tickets
      </div>

      {views.map((item) => {
        const isActive = isTicketsPage && currentView === item.view && !currentAgent;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
            <CountBadge count={item.count} variant={item.badgeVariant} />
          </Link>
        );
      })}

      {/* Agent Inboxes (Admin only) */}
      {isAdmin && agentCounts.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsAgentInboxesOpen(!isAgentInboxesOpen)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            {isAgentInboxesOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Agent Inboxes
          </button>

          {isAgentInboxesOpen && (
            <div className="mt-1 space-y-1">
              {agentCounts.map(({ agent, count }) => {
                const isActive = isTicketsPage && currentAgent === agent.id;
                return (
                  <Link
                    key={agent.id}
                    href={`/tickets?view=agent&agent=${agent.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 pl-8 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                    )}
                  >
                    <span className="truncate">{agent.full_name || agent.email}</span>
                    <CountBadge count={count} variant="muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
