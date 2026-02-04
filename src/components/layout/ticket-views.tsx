'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Inbox, InboxIcon, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Profile } from '@/lib/supabase/types';

interface TicketViewCounts {
  unassigned: number;
  myInbox: number;
  all: number;
}

interface AgentInboxCount {
  agent: Pick<Profile, 'id' | 'full_name' | 'email'>;
  count: number;
}

function CountBadge({ count, variant = 'default' }: { count: number; variant?: 'default' | 'muted' }) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function TicketViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [counts, setCounts] = useState<TicketViewCounts>({ unassigned: 0, myInbox: 0, all: 0 });
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

      // Get unassigned count
      const { count: unassignedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .is('assigned_agent_id', null)
        .in('status', ['open', 'pending']);

      // Get my inbox count
      const { count: myInboxCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', profile?.id || '')
        .in('status', ['open', 'pending']);

      // Get all tickets count
      const { count: allCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'pending']);

      setCounts({
        unassigned: unassignedCount || 0,
        myInbox: myInboxCount || 0,
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
    },
    {
      name: 'My Inbox',
      href: '/tickets?view=my-inbox',
      icon: Inbox,
      count: counts.myInbox,
      view: 'my-inbox',
    },
    {
      name: 'All Tickets',
      href: '/tickets?view=all',
      icon: Users,
      count: counts.all,
      view: 'all',
    },
  ];

  return (
    <div className="space-y-1">
      <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
            <CountBadge count={item.count} />
          </Link>
        );
      })}

      {/* Agent Inboxes (Admin only) */}
      {isAdmin && agentCounts.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsAgentInboxesOpen(!isAgentInboxesOpen)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
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
                        ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
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
