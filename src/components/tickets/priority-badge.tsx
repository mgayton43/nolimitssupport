import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketPriority } from '@/lib/supabase/types';

interface PriorityBadgeProps {
  priority: TicketPriority;
  size?: 'sm' | 'default';
}

const priorityConfig: Record<TicketPriority, { label: string; variant: 'default' | 'secondary' | 'outline' | 'warning' | 'destructive' }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'outline' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

export function PriorityBadge({ priority, size = 'default' }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <Badge
      variant={config.variant}
      className={cn(size === 'sm' && 'text-[10px] px-1.5 py-0')}
    >
      {config.label}
    </Badge>
  );
}
