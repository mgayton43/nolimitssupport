'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PromoCode, DiscountType, PromoSource } from '@/lib/supabase/types';

export interface CreatePromoCodeInput {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active?: boolean;
  is_stackable?: boolean;
  applies_to?: string;
  source?: PromoSource;
  source_details?: string;
  expiration_date?: string;
  brand_id?: string;
}

export interface UpdatePromoCodeInput extends Partial<CreatePromoCodeInput> {
  id: string;
}

export async function getPromoCodes(options?: {
  is_active?: boolean;
  source?: PromoSource;
  brand_id?: string;
  search?: string;
}): Promise<{ promoCodes: PromoCode[] } | { error: string }> {
  const supabase = await createClient();

  let query = supabase
    .from('promo_codes')
    .select('*, brand:brands(id, name, color)')
    .order('created_at', { ascending: false });

  if (options?.is_active !== undefined) {
    query = query.eq('is_active', options.is_active);
  }

  if (options?.source) {
    query = query.eq('source', options.source);
  }

  if (options?.brand_id) {
    query = query.eq('brand_id', options.brand_id);
  }

  if (options?.search) {
    query = query.ilike('code', `%${options.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { error: 'Failed to fetch promo codes' };
  }

  return { promoCodes: data as PromoCode[] };
}

export async function getPromoCode(id: string): Promise<{ promoCode: PromoCode } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*, brand:brands(id, name, color)')
    .eq('id', id)
    .single();

  if (error) {
    return { error: 'Promo code not found' };
  }

  return { promoCode: data as PromoCode };
}

export async function createPromoCode(input: CreatePromoCodeInput): Promise<{ promoCode: PromoCode } | { error: string }> {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Only admins can create promo codes' };
  }

  const { data, error } = await supabase
    .from('promo_codes')
    .insert({
      code: input.code.toUpperCase(),
      description: input.description || null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      is_active: input.is_active ?? true,
      is_stackable: input.is_stackable ?? false,
      applies_to: input.applies_to || 'all',
      source: input.source || null,
      source_details: input.source_details || null,
      expiration_date: input.expiration_date || null,
      brand_id: input.brand_id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: 'Failed to create promo code' };
  }

  revalidatePath('/settings/promo-codes');
  return { promoCode: data as PromoCode };
}

export async function updatePromoCode(input: UpdatePromoCodeInput): Promise<{ promoCode: PromoCode } | { error: string }> {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Only admins can update promo codes' };
  }

  const { id, ...updateData } = input;

  // Uppercase the code if provided
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase();
  }

  const { data, error } = await supabase
    .from('promo_codes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { error: 'Failed to update promo code' };
  }

  revalidatePath('/settings/promo-codes');
  return { promoCode: data as PromoCode };
}

export async function deletePromoCode(id: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Only admins can delete promo codes' };
  }

  const { error } = await supabase
    .from('promo_codes')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: 'Failed to delete promo code' };
  }

  revalidatePath('/settings/promo-codes');
  return { success: true };
}
