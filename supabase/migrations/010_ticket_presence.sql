-- Ticket Presence (Collision Detection) Migration
-- Tracks which agents are currently viewing tickets

-- Create ticket_presence table
CREATE TABLE ticket_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_typing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only have one presence record per ticket
    UNIQUE(ticket_id, user_id)
);

-- Index for fast lookups by ticket
CREATE INDEX idx_ticket_presence_ticket_id ON ticket_presence(ticket_id);

-- Index for finding stale records to clean up
CREATE INDEX idx_ticket_presence_last_seen ON ticket_presence(last_seen_at);

-- Function to update presence (upsert)
CREATE OR REPLACE FUNCTION update_ticket_presence(
    p_ticket_id UUID,
    p_user_id UUID,
    p_is_typing BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
    INSERT INTO ticket_presence (ticket_id, user_id, last_seen_at, is_typing)
    VALUES (p_ticket_id, p_user_id, NOW(), p_is_typing)
    ON CONFLICT (ticket_id, user_id)
    DO UPDATE SET
        last_seen_at = NOW(),
        is_typing = p_is_typing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove presence when leaving
CREATE OR REPLACE FUNCTION remove_ticket_presence(
    p_ticket_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
BEGIN
    DELETE FROM ticket_presence
    WHERE ticket_id = p_ticket_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up stale presence records (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ticket_presence
    WHERE last_seen_at < NOW() - INTERVAL '5 minutes';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active presence for a ticket (within last 60 seconds)
CREATE OR REPLACE FUNCTION get_ticket_presence(p_ticket_id UUID)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    is_typing BOOLEAN,
    last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tp.user_id,
        p.full_name,
        p.email,
        p.avatar_url,
        tp.is_typing,
        tp.last_seen_at
    FROM ticket_presence tp
    JOIN profiles p ON tp.user_id = p.id
    WHERE tp.ticket_id = p_ticket_id
    AND tp.last_seen_at > NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for ticket_presence table
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_presence;

-- Grant permissions
GRANT ALL ON ticket_presence TO authenticated;
GRANT EXECUTE ON FUNCTION update_ticket_presence TO authenticated;
GRANT EXECUTE ON FUNCTION remove_ticket_presence TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_presence TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_presence TO authenticated;
