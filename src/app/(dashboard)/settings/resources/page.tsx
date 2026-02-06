import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { ResourceList } from '@/components/settings/resource-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getBrands } from '@/lib/actions/brands';

async function ResourcesContent() {
  const supabase = await createClient();

  const [resourcesResult, brandsResult] = await Promise.all([
    supabase
      .from('resources')
      .select('*')
      .order('category', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true }),
    getBrands(),
  ]);

  if (resourcesResult.error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading resources
      </div>
    );
  }

  return (
    <ResourceList
      resources={resourcesResult.data || []}
      brands={brandsResult.brands}
    />
  );
}

function ResourcesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-32" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Resources" />

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<ResourcesSkeleton />}>
          <ResourcesContent />
        </Suspense>
      </div>
    </div>
  );
}
