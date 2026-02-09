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
    if (error.code === '23505') {
      return { error: 'A tag with this name already exists' };
    }
    return { error: 'Failed to create tag' };
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
    if (error.code === '23505') {
      return { error: 'A tag with this name already exists' };
    }
    return { error: 'Failed to update tag' };
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
    return { error: 'Failed to delete tag' };
  }

  revalidatePath('/settings/tags');
  return { success: true };
}
