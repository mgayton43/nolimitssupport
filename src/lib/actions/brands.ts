'use server';

import { createClient } from '@/lib/supabase/server';
import type { Brand } from '@/lib/supabase/types';

export async function getBrands(): Promise<{ brands: Brand[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .order('name');

    if (error) {
      // Table might not exist yet - return empty array gracefully
      if (error.code === 'PGRST205' || error.message?.includes('Could not find')) {
        return { brands: [] };
      }
      console.error('Error fetching brands:', error);
      return { brands: [], error: 'Failed to fetch brands' };
    }

    return { brands: brands || [] };
  } catch {
    // Table doesn't exist yet
    return { brands: [] };
  }
}

export async function getBrandBySlug(slug: string): Promise<{ brand: Brand | null; error?: string }> {
  const supabase = await createClient();

  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    return { brand: null, error: 'Brand not found' };
  }

  return { brand };
}

export async function getBrandByEmail(email: string): Promise<{ brand: Brand | null; error?: string }> {
  const supabase = await createClient();

  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('email_address', email)
    .single();

  if (error) {
    return { brand: null };
  }

  return { brand };
}
