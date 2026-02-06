import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { PriorityRulesList } from '@/components/settings/priority-rules-list';
import { getAutoPriorityRules } from '@/lib/actions/auto-priority-rules';

export default async function PriorityRulesPage() {
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

  // Fetch rules
  const result = await getAutoPriorityRules();
  const rules = 'rules' in result ? result.rules : [];

  return (
    <div className="flex h-full flex-col">
      <Header title="Priority Rules" />
      <div className="flex-1 overflow-auto">
        <PriorityRulesList rules={rules} />
      </div>
    </div>
  );
}
