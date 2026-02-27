import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { UserList } from '@/components/settings/user-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getInvitations } from '@/lib/actions/invitations';

async function UsersContent() {
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from('profiles')
    .select('*, team:teams(name)')
    .order('full_name');

  const { data: teams } = await supabase.from('teams').select('*').order('name');

  // Fetch pending invitations
  const invitationsResult = await getInvitations();
  const invitations = 'invitations' in invitationsResult ? invitationsResult.invitations : [];

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading users
      </div>
    );
  }

  return <UserList users={users || []} teams={teams || []} invitations={invitations} />;
}

function UsersSkeleton() {
  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Users" />

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<UsersSkeleton />}>
          <UsersContent />
        </Suspense>
      </div>
    </div>
  );
}
