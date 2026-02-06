'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendMessageSchema, uuidSchema, type SendMessageInput } from '@/lib/validations';

export type SendAction = 'send' | 'send-close' | 'send-snooze';
export type SnoozeDuration = '1-day' | '3-days' | '1-week';

export interface SendMessageOptions extends SendMessageInput {
  action?: SendAction;
  snoozeDuration?: SnoozeDuration;
}

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

export async function sendMessage(input: SendMessageOptions) {
  const parsed = sendMessageSchema.safeParse(input);
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

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      ticket_id: parsed.data.ticketId,
      sender_type: 'agent',
      sender_id: user.id,
      content: parsed.data.content,
      is_internal: parsed.data.isInternal || false,
      attachments: parsed.data.attachments || [],
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Failed to send message' };
  }

  // For non-internal replies, update ticket metadata
  if (!parsed.data.isInternal) {
    // Update first_response_at if this is the first agent response
    await supabase
      .from('tickets')
      .update({ first_response_at: new Date().toISOString() })
      .eq('id', parsed.data.ticketId)
      .is('first_response_at', null);

    // Auto-assign ticket to the replying agent if currently unassigned
    await supabase
      .from('tickets')
      .update({ assigned_agent_id: user.id })
      .eq('id', parsed.data.ticketId)
      .is('assigned_agent_id', null);

    // Apply auto-tagging rules
    await supabase.rpc('apply_auto_tags', {
      p_ticket_id: parsed.data.ticketId,
      p_subject: null,
      p_body: parsed.data.content,
    });
  }

  // Handle send actions
  const action = input.action || 'send';

  if (action === 'send-close') {
    // Close the ticket and auto-assign to the user who closed it
    await supabase
      .from('tickets')
      .update({
        status: 'closed',
        resolved_at: new Date().toISOString(),
        snoozed_until: null,
        snoozed_by: null,
        assigned_agent_id: user.id,
      })
      .eq('id', parsed.data.ticketId);
  } else if (action === 'send-snooze' && input.snoozeDuration) {
    // Snooze the ticket and auto-assign to the user who snoozed it
    const snoozedUntil = getSnoozedUntil(input.snoozeDuration);
    await supabase
      .from('tickets')
      .update({
        status: 'pending',
        snoozed_until: snoozedUntil.toISOString(),
        snoozed_by: user.id,
        assigned_agent_id: user.id,
      })
      .eq('id', parsed.data.ticketId);
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { messageId: message.id };
}

export async function getMessages(ticketId: string) {
  const parsed = uuidSchema.safeParse(ticketId);
  if (!parsed.success) {
    return { error: 'Invalid ticket ID' };
  }

  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', parsed.data)
    .order('created_at', { ascending: true });

  if (error) {
    return { error: 'Failed to fetch messages' };
  }

  return { messages };
}

export async function unsnoozeExpiredTickets(): Promise<{ count: number } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('unsnooze_expired_tickets');

  if (error) {
    console.error('Unsnooze expired tickets error:', error);
    return { error: 'Failed to unsnooze expired tickets' };
  }

  if (data && data.length > 0) {
    revalidatePath('/tickets');
  }

  return { count: data?.length || 0 };
}
