'use client';

import { useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { updateUserRole, updateUserTeam, toggleUserActive } from '@/lib/actions/profile';
import { inviteUser, resendInvite, revokeInvite } from '@/lib/actions/invitations';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { Plus, Mail, RefreshCw, X, Clock, Loader2 } from 'lucide-react';
import type { Profile, Team, UserRole, UserInvitation } from '@/lib/supabase/types';

interface UserListProps {
  users: (Profile & { team: Pick<Team, 'name'> | null })[];
  teams: Team[];
  invitations: UserInvitation[];
}

export function UserList({ users, teams, invitations: initialInvitations }: UserListProps) {
  const { profile: currentUser } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'agent' as UserRole });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

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

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    startTransition(async () => {
      const result = await inviteUser(inviteForm);

      if ('error' in result) {
        setInviteError(result.error);
      } else {
        setInvitations((prev) => [result.invitation, ...prev]);
        setInviteForm({ email: '', full_name: '', role: 'agent' });
        setIsInviteOpen(false);
      }
    });
  };

  const handleResendInvite = async (invitationId: string) => {
    setActioningId(invitationId);
    const result = await resendInvite(invitationId);
    if ('error' in result) {
      console.error(result.error);
    }
    setActioningId(null);
  };

  const handleRevokeInvite = async (invitationId: string) => {
    setActioningId(invitationId);
    const result = await revokeInvite(invitationId);
    if ('success' in result) {
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }
    setActioningId(null);
  };

  const isCurrentUserAdmin = currentUser?.role === 'admin';

  return (
    <div>
      {/* Header with Invite Button */}
      {isCurrentUserAdmin && (
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInviteSubmit}>
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to add a new team member.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={inviteForm.full_name}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role *</label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) => setInviteForm((prev) => ({ ...prev, role: value as UserRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {inviteError && (
                    <p className="text-sm text-red-500">{inviteError}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Pending Invitations */}
      {isCurrentUserAdmin && invitations.length > 0 && (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Pending Invitations ({invitations.length})
            </h3>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <Mail className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {invitation.full_name || invitation.email}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      Pending
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {invitation.email}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-4 w-4" />
                  <span>Expires {formatRelativeTime(invitation.expires_at)}</span>
                </div>

                <Badge variant="outline" className="capitalize">
                  {invitation.role}
                </Badge>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendInvite(invitation.id)}
                    disabled={actioningId === invitation.id}
                  >
                    {actioningId === invitation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeInvite(invitation.id)}
                    disabled={actioningId === invitation.id}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Users */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUser?.id;

          return (
            <div key={user.id} className="flex items-center gap-4 p-4">
              <Avatar
                src={user.avatar_url}
                fallback={getInitials(user.full_name || user.email)}
                size="default"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{user.full_name || user.email}</p>
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
    </div>
  );
}
