# Water Warrior

Social hydration tracking — React + Vite frontend with **Supabase** (auth, Postgres, storage) or **local mode** for offline dev.

## Quick start (local demo, no backend)

```bash
npm install
npm run dev
```

Without `VITE_SUPABASE_*` env vars, the app uses localStorage (guest user + demo friends).

## Supabase setup (real users)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Wait for the database to finish provisioning.

### 2. Run the database migration

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste and run the full contents of:

   `supabase/migrations/20260206120000_init.sql`

This creates `profiles`, `water_posts`, `friend_requests`, `friendships`, RLS policies, storage bucket `post-photos`, and triggers.

If the storage bucket insert fails, create it manually: **Storage → New bucket** → name `post-photos` → **Public bucket** ON.

### 3. Configure Auth

1. **Authentication → Providers → Email** — enable Email.
2. For easier dev, turn **Confirm email** OFF (you can enable later for production).
3. **Authentication → URL configuration**:
   - **Site URL**: `http://localhost:5173` (change to your Vercel URL after deploy)
   - **Redirect URLs** (add all you use):
     - `http://localhost:5173/**`
     - `https://localhost:5173/**` (for `npm run dev:mobile` on phone)
     - `https://YOUR_VERCEL_DOMAIN/**`
   - Password reset emails redirect to `/auth?mode=reset` — include that path in redirect URLs.

### 4. Environment variables

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the **anon public** key, not service_role)

Restart the dev server after changing env vars.

### 5. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` → you’ll be sent to **Sign in** → create an account → pick a username.

### 6. Test on your phone

```bash
npm run dev:mobile
```

Open the **`https://`** URL on your phone (same Wi‑Fi). Camera requires HTTPS on mobile.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → **Import project**.
3. Framework preset: **Vite**.
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.
6. In Supabase **Auth → URL configuration**, add your Vercel URL to **Site URL** and **Redirect URLs**.

`vercel.json` is included for client-side routing.

---

## Architecture

| Layer | Location |
|-------|----------|
| UI | `src/pages/*`, `src/components/*` |
| API (same interface for local + Supabase) | `src/api/client.js` |
| Supabase implementation | `src/api/supabaseApi.js` |
| Local fallback | `src/api/localClient.js` |
| Auth state | `src/lib/AuthContext.jsx` |
| Sign in / sign up | `src/pages/Auth.jsx` |
| Schema + RLS | `supabase/migrations/20260206120000_init.sql` |

Photos upload to Supabase Storage bucket **`post-photos`** at `{userId}/{uuid}.jpg` with public read URLs.

---

## Xcode / native iOS (later)

Use the **same Supabase project**:

- **Capacitor** — wrap this React app; keep `@supabase/supabase-js` or use native camera plugins.
- **SwiftUI** — [supabase-swift](https://github.com/supabase/supabase-swift) against the same tables, RLS, and storage bucket.

Enable **Sign in with Apple** in Supabase when you ship to the App Store.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run dev:mobile` | Dev server on LAN + HTTPS (phone testing) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
