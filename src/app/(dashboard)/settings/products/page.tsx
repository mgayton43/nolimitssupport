import { Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { ProductList } from '@/components/settings/product-list';
import { getProducts } from '@/lib/actions/products';
import { createClient } from '@/lib/supabase/server';
import { Loader2 } from 'lucide-react';

async function ProductsContent() {
  const [productsResult, supabase] = await Promise.all([
    getProducts(),
    createClient(),
  ]);

  const { data: brands } = await supabase.from('brands').select('id, name, color');

  if ('error' in productsResult) {
    return (
      <div className="p-6 text-red-500">
        {productsResult.error}
      </div>
    );
  }

  return (
    <ProductList
      products={productsResult.products}
      brands={brands || []}
    />
  );
}

export default function ProductsPage() {
  return (
    <div className="flex h-full flex-col">
      <Header title="Products" />
      <div className="flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          }
        >
          <ProductsContent />
        </Suspense>
      </div>
    </div>
  );
}
