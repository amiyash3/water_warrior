-- Comment replies, likes, and post-owner comment delete

-- ---------------------------------------------------------------------------
-- Replies: parent_id on comments
-- ---------------------------------------------------------------------------
ALTER TABLE public.water_post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.water_post_comments (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS water_post_comments_parent_id_idx
  ON public.water_post_comments (parent_id)
  WHERE parent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Comment likes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.water_comment_likes (
  comment_id UUID NOT NULL REFERENCES public.water_post_comments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS water_comment_likes_user_id_idx
  ON public.water_comment_likes (user_id);

ALTER TABLE public.water_comment_likes ENABLE ROW LEVEL SECURITY;

-- Visible if the underlying comment is visible to the viewer
DROP POLICY IF EXISTS "water_comment_likes_select" ON public.water_comment_likes;
CREATE POLICY "water_comment_likes_select"
  ON public.water_comment_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.water_post_comments c
      JOIN public.water_posts p ON p.id = c.post_id
      WHERE c.id = water_comment_likes.comment_id
        AND public.content_is_feed_visible(c.user_id, c.moderation_status)
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

DROP POLICY IF EXISTS "water_comment_likes_insert_own" ON public.water_comment_likes;
CREATE POLICY "water_comment_likes_insert_own"
  ON public.water_comment_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.water_post_comments c
      JOIN public.water_posts p ON p.id = c.post_id
      WHERE c.id = water_comment_likes.comment_id
        AND public.content_is_feed_visible(c.user_id, c.moderation_status)
        AND public.content_is_feed_visible(p.user_id, p.moderation_status)
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE (f.user_a_id = auth.uid() AND f.user_b_id = p.user_id)
               OR (f.user_b_id = auth.uid() AND f.user_a_id = p.user_id)
          )
        )
        AND NOT public.users_are_blocked(auth.uid(), c.user_id)
    )
  );

DROP POLICY IF EXISTS "water_comment_likes_delete_own" ON public.water_comment_likes;
CREATE POLICY "water_comment_likes_delete_own"
  ON public.water_comment_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.water_comment_likes TO authenticated;

-- ---------------------------------------------------------------------------
-- Delete comments: author OR post owner
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "water_post_comments_delete_own" ON public.water_post_comments;
CREATE POLICY "water_post_comments_delete_own_or_post_owner"
  ON public.water_post_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.water_posts p
      WHERE p.id = water_post_comments.post_id
        AND p.user_id = auth.uid()
    )
  );
