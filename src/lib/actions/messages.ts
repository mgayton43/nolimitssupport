'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendMessageSchema, uuidSchema, type SendMessageInput } from '@/lib/validations';

export async function sendMessage(input: SendMessageInput) {
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
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Failed to send message' };
  }

  // Update first_response_at if this is the first agent response
  if (!parsed.data.isInternal) {
    await supabase
      .from('tickets')
      .update({ first_response_at: new Date().toISOString() })
      .eq('id', parsed.data.ticketId)
      .is('first_response_at', null);
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
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
