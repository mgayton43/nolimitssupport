/**
 * Template variable replacement for canned responses
 *
 * Supported variables:
 * - {{customer_name}} - Customer's full name or email if no name
 * - {{customer_email}} - Customer's email address
 * - {{ticket_number}} - Ticket number (e.g., 123)
 * - {{agent_name}} - Current agent's full name
 */

export interface TemplateContext {
  customerName?: string | null;
  customerEmail?: string | null;
  ticketNumber?: number | null;
  agentName?: string | null;
}

export const AVAILABLE_VARIABLES = [
  {
    variable: '{{customer_name}}',
    description: "Customer's full name (or email if no name set)",
    example: 'John Smith',
  },
  {
    variable: '{{customer_email}}',
    description: "Customer's email address",
    example: 'john@example.com',
  },
  {
    variable: '{{ticket_number}}',
    description: 'The ticket number',
    example: '1234',
  },
  {
    variable: '{{agent_name}}',
    description: 'Your name (the current agent)',
    example: 'Sarah Jones',
  },
] as const;

/**
 * Replace template variables in content with actual values
 */
export function replaceTemplateVariables(
  content: string,
  context: TemplateContext
): string {
  let result = content;

  // Replace {{customer_name}} - fall back to email if no name
  const customerName = context.customerName || context.customerEmail || 'Customer';
  result = result.replace(/\{\{customer_name\}\}/gi, customerName);

  // Replace {{customer_email}}
  const customerEmail = context.customerEmail || '';
  result = result.replace(/\{\{customer_email\}\}/gi, customerEmail);

  // Replace {{ticket_number}}
  const ticketNumber = context.ticketNumber?.toString() || '';
  result = result.replace(/\{\{ticket_number\}\}/gi, ticketNumber);

  // Replace {{agent_name}}
  const agentName = context.agentName || 'Support Team';
  result = result.replace(/\{\{agent_name\}\}/gi, agentName);

  return result;
}

/**
 * Check if content contains any template variables
 */
export function hasTemplateVariables(content: string): boolean {
  return /\{\{(customer_name|customer_email|ticket_number|agent_name)\}\}/gi.test(content);
}
