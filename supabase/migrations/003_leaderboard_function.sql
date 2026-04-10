-- DRL Bracket Challenge — Leaderboard
--
-- Computes per-user pick statistics WITHOUT exposing the raw `predictions`
-- table. This is the privacy-preserving entry point: viewers see aggregated
-- counts and points, never another user's individual picks.
--
-- Run this in the Supabase SQL Editor after 002_match_scheduling.sql.
--
-- Scoring: weighted by round.
--   Winners R1            = 1pt   Losers R1, R2          = 1pt
--   Winners QF            = 2pt   Losers R3, R4          = 2pt
--   Winners SF            = 3pt   Losers R5, QF          = 3pt
--   Winners Final         = 5pt   Losers SF, Final       = 5pt
--   Grand Final           = 8pt
--
-- Inclusion: only users with a complete bracket (>= 46 picks).

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  user_id        UUID,
  display_name   TEXT,
  twitch_handle  TEXT,
  total_picks    INT,
  resolved_count INT,
  correct_count  INT,
  points         INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  WITH match_points AS (
    SELECT
      m.id,
      m.winner_id,
      CASE m.bracket_side
        WHEN 'winners' THEN
          CASE m.round
            WHEN 1 THEN 1
            WHEN 2 THEN 2
            WHEN 3 THEN 3
            WHEN 4 THEN 5
            ELSE 1
          END
        WHEN 'losers' THEN
          CASE m.round
            WHEN 1 THEN 1
            WHEN 2 THEN 1
            WHEN 3 THEN 2
            WHEN 4 THEN 2
            WHEN 5 THEN 3
            WHEN 6 THEN 3
            WHEN 7 THEN 5
            WHEN 8 THEN 5
            ELSE 1
          END
        WHEN 'grand_final' THEN 8
        ELSE 1
      END AS pts
    FROM matches m
  ),
  user_stats AS (
    SELECT
      p.user_id,
      COUNT(*)::INT AS total_picks,
      COUNT(*) FILTER (WHERE mp.winner_id IS NOT NULL)::INT AS resolved_count,
      COUNT(*) FILTER (
        WHERE mp.winner_id IS NOT NULL
          AND p.predicted_winner_id = mp.winner_id
      )::INT AS correct_count,
      COALESCE(
        SUM(mp.pts) FILTER (
          WHERE mp.winner_id IS NOT NULL
            AND p.predicted_winner_id = mp.winner_id
        ),
        0
      )::INT AS points
    FROM predictions p
    JOIN match_points mp ON mp.id = p.match_id
    GROUP BY p.user_id
    HAVING COUNT(*) >= 46  -- Full brackets only
  )
  SELECT
    s.user_id,
    COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'preferred_username',
      'Unknown'
    ) AS display_name,
    u.raw_user_meta_data->>'preferred_username' AS twitch_handle,
    s.total_picks,
    s.resolved_count,
    s.correct_count,
    s.points
  FROM user_stats s
  LEFT JOIN auth.users u ON u.id = s.user_id
  ORDER BY s.points DESC, s.correct_count DESC, display_name ASC;
$$;

-- Anyone (logged in or not) can call the function. The function itself
-- bypasses RLS thanks to SECURITY DEFINER, but only returns aggregates.
GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon, authenticated;
