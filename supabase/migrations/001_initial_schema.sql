-- Strikeman Support Desk Database Schema
-- Initial migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'viewer');
CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'agent',
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}', -- For Shopify integration, order history, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6B7280',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number SERIAL UNIQUE,
    subject TEXT NOT NULL,
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'medium',
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket tags junction table
CREATE TABLE ticket_tags (
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, tag_id)
);

-- Messages table (ticket conversation)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent')),
    sender_id UUID, -- References customers or profiles depending on sender_type
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Agent-only notes
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canned responses (macros/templates)
CREATE TABLE canned_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    shortcut TEXT, -- Quick access code like /thanks
    category TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT true, -- If false, only visible to creator
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket activities (audit log)
CREATE TABLE ticket_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'status_changed', 'assigned', 'tagged', etc.
    old_value TEXT,
    new_value TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_assigned_agent ON tickets(assigned_agent_id);
CREATE INDEX idx_tickets_assigned_team ON tickets(assigned_team_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_messages_ticket ON messages(ticket_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX idx_customers_email ON customers(email);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_canned_responses_updated_at BEFORE UPDATE ON canned_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ticket activity logging trigger
CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO ticket_activities (ticket_id, actor_id, action, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_agent_id, 'status_changed', OLD.status::TEXT, NEW.status::TEXT);
        END IF;

        -- Log priority changes
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            INSERT INTO ticket_activities (ticket_id, actor_id, action, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_agent_id, 'priority_changed', OLD.priority::TEXT, NEW.priority::TEXT);
        END IF;

        -- Log assignment changes
        IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
            INSERT INTO ticket_activities (ticket_id, actor_id, action, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_agent_id, 'assigned', OLD.assigned_agent_id::TEXT, NEW.assigned_agent_id::TEXT);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ticket_activity_logger AFTER UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION log_ticket_activity();

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_val user_role;
BEGIN
    SELECT role INTO user_role_val
    FROM profiles
    WHERE id = auth.uid();

    RETURN COALESCE(user_role_val, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's team
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
DECLARE
    team_id_val UUID;
BEGIN
    SELECT team_id INTO team_id_val
    FROM profiles
    WHERE id = auth.uid();

    RETURN team_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- Row Level Security
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- Teams policies
CREATE POLICY "Authenticated users can view teams" ON teams
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teams" ON teams
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- Customers policies
CREATE POLICY "Agents and admins can view customers" ON customers
    FOR SELECT TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

CREATE POLICY "Agents and admins can manage customers" ON customers
    FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

-- Tickets policies
CREATE POLICY "Agents and admins can view all tickets" ON tickets
    FOR SELECT TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

CREATE POLICY "Viewers can view team tickets" ON tickets
    FOR SELECT TO authenticated
    USING (
        get_user_role() = 'viewer'
        AND assigned_team_id = get_user_team_id()
    );

CREATE POLICY "Agents and admins can manage tickets" ON tickets
    FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

-- Ticket tags policies
CREATE POLICY "Authenticated users can view ticket tags" ON ticket_tags
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agents and admins can manage ticket tags" ON ticket_tags
    FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

-- Tags policies
CREATE POLICY "Authenticated users can view tags" ON tags
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tags" ON tags
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- Messages policies
CREATE POLICY "Agents and admins can view all messages" ON messages
    FOR SELECT TO authenticated
    USING (get_user_role() IN ('admin', 'agent'));

CREATE POLICY "Viewers can view non-internal messages for team tickets" ON messages
    FOR SELECT TO authenticated
    USING (
        get_user_role() = 'viewer'
        AND is_internal = false
        AND ticket_id IN (
            SELECT id FROM tickets WHERE assigned_team_id = get_user_team_id()
        )
    );

CREATE POLICY "Agents and admins can create messages" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'agent'));

-- Canned responses policies
CREATE POLICY "Users can view shared canned responses" ON canned_responses
    FOR SELECT TO authenticated
    USING (is_shared = true OR created_by = auth.uid());

CREATE POLICY "Users can manage own canned responses" ON canned_responses
    FOR ALL TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all canned responses" ON canned_responses
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin');

-- Ticket activities policies
CREATE POLICY "Users can view ticket activities" ON ticket_activities
    FOR SELECT TO authenticated USING (true);

-- =====================
-- Report Functions
-- =====================

-- Get ticket volume stats
CREATE OR REPLACE FUNCTION get_ticket_volume(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
    date DATE,
    opened BIGINT,
    closed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.date,
        COUNT(t.id) FILTER (WHERE t.created_at::DATE = d.date) as opened,
        COUNT(t.id) FILTER (WHERE t.resolved_at::DATE = d.date) as closed
    FROM generate_series(start_date::DATE, end_date::DATE, '1 day'::INTERVAL) AS d(date)
    LEFT JOIN tickets t ON t.created_at::DATE = d.date OR t.resolved_at::DATE = d.date
    GROUP BY d.date
    ORDER BY d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get response time stats
CREATE OR REPLACE FUNCTION get_response_time_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
    avg_first_response_minutes NUMERIC,
    avg_resolution_minutes NUMERIC,
    total_tickets BIGINT,
    tickets_with_response BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)::NUMERIC, 2),
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::NUMERIC, 2),
        COUNT(*),
        COUNT(first_response_at)
    FROM tickets
    WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get agent performance
CREATE OR REPLACE FUNCTION get_agent_performance(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    tickets_resolved BIGINT,
    avg_response_minutes NUMERIC,
    avg_resolution_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        COUNT(t.id) FILTER (WHERE t.status = 'closed'),
        ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60)::NUMERIC, 2),
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60)::NUMERIC, 2)
    FROM profiles p
    LEFT JOIN tickets t ON t.assigned_agent_id = p.id
        AND t.created_at BETWEEN start_date AND end_date
    WHERE p.role IN ('admin', 'agent')
    GROUP BY p.id, p.full_name
    ORDER BY COUNT(t.id) FILTER (WHERE t.status = 'closed') DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- Realtime
-- =====================

-- Enable realtime for tickets and messages
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =====================
-- Profile Creation Trigger
-- =====================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
