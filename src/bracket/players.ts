// Placeholder players for development. Replace with real data before launch.
//
// To swap in the real player roster:
// 1. Update each entry below with twitchUsername, displayName, countryCode
// 2. Or seed the `players` table directly in Supabase via SQL/CSV import
//    and the app will fetch from there at runtime.

import type { Player } from './types';

export const PLACEHOLDER_PLAYERS: Player[] = Array.from({ length: 32 }, (_, i) => {
  const seed = i + 1;
  return {
    id: `placeholder-${seed}`,
    seed,
    twitchUsername: `player${seed}`,
    displayName: `Player ${seed}`,
    // Cycle through a few country codes so the flag rendering is visible during dev
    countryCode: ['us', 'fr', 'de', 'br', 'ca', 'gb', 'es', 'jp'][i % 8],
  };
});
