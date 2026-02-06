import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { ImportWizard } from '@/components/settings/import-wizard';
import { getBrands } from '@/lib/actions/brands';

export default async function ImportPage() {
  const supabase = await createClient();

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();

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

  // Fetch brands for the brand selector
  const { brands } = await getBrands();

  return (
    <div className="flex h-full flex-col">
      <Header title="Import from Gorgias" />

      <div className="flex-1 overflow-auto p-6">
        <ImportWizard brands={brands} />
      </div>
    </div>
  );
}
