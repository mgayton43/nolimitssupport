'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { inviteUserSchema, type InviteUserInput } from '@/lib/validations';
import type { UserInvitation } from '@/lib/supabase/types';

export async function getInvitations(): Promise<{ invitations: UserInvitation[] } | { error: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_invitations')
      .select('*, inviter:profiles!user_invitations_invited_by_fkey(id, full_name, email)')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet if migration hasn't been applied
      if (error.code === '42P01') {
        return { invitations: [] };
      }
      console.error('Get invitations error:', error);
      return { invitations: [] };
    }

    return { invitations: data as UserInvitation[] };
  } catch {
    // Silently handle errors - table might not exist
    return { invitations: [] };
  }
}

export async function inviteUser(input: InviteUserInput): Promise<{ invitation: UserInvitation } | { error: string }> {
  try {
    console.log('[inviteUser] Starting invitation process for:', input.email);

    const parsed = inviteUserSchema.safeParse(input);
    if (!parsed.success) {
      console.log('[inviteUser] Validation failed:', parsed.error.issues);
      return { error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    console.log('[inviteUser] Creating Supabase clients...');
    const supabase = await createClient();

    let serviceClient;
    try {
      serviceClient = await createServiceClient();
      console.log('[inviteUser] Service client created successfully');
    } catch (serviceError) {
      console.error('[inviteUser] Failed to create service client:', serviceError);
      return { error: 'Server configuration error - service role key may be missing' };
    }

    // Check if current user is admin
    console.log('[inviteUser] Checking current user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[inviteUser] Auth error:', JSON.stringify(userError, null, 2));
      return { error: 'Authentication error: ' + userError.message };
    }
    if (!user) {
      console.log('[inviteUser] No user found');
      return { error: 'Not authenticated' };
    }
    console.log('[inviteUser] Current user:', user.id);

    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[inviteUser] Profile fetch error:', JSON.stringify(profileError, null, 2));
      return { error: 'Failed to fetch your profile' };
    }

    if (currentProfile?.role !== 'admin') {
      console.log('[inviteUser] User is not admin:', currentProfile?.role);
      return { error: 'Only admins can invite users' };
    }

    // Check if email already exists as a user
    console.log('[inviteUser] Checking if email already exists...');
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', parsed.data.email.toLowerCase())
      .single();

    if (existingProfile) {
      console.log('[inviteUser] Email already exists as user');
      return { error: 'A user with this email already exists' };
    }

    // Check if there's already a pending invitation for this email
    console.log('[inviteUser] Checking for existing invitation...');
    try {
      const { data: existingInvite } = await supabase
        .from('user_invitations')
        .select('id')
        .eq('email', parsed.data.email.toLowerCase())
        .is('accepted_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingInvite) {
        console.log('[inviteUser] Pending invitation already exists');
        return { error: 'A pending invitation already exists for this email' };
      }
    } catch {
      // Table might not exist, continue anyway
      console.log('[inviteUser] user_invitations table may not exist, continuing...');
    }

    // Use Supabase Auth admin API to invite user
    // The redirectTo URL MUST include the full path
    const redirectTo = 'https://nolimitssupport-tsyd.vercel.app/auth/set-password';

    console.log('[inviteUser] Calling inviteUserByEmail with redirectTo:', redirectTo);
    const { data: authData, error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
      parsed.data.email.toLowerCase(),
      {
        data: {
          full_name: parsed.data.full_name || '',
          role: parsed.data.role,
        },
        redirectTo,
      }
    );

    if (authError) {
      console.error('[inviteUser] Auth invite error - Full details:');
      console.error('  Message:', authError.message);
      console.error('  Status:', authError.status);
      console.error('  Name:', authError.name);
      console.error('  Full error:', JSON.stringify(authError, null, 2));

      // Provide more specific error messages
      if (authError.message?.includes('already registered')) {
        return { error: 'This email is already registered in auth system' };
      }
      if (authError.message?.includes('Database error')) {
        return { error: `Database error: ${authError.message}. Check if handle_new_user trigger is working.` };
      }
      return { error: `Auth error: ${authError.message}` };
    }

    console.log('[inviteUser] Auth invite successful, user ID:', authData.user?.id);

    // Create invitation record using service client to bypass RLS
    console.log('[inviteUser] Creating invitation record...');
    const { data: invitation, error: inviteError } = await serviceClient
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
      console.error('[inviteUser] Invitation record error - Full details:');
      console.error('  Message:', inviteError.message);
      console.error('  Code:', inviteError.code);
      console.error('  Details:', inviteError.details);
      console.error('  Hint:', inviteError.hint);
      console.error('  Full error:', JSON.stringify(inviteError, null, 2));

      // The auth user was created but we failed to record it - still a partial success
      return { error: `Invitation sent but failed to record: ${inviteError.message}` };
    }

    console.log('[inviteUser] Invitation created successfully:', invitation.id);
    revalidatePath('/settings/users');
    return { invitation: invitation as UserInvitation };

  } catch (error) {
    console.error('[inviteUser] Unexpected error:');
    console.error('  Type:', typeof error);
    console.error('  Message:', error instanceof Error ? error.message : String(error));
    console.error('  Stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('  Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2));

    return { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
  }
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
  const redirectTo = 'https://nolimitssupport-tsyd.vercel.app/auth/set-password';
  const { error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
    invitation.email,
    {
      data: {
        full_name: invitation.full_name || '',
        role: invitation.role,
      },
      redirectTo,
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
