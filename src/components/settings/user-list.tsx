'use client';

import { useTransition } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateUserRole, updateUserTeam, toggleUserActive } from '@/lib/actions/profile';
import { getInitials } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import type { Profile, Team, UserRole } from '@/lib/supabase/types';

interface UserListProps {
  users: (Profile & { team: Pick<Team, 'name'> | null })[];
  teams: Team[];
}

export function UserList({ users, teams }: UserListProps) {
  const { profile: currentUser } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (userId: string, role: UserRole) => {
    startTransition(async () => {
      await updateUserRole({ userId, role });
    });
  };

  const handleTeamChange = (userId: string, teamId: string) => {
    startTransition(async () => {
      await updateUserTeam({ userId, teamId: teamId === 'none' ? null : teamId });
    });
  };

  const handleToggleActive = (userId: string, isActive: boolean) => {
    startTransition(async () => {
      await toggleUserActive(userId, isActive);
    });
  };

  const isCurrentUserAdmin = currentUser?.role === 'admin';

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {users.map((user) => {
        const isCurrentUser = user.id === currentUser?.id;

        return (
          <div key={user.id} className="flex items-center gap-4 p-4">
            <Avatar
              src={user.avatar_url}
              fallback={getInitials(user.full_name)}
              size="default"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{user.full_name || 'Unknown'}</p>
                {!user.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                {user.email}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={user.team_id || 'none'}
                onValueChange={(value) => handleTeamChange(user.id, value)}
                disabled={isPending || !isCurrentUserAdmin}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={user.role}
                onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                disabled={isPending || !isCurrentUserAdmin || isCurrentUser}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>

              {isCurrentUserAdmin && !isCurrentUser && (
                <Button
                  variant={user.is_active ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => handleToggleActive(user.id, !user.is_active)}
                  disabled={isPending}
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
