import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseEmailAddress, getBrandIdFromEmail } from '@/lib/email';

// Use service role client for API routes (no RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InboundEmailData {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: string;
  envelope?: string;
  attachments?: number;
  'attachment-info'?: string;
}

/**
 * Extract Message-ID and References from email headers
 */
function parseEmailHeaders(headersString: string): {
  messageId: string | null;
  references: string | null;
  inReplyTo: string | null;
} {
  const result = { messageId: null as string | null, references: null as string | null, inReplyTo: null as string | null };

  if (!headersString) return result;

  const lines = headersString.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('message-id:')) {
      result.messageId = line.substring('message-id:'.length).trim();
    } else if (lowerLine.startsWith('references:')) {
      result.references = line.substring('references:'.length).trim();
    } else if (lowerLine.startsWith('in-reply-to:')) {
      result.inReplyTo = line.substring('in-reply-to:'.length).trim();
    }
  }

  return result;
}

/**
 * Find existing ticket by reference IDs (for email threading)
 */
async function findTicketByReference(
  customerEmail: string,
  references: string | null,
  inReplyTo: string | null
): Promise<{ id: string; ticket_number: number; subject: string; reference_id: string | null } | null> {
  // First, try to find by In-Reply-To or References header
  const refIds = [inReplyTo, ...(references?.split(/\s+/) || [])].filter(Boolean);

  for (const refId of refIds) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, reference_id')
      .eq('reference_id', refId)
      .single();

    if (ticket) return ticket;
  }

  // Fallback: Find most recent open ticket from this customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (customer) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, reference_id')
      .eq('customer_id', customer.id)
      .in('status', ['open', 'pending'])
      .eq('channel', 'email')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (ticket) return ticket;
  }

  return null;
}

/**
 * Get or create customer by email
 */
async function getOrCreateCustomer(email: string, name: string | null): Promise<string> {
  // Try to find existing customer
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) return existing.id;

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      email,
      full_name: name,
      metadata: {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create customer:', error);
    throw new Error('Failed to create customer');
  }

  return newCustomer.id;
}

/**
 * Apply auto-tagging rules to a ticket
 */
async function applyAutoTagRules(ticketId: string, subject: string, body: string) {
  try {
    const { data, error } = await supabase.rpc('apply_auto_tags', {
      p_ticket_id: ticketId,
      p_subject: subject,
      p_body: body,
    });

    if (error) {
      console.error('Auto-tag error:', error);
    } else {
      console.log('Applied auto tags:', data);
    }
  } catch (err) {
    console.error('Auto-tag exception:', err);
  }
}

/**
 * Apply auto-priority rules to a ticket
 */
async function applyAutoPriorityRules(ticketId: string, subject: string, body: string) {
  try {
    // Get active priority rules
    const { data: rules } = await supabase
      .from('auto_priority_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false }); // Higher priority rules first

    if (!rules || rules.length === 0) return;

    const searchText = `${subject} ${body}`.toLowerCase();

    for (const rule of rules) {
      const keywords = rule.keywords as string[];
      const matchAll = rule.match_type === 'all';

      let isMatch = false;
      if (matchAll) {
        isMatch = keywords.every(kw => searchText.includes(kw.toLowerCase()));
      } else {
        isMatch = keywords.some(kw => searchText.includes(kw.toLowerCase()));
      }

      if (isMatch) {
        // Apply this priority
        await supabase
          .from('tickets')
          .update({ priority: rule.target_priority })
          .eq('id', ticketId);

        console.log(`Applied priority ${rule.target_priority} from rule ${rule.name}`);
        break; // Only apply the first matching rule
      }
    }
  } catch (err) {
    console.error('Auto-priority exception:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Inbound email webhook received');

    // Parse form data from SendGrid
    const formData = await request.formData();
    const data: InboundEmailData = {
      from: formData.get('from') as string || '',
      to: formData.get('to') as string || '',
      subject: formData.get('subject') as string || '(No Subject)',
      text: formData.get('text') as string || undefined,
      html: formData.get('html') as string || undefined,
      headers: formData.get('headers') as string || undefined,
      envelope: formData.get('envelope') as string || undefined,
      attachments: parseInt(formData.get('attachments') as string || '0', 10),
      'attachment-info': formData.get('attachment-info') as string || undefined,
    };

    console.log('Email from:', data.from);
    console.log('Email to:', data.to);
    console.log('Subject:', data.subject);

    // Parse sender email
    const { email: customerEmail, name: customerName } = parseEmailAddress(data.from);
    console.log('Customer email:', customerEmail, 'Name:', customerName);

    // Parse email headers for threading
    const headers = parseEmailHeaders(data.headers || '');
    console.log('Email headers:', headers);

    // Get the email content (prefer text over html for storage)
    const emailContent = data.text ||
      (data.html ? data.html.replace(/<[^>]*>/g, '') : '(No content)');

    // Determine brand from recipient email
    const toEmail = data.to.includes(',') ? data.to.split(',')[0] : data.to;
    const { email: recipientEmail } = parseEmailAddress(toEmail);
    const brandId = await getBrandIdFromEmail(recipientEmail, supabase);
    console.log('Brand ID:', brandId);

    // Check for existing ticket (threading)
    const existingTicket = await findTicketByReference(
      customerEmail,
      headers.references,
      headers.inReplyTo
    );

    if (existingTicket) {
      // Add message to existing ticket
      console.log('Adding to existing ticket:', existingTicket.ticket_number);

      // Get customer ID
      const customerId = await getOrCreateCustomer(customerEmail, customerName);

      // Create message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: existingTicket.id,
          sender_type: 'customer',
          sender_id: customerId,
          content: emailContent,
          is_internal: false,
          source: 'new_email',
          source_email_id: headers.messageId,
          attachments: [],
        });

      if (messageError) {
        console.error('Failed to create message:', messageError);
        return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
      }

      // Update ticket status to open if it was pending/closed
      await supabase
        .from('tickets')
        .update({
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTicket.id);

      // Update reference_id if we got a new message ID
      if (headers.messageId && !existingTicket.reference_id) {
        await supabase
          .from('tickets')
          .update({ reference_id: headers.messageId })
          .eq('id', existingTicket.id);
      }

      console.log('Message added to ticket #', existingTicket.ticket_number);

      return NextResponse.json({
        success: true,
        action: 'message_added',
        ticketNumber: existingTicket.ticket_number
      });
    } else {
      // Create new ticket
      console.log('Creating new ticket');

      // Get or create customer
      const customerId = await getOrCreateCustomer(customerEmail, customerName);

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          subject: data.subject,
          status: 'open',
          priority: 'medium',
          channel: 'email',
          customer_id: customerId,
          brand_id: brandId,
          reference_id: headers.messageId,
        })
        .select('id, ticket_number')
        .single();

      if (ticketError || !ticket) {
        console.error('Failed to create ticket:', ticketError);
        return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
      }

      console.log('Created ticket #', ticket.ticket_number);

      // Create initial message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'customer',
          sender_id: customerId,
          content: emailContent,
          is_internal: false,
          source: 'new_email',
          source_email_id: headers.messageId,
          attachments: [],
        });

      if (messageError) {
        console.error('Failed to create initial message:', messageError);
      }

      // Apply auto-tagging rules
      await applyAutoTagRules(ticket.id, data.subject, emailContent);

      // Apply auto-priority rules
      await applyAutoPriorityRules(ticket.id, data.subject, emailContent);

      console.log('Ticket created successfully: #', ticket.ticket_number);

      return NextResponse.json({
        success: true,
        action: 'ticket_created',
        ticketNumber: ticket.ticket_number
      });
    }
  } catch (err) {
    console.error('Inbound email error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// SendGrid may also send HEAD or GET for verification
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
