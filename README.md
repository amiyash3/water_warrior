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

Also run (for saved bottles + per-bottle stats):

   `supabase/migrations/20260606120000_user_bottles.sql`

And for profile photos:

   `supabase/migrations/20260802120000_profile_avatars.sql`

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

## Xcode / native iOS

This app uses **[Capacitor](https://capacitorjs.com/)** to wrap the same React build in a native iOS shell. You edit UI in this repo; Xcode runs it on a simulator or device.

### Prerequisites

- macOS with **Xcode** installed (from the App Store)
- Xcode command-line tools: `xcode-select --install`
- Apple ID (free tier is fine for simulator + your own device)
- `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (values are baked in at **build** time)

### First-time setup

```bash
npm install
npm run cap:ios
```

That builds the web app, copies it into `ios/`, and opens **Water Warrior.xcodeproj** in Xcode.

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → choose your **Team**
2. Pick a simulator (e.g. iPhone 16) or plug in your iPhone
3. Press **Run** (▶)

### Day-to-day workflow

After changing React code:

```bash
npm run cap:sync    # rebuild web app + copy to ios/
```

Then run again from Xcode (▶). You do **not** need to re-run `cap add ios`.

Open Xcode anytime:

```bash
npx cap open ios
```

### Supabase for the native app

In **Authentication → URL configuration**, add these **Redirect URLs**:

- `com.waterwarrior.app://**`
- `com.waterwarrior.app://auth/callback`

Email/password sign-in works immediately. Password-reset emails use the custom URL scheme above (`src/lib/native.js`).

Use the **same Supabase project** as the web app — same tables, RLS, and `post-photos` bucket.

### Camera on iOS

`Info.plist` already includes camera permission text. The Capture page uses the WebView camera APIs; for true simultaneous front+rear photos later, add `@capacitor/camera` or a native plugin.

### Live reload from your Mac (optional)

In `capacitor.config.ts`, uncomment `server.url` and set it to your LAN HTTPS dev URL from `npm run dev:mobile`, then `npx cap sync ios`.

Enable **Sign in with Apple** in Supabase when you ship to the App Store.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run dev:mobile` | Dev server on LAN + HTTPS (phone testing) |
| `npm run build` | Production build |
| `npm run cap:sync` | Build + copy web assets into `ios/` |
| `npm run cap:ios` | Build, sync, and open Xcode |
| `npm run preview` | Preview production build |
