'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createTagSchema,
  updateTagSchema,
  uuidSchema,
  type CreateTagInput,
  type UpdateTagInput,
} from '@/lib/validations';

export async function createTag(input: CreateTagInput) {
  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { data: tag, error } = await supabase
    .from('tags')
    .insert({
      name: parsed.data.name,
      color: parsed.data.color || '#6B7280',
      description: parsed.data.description || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Create tag error:', error);
    if (error.code === '23505') {
      return { error: 'A tag with this name already exists' };
    }
    if (error.code === '42501') {
      return { error: 'Permission denied. Only admins can manage tags.' };
    }
    return { error: `Failed to create tag: ${error.message}` };
  }

  revalidatePath('/settings/tags');
  return { tagId: tag.id };
}

export async function updateTag(input: UpdateTagInput) {
  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const updateData: Record<string, string | null | undefined> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

  const { error } = await supabase
    .from('tags')
    .update(updateData)
    .eq('id', parsed.data.id);

  if (error) {
    console.error('Update tag error:', error);
    if (error.code === '23505') {
      return { error: 'A tag with this name already exists' };
    }
    if (error.code === '42501') {
      return { error: 'Permission denied. Only admins can manage tags.' };
    }
    return { error: `Failed to update tag: ${error.message}` };
  }

  revalidatePath('/settings/tags');
  return { success: true };
}

export async function deleteTag(tagId: string) {
  const parsed = uuidSchema.safeParse(tagId);
  if (!parsed.success) {
    return { error: 'Invalid tag ID' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('tags').delete().eq('id', parsed.data);

  if (error) {
    console.error('Delete tag error:', error);
    if (error.code === '42501') {
      return { error: 'Permission denied. Only admins can manage tags.' };
    }
    return { error: `Failed to delete tag: ${error.message}` };
  }

  revalidatePath('/settings/tags');
  return { success: true };
}

export interface TagTicket {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  created_at: string;
  customer: {
    full_name: string | null;
    email: string;
  } | null;
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export async function getTicketsByTag(
  tagId: string,
  limit = 25,
  dateRange?: DateRange
): Promise<{ tickets: TagTicket[]; total: number } | { error: string }> {
  const parsed = uuidSchema.safeParse(tagId);
  if (!parsed.success) {
    return { error: 'Invalid tag ID' };
  }

  const supabase = await createClient();

  // Build the query with date filtering
  // We need to join through tickets to filter by created_at
  let countQuery = supabase
    .from('ticket_tags')
    .select('ticket_id, tickets!inner(created_at)', { count: 'exact', head: true })
    .eq('tag_id', parsed.data);

  let dataQuery = supabase
    .from('ticket_tags')
    .select(`
      ticket:tickets!inner(
        id,
        ticket_number,
        subject,
        status,
        created_at,
        customer:customers(full_name, email)
      )
    `)
    .eq('tag_id', parsed.data)
    .order('ticket_id', { ascending: false })
    .limit(limit);

  // Apply date range filters
  if (dateRange?.from) {
    countQuery = countQuery.gte('tickets.created_at', dateRange.from);
    dataQuery = dataQuery.gte('ticket.created_at', dateRange.from);
  }
  if (dateRange?.to) {
    // Add 1 day to include the end date fully
    const toDate = new Date(dateRange.to);
    toDate.setDate(toDate.getDate() + 1);
    const toDateStr = toDate.toISOString().split('T')[0];
    countQuery = countQuery.lt('tickets.created_at', toDateStr);
    dataQuery = dataQuery.lt('ticket.created_at', toDateStr);
  }

  const [{ count }, { data: ticketTags, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error) {
    console.error('Get tickets by tag error:', error);
    return { error: 'Failed to fetch tickets' };
  }

  const tickets = ticketTags
    ?.map((tt) => tt.ticket as unknown as TagTicket)
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

  return { tickets, total: count || 0 };
}

export async function getTagTicketCounts(
  dateRange?: DateRange
): Promise<{ counts: Record<string, number> } | { error: string }> {
  const supabase = await createClient();

  let query = supabase
    .from('ticket_tags')
    .select('tag_id, tickets!inner(created_at)');

  // Apply date range filters
  if (dateRange?.from) {
    query = query.gte('tickets.created_at', dateRange.from);
  }
  if (dateRange?.to) {
    // Add 1 day to include the end date fully
    const toDate = new Date(dateRange.to);
    toDate.setDate(toDate.getDate() + 1);
    const toDateStr = toDate.toISOString().split('T')[0];
    query = query.lt('tickets.created_at', toDateStr);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get tag ticket counts error:', error);
    return { error: 'Failed to fetch counts' };
  }

  const counts: Record<string, number> = {};
  data?.forEach((row) => {
    counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
  });

  return { counts };
}
