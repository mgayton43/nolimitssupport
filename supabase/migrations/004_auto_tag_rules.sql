-- Auto Tag Rules Migration
-- Adds auto-tagging rules engine for automatically applying tags based on keywords

-- Create auto_tag_rules table
CREATE TABLE auto_tag_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    match_subject BOOLEAN DEFAULT true,
    match_body BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for active rules lookup
CREATE INDEX idx_auto_tag_rules_active ON auto_tag_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_auto_tag_rules_tag ON auto_tag_rules(tag_id);

-- Apply updated_at trigger
CREATE TRIGGER update_auto_tag_rules_updated_at BEFORE UPDATE ON auto_tag_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE auto_tag_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only for management, all authenticated can read active rules
CREATE POLICY "Authenticated users can view active rules" ON auto_tag_rules
    FOR SELECT TO authenticated
    USING (is_active = true OR get_user_role() = 'admin');

CREATE POLICY "Admins can manage rules" ON auto_tag_rules
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin');

-- Function to apply auto-tags to a ticket based on text content
CREATE OR REPLACE FUNCTION apply_auto_tags(
    p_ticket_id UUID,
    p_subject TEXT DEFAULT NULL,
    p_body TEXT DEFAULT NULL
)
RETURNS SETOF UUID AS $$
DECLARE
    rule RECORD;
    keyword TEXT;
    search_text TEXT;
    matched BOOLEAN;
    applied_tag_ids UUID[] := '{}';
BEGIN
    -- Get all active rules
    FOR rule IN
        SELECT * FROM auto_tag_rules WHERE is_active = true
    LOOP
        matched := false;

        -- Check each keyword
        FOREACH keyword IN ARRAY rule.keywords
        LOOP
            -- Check subject if enabled
            IF rule.match_subject AND p_subject IS NOT NULL THEN
                IF LOWER(p_subject) LIKE '%' || LOWER(keyword) || '%' THEN
                    matched := true;
                    EXIT;
                END IF;
            END IF;

            -- Check body if enabled
            IF rule.match_body AND p_body IS NOT NULL THEN
                IF LOWER(p_body) LIKE '%' || LOWER(keyword) || '%' THEN
                    matched := true;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        -- If matched, add the tag (avoiding duplicates)
        IF matched AND NOT (rule.tag_id = ANY(applied_tag_ids)) THEN
            -- Check if ticket already has this tag
            IF NOT EXISTS (
                SELECT 1 FROM ticket_tags
                WHERE ticket_id = p_ticket_id AND tag_id = rule.tag_id
            ) THEN
                INSERT INTO ticket_tags (ticket_id, tag_id)
                VALUES (p_ticket_id, rule.tag_id)
                ON CONFLICT (ticket_id, tag_id) DO NOTHING;

                applied_tag_ids := applied_tag_ids || rule.tag_id;
                RETURN NEXT rule.tag_id;
            END IF;
        END IF;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_auto_tags TO authenticated;
