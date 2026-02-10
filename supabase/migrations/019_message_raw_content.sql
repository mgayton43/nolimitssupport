-- Add raw_content column to messages table
-- Stores the original unprocessed email content for reference

ALTER TABLE messages ADD COLUMN raw_content TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN messages.raw_content IS 'Original unprocessed email content. For new tickets, content may include quoted thread for context. For replies to existing tickets, content is stripped. raw_content always contains the full original.';
