-- DRL Bracket Challenge — All-Brackets (admin view)
--
-- Returns every submitted bracket as one JSONB blob per user. This powers
-- the admin-only "All Brackets" tab, which renders each user's full 46-match
-- bracket by replaying their picks through the client-side engine.
--
-- Gates (both enforced server-side, defense in depth):
--   1. Caller MUST be an admin (is_admin() helper from 001_initial_schema).
--   2. Global prediction deadline MUST have passed. This prevents even an
--      admin from accidentally peeking at in-progress brackets and
--      leaking information that could change how other users pick.
--
-- Run this in the Supabase SQL Editor after 003_leaderboard_function.sql.

CREATE OR REPLACE FUNCTION get_all_brackets()
RETURNS TABLE (
  user_id       UUID,
  display_name  TEXT,
  twitch_handle TEXT,
  picks         JSONB,
  submitted_at  TIMESTAMPTZ,
  total_picks   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  -- Keep this constant in lock-step with predictions_unlocked() in 001.
  IF now() < TIMESTAMPTZ '2026-04-12 08:00:00-07' THEN
    RAISE EXCEPTION 'forbidden: predictions are still open'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'preferred_username',
      'Unknown'
    ) AS display_name,
    (u.raw_user_meta_data->>'preferred_username')::TEXT AS twitch_handle,
    jsonb_object_agg(p.match_id, p.predicted_winner_id) AS picks,
    MAX(p.created_at) AS submitted_at,
    COUNT(*)::INT AS total_picks
  FROM predictions p
  LEFT JOIN auth.users u ON u.id = p.user_id
  GROUP BY p.user_id, u.raw_user_meta_data
  ORDER BY display_name ASC;
END;
$$;

-- Only authenticated users need to call this; RLS/gates take care of
-- the rest. anon role has no reason to ever see the response.
REVOKE ALL ON FUNCTION get_all_brackets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_all_brackets() TO authenticated;
