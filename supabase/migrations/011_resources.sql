-- Resource type enum
CREATE TYPE resource_type AS ENUM ('video', 'article', 'faq', 'guide');

-- Resources table
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    type resource_type NOT NULL,
    category TEXT,
    thumbnail_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_created_at ON resources(created_at DESC);

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read
CREATE POLICY "All agents can view resources"
    ON resources FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can create/update/delete
CREATE POLICY "Admins can create resources"
    ON resources FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update resources"
    ON resources FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete resources"
    ON resources FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');

-- Update trigger
CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
