-- Add is_auto_reply column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_auto_reply BOOLEAN DEFAULT false;

-- Index for filtering auto-reply tickets
CREATE INDEX IF NOT EXISTS idx_tickets_is_auto_reply ON tickets(is_auto_reply) WHERE is_auto_reply = true;

-- Update existing tickets - mark any with auto-reply subjects as auto-replies
UPDATE tickets
SET is_auto_reply = true
WHERE
  LOWER(subject) LIKE '%automatic reply%'
  OR LOWER(subject) LIKE '%auto-reply%'
  OR LOWER(subject) LIKE '%auto reply%'
  OR LOWER(subject) LIKE '%out of office%'
  OR LOWER(subject) LIKE '%out-of-office%'
  OR LOWER(subject) LIKE '%ooo:%'
  OR LOWER(subject) LIKE '%away from office%'
  OR LOWER(subject) LIKE '%on vacation%'
  OR LOWER(subject) LIKE '%autoreply%'
  OR LOWER(subject) LIKE '%automatische antwort%'
  OR LOWER(subject) LIKE '%réponse automatique%';
