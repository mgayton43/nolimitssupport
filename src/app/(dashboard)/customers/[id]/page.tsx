import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/tickets/status-badge';
import { PriorityBadge } from '@/components/tickets/priority-badge';
import { getInitials, formatDate, formatRelativeTime } from '@/lib/utils';
import { Mail, Phone, Calendar, Package } from 'lucide-react';
import type { Customer, TicketStatus, TicketPriority } from '@/lib/supabase/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TicketWithAgent {
  id: string;
  ticket_number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  assigned_agent: { full_name: string | null } | null;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  const customer = data as Customer | null;

  if (error || !customer) {
    notFound();
  }

  // Fetch customer's tickets
  const { data: ticketsData } = await supabase
    .from('tickets')
    .select('*, assigned_agent:profiles(full_name)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const tickets = ticketsData as TicketWithAgent[] | null;
  const metadata = customer.metadata as Record<string, unknown> | null;

  return (
    <div className="flex h-full flex-col">
      <Header title="Customer Details" />

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Customer Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <Avatar
                  src={customer.avatar_url}
                  fallback={getInitials(customer.full_name || customer.email)}
                  size="lg"
                  className="h-20 w-20 text-xl"
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold">
                    {customer.full_name || 'Unknown Customer'}
                  </h2>
                  <div className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {customer.email}
                    </p>
                    {customer.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {customer.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Customer since {formatDate(customer.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata / Order History */}
          {metadata && Object.keys(metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(metadata).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </dt>
                      <dd className="mt-1 text-sm">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Support History ({tickets?.length || 0} tickets)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tickets && tickets.length > 0 ? (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          #{ticket.ticket_number} - {ticket.subject}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {formatRelativeTime(ticket.created_at)}
                          {ticket.assigned_agent && (
                            <> · Assigned to {ticket.assigned_agent.full_name}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                  No tickets yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
