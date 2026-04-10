-- DRL Bracket Challenge — Initial Schema
-- Run this in Supabase SQL Editor before starting the app.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Players in the tournament. Manually seeded by admin.
CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed          INTEGER NOT NULL UNIQUE,
  twitch_username TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  country_code  TEXT NOT NULL,  -- ISO 3166-1 alpha-2, lowercase (e.g. 'fr')
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Official match results. Only admin can write.
CREATE TABLE IF NOT EXISTS matches (
  id            TEXT PRIMARY KEY,                  -- e.g. 'W1', 'L17', 'GF'
  bracket_side  TEXT NOT NULL CHECK (bracket_side IN ('winners','losers','grand_final')),
  round         INTEGER NOT NULL,
  round_label   TEXT NOT NULL,
  player1_id    UUID REFERENCES players(id) ON DELETE SET NULL,
  player2_id    UUID REFERENCES players(id) ON DELETE SET NULL,
  winner_id     UUID REFERENCES players(id) ON DELETE SET NULL,
  score         TEXT,                              -- e.g. '2-0', '2-1'
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','live','completed')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User predictions. One per (user, match).
CREATE TABLE IF NOT EXISTS predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id        TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

-- Admin allowlist. Insert your Twitch user ID here to grant admin access.
CREATE TABLE IF NOT EXISTS admins (
  twitch_user_id TEXT PRIMARY KEY,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Updated_at trigger for matches
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_updated_at ON matches;
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS predictions_updated_at ON predictions;
CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: is the current authenticated user an admin?
-- Reads the Twitch user ID out of the JWT (Supabase populates this from
-- the OAuth provider).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
DECLARE
  twitch_id TEXT;
BEGIN
  -- Supabase puts the Twitch provider's user id at user_metadata.provider_id
  twitch_id := COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'provider_id'),
    (auth.jwt() -> 'app_metadata' ->> 'provider_id')
  );

  IF twitch_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (SELECT 1 FROM admins WHERE twitch_user_id = twitch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins      ENABLE ROW LEVEL SECURITY;

-- Players: anyone can read, only admins can write
DROP POLICY IF EXISTS players_read ON players;
CREATE POLICY players_read ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS players_admin_write ON players;
CREATE POLICY players_admin_write ON players FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Matches: anyone can read, only admins can write
DROP POLICY IF EXISTS matches_read ON matches;
CREATE POLICY matches_read ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS matches_admin_write ON matches;
CREATE POLICY matches_admin_write ON matches FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Predictions: a user can read their OWN picks (and admins can read all
-- for scoring / leaderboards). This prevents anonymous scraping of every
-- viewer's bracket before the tournament is locked in.
DROP POLICY IF EXISTS predictions_read ON predictions;
CREATE POLICY predictions_read ON predictions FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- Global cutoff: after this moment, no user can create / edit / delete a
-- prediction row. Keep this constant in lock-step with src/config/lockTime.ts
-- on the client. Sunday April 12, 2026 — 8:00 AM Pacific (PDT, UTC-7) === 15:00 UTC.
CREATE OR REPLACE FUNCTION predictions_unlocked() RETURNS boolean AS $$
  SELECT now() < TIMESTAMPTZ '2026-04-12 08:00:00-07';
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS predictions_own_insert ON predictions;
CREATE POLICY predictions_own_insert ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND predictions_unlocked());

DROP POLICY IF EXISTS predictions_own_update ON predictions;
CREATE POLICY predictions_own_update ON predictions FOR UPDATE
  USING (auth.uid() = user_id AND predictions_unlocked())
  WITH CHECK (auth.uid() = user_id AND predictions_unlocked());

DROP POLICY IF EXISTS predictions_own_delete ON predictions;
CREATE POLICY predictions_own_delete ON predictions FOR DELETE
  USING (auth.uid() = user_id AND predictions_unlocked());

-- Admins table: anyone authenticated can read (so the client can check
-- their own admin status), but no one can write via the API. Inserts
-- happen only via direct SQL access in the Supabase dashboard.
DROP POLICY IF EXISTS admins_read ON admins;
CREATE POLICY admins_read ON admins FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Realtime: enable change broadcasts on matches and predictions
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='predictions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;
END $$;
