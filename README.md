# DRL Bracket Challenge

A 32-player double-elimination bracket challenge with Twitch login, admin-controlled real-time results, and user predictions. Hosted free on GitHub Pages with a Supabase backend.

## Quick start

1. Read **[SETUP.md](./SETUP.md)** for the one-time Supabase, Twitch, and GitHub setup (~20 minutes).
2. Copy `.env.example` → `.env` and fill in your Supabase credentials.
3. `npm install`
4. `npm run dev`
5. Open http://localhost:5173

## Project structure

```
src/
  auth/         Supabase client + auth context (Phase 5)
  api/          Database queries (Phase 5)
  admin/        Admin panel for live result updates (Phase 6)
  bracket/      Types, data, and progression engine
  realtime/     Supabase Realtime hooks (Phase 6)
  storage/      Prediction persistence (Phase 7)
  ui/           Header, share button, layout (Phase 8)
  styles/       Tailwind base + component classes
supabase/
  migrations/   SQL schema (run once in Supabase SQL Editor)
.github/
  workflows/    GitHub Actions for auto-deploy to Pages
```

## Build phases

- [x] **Phase 0** — Setup guide
- [x] **Phase 1** — Project scaffold (Vite + React + TS + Tailwind)
- [x] **Phase 2** — Bracket types, data, progression engine (46 matches)
- [x] **Phase 3** — Supabase schema + RLS policies
- [ ] **Phase 4** — Polished bracket UI rendering
- [ ] **Phase 5** — Twitch auth + admin detection
- [ ] **Phase 6** — Admin panel + Supabase Realtime
- [ ] **Phase 7** — User predictions
- [ ] **Phase 8** — Professional UI polish (connector lines, animations)
- [ ] **Phase 9** — Image export + GitHub Pages deploy

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling
- **Supabase** (Postgres + Auth + Realtime)
- **flag-icons** for country flag SVGs
- **html-to-image** for bracket → PNG export
- **GitHub Pages** for hosting
