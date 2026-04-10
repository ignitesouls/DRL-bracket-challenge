// DRL Top 32 — official roster.
//
// This is the canonical seed list used by:
//   1. The "Seed Players" admin button (inserts these into Supabase)
//   2. Local-only / preview mode when no Supabase env vars are set
//
// To swap in a different roster, just edit this list. The `id` values
// here are placeholders only — when the rows are inserted into Supabase,
// Postgres assigns real UUIDs and the app re-fetches them at runtime.

import type { Player } from './types';

interface RosterEntry {
  seed: number;
  twitchUsername: string;
  displayName: string;
  countryCode: string; // ISO 3166-1 alpha-2, lowercase
}

const ROSTER: RosterEntry[] = [
  { seed: 1,  twitchUsername: 'hoozher',            displayName: 'HooZher',            countryCode: 'us' },
  { seed: 2,  twitchUsername: 'ironyeu',            displayName: 'Ironyeu',            countryCode: 'fr' },
  { seed: 3,  twitchUsername: 'Niorra',             displayName: 'Niorra',             countryCode: 'fr' },
  { seed: 4,  twitchUsername: 'AzaZ_ow',            displayName: 'AzaZ_ow',            countryCode: 'bg' },
  { seed: 5,  twitchUsername: 'Kayjuro_',           displayName: 'Kayjuro_',           countryCode: 'de' },
  { seed: 6,  twitchUsername: 'Rakushain_',         displayName: 'Rakushain_',         countryCode: 'fr' },
  { seed: 7,  twitchUsername: 'psiphicode',         displayName: 'psiphicode',         countryCode: 'us' },
  { seed: 8,  twitchUsername: 'Forsa',              displayName: 'Forsa',              countryCode: 'us' },
  { seed: 9,  twitchUsername: 'EnsgMaster',         displayName: 'EnsgMaster',         countryCode: 'fr' },
  { seed: 10, twitchUsername: 'LazyHelios',         displayName: 'LazyHelios',         countryCode: 'in' },
  { seed: 11, twitchUsername: 'GustafGabel',        displayName: 'GustafGabel',        countryCode: 'de' },
  { seed: 12, twitchUsername: 'poleuky',            displayName: 'poleuky',            countryCode: 'fr' },
  { seed: 13, twitchUsername: 'Pluryl',             displayName: 'Pluryl',             countryCode: 'us' },
  { seed: 14, twitchUsername: 'RomainJacques_',     displayName: 'RomainJacques_',     countryCode: 'ch' },
  { seed: 15, twitchUsername: 'jeffqed',            displayName: 'jeffqed',            countryCode: 'de' },
  { seed: 16, twitchUsername: 'rambler_ing',        displayName: 'rambler_ing',        countryCode: 'br' },
  { seed: 17, twitchUsername: 'pirl_fresh',         displayName: 'pirl_fresh',         countryCode: 'fr' },
  { seed: 18, twitchUsername: 'SeriousChallenges',  displayName: 'SeriousChallenges',  countryCode: 'de' },
  { seed: 19, twitchUsername: 'wander652',          displayName: 'wander652',          countryCode: 'us' },
  { seed: 20, twitchUsername: 'consta_sama',        displayName: 'consta_sama',        countryCode: 'fr' },
  { seed: 21, twitchUsername: 'Typin__',            displayName: 'Typin__',            countryCode: 'fr' },
  { seed: 22, twitchUsername: 'LilAggy',            displayName: 'LilAggy',            countryCode: 'us' },
  { seed: 23, twitchUsername: 'Mokyx',              displayName: 'Mokyx',              countryCode: 'fr' },
  { seed: 24, twitchUsername: 'NuclearPastaTom',    displayName: 'NuclearPastaTom',    countryCode: 'us' },
  { seed: 25, twitchUsername: 'az_gar25',           displayName: 'az_gar25',           countryCode: 'de' },
  { seed: 26, twitchUsername: 'mr_dr_raven',        displayName: 'mr_dr_raven',        countryCode: 'ua' },
  { seed: 27, twitchUsername: 'Unlucked_Destro',    displayName: 'Unlucked_Destro',    countryCode: 'fr' },
  { seed: 28, twitchUsername: 'Teddy59C',           displayName: 'Teddy59C',           countryCode: 'fr' },
  { seed: 29, twitchUsername: 'theMixed_',          displayName: 'theMixed_',          countryCode: 'fr' },
  { seed: 30, twitchUsername: 'Owarida',            displayName: 'Owarida',            countryCode: 'fr' },
  { seed: 31, twitchUsername: 'RannisConsortBryan', displayName: 'RannisConsortBryan', countryCode: 'ca' },
  { seed: 32, twitchUsername: 'Dagann_e',           displayName: 'Dagann_e',           countryCode: 'fr' },
];

export const PLACEHOLDER_PLAYERS: Player[] = ROSTER.map((p) => ({
  id: `placeholder-${p.seed}`,
  seed: p.seed,
  twitchUsername: p.twitchUsername,
  displayName: p.displayName,
  countryCode: p.countryCode,
}));
