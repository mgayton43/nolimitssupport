'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TicketPriority } from '@/lib/supabase/types';

export interface AutoPriorityRule {
  id: string;
  name: string;
  keywords: string[];
  priority: TicketPriority;
  match_subject: boolean;
  match_body: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAutoPriorityRuleInput {
  name: string;
  keywords: string[];
  priority: TicketPriority;
  match_subject: boolean;
  match_body: boolean;
  is_active?: boolean;
}

export interface UpdateAutoPriorityRuleInput {
  id: string;
  name?: string;
  keywords?: string[];
  priority?: TicketPriority;
  match_subject?: boolean;
  match_body?: boolean;
  is_active?: boolean;
}

export async function getAutoPriorityRules(): Promise<
  { rules: AutoPriorityRule[] } | { error: string }
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('auto_priority_rules')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    console.error('Get auto priority rules error:', error);
    return { error: 'Failed to fetch auto priority rules' };
  }

  // Sort by priority weight (urgent first)
  const priorityOrder: Record<TicketPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const sortedRules = (data as AutoPriorityRule[]).sort(
    (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
  );

  return { rules: sortedRules };
}

export async function createAutoPriorityRule(
  input: CreateAutoPriorityRuleInput
): Promise<{ rule: AutoPriorityRule } | { error: string }> {
  const supabase = await createClient();

  // Validate input
  if (!input.name.trim()) {
    return { error: 'Rule name is required' };
  }

  if (!input.keywords.length || input.keywords.every((k) => !k.trim())) {
    return { error: 'At least one keyword is required' };
  }

  if (!input.match_subject && !input.match_body) {
    return { error: 'At least one match field (subject or body) must be selected' };
  }

  // Filter out empty keywords
  const keywords = input.keywords.filter((k) => k.trim()).map((k) => k.trim().toLowerCase());

  const { data, error } = await supabase
    .from('auto_priority_rules')
    .insert({
      name: input.name.trim(),
      keywords,
      priority: input.priority,
      match_subject: input.match_subject,
      match_body: input.match_body,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('Create auto priority rule error:', error);
    return { error: 'Failed to create auto priority rule' };
  }

  revalidatePath('/settings/priority-rules');
  return { rule: data as AutoPriorityRule };
}

export async function updateAutoPriorityRule(
  input: UpdateAutoPriorityRuleInput
): Promise<{ rule: AutoPriorityRule } | { error: string }> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      return { error: 'Rule name is required' };
    }
    updateData.name = input.name.trim();
  }

  if (input.keywords !== undefined) {
    if (!input.keywords.length || input.keywords.every((k) => !k.trim())) {
      return { error: 'At least one keyword is required' };
    }
    updateData.keywords = input.keywords.filter((k) => k.trim()).map((k) => k.trim().toLowerCase());
  }

  if (input.priority !== undefined) {
    updateData.priority = input.priority;
  }

  if (input.match_subject !== undefined) {
    updateData.match_subject = input.match_subject;
  }

  if (input.match_body !== undefined) {
    updateData.match_body = input.match_body;
  }

  if (input.is_active !== undefined) {
    updateData.is_active = input.is_active;
  }

  // Validate match fields
  if (
    (input.match_subject !== undefined || input.match_body !== undefined) &&
    input.match_subject === false &&
    input.match_body === false
  ) {
    return { error: 'At least one match field (subject or body) must be selected' };
  }

  const { data, error } = await supabase
    .from('auto_priority_rules')
    .update(updateData)
    .eq('id', input.id)
    .select()
    .single();

  if (error) {
    console.error('Update auto priority rule error:', error);
    return { error: 'Failed to update auto priority rule' };
  }

  revalidatePath('/settings/priority-rules');
  return { rule: data as AutoPriorityRule };
}

export async function deleteAutoPriorityRule(
  id: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from('auto_priority_rules').delete().eq('id', id);

  if (error) {
    console.error('Delete auto priority rule error:', error);
    return { error: 'Failed to delete auto priority rule' };
  }

  revalidatePath('/settings/priority-rules');
  return { success: true };
}

export async function toggleAutoPriorityRule(
  id: string,
  isActive: boolean
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('auto_priority_rules')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    console.error('Toggle auto priority rule error:', error);
    return { error: 'Failed to toggle auto priority rule' };
  }

  revalidatePath('/settings/priority-rules');
  return { success: true };
}
