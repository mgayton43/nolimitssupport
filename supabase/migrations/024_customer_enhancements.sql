-- Customer enhancements: Shopify integration and internal notes

-- Add Shopify fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country TEXT;

-- Index for Shopify customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_shopify_id ON customers(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;

-- Customer notes table
CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer notes
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes(created_at DESC);

-- Enable RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view and create notes
CREATE POLICY "All agents can view customer notes"
    ON customer_notes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "All agents can create customer notes"
    ON customer_notes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update own notes"
    ON customer_notes FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Users can delete own notes"
    ON customer_notes FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- Update trigger for customer_notes
CREATE TRIGGER update_customer_notes_updated_at
    BEFORE UPDATE ON customer_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
