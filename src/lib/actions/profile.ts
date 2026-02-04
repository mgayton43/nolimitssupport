'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  updateProfileSchema,
  updateUserRoleSchema,
  updateUserTeamSchema,
  toggleUserActiveSchema,
  type UpdateProfileInput,
  type UpdateUserRoleInput,
  type UpdateUserTeamInput,
} from '@/lib/validations';

export async function updateProfile(input: UpdateProfileInput) {
  const parsed = updateProfileSchema.safeParse(input);
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

  const updateData: Partial<UpdateProfileInput> = {};
  if (parsed.data.full_name !== undefined) updateData.full_name = parsed.data.full_name;

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    return { error: 'Failed to update profile' };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function updateUserRole(input: UpdateUserRoleInput) {
  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  // Check if current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    return { error: 'Only admins can change user roles' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId);

  if (error) {
    return { error: 'Failed to update user role' };
  }

  revalidatePath('/settings/users');
  return { success: true };
}

export async function updateUserTeam(input: UpdateUserTeamInput) {
  const parsed = updateUserTeamSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ team_id: parsed.data.teamId })
    .eq('id', parsed.data.userId);

  if (error) {
    return { error: 'Failed to update user team' };
  }

  revalidatePath('/settings/users');
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const parsed = toggleUserActiveSchema.safeParse({ userId, isActive });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.userId);

  if (error) {
    return { error: 'Failed to update user status' };
  }

  revalidatePath('/settings/users');
  return { success: true };
}
