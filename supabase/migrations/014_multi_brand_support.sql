-- Multi-Brand Support Migration
-- ==============================================

-- Create brands table
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email_address TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6B7280',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on slug for lookups
CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_email ON brands(email_address);

-- Seed the two brands
INSERT INTO brands (name, slug, email_address, color) VALUES
    ('Strikeman', 'strikeman', 'support@strikeman.io', '#3B82F6'),
    ('Radenso', 'radenso', 'support@nolimitsenterprises.com', '#F97316');

-- Add brand_id to tickets (nullable initially for migration, then we'll set a default)
ALTER TABLE tickets ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Set existing tickets to Strikeman as default
UPDATE tickets SET brand_id = (SELECT id FROM brands WHERE slug = 'strikeman');

-- Add brand_id to canned_responses (nullable = "All Brands")
ALTER TABLE canned_responses ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Add brand_id to resources (nullable = "All Brands")
ALTER TABLE resources ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create indexes for brand filtering
CREATE INDEX idx_tickets_brand ON tickets(brand_id);
CREATE INDEX idx_canned_responses_brand ON canned_responses(brand_id);
CREATE INDEX idx_resources_brand ON resources(brand_id);

-- Enable RLS on brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view brands
CREATE POLICY "All users can view brands"
    ON brands FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify brands
CREATE POLICY "Admins can insert brands"
    ON brands FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update brands"
    ON brands FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete brands"
    ON brands FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');
