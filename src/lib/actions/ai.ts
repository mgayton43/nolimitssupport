'use server';

import { createClient } from '@/lib/supabase/server';
import { callClaude } from '@/lib/ai';
import { getCustomerOrders, type ShopifyOrder } from '@/lib/shopify';
import type { Message, CannedResponse, Resource, Tag } from '@/lib/supabase/types';

interface TicketContext {
  ticketNumber: number;
  subject: string;
  priority: string;
  status: string;
  tags: Tag[];
  customerName: string | null;
  customerEmail: string | null;
  messages: Message[];
  orders: ShopifyOrder[];
  cannedResponses: CannedResponse[];
  resources: Resource[];
}

function formatOrdersForContext(orders: ShopifyOrder[]): string {
  if (orders.length === 0) return 'No order history found.';

  return orders.map(order => {
    const items = order.line_items.map(item =>
      `  - ${item.title}${item.variant_title ? ` (${item.variant_title})` : ''} x${item.quantity} - $${item.price}`
    ).join('\n');

    const tracking = order.fulfillments
      .filter(f => f.tracking_number)
      .map(f => `  Tracking: ${f.tracking_number}${f.tracking_company ? ` (${f.tracking_company})` : ''}${f.tracking_url ? ` - ${f.tracking_url}` : ''}`)
      .join('\n');

    return `Order ${order.name} (${new Date(order.created_at).toLocaleDateString()}):
  Status: ${order.financial_status}${order.fulfillment_status ? ` / ${order.fulfillment_status}` : ''}
  Total: $${order.total_price} ${order.currency}
  Items:
${items}${tracking ? `\n${tracking}` : ''}`;
  }).join('\n\n');
}

function formatCannedResponsesForContext(responses: CannedResponse[]): string {
  if (responses.length === 0) return 'No canned responses available.';

  return responses.map(r =>
    `[${r.category || 'General'}] ${r.title}:\n${r.content}`
  ).join('\n\n---\n\n');
}

function getResourceTypeLabel(resource: Resource): string {
  if (resource.is_uploaded) return 'FILE';
  switch (resource.type) {
    case 'video': return 'VIDEO';
    case 'article': return 'ARTICLE';
    case 'faq': return 'FAQ';
    case 'guide': return 'GUIDE';
    default: return 'RESOURCE';
  }
}

function getResourceTypeNatural(resource: Resource): string {
  if (resource.is_uploaded) return 'downloadable file';
  switch (resource.type) {
    case 'video': return 'video';
    case 'article': return 'article';
    case 'faq': return 'FAQ';
    case 'guide': return 'guide';
    default: return 'resource';
  }
}

function formatResourcesForContext(resources: Resource[]): string {
  if (resources.length === 0) {
    return `No resources available in the library.

NOTE: If the customer asks a product or troubleshooting question and no relevant resource exists, you may answer based on your general knowledge but keep the response brief and suggest they contact support for detailed assistance.`;
  }

  // Group resources by category
  const grouped = resources.reduce((acc, resource) => {
    const category = resource.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  const sections = Object.entries(grouped).map(([category, categoryResources]) => {
    const resourceList = categoryResources.map(r => {
      const typeLabel = getResourceTypeLabel(r);
      const typeNatural = getResourceTypeNatural(r);
      const description = r.description ? `\n   Description: ${r.description}` : '';
      return `• [${typeLabel}] "${r.title}"${description}
   URL: ${r.url}
   (Refer to this as: "this ${typeNatural}" or "our ${r.title} ${typeNatural}")`;
    }).join('\n\n');

    return `### ${category}\n${resourceList}`;
  }).join('\n\n');

  return sections;
}

function formatConversationForContext(messages: Message[], customerName: string | null): string {
  return messages.map(m => {
    const sender = m.sender_type === 'customer'
      ? (customerName || 'Customer')
      : 'Support Agent';
    const prefix = m.is_internal ? '[Internal Note] ' : '';
    return `${prefix}${sender}:\n${m.content}`;
  }).join('\n\n---\n\n');
}

function buildSystemPrompt(context: TicketContext): string {
  const hasResources = context.resources.length > 0;

  return `You are a helpful customer support agent for NoLimits (a golf training product company). Your job is to draft a response to the customer's latest message.

## IMPORTANT: Resource Library First
${hasResources ? `You have access to our official Resource Library below. This is your PRIMARY knowledge base.

**ALWAYS follow this process:**
1. FIRST, check the Resource Library for any resource that addresses the customer's question
2. If a resource exists that answers their question, use it as your primary source of truth
3. Link to relevant resources in your response - customers trust our official guides
4. Format resource links naturally, like:
   - "For step-by-step instructions, check out our guide: [Resource Title](url)"
   - "Here's a helpful video that walks through this: [Video Title](url)"
   - "This article explains everything you need to know: [Article Title](url)"
   - "You can find the answer in our FAQ: [FAQ Title](url)"

**Why this matters:** Customers trust our official resources. Linking to them provides verified, consistent information and helps customers help themselves in the future.` : `Note: The Resource Library is currently empty. Answer questions based on general knowledge but keep responses brief for product-specific questions and suggest contacting support for detailed assistance.`}

## Guidelines
- Be helpful, friendly, and professional
- Use the customer's name (${context.customerName || 'the customer'}) when appropriate
- Reference specific order information when relevant (order numbers, tracking numbers, etc.)
- Keep responses concise but complete - don't be overly verbose
- Match the professional but warm tone of the example canned responses below
- NEVER make up information - only use facts from the context provided
- If you don't have information to answer a question, say so honestly
- Format links as markdown: [Link Text](url)

## Current Ticket
- Ticket #${context.ticketNumber}: ${context.subject}
- Priority: ${context.priority}
- Status: ${context.status}
- Tags: ${context.tags.length > 0 ? context.tags.map(t => t.name).join(', ') : 'None'}

## Customer Information
- Name: ${context.customerName || 'Unknown'}
- Email: ${context.customerEmail || 'Unknown'}

## Customer's Order History
${formatOrdersForContext(context.orders)}

## 📚 OFFICIAL RESOURCE LIBRARY
${hasResources ? `**Always prefer linking to these official resources rather than explaining things from scratch.**

` : ''}${formatResourcesForContext(context.resources)}

## Example Canned Responses (for tone and style reference)
${formatCannedResponsesForContext(context.cannedResponses)}

## Instructions
Based on the conversation below, draft a helpful response to the customer's most recent message.
- Do not include a subject line
- Do not include "Dear [Name]" or similar - just start with the response content
- End with an appropriate sign-off only if it feels natural
- If the customer has an order issue, reference their specific order details
- **If a resource in the library addresses their question, ALWAYS include a link to it**
- When linking resources, introduce them naturally based on their type (video, article, guide, FAQ)
${!hasResources ? '- If the customer asks a product question and no resource exists, provide a brief helpful answer but note that detailed guides may be available - suggest they check back or contact support' : ''}`;
}

export async function generateSuggestedReply(ticketId: string): Promise<{ suggestion: string; error?: string }> {
  const supabase = await createClient();

  try {
    // Fetch ticket with customer info
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:customers(*),
        tags:ticket_tags(tag:tags(*))
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return { suggestion: '', error: 'Ticket not found' };
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    // Fetch canned responses
    const { data: cannedResponses } = await supabase
      .from('canned_responses')
      .select('*')
      .order('title');

    // Fetch resources with full details
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .order('category', { ascending: true, nullsFirst: false })
      .order('title');

    // Fetch Shopify orders if customer has email
    let orders: ShopifyOrder[] = [];
    if (ticket.customer?.email) {
      const shopifyData = await getCustomerOrders(ticket.customer.email);
      orders = shopifyData.orders;
    }

    // Extract tags from the nested structure
    const tags: Tag[] = (ticket.tags || [])
      .map((tt: { tag: Tag }) => tt.tag)
      .filter(Boolean);

    // Build context
    const context: TicketContext = {
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      tags,
      customerName: ticket.customer?.full_name || null,
      customerEmail: ticket.customer?.email || null,
      messages: (messages || []) as Message[],
      orders,
      cannedResponses: (cannedResponses || []) as CannedResponse[],
      resources: (resources || []) as Resource[],
    };

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Format conversation as the user message
    const conversationText = formatConversationForContext(context.messages, context.customerName);

    // Call Claude
    const { text, error } = await callClaude({
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation so far:\n\n${conversationText}\n\nPlease draft a response to the customer's most recent message. Remember to check the Resource Library first and link to any relevant resources.`,
        },
      ],
      maxTokens: 1024,
    });

    if (error) {
      return { suggestion: '', error };
    }

    return { suggestion: text };
  } catch (error) {
    console.error('Error generating suggested reply:', error);
    return {
      suggestion: '',
      error: error instanceof Error ? error.message : 'Failed to generate suggestion'
    };
  }
}
