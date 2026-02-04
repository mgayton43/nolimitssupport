import { Badge } from '@/components/ui/badge';
import type { TicketStatus } from '@/lib/supabase/types';

interface StatusBadgeProps {
  status: TicketStatus;
}

const statusConfig: Record<TicketStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  open: { label: 'Open', variant: 'warning' },
  pending: { label: 'Pending', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'success' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
