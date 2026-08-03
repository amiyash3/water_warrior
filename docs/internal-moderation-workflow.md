# Internal moderation workflow (Water Warrior)

This document is for operators and developers only. **Do not publish it on the public website homepage.** Do not store secrets, service-role keys, or credentials in this file.

## Where reports are stored

Reports live in the Supabase table `public.content_reports`.

Important columns:

| Column | Meaning |
|--------|---------|
| `reporter_id` | User who filed the report |
| `reported_user_id` | Author of the reported content / profile |
| `target_type` | `post`, `comment`, or `profile` |
| `target_id` | UUID of the post, comment, or profile |
| `reason` | Enum reason chosen in the app |
| `details` | Optional free-text context |
| `status` | `open`, `under_review`, `actioned`, or `dismissed` |
| `created_at` | When the report was filed |
| `reviewed_at` | When an operator finished review |
| `resolution_note` | Short internal note about the outcome |

Normal authenticated app users can insert reports but cannot select or update them via RLS. Review happens in the Supabase Dashboard (or SQL editor) with a privileged project role.

## Filter open reports

In the Supabase Table Editor, open `content_reports` and filter:

```sql
select *
from public.content_reports
where status = 'open'
order by created_at asc;
```

To claim work:

```sql
update public.content_reports
set status = 'under_review',
    reviewed_at = null
where id = '<report-uuid>';
```

## Locate the referenced content

1. Note `target_type` and `target_id`.
2. For posts:

```sql
select id, user_id, author_email, caption, moderation_status, created_at
from public.water_posts
where id = '<target-id>';
```

3. For comments:

```sql
select id, post_id, user_id, author_email, content, moderation_status, created_at
from public.water_post_comments
where id = '<target-id>';
```

4. For profiles:

```sql
select id, email, username, full_name, bio
from public.profiles
where id = '<target-id>';
```

## Update content moderation status

Allowed values on posts and comments: `visible`, `under_review`, `hidden`, `removed`.

Examples:

```sql
-- Hold while investigating
update public.water_posts
set moderation_status = 'under_review'
where id = '<post-id>';

-- Hide from feeds but keep for records
update public.water_post_comments
set moderation_status = 'hidden'
where id = '<comment-id>';

-- Permanently remove from normal feeds
update public.water_posts
set moderation_status = 'removed'
where id = '<post-id>';

-- Restore after false positive
update public.water_posts
set moderation_status = 'visible'
where id = '<post-id>';
```

RLS only shows non-authors content with `moderation_status = 'visible'` (and not blocked). Authors can still see their own rows for transparency.

## Close the report

```sql
update public.content_reports
set status = 'actioned', -- or 'dismissed'
    reviewed_at = now(),
    resolution_note = 'Hidden post; warned user via email'
where id = '<report-uuid>';
```

## Urgent threats or dangerous content

1. Immediately set the content to `removed` or `hidden`.
2. Mark the report `under_review` then `actioned`.
3. If there is an imminent risk of harm, contact appropriate authorities and preserve evidence (do not delete needed audit rows casually).
4. Consider suspending the account through Supabase Auth / profile access restrictions as required.
5. Document the resolution in `resolution_note` without storing secrets.

## Blocking

User-initiated blocks are stored in `public.user_blocks`. Inserting a block automatically removes friendships and pending friend requests between the pair via trigger.

## Trusted publishing path

Social posts and comments must be created through the Edge Function `publish-social-content`, which screens text server-side. Direct authenticated inserts into `water_posts` / `water_post_comments` are blocked by RLS after the UGC safety migration.

Optional secrets (Edge Function only, never in the app):

- `MODERATION_API_KEY`
- `MODERATION_API_ENDPOINT`

Built-in rules still run when no external provider is configured.
