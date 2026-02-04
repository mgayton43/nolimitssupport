'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createTicketSchema,
  updateTicketStatusSchema,
  updateTicketPrioritySchema,
  assignTicketSchema,
  assignTicketToTeamSchema,
  ticketTagSchema,
  type CreateTicketInput,
} from '@/lib/validations';
import type {
  TicketStatus,
  TicketPriority,
  TicketSearchResult,
  MatchField,
  UserRole,
  Profile,
} from '@/lib/supabase/types';

// Ticket View Counts

export interface TicketViewCounts {
  unassigned: number;
  myInbox: number;
  all: number;
}

export interface AgentInboxCount {
  agent: Pick<Profile, 'id' | 'full_name' | 'email'>;
  count: number;
}

export async function getTicketViewCounts(): Promise<TicketViewCounts> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get unassigned tickets (no assigned agent AND no agent replies)
  const { count: unassignedCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .is('assigned_agent_id', null)
    .in('status', ['open', 'pending']);

  // Get my inbox count (tickets assigned to current user)
  const { count: myInboxCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_agent_id', user?.id || '')
    .in('status', ['open', 'pending']);

  // Get all tickets count
  const { count: allCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'pending']);

  return {
    unassigned: unassignedCount || 0,
    myInbox: myInboxCount || 0,
    all: allCount || 0,
  };
}

export async function getAgentInboxCounts(): Promise<AgentInboxCount[]> {
  const supabase = await createClient();

  // Get all active agents
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true)
    .order('full_name');

  if (!agents) return [];

  // Get ticket counts for each agent
  const agentCounts: AgentInboxCount[] = [];

  for (const agent of agents) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_agent_id', agent.id)
      .in('status', ['open', 'pending']);

    agentCounts.push({
      agent,
      count: count || 0,
    });
  }

  return agentCounts;
}

type SearchTicketRow = {
  id: string;
  ticket_number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer_id: string | null;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  match_field: string;
  customer_email: string | null;
  customer_full_name: string | null;
  customer_phone: string | null;
  customer_avatar_url: string | null;
  customer_metadata: Record<string, unknown> | null;
  customer_created_at: string | null;
  customer_updated_at: string | null;
  agent_email: string | null;
  agent_full_name: string | null;
  agent_avatar_url: string | null;
  agent_role: UserRole | null;
  agent_team_id: string | null;
  agent_is_active: boolean | null;
  team_name: string | null;
  team_description: string | null;
};

export async function createTicket(input: CreateTicketInput) {
  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Find or create customer
  let customerId: string;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', parsed.data.customerEmail)
    .single();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        email: parsed.data.customerEmail,
        full_name: parsed.data.customerName || null,
      })
      .select('id')
      .single();

    if (customerError || !newCustomer) {
      return { error: 'Failed to create customer' };
    }
    customerId = newCustomer.id;
  }

  // Create ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      subject: parsed.data.subject,
      priority: parsed.data.priority,
      customer_id: customerId,
      assigned_agent_id: user.id,
    })
    .select('id')
    .single();

  if (ticketError || !ticket) {
    return { error: 'Failed to create ticket' };
  }

  // Create initial message from customer
  const { error: messageError } = await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: customerId,
    content: parsed.data.message,
    is_internal: false,
  });

  if (messageError) {
    return { error: 'Failed to create initial message' };
  }

  revalidatePath('/tickets');
  return { ticketId: ticket.id };
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const parsed = updateTicketStatusSchema.safeParse({ ticketId, status });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const updateData: { status: TicketStatus; resolved_at?: string | null } = {
    status: parsed.data.status,
  };

  if (parsed.data.status === 'closed') {
    updateData.resolved_at = new Date().toISOString();
  } else {
    updateData.resolved_at = null;
  }

  const { error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', parsed.data.ticketId);

  if (error) {
    return { error: 'Failed to update ticket status' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

export async function updateTicketPriority(ticketId: string, priority: TicketPriority) {
  const parsed = updateTicketPrioritySchema.safeParse({ ticketId, priority });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('tickets')
    .update({ priority: parsed.data.priority })
    .eq('id', parsed.data.ticketId);

  if (error) {
    return { error: 'Failed to update ticket priority' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

export async function assignTicket(ticketId: string, agentId: string | null) {
  const parsed = assignTicketSchema.safeParse({ ticketId, agentId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('tickets')
    .update({ assigned_agent_id: parsed.data.agentId })
    .eq('id', parsed.data.ticketId);

  if (error) {
    return { error: 'Failed to assign ticket' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

export async function assignTicketToTeam(ticketId: string, teamId: string | null) {
  const parsed = assignTicketToTeamSchema.safeParse({ ticketId, teamId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('tickets')
    .update({ assigned_team_id: parsed.data.teamId })
    .eq('id', parsed.data.ticketId);

  if (error) {
    return { error: 'Failed to assign ticket to team' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

export async function addTagToTicket(ticketId: string, tagId: string) {
  const parsed = ticketTagSchema.safeParse({ ticketId, tagId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('ticket_tags').insert({
    ticket_id: parsed.data.ticketId,
    tag_id: parsed.data.tagId,
  });

  if (error) {
    return { error: 'Failed to add tag' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { success: true };
}

export async function removeTagFromTicket(ticketId: string, tagId: string) {
  const parsed = ticketTagSchema.safeParse({ ticketId, tagId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('ticket_tags')
    .delete()
    .eq('ticket_id', parsed.data.ticketId)
    .eq('tag_id', parsed.data.tagId);

  if (error) {
    return { error: 'Failed to remove tag' };
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { success: true };
}

export interface SearchTicketsParams {
  search: string;
  status?: string;
  priority?: string;
  assignee?: string;
}

export async function searchTickets(
  params: SearchTicketsParams
): Promise<{ tickets: TicketSearchResult[] } | { error: string }> {
  const supabase = await createClient();

  const statusFilter =
    params.status && params.status !== 'all'
      ? (params.status as TicketStatus)
      : null;
  const priorityFilter =
    params.priority && params.priority !== 'all'
      ? (params.priority as TicketPriority)
      : null;
  const assigneeUnassigned = params.assignee === 'unassigned';
  const assigneeFilter =
    params.assignee && params.assignee !== 'all' && !assigneeUnassigned
      ? params.assignee
      : null;

  const { data, error } = await supabase.rpc('search_tickets', {
    search_term: params.search,
    status_filter: statusFilter,
    priority_filter: priorityFilter,
    assignee_filter: assigneeFilter,
    assignee_unassigned: assigneeUnassigned,
  });

  if (error) {
    console.error('Search tickets error:', error);
    return { error: 'Failed to search tickets' };
  }

  // Transform flat results into nested TicketSearchResult structure
  const tickets: TicketSearchResult[] = ((data || []) as SearchTicketRow[]).map((row) => ({
    id: row.id,
    ticket_number: row.ticket_number,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    customer_id: row.customer_id,
    assigned_agent_id: row.assigned_agent_id,
    assigned_team_id: row.assigned_team_id,
    first_response_at: row.first_response_at,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    match_field: row.match_field as MatchField,
    customer: row.customer_id
      ? {
          id: row.customer_id,
          email: row.customer_email || '',
          full_name: row.customer_full_name,
          phone: row.customer_phone,
          avatar_url: row.customer_avatar_url,
          metadata: row.customer_metadata || {},
          created_at: row.customer_created_at || row.created_at,
          updated_at: row.customer_updated_at || row.updated_at,
        }
      : null,
    assigned_agent: row.assigned_agent_id
      ? {
          id: row.assigned_agent_id,
          email: row.agent_email || '',
          full_name: row.agent_full_name,
          avatar_url: row.agent_avatar_url,
          role: row.agent_role || 'agent',
          team_id: row.agent_team_id,
          is_active: row.agent_is_active ?? true,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      : null,
    assigned_team: row.assigned_team_id
      ? {
          id: row.assigned_team_id,
          name: row.team_name || '',
          description: row.team_description,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      : null,
    tags: [],
  }));

  return { tickets };
}

// Bulk Actions

export async function bulkUpdateTicketStatus(
  ticketIds: string[],
  status: TicketStatus
): Promise<{ success: true; count: number } | { error: string }> {
  if (ticketIds.length === 0) {
    return { error: 'No tickets selected' };
  }

  const supabase = await createClient();

  const updateData: { status: TicketStatus; resolved_at?: string | null } = {
    status,
  };

  if (status === 'closed') {
    updateData.resolved_at = new Date().toISOString();
  } else {
    updateData.resolved_at = null;
  }

  const { error, count } = await supabase
    .from('tickets')
    .update(updateData)
    .in('id', ticketIds);

  if (error) {
    console.error('Bulk status update error:', error);
    return { error: 'Failed to update ticket status' };
  }

  revalidatePath('/tickets');
  return { success: true, count: count || ticketIds.length };
}

export async function bulkAssignTickets(
  ticketIds: string[],
  agentId: string | null
): Promise<{ success: true; count: number } | { error: string }> {
  if (ticketIds.length === 0) {
    return { error: 'No tickets selected' };
  }

  const supabase = await createClient();

  const { error, count } = await supabase
    .from('tickets')
    .update({ assigned_agent_id: agentId })
    .in('id', ticketIds);

  if (error) {
    console.error('Bulk assign error:', error);
    return { error: 'Failed to assign tickets' };
  }

  revalidatePath('/tickets');
  return { success: true, count: count || ticketIds.length };
}

export async function bulkAddTagToTickets(
  ticketIds: string[],
  tagId: string
): Promise<{ success: true; count: number } | { error: string }> {
  if (ticketIds.length === 0) {
    return { error: 'No tickets selected' };
  }

  const supabase = await createClient();

  // Create insert records for each ticket-tag pair
  const insertRecords = ticketIds.map((ticketId) => ({
    ticket_id: ticketId,
    tag_id: tagId,
  }));

  // Use upsert to avoid errors for tickets that already have the tag
  const { error } = await supabase
    .from('ticket_tags')
    .upsert(insertRecords, { onConflict: 'ticket_id,tag_id', ignoreDuplicates: true });

  if (error) {
    console.error('Bulk add tag error:', error);
    return { error: 'Failed to add tag to tickets' };
  }

  revalidatePath('/tickets');
  return { success: true, count: ticketIds.length };
}
