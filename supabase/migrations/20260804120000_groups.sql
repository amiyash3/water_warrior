-- Groups + invite codes + leaderboard RPCs

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  invite_code TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_invite_code_format CHECK (invite_code ~ '^[A-Z0-9]{6,10}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS groups_invite_code_uidx ON public.groups (invite_code);
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON public.groups (created_by);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON public.group_members (user_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Invite code helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_group_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.generate_group_invite_code();
  ELSE
    NEW.invite_code := upper(NEW.invite_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_set_invite_code ON public.groups;
CREATE TRIGGER groups_set_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_group_invite_code();

CREATE OR REPLACE FUNCTION public.add_group_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_add_owner_member ON public.groups;
CREATE TRIGGER groups_add_owner_member
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE PROCEDURE public.add_group_owner_member();

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(gid UUID, uid UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = gid AND gm.user_id = uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_group_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "groups_insert_own" ON public.groups;
CREATE POLICY "groups_insert_own"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
CREATE POLICY "groups_update_owner"
  ON public.groups FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;
CREATE POLICY "groups_delete_owner"
  ON public.groups FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "group_members_select_member" ON public.group_members;
CREATE POLICY "group_members_select_member"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Direct inserts only for leave/remove paths; joining uses join_group_by_code RPC
DROP POLICY IF EXISTS "group_members_delete_self_or_owner" ON public.group_members;
CREATE POLICY "group_members_delete_self_or_owner"
  ON public.group_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Create group (avoids INSERT…RETURNING SELECT RLS race)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group(p_name TEXT)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g public.groups;
  trimmed TEXT := trim(both FROM coalesce(p_name, ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trimmed = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  IF char_length(trimmed) > 60 THEN
    RAISE EXCEPTION 'Group name must be 60 characters or fewer';
  END IF;

  INSERT INTO public.groups (name, created_by)
  VALUES (trimmed, uid)
  RETURNING * INTO g;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (g.id, uid, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN g;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Join by invite code
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code TEXT)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g public.groups;
  normalized TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalized := upper(trim(p_code));
  IF normalized IS NULL OR normalized = '' THEN
    RAISE EXCEPTION 'Invite code is required';
  END IF;

  SELECT * INTO g
  FROM public.groups
  WHERE invite_code = normalized;

  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF public.is_group_member(g.id, uid) THEN
    RETURN g;
  END IF;

  -- Block either way with any existing member
  IF EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = g.id
      AND public.users_are_blocked(uid, gm.user_id)
  ) THEN
    RAISE EXCEPTION 'Cannot join this group';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (g.id, uid, 'member');

  RETURN g;
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Regenerate invite code (owner)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(p_group_id UUID)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g public.groups;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = uid
      AND gm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the group owner can regenerate the invite code';
  END IF;

  UPDATE public.groups
  SET invite_code = public.generate_group_invite_code()
  WHERE id = p_group_id
  RETURNING * INTO g;

  RETURN g;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_group_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard (aggregates only; does not expose post content)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
  p_group_id UUID,
  p_period TEXT DEFAULT 'week'
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  streak_count INTEGER,
  water_ml BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  period_start TIMESTAMPTZ;
  period_key TEXT := lower(coalesce(p_period, 'week'));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_group_member(p_group_id, uid) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF period_key = 'month' THEN
    period_start := date_trunc('month', now());
  ELSIF period_key = 'all' THEN
    period_start := NULL;
  ELSE
    -- week = last 7 days including today
    period_start := date_trunc('day', now()) - interval '6 days';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    coalesce(p.streak_count, 0)::INTEGER AS streak_count,
    coalesce((
      SELECT sum(wp.bottle_size_ml)::BIGINT
      FROM public.water_posts wp
      WHERE wp.user_id = p.id
        AND coalesce(wp.moderation_status::text, 'visible') = 'visible'
        AND (period_start IS NULL OR wp.created_at >= period_start)
    ), 0)::BIGINT AS water_ml
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  WHERE gm.group_id = p_group_id
    AND NOT public.users_are_blocked(uid, p.id)
  ORDER BY water_ml DESC, streak_count DESC, p.username ASC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_leaderboard(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_leaderboard(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion
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

  DELETE FROM public.groups WHERE created_by = uid;
  DELETE FROM public.group_members WHERE user_id = uid;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
