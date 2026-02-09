import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/lib/supabase/types';

interface StatusBadgeProps {
  status: TicketStatus;
  size?: 'sm' | 'default';
}

const statusConfig: Record<TicketStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  open: { label: 'Open', variant: 'warning' },
  pending: { label: 'Pending', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'success' },
};

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge
      variant={config.variant}
      className={cn(size === 'sm' && 'text-[10px] px-1.5 py-0')}
    >
      {config.label}
    </Badge>
  );
}
