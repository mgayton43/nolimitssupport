-- Ticket Snooze Migration
-- Adds snooze functionality to tickets

-- Add snooze columns to tickets table
ALTER TABLE tickets
ADD COLUMN snoozed_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN snoozed_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT NULL;

-- Add index for snoozed tickets lookup
CREATE INDEX idx_tickets_snoozed_until ON tickets(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Function to check and unsnooze expired tickets
CREATE OR REPLACE FUNCTION unsnooze_expired_tickets()
RETURNS TABLE (
    ticket_id UUID,
    ticket_number INT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE tickets
    SET
        status = 'open',
        snoozed_until = NULL,
        snoozed_by = NULL
    WHERE
        snoozed_until IS NOT NULL
        AND snoozed_until <= NOW()
        AND status = 'pending'
    RETURNING id AS ticket_id, tickets.ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to snooze a ticket
CREATE OR REPLACE FUNCTION snooze_ticket(
    p_ticket_id UUID,
    p_snoozed_until TIMESTAMPTZ,
    p_snoozed_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tickets
    SET
        status = 'pending',
        snoozed_until = p_snoozed_until,
        snoozed_by = p_snoozed_by
    WHERE id = p_ticket_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unsnooze a specific ticket
CREATE OR REPLACE FUNCTION unsnooze_ticket(p_ticket_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tickets
    SET
        status = 'open',
        snoozed_until = NULL,
        snoozed_by = NULL
    WHERE id = p_ticket_id
    AND snoozed_until IS NOT NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION unsnooze_expired_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION snooze_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION unsnooze_ticket TO authenticated;
