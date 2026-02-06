/**
 * Script to create a test agent account for collision detection testing
 * Run with: npx tsx scripts/create-test-agent.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestAgent() {
  const email = 'testagent@strikeman.io';
  const password = 'TestAgent123!';
  const fullName = 'Alex T.';

  console.log('Creating test agent account...');

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);

  if (existingUser) {
    console.log('User already exists. Updating password and profile...');

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
    });

    if (updateError) {
      console.error('Failed to update password:', updateError.message);
    } else {
      console.log('Password updated.');
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role: 'agent', is_active: true })
      .eq('id', existingUser.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError.message);
    } else {
      console.log('Profile updated.');
    }

    console.log('\n✅ Test agent account ready!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    return;
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }

  console.log('Auth user created:', data.user.id);

  // Update the profile with agent role
  // Small delay to ensure the profile trigger has run
  await new Promise(resolve => setTimeout(resolve, 1000));

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role: 'agent', is_active: true })
    .eq('id', data.user.id);

  if (profileError) {
    console.error('Failed to update profile:', profileError.message);
  } else {
    console.log('Profile updated with agent role.');
  }

  console.log('\n✅ Test agent account created!');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Name: ${fullName}`);
  console.log(`   Role: agent`);
}

createTestAgent().catch(console.error);
