#!/usr/bin/env python3
"""
DRL Season 2 — Full Dashboard Generator
========================================
Usage:
    python3 drl_generate.py drl_s2_playoffs.html [options]

    --no-avatars     Skip Twitch avatar fetching (faster, uses initials)
    --no-dates       Skip match date scraping
    --no-model       Skip model recalculation (only update dates/avatars)

Twitch avatar fetching (optional):
    Set env vars for API-based avatar fetch (most reliable):
        export TWITCH_CLIENT_ID=your_client_id
        export TWITCH_CLIENT_SECRET=your_client_secret

    Without credentials, falls back to scraping og:image from Twitch pages.

Dependencies:
    pip install requests beautifulsoup4 numpy scipy
"""

import sys, os, re, json, time, argparse
import urllib.request
import numpy as np
from datetime import datetime, timezone

# ── Try optional imports ──────────────────────────────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("WARNING: requests not installed — some features unavailable")
    print("  pip install requests beautifulsoup4")

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════════════════

LEADERBOARD_URL = "https://drl.forsa.tv/assets/json/qualifiers-leaderboard.json"
MATCHES_URL     = "https://drl.forsa.tv/matches"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_USERS_URL = "https://api.twitch.tv/helix/users"

TOTAL_SEEDS      = 8
N_SIM            = 1_000_000
SEED_RNG         = 42
TWO_WAY_ITERS    = 50
RAGE_COMPRESS_LO = 72.0
RAGE_COMPRESS_HI = 83.0
SCORE_LO         = 60
SCORE_HI         = 90
SIGMA_FLOOR      = 2.0
SIGMA_CEIL       = 6.0
P_BASE           = 0.05
BAIT_K           = 0.05
DEATH_GAMMA      = 0.3
DEATH_PENALTY    = 1
CLEAN_FLOOR      = 60
SPREAD_BLEND     = 0.6

PLAYOFF_PLAYERS = [
    "HooZher", "ironyeu", "Niorra", "AzaZ_ow", "Kayjuro_", "Rakushain_",
    "psiphicode", "Forsa", "EnsgMaster", "LazyHelios", "GustafGabel", "poleuky",
    "Pluryl", "RomainJacques_", "jeffqed", "rambler_ing", "pirl_fresh",
    "SeriousChallenges", "wander652", "consta_sama", "Typin__", "LilAggy",
    "Mokyx", "NuclearPastaTom", "az_gar25", "mr_dr_raven", "Unlucked_Destro",
    "Teddy59C", "theMixed_", "Owarida", "RannisConsortBryan", "Dagann_e",
]

W_R1 = {
    'W1': ('HooZher', 'rambler_ing'),    'W2': ('Forsa', 'EnsgMaster'),
    'W3': ('Kayjuro_', 'poleuky'),        'W4': ('AzaZ_ow', 'Pluryl'),
    'W5': ('Rakushain_', 'GustafGabel'), 'W6': ('Niorra', 'RomainJacques_'),
    'W7': ('psiphicode', 'LazyHelios'),  'W8': ('ironyeu', 'jeffqed'),
}
L_R1 = {
    'L1': ('pirl_fresh', 'Dagann_e'),          'L2': ('NuclearPastaTom', 'az_gar25'),
    'L3': ('Typin__', 'Teddy59C'),              'L4': ('consta_sama', 'theMixed_'),
    'L5': ('LilAggy', 'Unlucked_Destro'),       'L6': ('wander652', 'Owarida'),
    'L7': ('Mokyx', 'mr_dr_raven'),             'L8': ('SeriousChallenges', 'RannisConsortBryan'),
}
MATCHUP_BY_PLAYERS = {frozenset(v): k for k, v in {**W_R1, **L_R1}.items()}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — FETCH LEADERBOARD
# ══════════════════════════════════════════════════════════════════════════════

def fetch_leaderboard():
    print("Fetching leaderboard...")
    path = "qualifiers-leaderboard.json"
    urllib.request.urlretrieve(LEADERBOARD_URL, path)
    with open(path) as f:
        data = json.load(f)
    print(f"  {len(data)} players loaded")
    return data

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — SCRAPE MATCH DATES
# ══════════════════════════════════════════════════════════════════════════════

def scrape_match_dates():
    """
    Fetch match schedule from the DRL API endpoint.
    Returns UTC ISO strings for all scheduled R1 matches.
    """
    API_URL = 'https://drl.forsa.tv/api/matches-upcoming.php'
    if not HAS_REQUESTS:
        print("Skipping date fetch (requests not installed)")
        return {}
    print("Fetching match schedule from API...")
    try:
        resp = requests.get(API_URL, timeout=10,
                            headers={"User-Agent": "Mozilla/5.0 RAGEBAIT/2.0"})
        resp.raise_for_status()
        matches = resp.json()
    except Exception as e:
        print(f"  WARNING: {e}")
        return {}

    dates = {}
    for m in matches:
        p1  = m.get('player1', '').strip()
        p2  = m.get('player2', '').strip()
        dt  = m.get('date', '').strip()   # already UTC: "2026-04-12 17:00:00"
        if not dt:
            continue
        iso = dt.replace(' ', 'T') + 'Z'
        key = frozenset([p1, p2])
        mid = MATCHUP_BY_PLAYERS.get(key)
        if mid:
            dates[mid] = iso
            print(f"  {mid}: {p1} vs {p2} → {iso}")
        else:
            print(f"  UNMATCHED: {p1} vs {p2}")

    print(f"  {len(dates)} scheduled matches found")
    return dates

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — FETCH TWITCH AVATARS
# ══════════════════════════════════════════════════════════════════════════════

def get_twitch_token(client_id, client_secret):
    resp = requests.post(TWITCH_TOKEN_URL, params={
        'client_id': client_id, 'client_secret': client_secret,
        'grant_type': 'client_credentials',
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()['access_token']

def fetch_avatars_api(client_id, client_secret):
    print("Fetching Twitch avatars via API...")
    try:
        token = get_twitch_token(client_id, client_secret)
    except Exception as e:
        print(f"  WARNING: token failed: {e}")
        return {}
    headers = {'Client-Id': client_id, 'Authorization': f'Bearer {token}'}
    logins = [p.lower() for p in PLAYOFF_PLAYERS]
    avatars = {}
    for i in range(0, len(logins), 100):
        batch = logins[i:i+100]
        try:
            resp = requests.get(TWITCH_USERS_URL, headers=headers,
                                params=[('login', l) for l in batch], timeout=10)
            resp.raise_for_status()
            for user in resp.json().get('data', []):
                login = user['login'].lower()
                url   = user.get('profile_image_url', '')
                for original in PLAYOFF_PLAYERS:
                    if original.lower() == login:
                        avatars[original] = url
                        break
        except Exception as e:
            print(f"  WARNING: batch failed: {e}")
    found = sum(1 for v in avatars.values() if v)
    print(f"  {found}/{len(PLAYOFF_PLAYERS)} avatars fetched via API")
    return avatars

def fetch_avatars_scrape():
    """Fallback: scrape og:image from each Twitch page."""
    if not HAS_REQUESTS:
        print("Skipping avatar scrape (requests not installed)")
        return {}
    print("Fetching Twitch avatars via scrape (no credentials)...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    avatars = {}
    for name in PLAYOFF_PLAYERS:
        url = f'https://www.twitch.tv/{name.lower()}'
        try:
            resp = requests.get(url, headers=headers, timeout=8)
            m = re.search(r'property="og:image"\s+content="([^"]+)"', resp.text)
            if m and 'ttv-static' not in m.group(1):
                avatars[name] = m.group(1)
                print(f"  {name}: OK")
            else:
                avatars[name] = None
                print(f"  {name}: not found")
        except Exception as e:
            avatars[name] = None
            print(f"  {name}: ERROR")
        time.sleep(0.3)
    found = sum(1 for v in avatars.values() if v)
    print(f"  {found}/{len(PLAYOFF_PLAYERS)} avatars scraped")
    return avatars

def fetch_avatars(skip=False):
    if skip:
        return {n: None for n in PLAYOFF_PLAYERS}
    client_id     = os.environ.get('TWITCH_CLIENT_ID')
    client_secret = os.environ.get('TWITCH_CLIENT_SECRET')
    if client_id and client_secret and HAS_REQUESTS:
        return fetch_avatars_api(client_id, client_secret)
    else:
        if not client_id:
            print("TWITCH_CLIENT_ID not set — falling back to scrape")
            print("  (Set TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET for reliable avatar fetch)")
        return fetch_avatars_scrape()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — MODEL: FILTERED POPULATION + SEED MODEL
# ══════════════════════════════════════════════════════════════════════════════

def build_population(data):
    seed_all = {i: [] for i in range(TOTAL_SEEDS)}
    for p in data:
        for i, s in enumerate(p['seeds']):
            if s.get('score') is not None:
                seed_all[i].append(s['score'])

    seed_sorted = {i: sorted(seed_all[i], reverse=True) for i in range(TOTAL_SEEDS)}
    top20_names = set()
    for i in range(TOTAL_SEEDS):
        for sc, name in sorted(
            [(s['score'], p['name']) for p in data
             for j, s in enumerate(p['seeds'])
             if j == i and s.get('score') is not None], reverse=True)[:20]:
            top20_names.add(name)

    def total(p):
        return sum(s['score'] for s in p['seeds'] if s.get('score') is not None)

    filtered = [p for p in data if total(p) >= 200 or p['name'] in top20_names]
    print(f"  Filtered population: {len(filtered)} players")

    mu_top10  = {i: np.mean(seed_sorted[i][:10]) for i in range(TOTAL_SEEDS)}
    mu_top20  = {i: np.mean(seed_sorted[i][:20]) for i in range(TOTAL_SEEDS)}
    mu_full   = {i: np.mean(seed_sorted[i])       for i in range(TOTAL_SEEDS)}
    sigma_full= {i: np.std(seed_sorted[i], ddof=1) for i in range(TOTAL_SEEDS)}
    global_mu = np.mean(list(mu_full.values()))
    delta     = {i: mu_full[i] - global_mu for i in range(TOTAL_SEEDS)}

    return filtered, seed_sorted, {
        'mu_top10': mu_top10, 'mu_top20': mu_top20, 'mu_full': mu_full,
        'sigma_full': sigma_full, 'global_mu': global_mu, 'delta': delta,
        'seed_sorted': {i: list(seed_sorted[i]) for i in range(TOTAL_SEEDS)},
    }

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — MODEL: PLAYER METRICS (RAGE, BAIT, CONSISTENCY)
# ══════════════════════════════════════════════════════════════════════════════

def two_way_decomposition(filtered, seed_model):
    name_idx = {p['name']: j for j, p in enumerate(filtered)}
    n_players = len(filtered)
    X = np.full((n_players, TOTAL_SEEDS), np.nan)
    for p in filtered:
        j = name_idx[p['name']]
        for i, s in enumerate(p['seeds']):
            if s.get('score') is not None:
                X[j, i] = s['score']

    mu_global = np.nanmean(X)
    alpha = np.zeros(n_players)
    delta = np.zeros(TOTAL_SEEDS)

    for _ in range(TWO_WAY_ITERS):
        for i in range(TOTAL_SEEDS):
            col = X[:, i]; mask = ~np.isnan(col)
            if mask.sum() > 0:
                delta[i] = np.mean(col[mask] - mu_global - alpha[mask])
        for j in range(n_players):
            row = X[j, :]; mask = ~np.isnan(row)
            if mask.sum() > 0:
                alpha[j] = np.mean(row[mask] - mu_global - delta[mask])

    alpha -= np.mean(alpha)
    return {p['name']: alpha[name_idx[p['name']]] for p in filtered}, delta, mu_global

def build_player_models(filtered, seed_model, alpha_all, delta, mu_global):
    mu_top10  = seed_model['mu_top10']
    mu_top20  = seed_model['mu_top20']
    seed_sorted = seed_model['seed_sorted']

    FLOOR_FRAC = 0.35
    UPPER_FRAC = 0.80
    K_RAGE     = 0.08
    LAM        = 0.5
    floor_s    = {i: FLOOR_FRAC * mu_top10[i] for i in range(TOTAL_SEEDS)}
    upper_s    = {i: UPPER_FRAC * mu_top20[i] for i in range(TOTAL_SEEDS)}

    def percentile_rank(score, seed_idx):
        pool = seed_sorted[seed_idx]; n = len(pool)
        rank = sum(1 for s in pool if s >= score)
        return 1.0 - (rank-1)/(n-1) if n > 1 else 1.0

    def rage_for(p):
        seed_pcts = [(percentile_rank(s['score'], i), s['score'], i)
                     for i, s in enumerate(p['seeds']) if s.get('score') is not None]
        top3 = sorted(seed_pcts, reverse=True)[:3]
        x_bar = np.mean([sc for _, sc, _ in top3])
        avg_ratio = np.mean([sc / mu_top20[idx] for _, sc, idx in top3])
        return x_bar * (1 + (avg_ratio - 1) / (1 + K_RAGE * x_bar))

    def raw_bait_for(p):
        played = [(s['score'], i) for i, s in enumerate(p['seeds'])
                  if s.get('score') is not None]
        if not played: return 0.0
        # Always drop the single worst score unconditionally
        worst_sc, worst_idx = min(played, key=lambda x: x[0])
        candidates = [(sc, i) for sc, i in played
                      if not (sc == worst_sc and i == worst_idx)]
        severities = []
        for sc, i in candidates:
            u, fl = upper_s[i], floor_s[i]
            if sc >= u:    sev = 0.0
            elif sc <= fl: sev = 1.0
            else:          sev = (u - sc) / (u - fl)
            severities.append(sev)
        worst5  = sorted(severities, reverse=True)[:5]
        weights = [np.exp(-LAM * j) for j in range(len(worst5))]
        return sum(weights[j] * worst5[j] for j in range(len(worst5))) / sum(weights)

    def consistency_for(p):
        scores = sorted([s['score'] for s in p['seeds']
                         if s.get('score') is not None], reverse=True)
        avg_top2 = np.mean(scores[:2])
        avg_mid  = np.mean(scores[2:5])
        return 1.0 - (avg_top2 - avg_mid) / avg_top2

    p95 = np.percentile([raw_bait_for(p) for p in filtered], 95)

    filtered_map = {p['name']: p for p in filtered}
    players = {}
    for name in PLAYOFF_PLAYERS:
        p = filtered_map.get(name)
        if p is None: continue
        alpha_raw = alpha_all.get(name, 0.0)
        sigma_eps = np.std(
            [s['score'] - mu_global - delta[i] - alpha_raw
             for i, s in enumerate(p['seeds']) if s.get('score') is not None],
            ddof=1
        ) if sum(1 for s in p['seeds'] if s.get('score') is not None) >= 2 else 15.0

        players[name] = {
            'name':        name,
            'rage':        rage_for(p),
            'bait':        max(1.0, min(5.0, 1.0 + 4.0 * raw_bait_for(p) / p95)),
            'consistency': consistency_for(p),
            'sigma_eps':   sigma_eps,
            'mu_player':   mu_global + alpha_raw,
            'scores':      [s['score'] for s in p['seeds']],
        }

    # Compress RAGE to [RAGE_COMPRESS_LO, RAGE_COMPRESS_HI]
    rage_vals = [players[n]['rage'] for n in players]
    rmin, rmax = min(rage_vals), max(rage_vals)
    for name in players:
        raw = players[name]['rage']
        players[name]['rage'] = (
            RAGE_COMPRESS_LO + (raw - rmin) / (rmax - rmin) *
            (RAGE_COMPRESS_HI - RAGE_COMPRESS_LO)
            if rmax > rmin else (RAGE_COMPRESS_LO + RAGE_COMPRESS_HI) / 2
        )

    print(f"  BAIT anchor (p95): {p95:.4f}")
    return players

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — SIMULATION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def _beta_params(mu_scaled, sig_scaled):
    sig_scaled = min(sig_scaled, np.sqrt(mu_scaled * (1 - mu_scaled)) * 0.95)
    conc = mu_scaled * (1 - mu_scaled) / sig_scaled**2 - 1
    return mu_scaled * conc, (1 - mu_scaled) * conc

def _player_run(p, seed_sigmas, n, spread_adj=0.0):
    span       = SCORE_HI - SCORE_LO
    base_sigma = np.clip(p['rage'] * (1.0 - p['consistency']), SIGMA_FLOOR, SIGMA_CEIL)
    mean_eff_sigma = np.clip(
        base_sigma + 0.4 * float(np.mean(seed_sigmas)) * 0.1,
        SIGMA_FLOOR, SIGMA_CEIL
    )
    mu_scaled  = np.clip((p['rage'] + spread_adj - SCORE_LO) / span, 0.05, 0.95)
    sig_scaled = np.clip(mean_eff_sigma / span, 0.001,
                         np.sqrt(mu_scaled * (1 - mu_scaled)) * 0.95)
    conc = mu_scaled * (1 - mu_scaled) / sig_scaled**2 - 1
    a, b = mu_scaled * conc, (1 - mu_scaled) * conc
    raw    = np.random.beta(a, b, size=n) * span + SCORE_LO
    scores = np.clip(np.round(raw).astype(int), SCORE_LO, SCORE_HI)
    pd1    = P_BASE + BAIT_K * np.log(max(p['bait'], 1.0 + 1e-9))
    pd2    = pd1 * DEATH_GAMMA
    rng_d  = np.random.default_rng()
    die1   = rng_d.random(n) < pd1
    die2   = die1 & (rng_d.random(n) < pd2)
    deaths = die1.astype(int) + die2.astype(int)
    return deaths, np.clip(scores - deaths * DEATH_PENALTY, SCORE_LO, SCORE_HI)

def _empirical_spread(p1, p2):
    diffs = []
    for i in range(TOTAL_SEEDS):
        s1 = p1['scores'][i] if i < len(p1['scores']) else None
        s2 = p2['scores'][i] if i < len(p2['scores']) else None
        if s1 is not None and s2 is not None and s1 > CLEAN_FLOOR and s2 > CLEAN_FLOOR:
            diffs.append(s1 - s2)
    if len(diffs) < 3: return None
    return float(np.median(sorted(diffs, key=abs)[:3]))

def simulate_match(p1, p2, seed_model, rng, n=N_SIM):
    sigma_s   = seed_model['sigma_full']
    s_idx     = rng.integers(0, TOTAL_SEEDS, size=n)
    seed_sigs = np.array([sigma_s[s] for s in s_idx])

    d1r, s1r = _player_run(p1, seed_sigs, n, 0.0)
    d2r, s2r = _player_run(p2, seed_sigs, n, 0.0)
    sim_median = float(np.median(s1r - s2r))

    emp = _empirical_spread(p1, p2)
    target = SPREAD_BLEND * emp + (1 - SPREAD_BLEND) * sim_median if emp is not None else sim_median
    adj    = target - sim_median

    d1, s1 = _player_run(p1, seed_sigs, n, adj)
    d2, s2 = _player_run(p2, seed_sigs, n, 0.0)
    p1_win  = (d1 < d2) | ((d1 == d2) & (s1 > s2))
    diff    = s1 - s2
    median_diff = int(np.median(diff))
    p1_win_prob = float(np.mean(p1_win))

    # Spread shading: only add 0.5 when it eliminates a meaningful push risk
    # and when it correctly assigns the half-point to the favorite's side.
    # Rule: if |median_diff| >= 1, shade by 0.5 away from zero (standard sportsbook logic).
    # If median_diff == 0 (true coin flip), leave as 0 — no shade needed.
    if median_diff == 0:
        spread = 0.0
    elif median_diff > 0:
        # p1 is favored — p1 spread is negative, so shade makes it -X.5
        spread = median_diff + 0.5
    else:
        # p2 is favored — p1 spread is positive, so shade makes it +X.5
        spread = median_diff - 0.5

    return round(float(np.mean(p1_win)), 4), spread

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — TOURNAMENT SIMULATION
# ══════════════════════════════════════════════════════════════════════════════

def simulate_tournament(players, seed_model, n=N_SIM):
    rng  = np.random.default_rng(SEED_RNG)
    pmap = {p['name']: p for p in players.values()}
    names = list(pmap.keys())

    print("  Precomputing pairwise win probabilities...")
    win_prob   = {}
    pair_spread = {}
    for i, a in enumerate(names):
        for b in names[i+1:]:
            p, spread = simulate_match(pmap[a], pmap[b], seed_model, rng, n=20_000)
            win_prob[(a, b)] = p;    win_prob[(b, a)] = 1 - p
            pair_spread[(a, b)] = spread; pair_spread[(b, a)] = -spread

    rounds = ['top32', 'top16', 'top8', 'top4', 'finalist', 'champion']
    reach  = {name: {r: 0 for r in rounds} for name in names}
    r1_wins = {mid: 0 for mid in list(W_R1.keys()) + list(L_R1.keys())}

    def pw(a, b):
        return np.random.random() < win_prob.get((a, b), 0.5)

    print(f"  Running {n} tournament simulations...")
    for _ in range(n):
        ww, wl, lw = {}, {}, {}
        for mid, (a, b) in W_R1.items():
            if pw(a, b): ww[mid]=a; wl[mid]=b
            else:        ww[mid]=b; wl[mid]=a
            r1_wins[mid] += (ww[mid] == a)
        for mid, (a, b) in L_R1.items():
            lw[mid] = a if pw(a, b) else b
            r1_wins[mid] += (lw[mid] == a)
        for name in names:
            reach[name]['top32'] += 1

        # LR2 (L9-L16): 8 matches
        # L9:W5L vs L1W, L10:W6L vs L2W, L11:W7L vs L3W, L12:W8L vs L4W
        # L13:W1L vs L5W, L14:W2L vs L6W, L15:W3L vs L7W, L16:W4L vs L8W
        lr2 = [wl[f'W{i+5}'] if pw(wl[f'W{i+5}'],lw[f'L{i+1}']) else lw[f'L{i+1}'] for i in range(4)] +               [wl[f'W{i+1}'] if pw(wl[f'W{i+1}'],lw[f'L{i+5}']) else lw[f'L{i+5}'] for i in range(4)]
        # lr2[0]=L9W, lr2[1]=L10W, lr2[2]=L11W, lr2[3]=L12W
        # lr2[4]=L13W, lr2[5]=L14W, lr2[6]=L15W, lr2[7]=L16W

        # WQF (W9-W12): W1W vs W4W, W2W vs W3W, W5W vs W8W, W6W vs W7W
        wqfw, wqfl = [], []
        for a, b in [(ww['W1'],ww['W4']),(ww['W2'],ww['W3']),(ww['W5'],ww['W8']),(ww['W6'],ww['W7'])]:
            w=a if pw(a,b) else b; l=b if w==a else a; wqfw.append(w); wqfl.append(l)
        # wqfl[0]=W9L, wqfl[1]=W10L, wqfl[2]=W11L, wqfl[3]=W12L

        # Top 16: WQF winners (4) + WQF losers (4) + LR2 winners (8) = 16
        for pl in wqfw + wqfl + lr2: reach[pl]['top16'] += 1

        # LR3 (L17-L20): LR2 winners pair up
        # L17: L9W vs L10W, L18: L11W vs L12W, L19: L13W vs L14W, L20: L15W vs L16W
        lr3 = [lr2[2*j] if pw(lr2[2*j], lr2[2*j+1]) else lr2[2*j+1] for j in range(4)]
        # lr3[0]=L17W, lr3[1]=L18W, lr3[2]=L19W, lr3[3]=L20W

        # LR4 (L21-L24): WQF losers vs LR3 winners
        # L21: W9L vs L17W, L22: W10L vs L18W, L23: W11L vs L19W, L24: W12L vs L20W
        lr4 = [wqfl[j] if pw(wqfl[j], lr3[j]) else lr3[j] for j in range(4)]
        # lr4[0]=L21W, lr4[1]=L22W, lr4[2]=L23W, lr4[3]=L24W

        # WSF (W13-W14): WQF winners pair up
        wsfw, wsfl = [], []
        for a, b in [(wqfw[0],wqfw[1]),(wqfw[2],wqfw[3])]:
            w=a if pw(a,b) else b; l=b if w==a else a; wsfw.append(w); wsfl.append(l)
        # wsfl[0]=W13L, wsfl[1]=W14L

        # Top 8: WSF winners (2) + WSF losers (2) + LR4 winners (4) = 8
        for pl in wsfw + wsfl + lr4: reach[pl]['top8'] += 1

        # LR5 (L25-L26): LR4 winners pair up
        # L25: L21W vs L22W, L26: L23W vs L24W
        lr5_a = lr4[0] if pw(lr4[0], lr4[1]) else lr4[1]  # L25W
        lr5_b = lr4[2] if pw(lr4[2], lr4[3]) else lr4[3]  # L26W

        # WF (W15): WSF winners
        wf_w = wsfw[0] if pw(wsfw[0],wsfw[1]) else wsfw[1]
        wf_l = wsfw[1] if wf_w==wsfw[0] else wsfw[0]

        # LQF (L27-L28): WSF losers vs LR5 winners
        # L27: W14L vs L25W, L28: W13L vs L26W
        lqf_a = wsfl[1] if pw(wsfl[1], lr5_a) else lr5_a  # L27W
        lqf_b = wsfl[0] if pw(wsfl[0], lr5_b) else lr5_b  # L28W

        # Top 4: WF winner + WF loser + LQF players (2 each side) = 4
        for pl in [wf_w, wf_l, lqf_a, lqf_b]: reach[pl]['top4'] += 1

        # LSF (L29): L27W vs L28W
        lsf = lqf_a if pw(lqf_a, lqf_b) else lqf_b

        # LF (L30): WF loser vs LSF winner
        lf_w = wf_l if pw(wf_l, lsf) else lsf

        for pl in [wf_w, lf_w]: reach[pl]['finalist'] += 1

        ga, gb = wf_w, lf_w; wa, wb = 1, 0
        while wa < 2 and wb < 2:
            if pw(ga, gb): wa += 1
            else:          wb += 1
        reach[ga if wa==2 else gb]['champion'] += 1

    round_reach = {
        name: {r: round(reach[name][r] / n, 4) for r in rounds}
        for name in names
    }
    match_odds = {}
    for mid, (a, b) in {**W_R1, **L_R1}.items():
        match_odds[mid] = {
            'p1Win':  round(r1_wins[mid] / n, 4),
            'spread': pair_spread.get((a, b), 0.0),
        }

    # Pairwise win probabilities for every player pair. React consumes these
    # to render the win-% badges on match cards once both slots of a match
    # are filled (live view or via picks in predictions view). We store
    # canonical keys of the form "{alpha_first}__{alpha_second}" where the
    # first name is the alphabetically earlier one, and `p1Win` is the
    # probability that the alphabetically-first player wins.
    pairwise = {}
    for i, a in enumerate(names):
        for b in names[i+1:]:
            first, second = sorted([a, b])
            p_first_wins = win_prob.get((first, second), 0.5)
            key = f'{first}__{second}'
            pairwise[key] = {'p1Win': round(float(p_first_wins), 4)}

    return match_odds, round_reach, pairwise

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — INJECT INTO HTML
# ══════════════════════════════════════════════════════════════════════════════

def inject_html(html_path, match_odds, player_stats, match_dates, avatars, pairwise=None):
    with open(html_path, encoding='utf-8') as f:
        html = f.read()

    replaced = 0

    def sub(pattern, value):
        nonlocal html, replaced
        new, n = re.subn(pattern, value, html, flags=re.DOTALL)
        replaced += n
        html = new

    sub(r'const MATCH_ODDS\s*=\s*\{.*?\};',
        'const MATCH_ODDS = ' + json.dumps(match_odds, indent=2) + ';')

    sub(r'const PLAYER_STATS\s*=\s*\{.*?\};',
        'const PLAYER_STATS = ' + json.dumps(player_stats, indent=2) + ';')

    # Pairwise odds — only update if the block already exists in the HTML.
    # The React JSON also consumes this, so the HTML acts as the source of
    # truth even when the dashboard doesn't render it.
    if pairwise is not None:
        sub(r'const PAIRWISE_ODDS\s*=\s*\{.*?\};',
            'const PAIRWISE_ODDS = ' + json.dumps(pairwise, indent=2) + ';')

    # Always overwrite dates if we got any; preserve existing if scraper returned nothing
    if match_dates:
        sub(r'const MATCH_DATES_UTC\s*=\s*\{.*?\};',
            'const MATCH_DATES_UTC = ' + json.dumps(match_dates, indent=2) + ';')
    else:
        print("  Keeping existing match dates (scraper returned nothing)")

    # Merge new avatars with existing ones — only overwrite nulls, never replace
    # a real URL with null (protects against failed fetches wiping good data)
    if avatars:
        import re as _re
        existing_m = _re.search(r'const AVATARS\s*=\s*(\{.*?\});', html, _re.DOTALL)
        if existing_m:
            try:
                existing = json.loads(existing_m.group(1))
                merged = {k: (avatars.get(k) or existing.get(k)) for k in
                          set(list(avatars.keys()) + list(existing.keys()))}
                avatars = merged
            except Exception:
                pass
        if any(v for v in avatars.values()):
            sub(r'const AVATARS\s*=\s*\{.*?\};',
                'const AVATARS = ' + json.dumps(avatars, indent=2) + ';')
        else:
            print("  No avatars to inject — keeping existing")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"  {replaced} constants injected into {html_path}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — EMIT CONSOLIDATED JSON FOR REACT APP
# ══════════════════════════════════════════════════════════════════════════════
#
# The React bracket-challenge app (src/) imports a single JSON file that
# contains every datum needed to render the Players tab: rank, totals, seed
# scores, model stats, tournament reach, country, avatar, twitch link. We
# assemble it by re-reading the HTML we just injected into (the source of
# truth for player metadata like seed scores and country codes) and merging
# with the model output we just computed.

def emit_react_json(html_path):
    """Write src/data/playerStats.json alongside the HTML injection."""
    out_path = os.path.join(
        os.path.dirname(os.path.abspath(html_path)),
        'src', 'data', 'playerStats.json'
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(html_path, encoding='utf-8') as f:
        html = f.read()

    def grab(name):
        m = re.search(rf'const {name}\s*=\s*(\{{.*?\}}|\[.*?\]);', html, re.DOTALL)
        return m.group(1) if m else None

    def js_to_json(src):
        # Convert single-quoted strings to double-quoted and strip trailing commas.
        out = re.sub(r"'([^'\\]*)'", r'"\1"', src)
        out = re.sub(r",(\s*[\]}])", r"\1", out)
        return out

    def add_key_quotes(src):
        return re.sub(
            r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)',
            r'\1"\2"\3',
            src,
        )

    try:
        player_data   = json.loads(js_to_json(grab('PLAYER_DATA')))
        player_stats  = json.loads(js_to_json(add_key_quotes(grab('PLAYER_STATS'))))
        avatars       = json.loads(js_to_json(add_key_quotes(grab('AVATARS'))))
        country_codes = json.loads(js_to_json(add_key_quotes(grab('COUNTRY_CODES'))))
        country_names = json.loads(js_to_json(add_key_quotes(grab('COUNTRY_NAMES'))))
        twitch        = json.loads(js_to_json(add_key_quotes(grab('TWITCH'))))
    except Exception as e:
        print(f"  WARNING: could not parse HTML constants for JSON emit: {e}")
        return

    # Pairwise odds are optional — the HTML block might not exist yet if
    # the script has only ever run on an older template.
    pairwise_raw = grab('PAIRWISE_ODDS')
    pairwise = {}
    if pairwise_raw is not None:
        try:
            pairwise = json.loads(js_to_json(add_key_quotes(pairwise_raw)))
        except Exception as e:
            print(f"  WARNING: could not parse PAIRWISE_ODDS: {e}")

    players = []
    for row in player_data:
        rank, name, total, *seeds = row
        stats = player_stats.get(name, {})
        cc = country_codes.get(name)
        players.append({
            'rank':         rank,
            'name':         name,
            'total':        total,
            'seeds':        seeds,
            'country':      cc,
            'countryName':  country_names.get(cc) if cc else None,
            'avatar':       avatars.get(name),
            'twitch':       twitch.get(name),
            'rage':         stats.get('rage'),
            'bait':         stats.get('bait'),
            'cons':         stats.get('cons'),
            'reach':        stats.get('reach') or {
                'top16': 0, 'top8': 0, 'top4': 0, 'finalist': 0, 'champion': 0,
            },
            'bracketEntry': 'Winners' if rank <= 16 else 'Losers',
        })

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'players':     players,
        'pairwise':    pairwise,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    print(f"  Wrote {out_path} ({len(players)} players)")

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def run(html_path, skip_avatars=False, skip_dates=False, skip_model=False):
    np.random.seed(SEED_RNG)

    # 1. Leaderboard
    data = fetch_leaderboard()

    # 2. Match dates
    match_dates = {} if skip_dates else scrape_match_dates()

    # 3. Avatars
    avatars = fetch_avatars(skip=skip_avatars)
    # Fill any missing with null
    for name in PLAYOFF_PLAYERS:
        if name not in avatars:
            avatars[name] = None

    if skip_model:
        inject_html(html_path, {}, {}, match_dates, avatars)
        emit_react_json(html_path)
        print("Done (model skipped)")
        return

    # 4. Build population + seed model
    print("Building population and seed model...")
    filtered, seed_sorted, seed_model = build_population(data)

    # 5. Two-way decomposition
    print("Running two-way decomposition...")
    alpha_all, delta, mu_global = two_way_decomposition(filtered, seed_model)
    seed_model['delta_decomp'] = {i: float(delta[i]) for i in range(TOTAL_SEEDS)}
    print(f"  mu_global={mu_global:.1f}")

    # 6. Player models
    print("Building player models...")
    players = build_player_models(filtered, seed_model, alpha_all, delta, mu_global)

    # Print summary
    print(f"\n  {'Name':<22} {'RAGE':>6} {'BAIT':>6} {'CONS':>6}")
    print("  " + "-"*40)
    for name in PLAYOFF_PLAYERS:
        if name in players:
            p = players[name]
            print(f"  {name:<22} {p['rage']:>6.1f} {p['bait']:>6.1f} {p['consistency']:>6.2f}")

    # 7. Tournament simulation
    print("\nRunning tournament simulation...")
    match_odds, round_reach, pairwise = simulate_tournament(players, seed_model, n=N_SIM)

    # Print R1 odds
    print("\nR1 Match odds:")
    for mid, (a, b) in {**W_R1, **L_R1}.items():
        pct    = match_odds[mid]['p1Win'] * 100
        spread = match_odds[mid]['spread']
        fav    = a if spread >= 0 else b
        print(f"  {mid}: {a} vs {b} → {pct:.1f}% / {100-pct:.1f}%  ({fav} {spread:+.1f})")

    # Print championship odds
    print("\nChampionship reach probabilities (%):")
    print(f"  {'Name':<22} {'Top16':>6} {'Top8':>6} {'Top4':>6} {'Final':>6} {'Win':>6}")
    print("  " + "-"*52)
    for name in PLAYOFF_PLAYERS:
        if name in round_reach:
            r = round_reach[name]
            print(f"  {name:<22} "
                  f"{r['top16']*100:>6.1f} {r['top8']*100:>6.1f} "
                  f"{r['top4']*100:>6.1f} {r['finalist']*100:>6.1f} "
                  f"{r['champion']*100:>6.1f}")

    # 8. Build PLAYER_STATS for injection
    player_stats = {}
    for name in PLAYOFF_PLAYERS:
        if name not in players: continue
        p = players[name]
        r = round_reach.get(name, {})
        player_stats[name] = {
            'rage': round(p['rage'], 1),
            'bait': round(p['bait'], 1),
            'cons': round(p['consistency'], 2),
            'reach': {
                'top16':    r.get('top16', 0),
                'top8':     r.get('top8', 0),
                'top4':     r.get('top4', 0),
                'finalist': r.get('finalist', 0),
                'champion': r.get('champion', 0),
            }
        }

    # 9. Inject
    print("\nInjecting into HTML...")
    inject_html(html_path, match_odds, player_stats, match_dates, avatars, pairwise)

    # 10. Emit consolidated JSON for the React bracket-challenge app
    print("\nEmitting React JSON...")
    emit_react_json(html_path)

    print("\nDone.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DRL Season 2 Playoffs Dashboard Generator')
    parser.add_argument('html', help='Path to drl_s2_playoffs.html template')
    parser.add_argument('--no-avatars', action='store_true', help='Skip Twitch avatar fetching')
    parser.add_argument('--no-dates',   action='store_true', help='Skip match date scraping')
    parser.add_argument('--no-model',   action='store_true', help='Only update dates/avatars, skip model')
    args = parser.parse_args()

    if not os.path.exists(args.html):
        print(f"ERROR: {args.html} not found")
        sys.exit(1)

    run(args.html,
        skip_avatars=args.no_avatars,
        skip_dates=args.no_dates,
        skip_model=args.no_model)