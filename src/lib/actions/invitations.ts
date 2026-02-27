'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { inviteUserSchema, type InviteUserInput } from '@/lib/validations';
import type { UserInvitation } from '@/lib/supabase/types';

export async function getInvitations(): Promise<{ invitations: UserInvitation[] } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_invitations')
    .select('*, inviter:profiles!user_invitations_invited_by_fkey(id, full_name, email)')
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get invitations error:', error);
    return { error: 'Failed to fetch invitations' };
  }

  return { invitations: data as UserInvitation[] };
}

export async function inviteUser(input: InviteUserInput): Promise<{ invitation: UserInvitation } | { error: string }> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    return { error: 'Only admins can invite users' };
  }

  // Check if email already exists as a user
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email.toLowerCase())
    .single();

  if (existingProfile) {
    return { error: 'A user with this email already exists' };
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvite } = await supabase
    .from('user_invitations')
    .select('id')
    .eq('email', parsed.data.email.toLowerCase())
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (existingInvite) {
    return { error: 'A pending invitation already exists for this email' };
  }

  // Use Supabase Auth admin API to invite user
  const { data: authData, error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
    parsed.data.email.toLowerCase(),
    {
      data: {
        full_name: parsed.data.full_name || '',
        role: parsed.data.role,
      },
    }
  );

  if (authError) {
    console.error('Auth invite error:', authError);
    return { error: authError.message || 'Failed to send invitation' };
  }

  // Create invitation record
  const { data: invitation, error: inviteError } = await supabase
    .from('user_invitations')
    .insert({
      email: parsed.data.email.toLowerCase(),
      full_name: parsed.data.full_name || null,
      role: parsed.data.role,
      invited_by: user.id,
      token: authData.user?.id || null,
    })
    .select('*, inviter:profiles!user_invitations_invited_by_fkey(id, full_name, email)')
    .single();

  if (inviteError) {
    console.error('Create invitation record error:', inviteError);
    return { error: 'Failed to create invitation record' };
  }

  revalidatePath('/settings/users');
  return { invitation: invitation as UserInvitation };
}

export async function resendInvite(invitationId: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    return { error: 'Only admins can resend invitations' };
  }

  // Get the invitation
  const { data: invitation, error: fetchError } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();

  if (fetchError || !invitation) {
    return { error: 'Invitation not found' };
  }

  if (invitation.accepted_at || invitation.revoked_at) {
    return { error: 'This invitation is no longer active' };
  }

  // Resend the invitation via Supabase Auth
  const { error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
    invitation.email,
    {
      data: {
        full_name: invitation.full_name || '',
        role: invitation.role,
      },
    }
  );

  if (authError) {
    console.error('Resend invite error:', authError);
    return { error: authError.message || 'Failed to resend invitation' };
  }

  // Update the expiration date
  const { error: updateError } = await supabase
    .from('user_invitations')
    .update({
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', invitationId);

  if (updateError) {
    console.error('Update invitation error:', updateError);
  }

  revalidatePath('/settings/users');
  return { success: true };
}

export async function revokeInvite(invitationId: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    return { error: 'Only admins can revoke invitations' };
  }

  const { error } = await supabase
    .from('user_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) {
    console.error('Revoke invitation error:', error);
    return { error: 'Failed to revoke invitation' };
  }

  revalidatePath('/settings/users');
  return { success: true };
}
