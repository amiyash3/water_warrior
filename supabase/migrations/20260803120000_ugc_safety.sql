-- UGC safety: blocks, reports, moderation status, comment table formalization,
-- and RLS so blocked users cannot see or interact with each other.

-- ---------------------------------------------------------------------------
-- Formalize water_post_comments (used by the app; may already exist remotely)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.water_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.water_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS water_post_comments_post_id_idx
  ON public.water_post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS water_post_comments_user_id_idx
  ON public.water_post_comments (user_id);

ALTER TABLE public.water_post_comments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Moderation status on posts and comments
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'content_moderation_status'
  ) THEN
    CREATE TYPE public.content_moderation_status AS ENUM (
      'visible',
      'under_review',
      'hidden',
      'removed'
    );
  END IF;
END $$;

ALTER TABLE public.water_posts
  ADD COLUMN IF NOT EXISTS moderation_status public.content_moderation_status
  NOT NULL DEFAULT 'visible';

ALTER TABLE public.water_post_comments
  ADD COLUMN IF NOT EXISTS moderation_status public.content_moderation_status
  NOT NULL DEFAULT 'visible';

CREATE INDEX IF NOT EXISTS water_posts_moderation_status_idx
  ON public.water_posts (moderation_status);
CREATE INDEX IF NOT EXISTS water_post_comments_moderation_status_idx
  ON public.water_post_comments (moderation_status);

-- ---------------------------------------------------------------------------
-- user_blocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx
  ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- content_reports
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'content_report_target_type'
  ) THEN
    CREATE TYPE public.content_report_target_type AS ENUM (
      'post',
      'comment',
      'profile'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'content_report_reason'
  ) THEN
    CREATE TYPE public.content_report_reason AS ENUM (
      'harassment',
      'hate_speech',
      'sexual_content',
      'violence',
      'spam',
      'dangerous_health_advice',
      'impersonation',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'content_report_status'
  ) THEN
    CREATE TYPE public.content_report_status AS ENUM (
      'open',
      'under_review',
      'actioned',
      'dismissed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  target_type public.content_report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason public.content_report_reason NOT NULL,
  details TEXT,
  status public.content_report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  CONSTRAINT content_reports_no_self CHECK (reporter_id <> reported_user_id),
  CONSTRAINT content_reports_unique_target UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reported_user_idx
  ON public.content_reports (reported_user_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users may file reports as themselves only; no SELECT/UPDATE for normal clients.
DROP POLICY IF EXISTS "content_reports_insert_own" ON public.content_reports;
CREATE POLICY "content_reports_insert_own"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so RLS on user_blocks does not recurse incorrectly)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_are_blocked(a UUID, b UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR a = b THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_blocks ub
      WHERE (ub.blocker_id = a AND ub.blocked_id = b)
         OR (ub.blocker_id = b AND ub.blocked_id = a)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.users_are_blocked(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.users_are_blocked(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.content_is_feed_visible(
  author_id UUID,
  status public.content_moderation_status
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    author_id = auth.uid()
    OR (
      status = 'visible'
      AND NOT public.users_are_blocked(auth.uid(), author_id)
    );
$$;

REVOKE ALL ON FUNCTION public.content_is_feed_visible(UUID, public.content_moderation_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_is_feed_visible(UUID, public.content_moderation_status) TO authenticated;

-- On block: remove friendships and pending friend requests both ways
CREATE OR REPLACE FUNCTION public.cleanup_social_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (user_a_id = NEW.blocker_id AND user_b_id = NEW.blocked_id)
     OR (user_a_id = NEW.blocked_id AND user_b_id = NEW.blocker_id);

  DELETE FROM public.friend_requests
  WHERE status = 'pending'
    AND (
      (from_user_id = NEW.blocker_id AND to_user_id = NEW.blocked_id)
      OR (from_user_id = NEW.blocked_id AND to_user_id = NEW.blocker_id)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_blocks_cleanup_social ON public.user_blocks;
CREATE TRIGGER user_blocks_cleanup_social
  AFTER INSERT ON public.user_blocks
  FOR EACH ROW
  EXECUTE PROCEDURE public.cleanup_social_on_block();

-- ---------------------------------------------------------------------------
-- Tighten existing RLS
-- ---------------------------------------------------------------------------

-- Profiles: hide blocked users (still allow self)
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR NOT public.users_are_blocked(auth.uid(), id)
  );

-- Friendships: hide blocked pairs (cleanup usually removes them)
DROP POLICY IF EXISTS "friendships_select_member" ON public.friendships;
CREATE POLICY "friendships_select_member"
  ON public.friendships FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    AND NOT public.users_are_blocked(user_a_id, user_b_id)
  );

-- Friend requests: no create/select across a block
DROP POLICY IF EXISTS "friend_requests_select_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_select_involved"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (
    (from_user_id = auth.uid() OR to_user_id = auth.uid())
    AND NOT public.users_are_blocked(from_user_id, to_user_id)
  );

DROP POLICY IF EXISTS "friend_requests_insert_own" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_own"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND NOT public.users_are_blocked(auth.uid(), to_user_id)
  );

DROP POLICY IF EXISTS "friend_requests_update_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_update_involved"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (
    (from_user_id = auth.uid() OR to_user_id = auth.uid())
    AND NOT public.users_are_blocked(from_user_id, to_user_id)
  );

-- Water posts: respect blocks + moderation; revoke direct client inserts
-- (trusted publishing path = Edge Function using service role)
DROP POLICY IF EXISTS "water_posts_select_own_or_friend" ON public.water_posts;
CREATE POLICY "water_posts_select_own_or_friend"
  ON public.water_posts FOR SELECT TO authenticated
  USING (
    public.content_is_feed_visible(user_id, moderation_status)
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.user_a_id = auth.uid() AND f.user_b_id = water_posts.user_id)
           OR (f.user_b_id = auth.uid() AND f.user_a_id = water_posts.user_id)
      )
    )
  );

DROP POLICY IF EXISTS "water_posts_insert_own" ON public.water_posts;
-- No INSERT policy for authenticated: posts must go through publish-social-content.

DROP POLICY IF EXISTS "water_posts_delete_own" ON public.water_posts;
CREATE POLICY "water_posts_delete_own"
  ON public.water_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "water_posts_update_own" ON public.water_posts;
CREATE POLICY "water_posts_update_own"
  ON public.water_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Comments RLS
DROP POLICY IF EXISTS "water_post_comments_select_visible" ON public.water_post_comments;
CREATE POLICY "water_post_comments_select_visible"
  ON public.water_post_comments FOR SELECT TO authenticated
  USING (
    public.content_is_feed_visible(user_id, moderation_status)
    AND EXISTS (
      SELECT 1 FROM public.water_posts p
      WHERE p.id = water_post_comments.post_id
        AND public.content_is_feed_visible(p.user_id, p.moderation_status)
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE (f.user_a_id = auth.uid() AND f.user_b_id = p.user_id)
               OR (f.user_b_id = auth.uid() AND f.user_a_id = p.user_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "water_post_comments_insert_own" ON public.water_post_comments;
-- No INSERT policy for authenticated: comments must go through publish-social-content.

DROP POLICY IF EXISTS "water_post_comments_delete_own" ON public.water_post_comments;
CREATE POLICY "water_post_comments_delete_own"
  ON public.water_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Account deletion cleanup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.content_reports
  WHERE reporter_id = uid OR reported_user_id = uid;
  DELETE FROM public.user_blocks
  WHERE blocker_id = uid OR blocked_id = uid;
  DELETE FROM public.water_post_comments WHERE user_id = uid;
  DELETE FROM public.water_posts WHERE user_id = uid;
  DELETE FROM public.friend_requests WHERE from_user_id = uid OR to_user_id = uid;
  DELETE FROM public.friendships WHERE user_a_id = uid OR user_b_id = uid;

  UPDATE public.profiles SET
    username = NULL,
    bio = NULL,
    full_name = '',
    streak_count = 0,
    last_goal_date = NULL,
    updated_at = now()
  WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT INSERT ON public.content_reports TO authenticated;
GRANT SELECT, DELETE ON public.water_post_comments TO authenticated;
GRANT SELECT, DELETE, UPDATE ON public.water_posts TO authenticated;
