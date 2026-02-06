-- Notifications System Migration

-- Create notification type enum
CREATE TYPE notification_type AS ENUM ('ticket_assigned', 'ticket_mentioned', 'snooze_expired');

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type notification_type,
    p_title TEXT,
    p_message TEXT,
    p_ticket_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, ticket_id)
    VALUES (p_user_id, p_type, p_title, p_message, p_ticket_id)
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify on ticket assignment
CREATE OR REPLACE FUNCTION notify_ticket_assigned()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if assigned_agent_id changed and is not null
    IF (TG_OP = 'UPDATE' AND
        NEW.assigned_agent_id IS NOT NULL AND
        (OLD.assigned_agent_id IS NULL OR OLD.assigned_agent_id != NEW.assigned_agent_id)) THEN

        PERFORM create_notification(
            NEW.assigned_agent_id,
            'ticket_assigned',
            'Ticket assigned to you',
            'Ticket #' || NEW.ticket_number || ' "' || LEFT(NEW.subject, 50) ||
                CASE WHEN LENGTH(NEW.subject) > 50 THEN '...' ELSE '' END ||
                '" has been assigned to you',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ticket assignment notifications
CREATE TRIGGER on_ticket_assigned
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_ticket_assigned();

-- Function to notify on snooze expiry (called by unsnooze_expired_tickets)
CREATE OR REPLACE FUNCTION notify_snooze_expired(
    p_ticket_id UUID,
    p_ticket_number INT,
    p_subject TEXT,
    p_agent_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM create_notification(
        p_agent_id,
        'snooze_expired',
        'Snoozed ticket is back',
        'Ticket #' || p_ticket_number || ' "' || LEFT(p_subject, 50) ||
            CASE WHEN LENGTH(p_subject) > 50 THEN '...' ELSE '' END ||
            '" is back in your inbox (snooze expired)',
        p_ticket_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unsnooze_expired_tickets to also send notifications
CREATE OR REPLACE FUNCTION unsnooze_expired_tickets()
RETURNS TABLE (
    ticket_id UUID,
    ticket_number INT
) AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    FOR v_ticket IN
        SELECT t.id, t.ticket_number, t.subject, t.assigned_agent_id
        FROM tickets t
        WHERE t.snoozed_until IS NOT NULL
            AND t.snoozed_until <= NOW()
            AND t.status = 'pending'
    LOOP
        -- Update the ticket
        UPDATE tickets
        SET status = 'open',
            snoozed_until = NULL,
            snoozed_by = NULL
        WHERE id = v_ticket.id;

        -- Send notification to the assigned agent
        IF v_ticket.assigned_agent_id IS NOT NULL THEN
            PERFORM notify_snooze_expired(
                v_ticket.id,
                v_ticket.ticket_number,
                v_ticket.subject,
                v_ticket.assigned_agent_id
            );
        END IF;

        -- Return the ticket info
        ticket_id := v_ticket.id;
        ticket_number := v_ticket.ticket_number;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION notify_snooze_expired TO authenticated;
