import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { TicketSidebar } from '@/components/tickets/ticket-sidebar';
import type {
  Ticket,
  Customer,
  Profile,
  Team,
  Message,
  Tag,
  TicketActivity,
  CannedResponse,
} from '@/lib/supabase/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TicketWithRelations extends Ticket {
  customer: Customer | null;
  assigned_agent: Profile | null;
  assigned_team: Team | null;
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
      assigned_agent:profiles(*),
      assigned_team:teams(*)
    `
    )
    .eq('id', id)
    .single();

  const ticket = data as TicketWithRelations | null;

  if (error || !ticket) {
    notFound();
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

  // Fetch current user profile for template variables
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      <Header title={`#${ticket.ticket_number} - ${ticket.subject}`} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <TicketDetail
            ticket={{ ...ticket, tags, messages }}
            cannedResponses={cannedResponses}
            agentName={currentAgentName}
          />
        </div>
        <div className="w-80 border-l border-zinc-200 overflow-auto dark:border-zinc-800">
          <TicketSidebar
            ticket={{ ...ticket, tags }}
            agents={agents}
            teams={teams}
            allTags={allTags}
            activities={activities}
          />
        </div>
      </div>
    </div>
  );
}
