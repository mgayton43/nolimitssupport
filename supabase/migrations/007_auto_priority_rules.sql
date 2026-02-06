-- Auto Priority Rules Migration

-- Create auto_priority_rules table
CREATE TABLE auto_priority_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    keywords TEXT[] NOT NULL,
    priority ticket_priority NOT NULL,
    match_subject BOOLEAN NOT NULL DEFAULT TRUE,
    match_body BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for active rules lookup
CREATE INDEX idx_auto_priority_rules_active ON auto_priority_rules(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE auto_priority_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access
CREATE POLICY "Admins can manage auto priority rules"
    ON auto_priority_rules FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Agents can read rules (needed for rule execution)
CREATE POLICY "Agents can view auto priority rules"
    ON auto_priority_rules FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'agent')
        )
    );

-- Function to get priority weight (for comparison)
CREATE OR REPLACE FUNCTION get_priority_weight(p ticket_priority)
RETURNS INT AS $$
BEGIN
    RETURN CASE p
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to apply auto priority rules
CREATE OR REPLACE FUNCTION apply_auto_priority(
    p_ticket_id UUID,
    p_subject TEXT,
    p_body TEXT,
    p_current_priority ticket_priority DEFAULT 'medium'
)
RETURNS ticket_priority AS $$
DECLARE
    v_rule RECORD;
    v_highest_priority ticket_priority := NULL;
    v_highest_weight INT := 0;
    v_text_to_match TEXT;
    v_keyword TEXT;
    v_matched BOOLEAN;
BEGIN
    -- Only apply if current priority is the default (medium)
    -- This prevents overriding manually set priorities
    IF p_current_priority != 'medium' THEN
        RETURN p_current_priority;
    END IF;

    -- Check each active rule
    FOR v_rule IN
        SELECT * FROM auto_priority_rules
        WHERE is_active = TRUE
        ORDER BY get_priority_weight(priority) DESC
    LOOP
        v_matched := FALSE;

        -- Check subject if enabled
        IF v_rule.match_subject AND p_subject IS NOT NULL THEN
            FOREACH v_keyword IN ARRAY v_rule.keywords
            LOOP
                IF LOWER(p_subject) LIKE '%' || LOWER(v_keyword) || '%' THEN
                    v_matched := TRUE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        -- Check body if enabled and not already matched
        IF NOT v_matched AND v_rule.match_body AND p_body IS NOT NULL THEN
            FOREACH v_keyword IN ARRAY v_rule.keywords
            LOOP
                IF LOWER(p_body) LIKE '%' || LOWER(v_keyword) || '%' THEN
                    v_matched := TRUE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        -- If matched, check if this is higher priority
        IF v_matched THEN
            IF get_priority_weight(v_rule.priority) > v_highest_weight THEN
                v_highest_weight := get_priority_weight(v_rule.priority);
                v_highest_priority := v_rule.priority;
            END IF;
        END IF;
    END LOOP;

    -- Return highest matched priority or current priority if no match
    IF v_highest_priority IS NOT NULL THEN
        -- Update the ticket priority
        UPDATE tickets
        SET priority = v_highest_priority
        WHERE id = p_ticket_id;

        RETURN v_highest_priority;
    END IF;

    RETURN p_current_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_auto_priority TO authenticated;
GRANT EXECUTE ON FUNCTION get_priority_weight TO authenticated;

-- Trigger to auto-set updated_at
CREATE OR REPLACE FUNCTION update_auto_priority_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_auto_priority_rules_updated_at
    BEFORE UPDATE ON auto_priority_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_auto_priority_rules_updated_at();
