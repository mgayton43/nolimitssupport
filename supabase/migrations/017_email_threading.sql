-- Add email threading support to tickets
-- reference_id stores the email Message-ID for threading replies

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- Index for looking up tickets by reference_id (email Message-ID)
CREATE INDEX IF NOT EXISTS idx_tickets_reference_id ON tickets(reference_id) WHERE reference_id IS NOT NULL;

-- Add source column to messages to track where the message came from
-- This helps prevent email loops (don't send email for messages that came from email)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source_email_id TEXT;

-- Index for checking if a message came from an email
CREATE INDEX IF NOT EXISTS idx_messages_source_email_id ON messages(source_email_id) WHERE source_email_id IS NOT NULL;
