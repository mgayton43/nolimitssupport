-- Add last_message_at column to tickets for efficient sorting by most recent message
ALTER TABLE tickets ADD COLUMN last_message_at TIMESTAMPTZ;

-- Create index for sorting by last message
CREATE INDEX idx_tickets_last_message_at ON tickets(last_message_at DESC NULLS LAST);

-- Create function to update last_message_at when a message is added
CREATE OR REPLACE FUNCTION update_ticket_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tickets
    SET last_message_at = NEW.created_at
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function on message insert
CREATE TRIGGER update_ticket_last_message_on_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_last_message_at();

-- Backfill existing tickets with their last message date
UPDATE tickets t
SET last_message_at = (
    SELECT MAX(created_at)
    FROM messages m
    WHERE m.ticket_id = t.id
);

-- For tickets with no messages, set last_message_at to created_at
UPDATE tickets
SET last_message_at = created_at
WHERE last_message_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.last_message_at IS 'Timestamp of the most recent message on this ticket, updated automatically by trigger';

-- Update search_tickets function to include last_message_at
DROP FUNCTION IF EXISTS search_tickets(TEXT, ticket_status, ticket_priority, UUID, BOOLEAN, ticket_channel, UUID);

CREATE OR REPLACE FUNCTION search_tickets(
    search_term TEXT,
    status_filter ticket_status DEFAULT NULL,
    priority_filter ticket_priority DEFAULT NULL,
    assignee_filter UUID DEFAULT NULL,
    assignee_unassigned BOOLEAN DEFAULT FALSE,
    channel_filter ticket_channel DEFAULT NULL,
    brand_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    ticket_number INT,
    subject TEXT,
    status ticket_status,
    priority ticket_priority,
    channel ticket_channel,
    customer_id UUID,
    assigned_agent_id UUID,
    assigned_team_id UUID,
    brand_id UUID,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    match_field TEXT,
    customer_email TEXT,
    customer_full_name TEXT,
    customer_phone TEXT,
    customer_avatar_url TEXT,
    customer_metadata JSONB,
    customer_created_at TIMESTAMPTZ,
    customer_updated_at TIMESTAMPTZ,
    agent_email TEXT,
    agent_full_name TEXT,
    agent_avatar_url TEXT,
    agent_role user_role,
    agent_team_id UUID,
    agent_is_active BOOLEAN,
    team_name TEXT,
    team_description TEXT,
    brand_name TEXT,
    brand_slug TEXT,
    brand_color TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH matched_tickets AS (
        -- Match by ticket number
        SELECT t.id, 'ticket_number'::TEXT as match_field
        FROM tickets t
        WHERE search_term ~ '^\d+$' AND t.ticket_number = search_term::INT

        UNION

        -- Match by subject
        SELECT t.id, 'subject'::TEXT as match_field
        FROM tickets t
        WHERE t.subject ILIKE '%' || search_term || '%'

        UNION

        -- Match by customer name
        SELECT t.id, 'customer_name'::TEXT as match_field
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        WHERE c.full_name ILIKE '%' || search_term || '%'

        UNION

        -- Match by customer email
        SELECT t.id, 'customer_email'::TEXT as match_field
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        WHERE c.email ILIKE '%' || search_term || '%'

        UNION

        -- Match by message content (full-text search)
        SELECT DISTINCT t.id, 'message'::TEXT as match_field
        FROM tickets t
        JOIN messages m ON t.id = m.ticket_id
        WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', search_term)
    )
    SELECT DISTINCT ON (t.id)
        t.id,
        t.ticket_number,
        t.subject,
        t.status,
        t.priority,
        t.channel,
        t.customer_id,
        t.assigned_agent_id,
        t.assigned_team_id,
        t.brand_id,
        t.first_response_at,
        t.resolved_at,
        t.last_message_at,
        t.created_at,
        t.updated_at,
        mt.match_field,
        c.email as customer_email,
        c.full_name as customer_full_name,
        c.phone as customer_phone,
        c.avatar_url as customer_avatar_url,
        c.metadata as customer_metadata,
        c.created_at as customer_created_at,
        c.updated_at as customer_updated_at,
        p.email as agent_email,
        p.full_name as agent_full_name,
        p.avatar_url as agent_avatar_url,
        p.role as agent_role,
        p.team_id as agent_team_id,
        p.is_active as agent_is_active,
        tm.name as team_name,
        tm.description as team_description,
        b.name as brand_name,
        b.slug as brand_slug,
        b.color as brand_color
    FROM matched_tickets mt
    JOIN tickets t ON mt.id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN profiles p ON t.assigned_agent_id = p.id
    LEFT JOIN teams tm ON t.assigned_team_id = tm.id
    LEFT JOIN brands b ON t.brand_id = b.id
    WHERE
        (status_filter IS NULL OR t.status = status_filter)
        AND (priority_filter IS NULL OR t.priority = priority_filter)
        AND (channel_filter IS NULL OR t.channel = channel_filter)
        AND (brand_filter IS NULL OR t.brand_id = brand_filter)
        AND (
            (assignee_unassigned = TRUE AND t.assigned_agent_id IS NULL)
            OR (assignee_unassigned = FALSE AND (assignee_filter IS NULL OR t.assigned_agent_id = assignee_filter))
        )
    ORDER BY t.id, mt.match_field
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_tickets TO authenticated;
