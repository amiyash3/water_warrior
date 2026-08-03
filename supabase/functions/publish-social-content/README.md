# Edge Function: publish-social-content

Trusted path for creating `water_posts` and `water_post_comments` after server-side screening.

The function is **self-contained** in `index.ts` (no `_shared` import) so Dashboard deploy works.

## Deploy via Dashboard

1. Edge Functions → `publish-social-content`
2. Paste the full contents of `index.ts`
3. Deploy

## Deploy via CLI

```bash
supabase functions deploy publish-social-content
```

## Secrets (optional external moderation)

```bash
supabase secrets set MODERATION_API_KEY=your-key
supabase secrets set MODERATION_API_ENDPOINT=https://your-provider.example/v1/moderate
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

Never put the service role key or moderation API key in Vite env files or the iOS bundle.
