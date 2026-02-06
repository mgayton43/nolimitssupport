'use client';

import { Eye, PenLine } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import type { PresenceUser } from '@/lib/hooks/use-ticket-presence';

interface TicketPresenceBannerProps {
  viewers: PresenceUser[];
}

export function TicketPresenceBanner({ viewers }: TicketPresenceBannerProps) {
  if (viewers.length === 0) return null;

  // Separate typing users from just viewing users
  const typingUsers = viewers.filter((v) => v.is_typing);
  const viewingUsers = viewers.filter((v) => !v.is_typing);

  const getName = (user: PresenceUser) => user.full_name || user.email;

  return (
    <div className="space-y-0">
      {/* Typing indicator - more prominent */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 bg-orange-100 px-4 py-2.5 border-b border-orange-200 dark:bg-orange-900/30 dark:border-orange-800">
          <div className="flex items-center">
            {typingUsers.slice(0, 3).map((user, i) => (
              <Avatar
                key={user.user_id}
                src={user.avatar_url}
                fallback={getInitials(getName(user))}
                size="sm"
                className={i > 0 ? '-ml-2' : ''}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <PenLine className="h-4 w-4 text-orange-600 dark:text-orange-400 animate-pulse" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
              {typingUsers.length === 1
                ? `${getName(typingUsers[0])} is composing a reply...`
                : `${typingUsers.length} agents are composing replies...`}
            </span>
          </div>
        </div>
      )}

      {/* Viewing indicator */}
      {viewingUsers.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 border-b border-amber-100 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex items-center">
            {viewingUsers.slice(0, 3).map((user, i) => (
              <Avatar
                key={user.user_id}
                src={user.avatar_url}
                fallback={getInitials(getName(user))}
                size="sm"
                className={i > 0 ? '-ml-2' : ''}
              />
            ))}
            {viewingUsers.length > 3 && (
              <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                +{viewingUsers.length - 3}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {viewingUsers.length === 1
                ? `${getName(viewingUsers[0])} is also viewing this ticket`
                : `${viewingUsers.map(u => getName(u)).slice(0, 2).join(', ')}${viewingUsers.length > 2 ? ` and ${viewingUsers.length - 2} other${viewingUsers.length > 3 ? 's' : ''}` : ''} are also viewing this ticket`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
