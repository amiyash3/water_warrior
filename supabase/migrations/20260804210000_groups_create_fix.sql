-- Fix group creation RLS (INSERT … RETURNING) + create_group RPC

-- Allow creators to read their group even before membership is visible to policies
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_group_member(id, auth.uid())
  );

-- Allow self-membership inserts (owner trigger / join paths)
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT INSERT ON public.group_members TO authenticated;

-- Preferred create path: SECURITY DEFINER so RETURNING never trips SELECT RLS
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
