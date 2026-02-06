'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createResourceSchema,
  updateResourceSchema,
  uuidSchema,
  type CreateResourceInput,
  type UpdateResourceInput,
} from '@/lib/validations';
import type { Resource } from '@/lib/supabase/types';

export async function getResources(): Promise<{ resources: Resource[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('category', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  if (error) {
    return { resources: [], error: 'Failed to fetch resources' };
  }

  return { resources: data || [] };
}

export async function createResource(input: CreateResourceInput) {
  const parsed = createResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  const { data: resource, error } = await supabase
    .from('resources')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      url: parsed.data.url,
      type: parsed.data.type,
      category: parsed.data.category || null,
      thumbnail_url: parsed.data.thumbnail_url || null,
      file_path: parsed.data.file_path || null,
      is_uploaded: parsed.data.is_uploaded || false,
      created_by: user?.id || null,
      brand_id: parsed.data.brand_id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '42501') {
      return { error: 'Only admins can create resources' };
    }
    return { error: 'Failed to create resource' };
  }

  revalidatePath('/settings/resources');
  return { resourceId: resource.id };
}

export async function updateResource(input: UpdateResourceInput) {
  const parsed = updateResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  // If switching from uploaded to URL, delete the old file
  const { data: existingResource } = await supabase
    .from('resources')
    .select('file_path, is_uploaded')
    .eq('id', parsed.data.id)
    .single();

  // If there's an existing uploaded file and we're switching to URL mode, delete the old file
  if (existingResource?.is_uploaded && existingResource?.file_path && !parsed.data.is_uploaded) {
    await supabase.storage.from('resources').remove([existingResource.file_path]);
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
  if (parsed.data.url !== undefined) updateData.url = parsed.data.url;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category || null;
  if (parsed.data.thumbnail_url !== undefined) updateData.thumbnail_url = parsed.data.thumbnail_url || null;
  if (parsed.data.file_path !== undefined) updateData.file_path = parsed.data.file_path || null;
  if (parsed.data.is_uploaded !== undefined) updateData.is_uploaded = parsed.data.is_uploaded;
  if (parsed.data.brand_id !== undefined) updateData.brand_id = parsed.data.brand_id;

  const { error } = await supabase
    .from('resources')
    .update(updateData)
    .eq('id', parsed.data.id);

  if (error) {
    if (error.code === '42501') {
      return { error: 'Only admins can update resources' };
    }
    return { error: 'Failed to update resource' };
  }

  revalidatePath('/settings/resources');
  return { success: true };
}

export async function deleteResource(resourceId: string) {
  const parsed = uuidSchema.safeParse(resourceId);
  if (!parsed.success) {
    return { error: 'Invalid resource ID' };
  }

  const supabase = await createClient();

  // First, get the resource to check if it has an uploaded file
  const { data: resource } = await supabase
    .from('resources')
    .select('file_path, is_uploaded')
    .eq('id', parsed.data)
    .single();

  // Delete the file from storage if it exists
  if (resource?.is_uploaded && resource?.file_path) {
    const { error: storageError } = await supabase.storage
      .from('resources')
      .remove([resource.file_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with resource deletion even if file deletion fails
    }
  }

  // Delete the resource record
  const { error } = await supabase.from('resources').delete().eq('id', parsed.data);

  if (error) {
    if (error.code === '42501') {
      return { error: 'Only admins can delete resources' };
    }
    return { error: 'Failed to delete resource' };
  }

  revalidatePath('/settings/resources');
  return { success: true };
}

export async function deleteResourceFile(filePath: string) {
  const supabase = await createClient();

  const { error } = await supabase.storage.from('resources').remove([filePath]);

  if (error) {
    return { error: 'Failed to delete file' };
  }

  return { success: true };
}
