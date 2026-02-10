-- Add status column to canned_responses for archiving functionality
-- Status can be 'active' or 'archived'

-- Create the enum type
CREATE TYPE canned_response_status AS ENUM ('active', 'archived');

-- Add status column with default 'active'
ALTER TABLE canned_responses ADD COLUMN status canned_response_status NOT NULL DEFAULT 'active';

-- Create index for filtering by status
CREATE INDEX idx_canned_responses_status ON canned_responses(status);

-- Add comment for documentation
COMMENT ON COLUMN canned_responses.status IS 'Status of canned response: active (default) or archived';
