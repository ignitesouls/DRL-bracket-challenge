# DRL Bracket Challenge — Setup Guide

Follow these steps **before** running the app for the first time. Total time: ~20 minutes.

You'll set up three free accounts/services:
1. **Supabase** — backend database + auth + realtime
2. **Twitch Developer App** — OAuth credentials
3. **GitHub repository** — for hosting via GitHub Pages

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard and sign up (free, no credit card)
2. Click **New Project**
3. Fill in:
   - **Name:** `drl-bracket-challenge`
   - **Database password:** generate a strong one and save it somewhere — you won't need it for the app, but you'll want it for direct DB access later
   - **Region:** pick whatever's closest to your audience
   - **Plan:** Free
4. Wait ~2 minutes for the project to provision
5. Once it's ready, go to **Project Settings → API** and copy these two values:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (long JWT string)
6. Save these somewhere — you'll paste them into `.env` later

---

## Step 2: Create a Twitch Developer App

1. Go to https://dev.twitch.tv/console/apps and log in with your Twitch account
2. Click **Register Your Application**
3. Fill in:
   - **Name:** `DRL Bracket Challenge`
   - **OAuth Redirect URLs:** Add this exact URL — you'll get it from Supabase in the next step:
     ```
     https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     (Replace `YOUR_SUPABASE_PROJECT_REF` with the subdomain of your Supabase project URL)
   - **Category:** Application Integration
   - **Client Type:** Confidential
4. Click **Create**
5. On the next screen, click **Manage** → copy your **Client ID**
6. Click **New Secret** → copy your **Client Secret**
7. Save both — you'll paste them into Supabase next

---

## Step 3: Connect Twitch to Supabase Auth

1. In your Supabase dashboard, go to **Authentication → Providers**
2. Find **Twitch** in the list and click to expand it
3. Toggle it **Enabled**
4. Paste your Twitch **Client ID** and **Client Secret**
5. Click **Save**

That's it for OAuth setup. Supabase now handles the entire Twitch login flow for you.

---

## Step 4: Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/migrations/001_initial_schema.sql` from this repo and copy its entire contents
4. Paste into the SQL Editor and click **Run**
5. You should see "Success. No rows returned"
6. Verify tables were created: go to **Table Editor** and you should see `players`, `matches`, `predictions`, and `admins`

---

## Step 5: Add Yourself as Admin

1. First, log into the app once (after you've started the dev server in Step 7 below) so Supabase creates your auth user
2. Then in Supabase dashboard, go to **Authentication → Users** and find your user
3. Copy your `provider_id` (this is your Twitch user ID)
4. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO admins (twitch_user_id) VALUES ('YOUR_TWITCH_USER_ID_HERE');
   ```
5. Refresh the app — you should now see an "Admin" badge and have access to result-editing controls

---

## Step 6: Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `DRL-bracket-challenge`
3. Set it to **Public** (required for free GitHub Pages)
4. Don't initialize with README — we already have one
5. Click **Create repository**
6. Follow the "push an existing repository" instructions GitHub shows you

---

## Step 7: Local Development Setup

1. Make sure you have **Node.js 20+** installed: https://nodejs.org
2. In the project folder, create a `.env` file by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and paste your Supabase credentials from Step 1:
   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Open http://localhost:5173 in your browser

---

## Step 8: Deploy to GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Add your Supabase secrets to the repo: **Settings → Secrets and variables → Actions → New repository secret**
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
4. Push to `main` — the GitHub Action will build and deploy automatically
5. Your site will be live at `https://YOUR_USERNAME.github.io/DRL-bracket-challenge/`
6. **Important:** Go back to your Twitch app and add this URL to the OAuth Redirect URLs too, so production login works

---

## Troubleshooting

**Supabase project paused?**
Free tier projects pause after 1 week of inactivity. Just click "Restore project" in the dashboard — takes ~30 seconds.

**Twitch login redirects but I'm not logged in?**
Check that the Supabase auth callback URL is exactly correct in your Twitch app's OAuth Redirect URLs. It must include the `/auth/v1/callback` path.

**Admin badge not showing?**
Make sure you've run the `INSERT INTO admins` SQL with your actual Twitch user ID (find it in **Authentication → Users → your user → Provider ID**).

**GitHub Pages 404?**
The repo must be public, and Pages must be set to "GitHub Actions" as the source (not "Deploy from branch").
