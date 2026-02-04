import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

interface AgentPerformance {
  agent_id: string;
  agent_name: string | null;
  tickets_resolved: number;
  avg_response_minutes: number | null;
  avg_resolution_minutes: number | null;
}

interface AgentLeaderboardProps {
  data: AgentPerformance[];
}

export function AgentLeaderboard({ data }: AgentLeaderboardProps) {
  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            No data available
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.slice(0, 10).map((agent, index) => (
              <div key={agent.agent_id} className="flex items-center gap-4 px-6 py-3">
                <span className="w-6 text-center text-sm font-medium text-zinc-400">
                  {index + 1}
                </span>
                <Avatar
                  fallback={getInitials(agent.agent_name)}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {agent.agent_name || 'Unknown Agent'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Avg response: {formatMinutes(agent.avg_response_minutes)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{agent.tickets_resolved}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">resolved</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
