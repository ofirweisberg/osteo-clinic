-- Schedule blocks: one-time or recurring weekly time blocks
CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type TEXT NOT NULL DEFAULT 'one_time' CHECK (block_type IN ('one_time', 'recurring')),
  -- For one-time blocks: specific date+time range
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  -- For recurring blocks: day of week (0=Sunday..6=Saturday) + time range
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  -- For recurring: dates to skip (YYYY-MM-DD strings)
  exception_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Common
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_blocks_type ON schedule_blocks (block_type);
CREATE INDEX idx_schedule_blocks_starts_at ON schedule_blocks (starts_at);
CREATE INDEX idx_schedule_blocks_day ON schedule_blocks (day_of_week);

-- RLS
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON schedule_blocks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read blocks for booking availability
CREATE POLICY "Public read schedule blocks" ON schedule_blocks
  FOR SELECT TO anon USING (true);
