import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { CannedResponseList } from '@/components/settings/canned-response-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getBrands } from '@/lib/actions/brands';
import { getResources } from '@/lib/actions/resources';

async function CannedResponsesContent() {
  const supabase = await createClient();

  // Get current user and check if admin
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

  const [responsesResult, brandsResult, resourcesResult] = await Promise.all([
    supabase
      .from('canned_responses')
      .select('*, creator:profiles(full_name, email), brand:brands(*)')
      .order('title'),
    getBrands(),
    getResources(),
  ]);

  if (responsesResult.error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading canned responses
      </div>
    );
  }

  return (
    <CannedResponseList
      responses={responsesResult.data || []}
      brands={brandsResult.brands}
      resources={resourcesResult.resources}
      isAdmin={isAdmin}
    />
  );
}

function CannedResponsesSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export default function CannedResponsesPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Canned Responses" />

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<CannedResponsesSkeleton />}>
          <CannedResponsesContent />
        </Suspense>
      </div>
    </div>
  );
}
