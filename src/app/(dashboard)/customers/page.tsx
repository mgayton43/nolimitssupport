import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Mail, MapPin, ExternalLink, StickyNote, ShoppingBag, Ticket } from 'lucide-react';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { getCustomerNoteCounts } from '@/lib/actions/customer-notes';
import { cn } from '@/lib/utils';
import type { Customer } from '@/lib/supabase/types';

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

// Shopify store URL
const SHOPIFY_ADMIN_URL = 'https://drifiresystem.myshopify.com/admin/customers';

interface CustomerWithTicketCount extends Customer {
  ticket_count: number;
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

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Error loading customers
      </div>
    );
  }

  const customers = data as Customer[] | null;

  if (!customers?.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500">
        <p>No customers found</p>
        {search && <p className="text-sm">Try a different search term</p>}
      </div>
    );
  }

  // Get ticket counts for each customer
  const customerIds = customers.map((c) => c.id);
  const { data: ticketCounts } = await supabase
    .from('tickets')
    .select('customer_id')
    .in('customer_id', customerIds);

  const ticketCountMap: Record<string, number> = {};
  ticketCounts?.forEach((t) => {
    ticketCountMap[t.customer_id] = (ticketCountMap[t.customer_id] || 0) + 1;
  });

  // Get note counts
  const noteCountsResult = await getCustomerNoteCounts();
  const noteCounts = 'counts' in noteCountsResult ? noteCountsResult.counts : {};

  const customersWithCounts: CustomerWithTicketCount[] = customers.map((c) => ({
    ...c,
    ticket_count: ticketCountMap[c.id] || 0,
  }));

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {customersWithCounts.map((customer) => {
        const hasNotes = (noteCounts[customer.id] || 0) > 0;
        const location = [customer.city, customer.state].filter(Boolean).join(', ');

        return (
          <div
            key={customer.id}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <Link
              href={`/customers/${customer.id}`}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <Avatar
                src={customer.avatar_url}
                fallback={getInitials(customer.full_name || customer.email)}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {customer.full_name || 'Unknown'}
                  </p>
                  {hasNotes && (
                    <span title="Has notes">
                      <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email}
                  </span>
                  {location && (
                    <span className="flex items-center gap-1 hidden sm:flex">
                      <MapPin className="h-3.5 w-3.5" />
                      {location}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Order count */}
              {customer.order_count > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <ShoppingBag className="h-3 w-3" />
                  {customer.order_count}
                </span>
              )}

              {/* Lifetime value */}
              {customer.lifetime_value > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ${customer.lifetime_value.toFixed(0)}
                </span>
              )}

              {/* Ticket count */}
              {customer.ticket_count > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <Ticket className="h-3 w-3" />
                  {customer.ticket_count}
                </span>
              )}

              {/* Shopify link */}
              {customer.shopify_customer_id && (
                <a
                  href={`${SHOPIFY_ADMIN_URL}/${customer.shopify_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="View in Shopify"
                >
                  <ExternalLink className="h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                </a>
              )}
            </div>

            {/* Time */}
            <div className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0 hidden md:block">
              {formatRelativeTime(customer.created_at)}
            </div>
          </div>
        );
      })}
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
