'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TicketStatus, TicketPriority, TicketChannel } from '@/lib/supabase/types';

// Types for import
export interface GorgiasTicketRow {
  externalId: string;
  subject: string;
  status: string;
  priority: string;
  customerEmail: string;
  customerName: string;
  assigneeEmail: string;
  tags: string;
  createdAt: string;
  channel: string;
  messages: GorgiasMessage[];
}

export interface GorgiasMessage {
  senderType: 'customer' | 'agent';
  senderEmail: string;
  content: string;
  createdAt: string;
  isInternal: boolean;
}

export interface ImportOptions {
  brandId: string | null;
  onlyOpenPending: boolean;
  includeClosedDays: number | null;
  fieldMapping: Record<string, string>;
}

export interface ImportResult {
  success: boolean;
  ticketsImported: number;
  customersCreated: number;
  tagsCreated: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  externalId: string;
  error: string;
}

// Helper to normalize status
function normalizeStatus(status: string): TicketStatus {
  const normalized = status.toLowerCase().trim();
  if (normalized === 'open') return 'open';
  if (normalized === 'pending' || normalized === 'waiting') return 'pending';
  if (normalized === 'closed' || normalized === 'solved' || normalized === 'resolved') return 'closed';
  return 'open'; // Default to open
}

// Helper to normalize priority
function normalizePriority(priority: string): TicketPriority {
  const normalized = priority.toLowerCase().trim();
  if (normalized === 'low') return 'low';
  if (normalized === 'medium' || normalized === 'normal') return 'medium';
  if (normalized === 'high') return 'high';
  if (normalized === 'urgent' || normalized === 'critical') return 'urgent';
  return 'medium'; // Default to medium
}

// Helper to normalize channel
function normalizeChannel(channel: string): TicketChannel {
  const normalized = channel.toLowerCase().trim();
  if (normalized === 'email' || normalized === 'mail') return 'email';
  if (normalized === 'facebook' || normalized === 'fb' || normalized === 'facebook-messenger') return 'facebook';
  if (normalized === 'instagram' || normalized === 'ig') return 'instagram';
  return 'manual';
}

// Helper to parse date
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

// Check if ticket should be imported based on filters
function shouldImportTicket(
  row: GorgiasTicketRow,
  options: ImportOptions
): boolean {
  const status = normalizeStatus(row.status);

  // Always import open/pending tickets if that option is selected
  if (options.onlyOpenPending && (status === 'open' || status === 'pending')) {
    return true;
  }

  // Check closed tickets against date filter
  if (status === 'closed') {
    if (!options.includeClosedDays) return false;

    const createdAt = parseDate(row.createdAt);
    if (!createdAt) return false;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.includeClosedDays);

    return new Date(createdAt) >= cutoffDate;
  }

  return !options.onlyOpenPending;
}

export async function importTickets(
  tickets: GorgiasTicketRow[],
  options: ImportOptions
): Promise<ImportResult> {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, ticketsImported: 0, customersCreated: 0, tagsCreated: 0, errors: [{ row: 0, externalId: '', error: 'Not authenticated' }] };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, ticketsImported: 0, customersCreated: 0, tagsCreated: 0, errors: [{ row: 0, externalId: '', error: 'Only admins can import tickets' }] };
  }

  // Get all agents for assignee lookup
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, email')
    .in('role', ['admin', 'agent']);

  const agentsByEmail = new Map(
    (agents || []).map(a => [a.email.toLowerCase(), a.id])
  );

  // Get existing tags
  const { data: existingTags } = await supabase
    .from('tags')
    .select('id, name');

  const tagsByName = new Map(
    (existingTags || []).map(t => [t.name.toLowerCase(), t.id])
  );

  // Get existing customers by email
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('id, email');

  const customersByEmail = new Map(
    (existingCustomers || []).map(c => [c.email.toLowerCase(), c.id])
  );

  // Check for already imported tickets
  const externalIds = tickets.map(t => t.externalId).filter(Boolean);
  const { data: existingImports } = await supabase
    .from('tickets')
    .select('external_id')
    .in('external_id', externalIds);

  const alreadyImported = new Set(
    (existingImports || []).map(t => t.external_id)
  );

  const result: ImportResult = {
    success: true,
    ticketsImported: 0,
    customersCreated: 0,
    tagsCreated: 0,
    errors: [],
  };

  const importedAt = new Date().toISOString();

  for (let i = 0; i < tickets.length; i++) {
    const row = tickets[i];
    const rowNum = i + 1;

    try {
      // Skip if already imported
      if (row.externalId && alreadyImported.has(row.externalId)) {
        result.errors.push({
          row: rowNum,
          externalId: row.externalId,
          error: 'Ticket already imported',
        });
        continue;
      }

      // Check if ticket should be imported based on filters
      if (!shouldImportTicket(row, options)) {
        continue;
      }

      // Validate required fields
      if (!row.customerEmail) {
        result.errors.push({
          row: rowNum,
          externalId: row.externalId,
          error: 'Missing customer email',
        });
        continue;
      }

      if (!row.subject) {
        result.errors.push({
          row: rowNum,
          externalId: row.externalId,
          error: 'Missing subject',
        });
        continue;
      }

      // Find or create customer
      let customerId = customersByEmail.get(row.customerEmail.toLowerCase());

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            email: row.customerEmail.toLowerCase(),
            full_name: row.customerName || null,
          })
          .select('id')
          .single();

        if (customerError || !newCustomer) {
          result.errors.push({
            row: rowNum,
            externalId: row.externalId,
            error: `Failed to create customer: ${customerError?.message || 'Unknown error'}`,
          });
          continue;
        }

        customerId = newCustomer.id;
        customersByEmail.set(row.customerEmail.toLowerCase(), customerId);
        result.customersCreated++;
      }

      // Find assignee (optional)
      let assigneeId: string | null = null;
      if (row.assigneeEmail) {
        assigneeId = agentsByEmail.get(row.assigneeEmail.toLowerCase()) || null;
      }

      // Parse tags and create if needed
      const tagIds: string[] = [];
      if (row.tags) {
        const tagNames = row.tags.split(',').map(t => t.trim()).filter(Boolean);

        for (const tagName of tagNames) {
          let tagId = tagsByName.get(tagName.toLowerCase());

          if (!tagId) {
            // Create new tag
            const { data: newTag, error: tagError } = await supabase
              .from('tags')
              .insert({ name: tagName })
              .select('id')
              .single();

            if (!tagError && newTag) {
              tagId = newTag.id;
              tagsByName.set(tagName.toLowerCase(), tagId);
              result.tagsCreated++;
            }
          }

          if (tagId) {
            tagIds.push(tagId);
          }
        }
      }

      // Create ticket
      const createdAt = parseDate(row.createdAt) || new Date().toISOString();
      const status = normalizeStatus(row.status);

      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          subject: row.subject,
          status,
          priority: normalizePriority(row.priority),
          channel: normalizeChannel(row.channel),
          customer_id: customerId,
          assigned_agent_id: assigneeId,
          brand_id: options.brandId,
          external_id: row.externalId || null,
          imported_at: importedAt,
          created_at: createdAt,
          resolved_at: status === 'closed' ? createdAt : null,
        })
        .select('id')
        .single();

      if (ticketError || !newTicket) {
        result.errors.push({
          row: rowNum,
          externalId: row.externalId,
          error: `Failed to create ticket: ${ticketError?.message || 'Unknown error'}`,
        });
        continue;
      }

      // Add tags to ticket
      if (tagIds.length > 0) {
        const ticketTags = tagIds.map(tagId => ({
          ticket_id: newTicket.id,
          tag_id: tagId,
        }));

        await supabase
          .from('ticket_tags')
          .insert(ticketTags);
      }

      // Create messages
      if (row.messages && row.messages.length > 0) {
        for (const msg of row.messages) {
          const msgCreatedAt = parseDate(msg.createdAt) || createdAt;

          // Determine sender_id based on sender type
          let senderId: string | null = null;
          if (msg.senderType === 'customer') {
            senderId = customerId;
          } else if (msg.senderEmail) {
            senderId = agentsByEmail.get(msg.senderEmail.toLowerCase()) || null;
          }

          await supabase
            .from('messages')
            .insert({
              ticket_id: newTicket.id,
              sender_type: msg.senderType,
              sender_id: senderId,
              content: msg.content,
              is_internal: msg.isInternal || false,
              source: 'reply',
              created_at: msgCreatedAt,
            });
        }
      }

      result.ticketsImported++;

      // Mark external_id as imported to prevent duplicates within this batch
      if (row.externalId) {
        alreadyImported.add(row.externalId);
      }

    } catch (err) {
      result.errors.push({
        row: rowNum,
        externalId: row.externalId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  revalidatePath('/tickets');
  revalidatePath('/settings/import');

  return result;
}

// Get count of tickets that would be imported with given options
export async function previewImportCount(
  tickets: GorgiasTicketRow[],
  options: ImportOptions
): Promise<{ total: number; toImport: number; alreadyImported: number }> {
  const supabase = await createClient();

  // Check for already imported tickets
  const externalIds = tickets.map(t => t.externalId).filter(Boolean);
  const { data: existingImports } = await supabase
    .from('tickets')
    .select('external_id')
    .in('external_id', externalIds);

  const alreadyImported = new Set(
    (existingImports || []).map(t => t.external_id)
  );

  let toImport = 0;
  let alreadyImportedCount = 0;

  for (const row of tickets) {
    if (row.externalId && alreadyImported.has(row.externalId)) {
      alreadyImportedCount++;
      continue;
    }

    if (shouldImportTicket(row, options)) {
      toImport++;
    }
  }

  return {
    total: tickets.length,
    toImport,
    alreadyImported: alreadyImportedCount,
  };
}
