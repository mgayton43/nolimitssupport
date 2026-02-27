-- Track per-user read state for tickets

CREATE TABLE IF NOT EXISTS ticket_reads (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_reads_user ON ticket_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reads_ticket ON ticket_reads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reads_last_read_at ON ticket_reads(last_read_at DESC);

CREATE TRIGGER update_ticket_reads_updated_at BEFORE UPDATE ON ticket_reads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ticket_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ticket reads" ON ticket_reads
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own ticket reads" ON ticket_reads
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ticket reads" ON ticket_reads
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own ticket reads" ON ticket_reads
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());
