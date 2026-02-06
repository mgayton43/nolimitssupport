-- Ticket Import Support
-- Adds columns for tracking imported tickets from external systems like Gorgias

-- Add external_id column to store original ticket ID from source system
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add imported_at timestamp to track when ticket was imported
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

-- Add index for looking up by external_id (useful for avoiding duplicates)
CREATE INDEX IF NOT EXISTS idx_tickets_external_id ON tickets(external_id) WHERE external_id IS NOT NULL;

-- Add index for filtering imported tickets
CREATE INDEX IF NOT EXISTS idx_tickets_imported_at ON tickets(imported_at) WHERE imported_at IS NOT NULL;
