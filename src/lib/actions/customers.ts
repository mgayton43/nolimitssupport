'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createCustomerSchema,
  updateCustomerSchema,
  uuidSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from '@/lib/validations';

export async function createCustomer(input: CreateCustomerInput) {
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      email: parsed.data.email,
      full_name: parsed.data.full_name || null,
      phone: parsed.data.phone || null,
      metadata: parsed.data.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A customer with this email already exists' };
    }
    return { error: 'Failed to create customer' };
  }

  revalidatePath('/customers');
  return { customerId: customer.id };
}

export async function updateCustomer(input: UpdateCustomerInput) {
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const supabase = await createClient();

  const updateData: Partial<Omit<UpdateCustomerInput, 'id'>> = {};
  if (parsed.data.full_name !== undefined) updateData.full_name = parsed.data.full_name;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.metadata !== undefined) updateData.metadata = parsed.data.metadata;

  const { error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', parsed.data.id);

  if (error) {
    return { error: 'Failed to update customer' };
  }

  revalidatePath(`/customers/${parsed.data.id}`);
  revalidatePath('/customers');
  return { success: true };
}

export async function deleteCustomer(customerId: string) {
  const parsed = uuidSchema.safeParse(customerId);
  if (!parsed.success) {
    return { error: 'Invalid customer ID' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    return { error: 'Failed to delete customer' };
  }

  revalidatePath('/customers');
  return { success: true };
}
