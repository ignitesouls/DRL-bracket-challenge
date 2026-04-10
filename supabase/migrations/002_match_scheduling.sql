-- DRL Bracket Challenge — Match Scheduling
-- Adds a per-match `scheduled_at` column so matches can auto-flip to "LIVE"
-- on the bracket as their scheduled start time arrives. The admin can still
-- override the live state manually via the existing `status` column.
--
-- Run this in the Supabase SQL Editor after 001_initial_schema.sql.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Optional helper index for "what's coming up next" type queries
CREATE INDEX IF NOT EXISTS matches_scheduled_at_idx
  ON matches (scheduled_at)
  WHERE scheduled_at IS NOT NULL;
