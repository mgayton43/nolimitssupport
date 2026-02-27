import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { TagList } from '@/components/settings/tag-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getTagTicketCounts } from '@/lib/actions/tags';

async function TagsContent() {
  const supabase = await createClient();

  const [tagsResult, countsResult] = await Promise.all([
    supabase.from('tags').select('*').order('name'),
    getTagTicketCounts(),
  ]);

  if (tagsResult.error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading tags
      </div>
    );
  }

  const ticketCounts = 'counts' in countsResult ? countsResult.counts : {};

  return <TagList tags={tagsResult.data || []} ticketCounts={ticketCounts} />;
}

function TagsSkeleton() {
  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

export default function TagsPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Tags" />

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<TagsSkeleton />}>
          <TagsContent />
        </Suspense>
      </div>
    </div>
  );
}
