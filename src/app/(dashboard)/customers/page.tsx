import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Mail, Phone } from 'lucide-react';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { Customer } from '@/lib/supabase/types';

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

async function CustomerListContent({ search }: { search?: string }) {
  const supabase = await createClient();

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(100);
  const customers = data as Customer[] | null;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading customers
      </div>
    );
  }

  if (!customers?.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500">
        <p>No customers found</p>
        {search && <p className="text-sm">Try a different search term</p>}
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {customers.map((customer) => (
        <Link
          key={customer.id}
          href={`/customers/${customer.id}`}
          className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <Avatar
            src={customer.avatar_url}
            fallback={getInitials(customer.full_name || customer.email)}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {customer.full_name || 'Unknown'}
            </p>
            <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3.5 w-3.5" />
                {customer.email}
              </span>
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {customer.phone}
                </span>
              )}
            </div>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatRelativeTime(customer.created_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}

function CustomerListSkeleton() {
  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { search } = await searchParams;

  return (
    <div className="flex h-full flex-col">
      <Header title="Customers">
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </Header>

      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <form className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            name="search"
            placeholder="Search by name or email..."
            defaultValue={search}
            className="pl-9"
          />
        </form>
      </div>

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<CustomerListSkeleton />}>
          <CustomerListContent search={search} />
        </Suspense>
      </div>
    </div>
  );
}
