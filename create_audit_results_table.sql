-- Create audit_results table
CREATE TABLE IF NOT EXISTS audit_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    total_suggestions INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
    updates JSONB NOT NULL,
    applied_at TIMESTAMPTZ,
    applied_count INTEGER DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_results_user_id ON audit_results(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_created_at ON audit_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_results_status ON audit_results(status);

-- Enable Row Level Security
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own audit results"
    ON audit_results FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit results"
    ON audit_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audit results"
    ON audit_results FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audit results"
    ON audit_results FOR DELETE
    USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_audit_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Only add trigger if you add updated_at column
-- ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- CREATE TRIGGER audit_results_updated_at
--     BEFORE UPDATE ON audit_results
--     FOR EACH ROW
--     EXECUTE FUNCTION update_audit_results_updated_at();
