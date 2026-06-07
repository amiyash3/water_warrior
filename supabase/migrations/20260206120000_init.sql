-- Water Warrior — initial schema, RLS, storage, and triggers
-- Run in Supabase SQL Editor or via: supabase db push

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  full_name TEXT,
  bio TEXT,
  daily_goal_ml INTEGER NOT NULL DEFAULT 2000,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_goal_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (lower(email));

-- New auth user → profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Keep email in sync when auth email changes
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_profile_email();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Friendships (normalized pair, user_a_id < user_b_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  user_a_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  from_username TEXT,
  to_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_no_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON public.friend_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_from_idx ON public.friend_requests (from_user_id, status);

CREATE OR REPLACE FUNCTION public.create_friendship_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'accepted'
     AND COALESCE(OLD.status, '') <> 'accepted' THEN
    INSERT INTO public.friendships (user_a_id, user_b_id)
    VALUES (
      LEAST(NEW.from_user_id, NEW.to_user_id),
      GREATEST(NEW.from_user_id, NEW.to_user_id)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_request_accepted ON public.friend_requests;
CREATE TRIGGER friend_request_accepted
  AFTER UPDATE OF status ON public.friend_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_friendship_on_accept();

-- ---------------------------------------------------------------------------
-- Water posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.water_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  front_photo_url TEXT NOT NULL,
  back_photo_url TEXT NOT NULL,
  caption TEXT,
  location TEXT,
  bottle_size_ml INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS water_posts_created_at_idx ON public.water_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS water_posts_user_id_idx ON public.water_posts (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "friendships_select_member" ON public.friendships;
CREATE POLICY "friendships_select_member"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Inserts only via trigger (SECURITY DEFINER); no direct insert policy for users

DROP POLICY IF EXISTS "friend_requests_select_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_select_involved"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_insert_own" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_own"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_update_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_update_involved"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "water_posts_select_own_or_friend" ON public.water_posts;
CREATE POLICY "water_posts_select_own_or_friend"
  ON public.water_posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_a_id = auth.uid() AND f.user_b_id = water_posts.user_id)
         OR (f.user_b_id = auth.uid() AND f.user_a_id = water_posts.user_id)
    )
  );

DROP POLICY IF EXISTS "water_posts_insert_own" ON public.water_posts;
CREATE POLICY "water_posts_insert_own"
  ON public.water_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "water_posts_delete_own" ON public.water_posts;
CREATE POLICY "water_posts_delete_own"
  ON public.water_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: post-photos bucket (create in Dashboard if SQL fails on older projects)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-photos', 'post-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "post_photos_public_read" ON storage.objects;
CREATE POLICY "post_photos_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'post-photos');

DROP POLICY IF EXISTS "post_photos_insert_own_folder" ON storage.objects;
CREATE POLICY "post_photos_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "post_photos_update_own_folder" ON storage.objects;
CREATE POLICY "post_photos_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post_photos_delete_own_folder" ON storage.objects;
CREATE POLICY "post_photos_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Delete own public data (auth user remains; user can sign in again)
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

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
