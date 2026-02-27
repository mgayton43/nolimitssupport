import { Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { PromoCodeList } from '@/components/settings/promo-code-list';
import { getPromoCodes } from '@/lib/actions/promo-codes';
import { createClient } from '@/lib/supabase/server';
import { Loader2 } from 'lucide-react';

async function PromoCodesContent() {
  const [promoCodesResult, supabase] = await Promise.all([
    getPromoCodes(),
    createClient(),
  ]);

  const { data: brands } = await supabase.from('brands').select('id, name, color');

  if ('error' in promoCodesResult) {
    return (
      <div className="p-6 text-red-500">
        {promoCodesResult.error}
      </div>
    );
  }

  return (
    <PromoCodeList
      promoCodes={promoCodesResult.promoCodes}
      brands={brands || []}
    />
  );
}

export default function PromoCodesPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Promo Codes" />
      <div className="flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          }
        >
          <PromoCodesContent />
        </Suspense>
      </div>
    </div>
  );
}
