'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AutoTagRule } from '@/lib/supabase/types';

export interface CreateAutoTagRuleInput {
  name: string;
  keywords: string[];
  tag_id: string;
  match_subject: boolean;
  match_body: boolean;
  is_active: boolean;
}

export interface UpdateAutoTagRuleInput extends Partial<CreateAutoTagRuleInput> {
  id: string;
}

export async function getAutoTagRules(): Promise<{ rules: AutoTagRule[] } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('auto_tag_rules')
    .select('*, tag:tags(*)')
    .order('name');

  if (error) {
    console.error('Get auto tag rules error:', error);
    return { error: 'Failed to fetch rules' };
  }

  return { rules: data || [] };
}

export async function createAutoTagRule(
  input: CreateAutoTagRuleInput
): Promise<{ ruleId: string } | { error: string }> {
  if (!input.name.trim()) {
    return { error: 'Rule name is required' };
  }

  if (input.keywords.length === 0) {
    return { error: 'At least one keyword is required' };
  }

  if (!input.tag_id) {
    return { error: 'Tag is required' };
  }

  if (!input.match_subject && !input.match_body) {
    return { error: 'Must match at least subject or body' };
  }

  const supabase = await createClient();

  // Filter out empty keywords
  const keywords = input.keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const { data, error } = await supabase
    .from('auto_tag_rules')
    .insert({
      name: input.name.trim(),
      keywords,
      tag_id: input.tag_id,
      match_subject: input.match_subject,
      match_body: input.match_body,
      is_active: input.is_active,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Create auto tag rule error:', error);
    return { error: 'Failed to create rule' };
  }

  revalidatePath('/settings/rules');
  return { ruleId: data.id };
}

export async function updateAutoTagRule(
  input: UpdateAutoTagRuleInput
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      return { error: 'Rule name is required' };
    }
    updateData.name = input.name.trim();
  }

  if (input.keywords !== undefined) {
    const keywords = input.keywords
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      return { error: 'At least one keyword is required' };
    }
    updateData.keywords = keywords;
  }

  if (input.tag_id !== undefined) {
    if (!input.tag_id) {
      return { error: 'Tag is required' };
    }
    updateData.tag_id = input.tag_id;
  }

  if (input.match_subject !== undefined) {
    updateData.match_subject = input.match_subject;
  }

  if (input.match_body !== undefined) {
    updateData.match_body = input.match_body;
  }

  // Validate that at least one match option is enabled
  if (input.match_subject !== undefined || input.match_body !== undefined) {
    const matchSubject = input.match_subject ?? true;
    const matchBody = input.match_body ?? true;
    if (!matchSubject && !matchBody) {
      return { error: 'Must match at least subject or body' };
    }
  }

  if (input.is_active !== undefined) {
    updateData.is_active = input.is_active;
  }

  const { error } = await supabase
    .from('auto_tag_rules')
    .update(updateData)
    .eq('id', input.id);

  if (error) {
    console.error('Update auto tag rule error:', error);
    return { error: 'Failed to update rule' };
  }

  revalidatePath('/settings/rules');
  return { success: true };
}

export async function deleteAutoTagRule(
  ruleId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('auto_tag_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    console.error('Delete auto tag rule error:', error);
    return { error: 'Failed to delete rule' };
  }

  revalidatePath('/settings/rules');
  return { success: true };
}

export async function applyAutoTags(
  ticketId: string,
  subject?: string,
  body?: string
): Promise<{ appliedTagIds: string[] } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('apply_auto_tags', {
    p_ticket_id: ticketId,
    p_subject: subject || null,
    p_body: body || null,
  });

  if (error) {
    console.error('Apply auto tags error:', error);
    return { error: 'Failed to apply auto tags' };
  }

  return { appliedTagIds: data || [] };
}
