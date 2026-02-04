-- Enhanced Ticket Search Migration
-- Adds full-text search capability across multiple fields

-- Create text search configuration if not exists (English)
-- Using built-in 'english' configuration

-- Add GIN index for full-text search on messages content
CREATE INDEX IF NOT EXISTS idx_messages_content_fts
ON messages USING GIN (to_tsvector('english', content));

-- Add GIN index for full-text search on ticket subject
CREATE INDEX IF NOT EXISTS idx_tickets_subject_fts
ON tickets USING GIN (to_tsvector('english', subject));

-- Create the search_tickets function
CREATE OR REPLACE FUNCTION search_tickets(
    search_term TEXT,
    status_filter ticket_status DEFAULT NULL,
    priority_filter ticket_priority DEFAULT NULL,
    assignee_filter UUID DEFAULT NULL,
    assignee_unassigned BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    ticket_number INT,
    subject TEXT,
    status ticket_status,
    priority ticket_priority,
    customer_id UUID,
    assigned_agent_id UUID,
    assigned_team_id UUID,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    match_field TEXT,
    -- Customer fields (flattened for easier client consumption)
    customer_email TEXT,
    customer_full_name TEXT,
    customer_phone TEXT,
    customer_avatar_url TEXT,
    customer_metadata JSONB,
    customer_created_at TIMESTAMPTZ,
    customer_updated_at TIMESTAMPTZ,
    -- Assigned agent fields
    agent_email TEXT,
    agent_full_name TEXT,
    agent_avatar_url TEXT,
    agent_role user_role,
    agent_team_id UUID,
    agent_is_active BOOLEAN,
    -- Assigned team fields
    team_name TEXT,
    team_description TEXT
) AS $$
DECLARE
    search_pattern TEXT;
    ts_query TSQUERY;
BEGIN
    -- Prepare search patterns
    search_pattern := '%' || LOWER(search_term) || '%';

    -- Create tsquery for full-text search (handle special characters)
    BEGIN
        ts_query := plainto_tsquery('english', search_term);
    EXCEPTION WHEN OTHERS THEN
        ts_query := NULL;
    END;

    RETURN QUERY
    WITH matched_tickets AS (
        -- Match by ticket number (exact or partial)
        SELECT DISTINCT t.id, 'ticket_number'::TEXT as match_field, 1 as priority
        FROM tickets t
        WHERE t.ticket_number::TEXT ILIKE search_pattern

        UNION

        -- Match by subject (ILIKE for simplicity)
        SELECT DISTINCT t.id, 'subject'::TEXT as match_field, 2 as priority
        FROM tickets t
        WHERE t.subject ILIKE search_pattern

        UNION

        -- Match by customer name
        SELECT DISTINCT t.id, 'customer_name'::TEXT as match_field, 3 as priority
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        WHERE c.full_name ILIKE search_pattern

        UNION

        -- Match by customer email
        SELECT DISTINCT t.id, 'customer_email'::TEXT as match_field, 4 as priority
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        WHERE c.email ILIKE search_pattern

        UNION

        -- Match by message content (full-text search)
        SELECT DISTINCT t.id, 'message'::TEXT as match_field, 5 as priority
        FROM tickets t
        JOIN messages m ON m.ticket_id = t.id
        WHERE ts_query IS NOT NULL
          AND to_tsvector('english', m.content) @@ ts_query
    ),
    -- Deduplicate matches, keeping the highest priority match field
    best_matches AS (
        SELECT DISTINCT ON (mt.id) mt.id, mt.match_field
        FROM matched_tickets mt
        ORDER BY mt.id, mt.priority
    )
    SELECT
        t.id,
        t.ticket_number,
        t.subject,
        t.status,
        t.priority,
        t.customer_id,
        t.assigned_agent_id,
        t.assigned_team_id,
        t.first_response_at,
        t.resolved_at,
        t.created_at,
        t.updated_at,
        bm.match_field,
        -- Customer
        c.email as customer_email,
        c.full_name as customer_full_name,
        c.phone as customer_phone,
        c.avatar_url as customer_avatar_url,
        c.metadata as customer_metadata,
        c.created_at as customer_created_at,
        c.updated_at as customer_updated_at,
        -- Agent
        p.email as agent_email,
        p.full_name as agent_full_name,
        p.avatar_url as agent_avatar_url,
        p.role as agent_role,
        p.team_id as agent_team_id,
        p.is_active as agent_is_active,
        -- Team
        tm.name as team_name,
        tm.description as team_description
    FROM best_matches bm
    JOIN tickets t ON t.id = bm.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN profiles p ON t.assigned_agent_id = p.id
    LEFT JOIN teams tm ON t.assigned_team_id = tm.id
    WHERE
        -- Apply filters
        (status_filter IS NULL OR t.status = status_filter)
        AND (priority_filter IS NULL OR t.priority = priority_filter)
        AND (
            (NOT assignee_unassigned AND assignee_filter IS NULL)
            OR (assignee_unassigned AND t.assigned_agent_id IS NULL)
            OR (NOT assignee_unassigned AND t.assigned_agent_id = assignee_filter)
        )
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_tickets TO authenticated;
