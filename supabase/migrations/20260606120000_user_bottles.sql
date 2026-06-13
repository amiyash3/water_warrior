-- User-owned water bottles + link posts to a bottle

CREATE TABLE IF NOT EXISTS public.user_bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_ml INTEGER NOT NULL CHECK (size_ml > 0 AND size_ml <= 10000),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_bottles_user_id_idx ON public.user_bottles (user_id);

ALTER TABLE public.water_posts
  ADD COLUMN IF NOT EXISTS bottle_id UUID REFERENCES public.user_bottles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS water_posts_bottle_id_idx ON public.water_posts (bottle_id);

ALTER TABLE public.user_bottles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_bottles_select_own" ON public.user_bottles;
CREATE POLICY "user_bottles_select_own"
  ON public.user_bottles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bottles_insert_own" ON public.user_bottles;
CREATE POLICY "user_bottles_insert_own"
  ON public.user_bottles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bottles_update_own" ON public.user_bottles;
CREATE POLICY "user_bottles_update_own"
  ON public.user_bottles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bottles_delete_own" ON public.user_bottles;
CREATE POLICY "user_bottles_delete_own"
  ON public.user_bottles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Keep delete_my_account_data in sync
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

  DELETE FROM public.water_posts WHERE user_id = uid;
  DELETE FROM public.user_bottles WHERE user_id = uid;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bottles TO authenticated;
