-- Promo Codes and Products tables for agent reference

-- Discount type enum
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping');

-- Promo code source enum
CREATE TYPE promo_source AS ENUM ('email_flow', 'website', 'ads', 'influencer', 'social_media', 'other');

-- Product availability enum
CREATE TYPE product_availability AS ENUM ('us_only', 'canada_only', 'us_and_canada');

-- Product stock status enum
CREATE TYPE stock_status AS ENUM ('in_stock', 'out_of_stock', 'discontinued', 'pre_order');

-- Promo Codes table
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_stackable BOOLEAN DEFAULT false,
    applies_to TEXT DEFAULT 'all',
    source promo_source,
    source_details TEXT,
    expiration_date DATE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image_url TEXT,
    whats_included TEXT,
    retail_price DECIMAL(10, 2),
    discounted_price DECIMAL(10, 2),
    availability product_availability DEFAULT 'us_and_canada',
    stock_status stock_status DEFAULT 'in_stock',
    notes TEXT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_is_active ON promo_codes(is_active);
CREATE INDEX idx_promo_codes_brand_id ON promo_codes(brand_id);
CREATE INDEX idx_promo_codes_source ON promo_codes(source);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_stock_status ON products(stock_status);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read
CREATE POLICY "All agents can view promo codes"
    ON promo_codes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "All agents can view products"
    ON products FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can create/update/delete
CREATE POLICY "Admins can create promo codes"
    ON promo_codes FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update promo codes"
    ON promo_codes FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete promo codes"
    ON promo_codes FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can create products"
    ON products FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update products"
    ON products FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete products"
    ON products FOR DELETE
    TO authenticated
    USING (get_user_role() = 'admin');

-- Update triggers
CREATE TRIGGER update_promo_codes_updated_at
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
