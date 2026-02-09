import type { Brand } from '@/lib/supabase/types';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

interface SendEmailOptions {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
  inReplyTo?: string; // Email Message-ID for threading
  references?: string; // Previous Message-IDs for threading
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via SendGrid API
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email not configured' };
  }

  const messageId = `<${crypto.randomUUID()}@nolimitssupport.com>`;

  const headers: Record<string, string> = {};
  if (options.inReplyTo) {
    headers['In-Reply-To'] = options.inReplyTo;
  }
  if (options.references) {
    headers['References'] = options.references;
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: options.to }],
      },
    ],
    from: {
      email: options.from,
      name: options.fromName || 'NoLimits Support',
    },
    reply_to: options.replyTo ? { email: options.replyTo } : undefined,
    subject: options.subject,
    content: [
      ...(options.textContent
        ? [{ type: 'text/plain', value: options.textContent }]
        : []),
      { type: 'text/html', value: options.htmlContent },
    ],
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    custom_args: {
      message_id: messageId,
    },
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }

    console.log('Email sent successfully to:', options.to);
    return { success: true, messageId };
  } catch (err) {
    console.error('SendGrid request failed:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Format a ticket reply as an HTML email
 */
export function formatReplyAsHtml(
  content: string,
  ticketNumber: number,
  agentName: string
): string {
  // Convert markdown-style formatting to HTML
  let htmlContent = content
    // Bold: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Underline: <u>text</u> (already HTML)
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .content {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #666;
    }
    .ticket-ref {
      color: #888;
      font-size: 11px;
    }
    a {
      color: #2563eb;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="content">
    ${htmlContent}
  </div>
  <div class="footer">
    <p>— ${agentName}</p>
    <p>Please reply to this email to continue the conversation.</p>
    <p class="ticket-ref">Ticket #${ticketNumber}</p>
  </div>
</body>
</html>
`.trim();
}

/**
 * Get the plain text version of a message (strip HTML/markdown)
 */
export function formatReplyAsText(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

/**
 * Get the support email address for a brand
 */
export function getBrandEmail(brand: Brand | null | undefined): string {
  if (!brand) {
    return 'support@nolimitsenterprises.com';
  }
  return brand.email_address || 'support@nolimitsenterprises.com';
}

/**
 * Get brand ID based on the email address that received the message
 */
export async function getBrandIdFromEmail(
  toEmail: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string | null> {
  // Normalize email
  const email = toEmail.toLowerCase().trim();

  // Query brands by email address
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('email_address', email)
    .single();

  return brand?.id || null;
}

/**
 * Parse email address from a "Name <email>" format
 */
export function parseEmailAddress(input: string): { email: string; name: string | null } {
  // Handle "Name <email@example.com>" format
  const match = input.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim().toLowerCase(),
    };
  }
  // Plain email address
  return {
    name: null,
    email: input.trim().toLowerCase(),
  };
}

/**
 * Generate the email subject for a reply
 */
export function generateReplySubject(originalSubject: string, ticketNumber: number): string {
  // Check if already has ticket reference
  const ticketRef = `[Ticket #${ticketNumber}]`;

  // Check if subject already starts with Re:
  const rePrefix = originalSubject.toLowerCase().startsWith('re:') ? '' : 'Re: ';

  // Check if ticket reference is already in subject
  if (originalSubject.includes(ticketRef)) {
    return `${rePrefix}${originalSubject}`;
  }

  return `${rePrefix}${ticketRef} ${originalSubject}`;
}
