'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { CustomerNote } from '@/lib/supabase/types';

export interface CreateCustomerNoteInput {
  customer_id: string;
  content: string;
}

export async function getCustomerNotes(customerId: string): Promise<{ notes: CustomerNote[] } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customer_notes')
    .select('*, author:profiles!customer_notes_created_by_fkey(id, full_name, email, avatar_url)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get customer notes error:', error);
    return { error: 'Failed to fetch notes' };
  }

  return { notes: data as CustomerNote[] };
}

export async function createCustomerNote(input: CreateCustomerNoteInput): Promise<{ note: CustomerNote } | { error: string }> {
  if (!input.content?.trim()) {
    return { error: 'Note content is required' };
  }

  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('customer_notes')
    .insert({
      customer_id: input.customer_id,
      content: input.content.trim(),
      created_by: user.id,
    })
    .select('*, author:profiles!customer_notes_created_by_fkey(id, full_name, email, avatar_url)')
    .single();

  if (error) {
    console.error('Create customer note error:', error);
    return { error: 'Failed to create note' };
  }

  revalidatePath(`/customers/${input.customer_id}`);
  revalidatePath('/customers');
  return { note: data as CustomerNote };
}

export async function deleteCustomerNote(noteId: string, customerId: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('customer_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Delete customer note error:', error);
    return { error: 'Failed to delete note' };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  return { success: true };
}

export async function getCustomerNoteCounts(): Promise<{ counts: Record<string, number> } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customer_notes')
    .select('customer_id');

  if (error) {
    console.error('Get customer note counts error:', error);
    return { error: 'Failed to fetch counts' };
  }

  const counts: Record<string, number> = {};
  data?.forEach((row) => {
    counts[row.customer_id] = (counts[row.customer_id] || 0) + 1;
  });

  return { counts };
}
