import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { RulesList } from '@/components/settings/rules-list';

export default async function RulesPage() {
  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/tickets');
  }

  // Fetch rules with tags
  const { data: rules } = await supabase
    .from('auto_tag_rules')
    .select('*, tag:tags(*)')
    .order('name');

  // Fetch tags for the dropdown
  const { data: tags } = await supabase.from('tags').select('*').order('name');

  return (
    <div className="flex h-full flex-col">
      <Header title="Auto-Tagging Rules" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Create rules to automatically apply tags to tickets based on keywords in the subject or
            message body.
          </p>
          <RulesList rules={rules || []} tags={tags || []} />
        </div>
      </div>
    </div>
  );
}
