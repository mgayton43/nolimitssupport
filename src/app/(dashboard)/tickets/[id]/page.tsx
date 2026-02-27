import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { TicketSidebar } from '@/components/tickets/ticket-sidebar';
import { TicketActions } from '@/components/tickets/ticket-actions';
import { TicketTagsBar } from '@/components/tickets/ticket-tags-bar';
import { ChannelIcon } from '@/components/tickets/channel-icon';
import { BrandBadge } from '@/components/ui/brand-badge';
import { Merge } from 'lucide-react';
import type {
  Ticket,
  Customer,
  Profile,
  Team,
  Message,
  Tag,
  TicketActivity,
  CannedResponse,
  Resource,
  PromoCode,
  Product,
  Brand,
} from '@/lib/supabase/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TicketWithRelations extends Ticket {
  customer: Customer | null;
  assigned_agent: Profile | null;
  assigned_team: Team | null;
  brand?: Brand | null;
}

interface MergedIntoTicket {
  id: string;
  ticket_number: number;
  subject: string;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tickets')
    .select(
      `
      *,
      customer:customers(*),
      assigned_agent:profiles!tickets_assigned_agent_id_fkey(*),
      assigned_team:teams(*)
    `
    )
    .eq('id', id)
    .single();

  const ticket = data as TicketWithRelations | null;

  if (error || !ticket) {
    notFound();
  }

  // Fetch merged into ticket info if this ticket was merged
  let mergedIntoTicket: MergedIntoTicket | null = null;
  if (ticket.merged_into_ticket_id) {
    const { data: mergedData } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject')
      .eq('id', ticket.merged_into_ticket_id)
      .single();
    mergedIntoTicket = mergedData as MergedIntoTicket | null;
  }

  // Fetch messages
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  const messages = (messagesData || []) as Message[];

  // Fetch tags
  const { data: ticketTags } = await supabase
    .from('ticket_tags')
    .select('tag_id, tags(*)')
    .eq('ticket_id', id);

  const tags = (ticketTags?.map((tt: { tags: unknown }) => tt.tags).filter(Boolean) || []) as Tag[];

  // Fetch agents for assignment
  const { data: agentsData } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true);

  const agents = (agentsData || []) as Profile[];

  // Fetch teams for assignment
  const { data: teamsData } = await supabase.from('teams').select('*');
  const teams = (teamsData || []) as Team[];

  // Fetch all tags for tag picker
  const { data: allTagsData } = await supabase.from('tags').select('*');
  const allTags = (allTagsData || []) as Tag[];

  // Fetch activities
  const { data: activitiesData } = await supabase
    .from('ticket_activities')
    .select('*, actor:profiles(full_name, avatar_url)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const activities = (activitiesData || []) as (TicketActivity & {
    actor: Pick<Profile, 'full_name' | 'avatar_url'> | null;
  })[];

  // Fetch canned responses
  const { data: cannedResponsesData } = await supabase
    .from('canned_responses')
    .select('*')
    .order('title');

  const cannedResponses = (cannedResponsesData || []) as CannedResponse[];

  // Fetch resources
  const { data: resourcesData } = await supabase
    .from('resources')
    .select('*')
    .order('category', { ascending: true, nullsFirst: false })
    .order('title');

  const resources = (resourcesData || []) as Resource[];

  // Fetch active promo codes (gracefully handle if table doesn't exist yet)
  let promoCodes: PromoCode[] = [];
  try {
    const { data: promoCodesData } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('is_active', true)
      .order('code');
    promoCodes = (promoCodesData || []) as PromoCode[];
  } catch {
    // Table may not exist yet
  }

  // Fetch products (gracefully handle if table doesn't exist yet)
  let products: Product[] = [];
  try {
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .in('stock_status', ['in_stock', 'pre_order'])
      .order('name');
    products = (productsData || []) as Product[];
  } catch {
    // Table may not exist yet
  }

  // Fetch customer ticket count
  let customerTicketCount = 0;
  if (ticket.customer_id) {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', ticket.customer_id);
    customerTicketCount = count || 0;
  }

  // Fetch current user profile for template variables
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Persist read state for the current user when they open the ticket.
  if (user) {
    try {
      await supabase
        .from('ticket_reads')
        .upsert(
          {
            ticket_id: id,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'ticket_id,user_id' }
        );
    } catch {
      // Table may not exist yet
    }
  }

  let currentAgentName: string | null = null;
  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    currentAgentName = (currentProfile as { full_name: string | null } | null)?.full_name || null;
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title={
          <span className="flex items-center gap-2">
            <ChannelIcon channel={ticket.channel || 'manual'} />
            #{ticket.ticket_number}
            <BrandBadge brand={ticket.brand} size="md" />
            <span>-</span>
            {ticket.subject}
          </span>
        }
      >
        <TicketActions ticketId={ticket.id} ticketNumber={ticket.ticket_number} ticketStatus={ticket.status} />
      </Header>

      {/* Merged ticket banner */}
      {mergedIntoTicket && (
        <div className="flex items-center gap-2 bg-purple-50 px-4 py-3 border-b border-purple-100 dark:bg-purple-900/20 dark:border-purple-800">
          <Merge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm text-purple-700 dark:text-purple-300">
            This ticket was merged into{' '}
            <Link
              href={`/tickets/${mergedIntoTicket.id}`}
              className="font-medium underline hover:no-underline"
            >
              #{mergedIntoTicket.ticket_number} - {mergedIntoTicket.subject}
            </Link>
          </span>
        </div>
      )}

      {/* Tags bar - inline tags with add button */}
      <TicketTagsBar ticketId={ticket.id} tags={tags} allTags={allTags} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <TicketDetail
            ticket={{ ...ticket, tags, messages }}
            cannedResponses={cannedResponses}
            resources={resources}
            promoCodes={promoCodes}
            products={products}
            agentName={currentAgentName}
          />
        </div>
        <div className="w-80 border-l border-zinc-200 overflow-auto dark:border-zinc-800">
          <TicketSidebar
            ticket={{ ...ticket, tags, customer: ticket.customer }}
            agents={agents}
            teams={teams}
            activities={activities}
            customerTicketCount={customerTicketCount}
          />
        </div>
      </div>
    </div>
  );
}
