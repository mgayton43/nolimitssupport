-- User invitations table for tracking pending invites
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    token TEXT UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up invitations by email
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);

-- Index for looking up pending invitations
CREATE INDEX IF NOT EXISTS idx_user_invitations_pending ON user_invitations(expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can view all invitations"
    ON user_invitations FOR SELECT
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can create invitations"
    ON user_invitations FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update invitations"
    ON user_invitations FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete invitations"
    ON user_invitations FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');

-- Update trigger
CREATE TRIGGER update_user_invitations_updated_at
    BEFORE UPDATE ON user_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
