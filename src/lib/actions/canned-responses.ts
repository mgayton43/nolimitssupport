'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createCannedResponseSchema,
  updateCannedResponseSchema,
  uuidSchema,
  type CreateCannedResponseInput,
  type UpdateCannedResponseInput,
} from '@/lib/validations';

export async function createCannedResponse(input: CreateCannedResponseInput) {
  const parsed = createCannedResponseSchema.safeParse(input);
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

  const { data: response, error } = await supabase
    .from('canned_responses')
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      shortcut: parsed.data.shortcut || null,
      category: parsed.data.category || null,
      is_shared: parsed.data.is_shared ?? true,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Failed to create canned response' };
  }

  revalidatePath('/settings/canned-responses');
  return { responseId: response.id };
}

export async function updateCannedResponse(input: UpdateCannedResponseInput) {
  const parsed = updateCannedResponseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const updateData: Partial<Omit<UpdateCannedResponseInput, 'id'>> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.shortcut !== undefined) updateData.shortcut = parsed.data.shortcut;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.is_shared !== undefined) updateData.is_shared = parsed.data.is_shared;

  const { error } = await supabase
    .from('canned_responses')
    .update(updateData)
    .eq('id', parsed.data.id);

  if (error) {
    return { error: 'Failed to update canned response' };
  }

  revalidatePath('/settings/canned-responses');
  return { success: true };
}

export async function deleteCannedResponse(responseId: string) {
  const parsed = uuidSchema.safeParse(responseId);
  if (!parsed.success) {
    return { error: 'Invalid response ID' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('canned_responses')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    return { error: 'Failed to delete canned response' };
  }

  revalidatePath('/settings/canned-responses');
  return { success: true };
}
