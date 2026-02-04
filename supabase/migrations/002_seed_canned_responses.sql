-- Seed default canned responses with template variables
-- These responses use template variables that get replaced when inserted:
--   {{customer_name}} - Customer's full name or email
--   {{customer_email}} - Customer's email address
--   {{ticket_number}} - The ticket number
--   {{agent_name}} - Current agent's name

-- Insert default canned responses (created_by is null for system defaults)
INSERT INTO canned_responses (title, content, shortcut, category, is_shared, created_by)
VALUES
  (
    'Greeting - Initial Response',
    'Hi {{customer_name}},

Thanks for reaching out! Let me look into this for you.

Best regards,
{{agent_name}}',
    'hello',
    'Greetings',
    true,
    null
  ),
  (
    'Greeting - Resolution',
    'Hi {{customer_name}},

Your issue has been resolved. Please let us know if you need anything else!

Best regards,
{{agent_name}}',
    'resolved',
    'Greetings',
    true,
    null
  ),
  (
    'Request More Information',
    'Hi {{customer_name}},

I need a bit more information to help you. Could you please provide your order number?

Thanks,
{{agent_name}}',
    'moreinfo',
    'Follow-up',
    true,
    null
  ),
  (
    'Order Status Check',
    'Hi {{customer_name}},

I''d be happy to check on your order status. Could you please confirm the email address associated with your order, or provide the order confirmation number?

Thanks,
{{agent_name}}',
    'orderstatus',
    'Orders',
    true,
    null
  ),
  (
    'Refund Processing',
    'Hi {{customer_name}},

I''ve processed your refund request. Please allow 5-10 business days for the refund to appear on your original payment method.

If you have any questions, feel free to reply to this ticket (#{{ticket_number}}).

Best regards,
{{agent_name}}',
    'refund',
    'Orders',
    true,
    null
  ),
  (
    'Shipping Delay Notification',
    'Hi {{customer_name}},

I apologize for the delay with your order. We''re currently experiencing higher than normal shipping times.

Your order is on its way and should arrive within the next few business days. You can track your shipment using the tracking link in your confirmation email.

Thank you for your patience!

Best regards,
{{agent_name}}',
    'shipdelay',
    'Shipping',
    true,
    null
  ),
  (
    'Closing - Thank You',
    'Hi {{customer_name}},

Thank you for contacting us! I''m glad I could help.

If you have any other questions in the future, don''t hesitate to reach out.

Have a great day!
{{agent_name}}',
    'thanks',
    'Closing',
    true,
    null
  ),
  (
    'Escalation Notice',
    'Hi {{customer_name}},

I''ve escalated your ticket (#{{ticket_number}}) to our specialist team for further review. Someone will be in touch with you shortly.

Thank you for your patience.

Best regards,
{{agent_name}}',
    'escalate',
    'Follow-up',
    true,
    null
  );
