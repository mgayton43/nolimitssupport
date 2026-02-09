-- Add description column to tags table
ALTER TABLE tags ADD COLUMN description TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN tags.description IS 'Help text explaining when agents should use this tag';
