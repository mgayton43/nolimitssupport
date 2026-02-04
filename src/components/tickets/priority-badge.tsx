import { Badge } from '@/components/ui/badge';
import type { TicketPriority } from '@/lib/supabase/types';

interface PriorityBadgeProps {
  priority: TicketPriority;
}

const priorityConfig: Record<TicketPriority, { label: string; variant: 'default' | 'secondary' | 'outline' | 'warning' | 'destructive' }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'outline' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
