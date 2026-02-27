'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Product, ProductAvailability, StockStatus } from '@/lib/supabase/types';

export interface CreateProductInput {
  sku: string;
  name: string;
  image_url?: string;
  whats_included?: string;
  retail_price?: number;
  discounted_price?: number;
  availability?: ProductAvailability;
  stock_status?: StockStatus;
  notes?: string;
  brand_id?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export async function getProducts(options?: {
  stock_status?: StockStatus;
  availability?: ProductAvailability;
  brand_id?: string;
  search?: string;
}): Promise<{ products: Product[] } | { error: string }> {
  const supabase = await createClient();

  let query = supabase
    .from('products')
    .select('*, brand:brands(id, name, color)')
    .order('name', { ascending: true });

  if (options?.stock_status) {
    query = query.eq('stock_status', options.stock_status);
  }

  if (options?.availability) {
    query = query.eq('availability', options.availability);
  }

  if (options?.brand_id) {
    query = query.eq('brand_id', options.brand_id);
  }

  if (options?.search) {
    query = query.or(`sku.ilike.%${options.search}%,name.ilike.%${options.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { error: 'Failed to fetch products' };
  }

  return { products: data as Product[] };
}

export async function getProduct(id: string): Promise<{ product: Product } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id, name, color)')
    .eq('id', id)
    .single();

  if (error) {
    return { error: 'Product not found' };
  }

  return { product: data as Product };
}

export async function createProduct(input: CreateProductInput): Promise<{ product: Product } | { error: string }> {
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
    return { error: 'Only admins can create products' };
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      sku: input.sku.toUpperCase(),
      name: input.name,
      image_url: input.image_url || null,
      whats_included: input.whats_included || null,
      retail_price: input.retail_price || null,
      discounted_price: input.discounted_price || null,
      availability: input.availability || 'us_and_canada',
      stock_status: input.stock_status || 'in_stock',
      notes: input.notes || null,
      brand_id: input.brand_id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A product with this SKU already exists' };
    }
    return { error: 'Failed to create product' };
  }

  revalidatePath('/settings/products');
  return { product: data as Product };
}

export async function updateProduct(input: UpdateProductInput): Promise<{ product: Product } | { error: string }> {
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
    return { error: 'Only admins can update products' };
  }

  const { id, ...updateData } = input;

  // Uppercase the SKU if provided
  if (updateData.sku) {
    updateData.sku = updateData.sku.toUpperCase();
  }

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A product with this SKU already exists' };
    }
    return { error: 'Failed to update product' };
  }

  revalidatePath('/settings/products');
  return { product: data as Product };
}

export async function deleteProduct(id: string): Promise<{ success: boolean } | { error: string }> {
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
    return { error: 'Only admins can delete products' };
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: 'Failed to delete product' };
  }

  revalidatePath('/settings/products');
  return { success: true };
}
