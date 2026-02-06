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
      brand_id: parsed.data.brand_id ?? null,
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
  if (parsed.data.brand_id !== undefined) updateData.brand_id = parsed.data.brand_id;

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

export interface BulkCannedResponseInput {
  title: string;
  content: string;
  shortcut?: string;
  category?: string;
}

export interface BulkImportResult {
  success: boolean;
  imported: number;
  errors: { row: number; message: string }[];
}

export async function bulkCreateCannedResponses(
  responses: BulkCannedResponseInput[]
): Promise<BulkImportResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, imported: 0, errors: [{ row: 0, message: 'Not authenticated' }] };
  }

  const errors: { row: number; message: string }[] = [];
  const validResponses: {
    title: string;
    content: string;
    shortcut: string | null;
    category: string | null;
    is_shared: boolean;
    created_by: string;
  }[] = [];

  // Validate each row
  for (let i = 0; i < responses.length; i++) {
    const row = responses[i];
    const rowNum = i + 1; // 1-indexed for user-friendly error messages

    // Skip empty rows
    if (!row.title && !row.content && !row.shortcut && !row.category) {
      continue;
    }

    // Validate title
    if (!row.title || row.title.trim() === '') {
      errors.push({ row: rowNum, message: 'Missing title' });
      continue;
    }

    if (row.title.length > 200) {
      errors.push({ row: rowNum, message: 'Title too long (max 200 characters)' });
      continue;
    }

    // Validate content
    if (!row.content || row.content.trim() === '') {
      errors.push({ row: rowNum, message: 'Missing content' });
      continue;
    }

    // Validate shortcut format
    let shortcut = row.shortcut?.trim() || null;
    if (shortcut) {
      // Remove leading / if present for storage
      if (shortcut.startsWith('/')) {
        shortcut = shortcut.slice(1);
      }
      if (shortcut.length > 50) {
        errors.push({ row: rowNum, message: 'Shortcut too long (max 50 characters)' });
        continue;
      }
    }

    // Category validation
    const category = row.category?.trim() || null;
    if (category && category.length > 100) {
      errors.push({ row: rowNum, message: 'Category too long (max 100 characters)' });
      continue;
    }

    validResponses.push({
      title: row.title.trim(),
      content: row.content.trim(),
      shortcut,
      category,
      is_shared: true,
      created_by: user.id,
    });
  }

  // If no valid responses, return early
  if (validResponses.length === 0) {
    return {
      success: errors.length === 0,
      imported: 0,
      errors: errors.length > 0 ? errors : [{ row: 0, message: 'No valid responses to import' }],
    };
  }

  // Insert all valid responses
  const { error } = await supabase.from('canned_responses').insert(validResponses);

  if (error) {
    return {
      success: false,
      imported: 0,
      errors: [{ row: 0, message: 'Database error: ' + error.message }],
    };
  }

  revalidatePath('/settings/canned-responses');

  return {
    success: true,
    imported: validResponses.length,
    errors,
  };
}
