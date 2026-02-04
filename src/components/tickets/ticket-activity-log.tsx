import { formatRelativeTime } from '@/lib/utils';
import type { TicketActivity, Profile } from '@/lib/supabase/types';

interface TicketActivityLogProps {
  activities: (TicketActivity & { actor: Pick<Profile, 'full_name' | 'avatar_url'> | null })[];
}

function formatActivityAction(activity: TicketActivity): string {
  switch (activity.action) {
    case 'status_changed':
      return `changed status from ${activity.old_value} to ${activity.new_value}`;
    case 'priority_changed':
      return `changed priority from ${activity.old_value} to ${activity.new_value}`;
    case 'assigned':
      return activity.new_value ? 'assigned the ticket' : 'unassigned the ticket';
    case 'tagged':
      return 'added a tag';
    case 'untagged':
      return 'removed a tag';
    default:
      return activity.action.replace(/_/g, ' ');
  }
}

export function TicketActivityLog({ activities }: TicketActivityLogProps) {
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="text-xs">
          <p className="text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {activity.actor?.full_name || 'System'}
            </span>{' '}
            {formatActivityAction(activity)}
          </p>
          <p className="text-zinc-500 dark:text-zinc-500">
            {formatRelativeTime(activity.created_at)}
          </p>
        </div>
      ))}
    </div>
  );
}
