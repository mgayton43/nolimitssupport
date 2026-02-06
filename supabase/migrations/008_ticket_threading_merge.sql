-- Ticket Threading and Merge Migration

-- Create message source enum
CREATE TYPE message_source AS ENUM ('reply', 'new_email', 'merge');

-- Add message_source column to messages table
ALTER TABLE messages
ADD COLUMN source message_source NOT NULL DEFAULT 'reply';

-- Add merged_into_ticket_id column to tickets table
ALTER TABLE tickets
ADD COLUMN merged_into_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;

-- Add index for finding merged tickets
CREATE INDEX idx_tickets_merged_into ON tickets(merged_into_ticket_id) WHERE merged_into_ticket_id IS NOT NULL;

-- Function to find existing open ticket for a customer
CREATE OR REPLACE FUNCTION find_open_ticket_for_customer(p_customer_email TEXT)
RETURNS TABLE (
    ticket_id UUID,
    ticket_number INT,
    subject TEXT,
    assigned_agent_id UUID,
    snoozed_until TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.ticket_number, t.subject, t.assigned_agent_id, t.snoozed_until
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE c.email = p_customer_email
    AND t.status IN ('open', 'pending')
    AND t.merged_into_ticket_id IS NULL
    ORDER BY t.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a message to an existing ticket (for auto-threading)
CREATE OR REPLACE FUNCTION thread_message_to_ticket(
    p_ticket_id UUID,
    p_customer_id UUID,
    p_content TEXT,
    p_source message_source DEFAULT 'new_email'
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_was_snoozed BOOLEAN;
    v_assigned_agent_id UUID;
BEGIN
    -- Check if ticket was snoozed
    SELECT
        snoozed_until IS NOT NULL,
        assigned_agent_id
    INTO v_was_snoozed, v_assigned_agent_id
    FROM tickets
    WHERE id = p_ticket_id;

    -- Insert the new message
    INSERT INTO messages (ticket_id, sender_type, sender_id, content, is_internal, source)
    VALUES (p_ticket_id, 'customer', p_customer_id, p_content, false, p_source)
    RETURNING id INTO v_message_id;

    -- Update ticket: refresh updated_at and un-snooze if needed
    UPDATE tickets
    SET
        updated_at = NOW(),
        status = CASE WHEN snoozed_until IS NOT NULL THEN 'open' ELSE status END,
        snoozed_until = NULL,
        snoozed_by = NULL
    WHERE id = p_ticket_id;

    -- If ticket was snoozed, create a notification for the agent
    IF v_was_snoozed AND v_assigned_agent_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, ticket_id)
        SELECT
            v_assigned_agent_id,
            'snooze_expired'::notification_type,
            'Customer replied to snoozed ticket',
            'Ticket #' || ticket_number || ' received a new message from the customer',
            p_ticket_id
        FROM tickets
        WHERE id = p_ticket_id;
    END IF;

    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge two tickets
CREATE OR REPLACE FUNCTION merge_tickets(
    p_primary_ticket_id UUID,
    p_secondary_ticket_id UUID,
    p_merged_by_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_primary_ticket_number INT;
    v_secondary_ticket_number INT;
BEGIN
    -- Get ticket numbers for activity logs
    SELECT ticket_number INTO v_primary_ticket_number FROM tickets WHERE id = p_primary_ticket_id;
    SELECT ticket_number INTO v_secondary_ticket_number FROM tickets WHERE id = p_secondary_ticket_id;

    -- Validate tickets exist and are different
    IF v_primary_ticket_number IS NULL OR v_secondary_ticket_number IS NULL THEN
        RETURN FALSE;
    END IF;

    IF p_primary_ticket_id = p_secondary_ticket_id THEN
        RETURN FALSE;
    END IF;

    -- Move all messages from secondary to primary, mark as merged
    UPDATE messages
    SET
        ticket_id = p_primary_ticket_id,
        source = 'merge'
    WHERE ticket_id = p_secondary_ticket_id;

    -- Close the secondary ticket and mark as merged
    UPDATE tickets
    SET
        status = 'closed',
        merged_into_ticket_id = p_primary_ticket_id,
        resolved_at = NOW(),
        snoozed_until = NULL,
        snoozed_by = NULL
    WHERE id = p_secondary_ticket_id;

    -- Update primary ticket's updated_at
    UPDATE tickets
    SET updated_at = NOW()
    WHERE id = p_primary_ticket_id;

    -- Add activity log to primary ticket
    INSERT INTO ticket_activities (ticket_id, actor_id, action, old_value, new_value, metadata)
    VALUES (
        p_primary_ticket_id,
        p_merged_by_user_id,
        'ticket_merged',
        NULL,
        'Merged from ticket #' || v_secondary_ticket_number,
        jsonb_build_object('merged_ticket_id', p_secondary_ticket_id, 'merged_ticket_number', v_secondary_ticket_number)
    );

    -- Add activity log to secondary ticket
    INSERT INTO ticket_activities (ticket_id, actor_id, action, old_value, new_value, metadata)
    VALUES (
        p_secondary_ticket_id,
        p_merged_by_user_id,
        'ticket_merged_into',
        NULL,
        'Merged into ticket #' || v_primary_ticket_number,
        jsonb_build_object('primary_ticket_id', p_primary_ticket_id, 'primary_ticket_number', v_primary_ticket_number)
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_open_ticket_for_customer TO authenticated;
GRANT EXECUTE ON FUNCTION thread_message_to_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION merge_tickets TO authenticated;
