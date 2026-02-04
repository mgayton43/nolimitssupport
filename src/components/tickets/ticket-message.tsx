import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, getInitials, formatDate } from '@/lib/utils';
import type { Message } from '@/lib/supabase/types';

interface TicketMessageProps {
  message: Message;
  senderName?: string | null;
  senderAvatar?: string | null;
}

export function TicketMessage({ message, senderName, senderAvatar }: TicketMessageProps) {
  const isAgent = message.sender_type === 'agent';

  return (
    <div
      className={cn(
        'flex gap-3',
        message.is_internal && 'bg-yellow-50 dark:bg-yellow-900/10 -mx-4 px-4 py-3'
      )}
    >
      <Avatar
        src={senderAvatar}
        fallback={getInitials(senderName)}
        size="default"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{senderName || 'Unknown'}</span>
          {isAgent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Agent
            </Badge>
          )}
          {message.is_internal && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              Internal Note
            </Badge>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(message.created_at)}
          </span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {message.content}
        </div>
      </div>
    </div>
  );
}
