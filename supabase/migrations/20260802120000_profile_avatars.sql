-- Profile photos: avatar_url on profiles + public avatars storage bucket

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Clear avatar when wiping account data
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
    avatar_url = NULL,
    streak_count = 0,
    last_goal_date = NULL,
    updated_at = now()
  WHERE id = uid;
END;
$$;
