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
  TicketChannel,
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
  channel: TicketChannel | null;
  customer_id: string | null;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  brand_id: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  last_message_at: string | null;
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
  brand_name: string | null;
  brand_slug: string | null;
  brand_color: string | null;
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

    // Check for existing open/pending ticket from this customer (auto-threading)
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id, ticket_number, snoozed_until, assigned_agent_id')
      .eq('customer_id', customerId)
      .in('status', ['open', 'pending'])
      .is('merged_into_ticket_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (existingTicket) {
      // Thread the message to the existing ticket instead of creating a new one
      const { error: messageError } = await supabase.from('messages').insert({
        ticket_id: existingTicket.id,
        sender_type: 'customer',
        sender_id: customerId,
        content: parsed.data.message,
        is_internal: false,
        source: 'new_email',
      });

      if (messageError) {
        return { error: 'Failed to add message to existing ticket' };
      }

      // Un-snooze if the ticket was snoozed
      if (existingTicket.snoozed_until) {
        await supabase
          .from('tickets')
          .update({
            status: 'open',
            snoozed_until: null,
            snoozed_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTicket.id);

        // Notify the assigned agent that the customer replied
        if (existingTicket.assigned_agent_id) {
          await supabase.from('notifications').insert({
            user_id: existingTicket.assigned_agent_id,
            type: 'snooze_expired',
            title: 'Customer replied to snoozed ticket',
            message: `Ticket #${existingTicket.ticket_number} received a new message from the customer`,
            ticket_id: existingTicket.id,
          });
        }
      } else {
        // Just update the updated_at timestamp
        await supabase
          .from('tickets')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existingTicket.id);
      }

      // Apply auto-tagging rules to the new message
      await supabase.rpc('apply_auto_tags', {
        p_ticket_id: existingTicket.id,
        p_subject: null,
        p_body: parsed.data.message,
      });

      revalidatePath('/tickets');
      revalidatePath(`/tickets/${existingTicket.id}`);
      return { ticketId: existingTicket.id, threaded: true };
    }
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

  // Create new ticket (no existing open ticket found)
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      subject: parsed.data.subject,
      priority: parsed.data.priority,
      channel: 'manual',
      customer_id: customerId,
      assigned_agent_id: user.id,
    })
    .select('id')
    .single();

  if (ticketError || !ticket) {
    console.error('Create ticket error:', ticketError);
    return { error: 'Failed to create ticket' };
  }

  // Create initial message from customer
  const { error: messageError } = await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: customerId,
    content: parsed.data.message,
    is_internal: false,
    source: 'reply',
  });

  if (messageError) {
    return { error: 'Failed to create initial message' };
  }

  // Apply auto-tagging rules based on subject and message body
  await supabase.rpc('apply_auto_tags', {
    p_ticket_id: ticket.id,
    p_subject: parsed.data.subject,
    p_body: parsed.data.message,
  });

  // Apply auto-priority rules (only if priority is default 'medium')
  if (parsed.data.priority === 'medium') {
    await supabase.rpc('apply_auto_priority', {
      p_ticket_id: ticket.id,
      p_subject: parsed.data.subject,
      p_body: parsed.data.message,
      p_current_priority: parsed.data.priority,
    });
  }

  revalidatePath('/tickets');
  return { ticketId: ticket.id, threaded: false };
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
  channel?: string;
  brand?: string;
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
  const channelFilter =
    params.channel && params.channel !== 'all'
      ? (params.channel as TicketChannel)
      : null;
  const brandFilter =
    params.brand && params.brand !== 'all'
      ? params.brand
      : null;

  const { data, error } = await supabase.rpc('search_tickets', {
    search_term: params.search,
    status_filter: statusFilter,
    priority_filter: priorityFilter,
    assignee_filter: assigneeFilter,
    assignee_unassigned: assigneeUnassigned,
    channel_filter: channelFilter,
    brand_filter: brandFilter,
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
    channel: row.channel || 'manual',
    customer_id: row.customer_id,
    assigned_agent_id: row.assigned_agent_id,
    assigned_team_id: row.assigned_team_id,
    brand_id: row.brand_id,
    first_response_at: row.first_response_at,
    resolved_at: row.resolved_at,
    snoozed_until: null,
    snoozed_by: null,
    merged_into_ticket_id: null,
    external_id: null,
    imported_at: null,
    reference_id: null,
    last_message_at: row.last_message_at,
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
    brand: row.brand_id
      ? {
          id: row.brand_id,
          name: row.brand_name || '',
          slug: row.brand_slug || '',
          email_address: '',
          color: row.brand_color || '#6B7280',
          logo_url: null,
          created_at: row.created_at,
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

export async function bulkDeleteTickets(
  ticketIds: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  if (ticketIds.length === 0) {
    return { error: 'No tickets selected' };
  }

  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Only admins can delete tickets' };
  }

  // Delete associated data first (due to foreign key constraints)
  // 1. Delete ticket_tags
  const { error: tagsError } = await supabase
    .from('ticket_tags')
    .delete()
    .in('ticket_id', ticketIds);

  if (tagsError) {
    console.error('Error deleting ticket tags:', tagsError);
  }

  // 2. Delete messages (and their attachments from storage if needed)
  // First get messages to find attachments
  const { data: messages } = await supabase
    .from('messages')
    .select('id, attachments')
    .in('ticket_id', ticketIds);

  if (messages) {
    // Collect all attachment paths for deletion from storage
    const attachmentPaths: string[] = [];
    for (const message of messages) {
      if (message.attachments && Array.isArray(message.attachments)) {
        for (const attachment of message.attachments) {
          if (attachment && typeof attachment === 'object' && 'path' in attachment) {
            attachmentPaths.push((attachment as { path: string }).path);
          }
        }
      }
    }

    // Delete attachments from storage
    if (attachmentPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove(attachmentPaths);

      if (storageError) {
        console.error('Error deleting attachments from storage:', storageError);
      }
    }
  }

  // Delete messages
  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .in('ticket_id', ticketIds);

  if (messagesError) {
    console.error('Error deleting messages:', messagesError);
  }

  // 3. Delete ticket_activities
  const { error: activitiesError } = await supabase
    .from('ticket_activities')
    .delete()
    .in('ticket_id', ticketIds);

  if (activitiesError) {
    console.error('Error deleting ticket activities:', activitiesError);
  }

  // 4. Delete ticket_presence
  const { error: presenceError } = await supabase
    .from('ticket_presence')
    .delete()
    .in('ticket_id', ticketIds);

  if (presenceError) {
    console.error('Error deleting ticket presence:', presenceError);
  }

  // 5. Finally delete the tickets
  const { error: ticketsError, count } = await supabase
    .from('tickets')
    .delete()
    .in('id', ticketIds);

  if (ticketsError) {
    console.error('Bulk delete error:', ticketsError);
    return { error: 'Failed to delete tickets' };
  }

  revalidatePath('/tickets');
  return { success: true, count: count || ticketIds.length };
}

// Standalone Ticket Actions (without sending a message)

export type SnoozeDuration = '1-day' | '3-days' | '1-week';

function getSnoozedUntil(duration: SnoozeDuration): Date {
  const now = new Date();
  switch (duration) {
    case '1-day':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '3-days':
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    case '1-week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function closeTicket(ticketId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'closed',
      resolved_at: new Date().toISOString(),
      snoozed_until: null,
      snoozed_by: null,
      assigned_agent_id: user.id,
    })
    .eq('id', ticketId);

  if (error) {
    console.error('Close ticket error:', error);
    return { error: 'Failed to close ticket' };
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

export async function snoozeTicket(ticketId: string, duration: SnoozeDuration) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const snoozedUntil = getSnoozedUntil(duration);

  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'pending',
      snoozed_until: snoozedUntil.toISOString(),
      snoozed_by: user.id,
      assigned_agent_id: user.id,
    })
    .eq('id', ticketId);

  if (error) {
    console.error('Snooze ticket error:', error);
    return { error: 'Failed to snooze ticket' };
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  return { success: true };
}

// Ticket Merge Functions

export interface MergeableTicket {
  id: string;
  ticket_number: number;
  subject: string;
  status: TicketStatus;
  created_at: string;
  customer: {
    email: string;
    full_name: string | null;
  } | null;
}

export async function searchTicketsForMerge(
  query: string,
  excludeTicketId: string
): Promise<{ tickets: MergeableTicket[] } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Search by ticket number or subject
  let ticketQuery = supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, created_at, customer:customers(email, full_name)')
    .neq('id', excludeTicketId)
    .is('merged_into_ticket_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // If query is a number, search by ticket number
  const ticketNumber = parseInt(query, 10);
  if (!isNaN(ticketNumber)) {
    ticketQuery = ticketQuery.eq('ticket_number', ticketNumber);
  } else if (query.trim()) {
    // Otherwise search by subject
    ticketQuery = ticketQuery.ilike('subject', `%${query}%`);
  }

  const { data, error } = await ticketQuery;

  if (error) {
    console.error('Search tickets for merge error:', error);
    return { error: 'Failed to search tickets' };
  }

  // Transform the data to handle Supabase's array return for single relations
  const tickets: MergeableTicket[] = (data || []).map((row) => ({
    id: row.id,
    ticket_number: row.ticket_number,
    subject: row.subject,
    status: row.status,
    created_at: row.created_at,
    customer: Array.isArray(row.customer) ? row.customer[0] || null : row.customer,
  }));

  return { tickets };
}

export async function mergeTickets(
  primaryTicketId: string,
  secondaryTicketId: string
): Promise<{ success: boolean; primaryTicketNumber?: number } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Validate tickets exist
  const { data: primaryTicket } = await supabase
    .from('tickets')
    .select('id, ticket_number')
    .eq('id', primaryTicketId)
    .single();

  const { data: secondaryTicket } = await supabase
    .from('tickets')
    .select('id, ticket_number')
    .eq('id', secondaryTicketId)
    .single();

  if (!primaryTicket || !secondaryTicket) {
    return { error: 'One or both tickets not found' };
  }

  if (primaryTicketId === secondaryTicketId) {
    return { error: 'Cannot merge a ticket with itself' };
  }

  // Move all messages from secondary to primary
  const { error: moveError } = await supabase
    .from('messages')
    .update({
      ticket_id: primaryTicketId,
      source: 'merge',
    })
    .eq('ticket_id', secondaryTicketId);

  if (moveError) {
    console.error('Move messages error:', moveError);
    return { error: 'Failed to move messages' };
  }

  // Close and mark secondary ticket as merged
  const { error: closeError } = await supabase
    .from('tickets')
    .update({
      status: 'closed',
      merged_into_ticket_id: primaryTicketId,
      resolved_at: new Date().toISOString(),
      snoozed_until: null,
      snoozed_by: null,
    })
    .eq('id', secondaryTicketId);

  if (closeError) {
    console.error('Close secondary ticket error:', closeError);
    return { error: 'Failed to close merged ticket' };
  }

  // Update primary ticket's updated_at
  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', primaryTicketId);

  // Add activity log to primary ticket
  await supabase.from('ticket_activities').insert({
    ticket_id: primaryTicketId,
    actor_id: user.id,
    action: 'ticket_merged',
    new_value: `Merged from ticket #${secondaryTicket.ticket_number}`,
    metadata: {
      merged_ticket_id: secondaryTicketId,
      merged_ticket_number: secondaryTicket.ticket_number,
    },
  });

  // Add activity log to secondary ticket
  await supabase.from('ticket_activities').insert({
    ticket_id: secondaryTicketId,
    actor_id: user.id,
    action: 'ticket_merged_into',
    new_value: `Merged into ticket #${primaryTicket.ticket_number}`,
    metadata: {
      primary_ticket_id: primaryTicketId,
      primary_ticket_number: primaryTicket.ticket_number,
    },
  });

  revalidatePath(`/tickets/${primaryTicketId}`);
  revalidatePath(`/tickets/${secondaryTicketId}`);
  revalidatePath('/tickets');

  return { success: true, primaryTicketNumber: primaryTicket.ticket_number };
}

export async function getTicketMergeInfo(
  ticketId: string
): Promise<{ mergedFrom: number[]; mergedInto: { id: string; ticket_number: number } | null } | { error: string }> {
  const supabase = await createClient();

  // Check if this ticket was merged into another
  const { data: ticket } = await supabase
    .from('tickets')
    .select('merged_into_ticket_id')
    .eq('id', ticketId)
    .single();

  let mergedInto: { id: string; ticket_number: number } | null = null;
  if (ticket?.merged_into_ticket_id) {
    const { data: primaryTicket } = await supabase
      .from('tickets')
      .select('id, ticket_number')
      .eq('id', ticket.merged_into_ticket_id)
      .single();
    if (primaryTicket) {
      mergedInto = primaryTicket;
    }
  }

  // Check if other tickets were merged into this one
  const { data: mergedTickets } = await supabase
    .from('tickets')
    .select('ticket_number')
    .eq('merged_into_ticket_id', ticketId)
    .order('ticket_number');

  const mergedFrom = (mergedTickets || []).map((t) => t.ticket_number);

  return { mergedFrom, mergedInto };
}

// Get Ticket Detail for Split Pane Preview

import type {
  Message,
  Tag,
  TicketActivity,
  CannedResponse,
  Resource,
  Team,
  Brand,
} from '@/lib/supabase/types';

interface TicketDetailData {
  ticket: {
    id: string;
    ticket_number: number;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    channel: TicketChannel | null;
    brand_id: string | null;
    customer: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
    assigned_agent: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
    assigned_team: Team | null;
    brand: Brand | null;
    snoozed_until: string | null;
    merged_into_ticket_id: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
  };
  messages: Message[];
  tags: Tag[];
  activities: (TicketActivity & { actor: Pick<Profile, 'full_name' | 'avatar_url'> | null })[];
  agents: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>[];
  teams: Team[];
  allTags: Tag[];
  cannedResponses: CannedResponse[];
  resources: Resource[];
  customerTicketCount: number;
  currentAgentName: string | null;
  mergedIntoTicket: { id: string; ticket_number: number; subject: string } | null;
}

export async function getTicketDetail(
  ticketId: string
): Promise<{ data: TicketDetailData } | { error: string }> {
  const supabase = await createClient();

  // Fetch ticket with relations
  const { data: ticketData, error: ticketError } = await supabase
    .from('tickets')
    .select(
      `
      *,
      customer:customers(id, email, full_name, avatar_url),
      assigned_agent:profiles!tickets_assigned_agent_id_fkey(id, full_name, email, avatar_url),
      assigned_team:teams(*)
    `
    )
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticketData) {
    return { error: 'Ticket not found' };
  }

  // Fetch merged into ticket info if this ticket was merged
  let mergedIntoTicket: { id: string; ticket_number: number; subject: string } | null = null;
  if (ticketData.merged_into_ticket_id) {
    const { data: mergedData } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject')
      .eq('id', ticketData.merged_into_ticket_id)
      .single();
    mergedIntoTicket = mergedData;
  }

  // Fetch all data in parallel
  const [
    messagesResult,
    ticketTagsResult,
    agentsResult,
    teamsResult,
    allTagsResult,
    activitiesResult,
    cannedResponsesResult,
    resourcesResult,
    userResult,
  ] = await Promise.all([
    // Messages
    supabase
      .from('messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
    // Ticket tags
    supabase.from('ticket_tags').select('tag_id, tags(*)').eq('ticket_id', ticketId),
    // Agents
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('role', ['admin', 'agent'])
      .eq('is_active', true),
    // Teams
    supabase.from('teams').select('*'),
    // All tags
    supabase.from('tags').select('*'),
    // Activities
    supabase
      .from('ticket_activities')
      .select('*, actor:profiles(full_name, avatar_url)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(20),
    // Canned responses
    supabase.from('canned_responses').select('*').order('title'),
    // Resources
    supabase
      .from('resources')
      .select('*')
      .order('category', { ascending: true, nullsFirst: false })
      .order('title'),
    // Current user
    supabase.auth.getUser(),
  ]);

  const messages = (messagesResult.data || []) as Message[];
  const tags = (
    ticketTagsResult.data?.map((tt: { tags: unknown }) => tt.tags).filter(Boolean) || []
  ) as Tag[];
  const agents = (agentsResult.data || []) as Pick<
    Profile,
    'id' | 'full_name' | 'email' | 'avatar_url'
  >[];
  const teams = (teamsResult.data || []) as Team[];
  const allTags = (allTagsResult.data || []) as Tag[];
  const activities = (activitiesResult.data || []) as (TicketActivity & {
    actor: Pick<Profile, 'full_name' | 'avatar_url'> | null;
  })[];
  const cannedResponses = (cannedResponsesResult.data || []) as CannedResponse[];
  const resources = (resourcesResult.data || []) as Resource[];
  const user = userResult.data.user;

  // Persist read state for the current user
  if (user) {
    await supabase.from('ticket_reads').upsert(
      {
        ticket_id: ticketId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'ticket_id,user_id' }
    );
  }

  // Get current agent name
  let currentAgentName: string | null = null;
  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    currentAgentName = (currentProfile as { full_name: string | null } | null)?.full_name || null;
  }

  // Fetch customer ticket count
  let customerTicketCount = 0;
  if (ticketData.customer_id) {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', ticketData.customer_id);
    customerTicketCount = count || 0;
  }

  return {
    data: {
      ticket: {
        id: ticketData.id,
        ticket_number: ticketData.ticket_number,
        subject: ticketData.subject,
        status: ticketData.status,
        priority: ticketData.priority,
        channel: ticketData.channel,
        brand_id: ticketData.brand_id,
        customer: ticketData.customer as TicketDetailData['ticket']['customer'],
        assigned_agent: ticketData.assigned_agent as TicketDetailData['ticket']['assigned_agent'],
        assigned_team: ticketData.assigned_team as Team | null,
        brand: null, // Would need separate fetch
        snoozed_until: ticketData.snoozed_until,
        merged_into_ticket_id: ticketData.merged_into_ticket_id,
        resolved_at: ticketData.resolved_at,
        created_at: ticketData.created_at,
        updated_at: ticketData.updated_at,
      },
      messages,
      tags,
      activities,
      agents,
      teams,
      allTags,
      cannedResponses,
      resources,
      customerTicketCount,
      currentAgentName,
      mergedIntoTicket,
    },
  };
}
