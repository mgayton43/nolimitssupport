-- Ticket Channels Migration
-- Adds support for multi-channel ticket sources (email, Facebook, Instagram, manual)

-- Create channel enum type
CREATE TYPE ticket_channel AS ENUM ('email', 'facebook', 'instagram', 'manual');

-- Drop old search_tickets function (has different signature without channel_filter)
DROP FUNCTION IF EXISTS search_tickets(TEXT, ticket_status, ticket_priority, UUID, BOOLEAN);

-- Add channel column to tickets table
ALTER TABLE tickets
ADD COLUMN channel ticket_channel NOT NULL DEFAULT 'manual';

-- Add index for channel filtering
CREATE INDEX idx_tickets_channel ON tickets(channel);

-- Update the search_tickets function to include channel filter
CREATE OR REPLACE FUNCTION search_tickets(
    search_term TEXT,
    status_filter ticket_status DEFAULT NULL,
    priority_filter ticket_priority DEFAULT NULL,
    assignee_filter UUID DEFAULT NULL,
    assignee_unassigned BOOLEAN DEFAULT FALSE,
    channel_filter ticket_channel DEFAULT NULL
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
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
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
    team_description TEXT
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
        t.first_response_at,
        t.resolved_at,
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
        tm.description as team_description
    FROM matched_tickets mt
    JOIN tickets t ON mt.id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN profiles p ON t.assigned_agent_id = p.id
    LEFT JOIN teams tm ON t.assigned_team_id = tm.id
    WHERE
        (status_filter IS NULL OR t.status = status_filter)
        AND (priority_filter IS NULL OR t.priority = priority_filter)
        AND (channel_filter IS NULL OR t.channel = channel_filter)
        AND (
            (assignee_unassigned = TRUE AND t.assigned_agent_id IS NULL)
            OR (assignee_unassigned = FALSE AND (assignee_filter IS NULL OR t.assigned_agent_id = assignee_filter))
        )
    ORDER BY t.id, mt.match_field
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_tickets TO authenticated;
