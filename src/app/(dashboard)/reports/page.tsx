import { Suspense } from 'react';
import { subDays } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { StatsCard } from '@/components/reports/stats-card';
import { VolumeChart } from '@/components/reports/volume-chart';
import { AgentLeaderboard } from '@/components/reports/agent-leaderboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox, Clock, CheckCircle, Users } from 'lucide-react';

interface VolumeData {
  date: string;
  opened: number;
  closed: number;
}

interface ResponseStats {
  avg_first_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  total_tickets: number;
  tickets_with_response: number;
}

interface AgentPerformance {
  agent_id: string;
  agent_name: string | null;
  tickets_resolved: number;
  avg_response_minutes: number | null;
  avg_resolution_minutes: number | null;
}

async function ReportsContent() {
  const supabase = await createClient();
  const endDate = new Date();
  const startDate = subDays(endDate, 30);

  // Get ticket counts
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('id', { count: 'exact' })
    .eq('status', 'open');

  const { data: pendingTickets } = await supabase
    .from('tickets')
    .select('id', { count: 'exact' })
    .eq('status', 'pending');

  const { data: closedThisMonth } = await supabase
    .from('tickets')
    .select('id', { count: 'exact' })
    .eq('status', 'closed')
    .gte('resolved_at', startDate.toISOString());

  // Get volume data using RPC
  const { data: volumeData } = await supabase.rpc('get_ticket_volume', {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  } as unknown as undefined);

  // Get response time stats using RPC
  const { data: responseStats } = await supabase.rpc('get_response_time_stats', {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  } as unknown as undefined);

  // Get agent performance using RPC
  const { data: agentPerformance } = await supabase.rpc('get_agent_performance', {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  } as unknown as undefined);

  const volumeTyped = (volumeData || []) as VolumeData[];
  const statsTyped = ((responseStats as ResponseStats[] | null)?.[0]) || {
    avg_first_response_minutes: 0,
    avg_resolution_minutes: 0,
    total_tickets: 0,
    tickets_with_response: 0,
  };
  const agentTyped = (agentPerformance || []) as AgentPerformance[];

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open Tickets"
          value={openTickets?.length || 0}
          icon={Inbox}
          description="Awaiting response"
        />
        <StatsCard
          title="Pending Tickets"
          value={pendingTickets?.length || 0}
          icon={Clock}
          description="Awaiting customer"
        />
        <StatsCard
          title="Resolved (30d)"
          value={closedThisMonth?.length || 0}
          icon={CheckCircle}
          description="Last 30 days"
        />
        <StatsCard
          title="Avg First Response"
          value={formatMinutes(statsTyped.avg_first_response_minutes)}
          icon={Users}
          description="Last 30 days"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <VolumeChart data={volumeTyped} />
        <AgentLeaderboard data={agentTyped} />
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Reports" />

      <div className="flex-1 overflow-auto p-6">
        <Suspense fallback={<ReportsSkeleton />}>
          <ReportsContent />
        </Suspense>
      </div>
    </div>
  );
}
