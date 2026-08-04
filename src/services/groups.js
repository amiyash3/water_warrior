import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}

async function requireUser() {
  const client = requireClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw Object.assign(new Error('You must be signed in to continue.'), {
      code: 'NOT_AUTHENTICATED',
    });
  }
  return { client, user };
}

/**
 * @returns {Promise<Array<{ id: string, name: string, invite_code: string, created_by: string, created_at: string, member_count: number, my_role: string }>>}
 */
export async function listMyGroups() {
  const { client, user } = await requireUser();

  const { data: memberships, error: mErr } = await client
    .from('group_members')
    .select('group_id, role')
    .eq('user_id', user.id);

  if (mErr) throw mErr;
  if (!memberships?.length) return [];

  const ids = memberships.map((m) => m.group_id);
  const roleByGroup = Object.fromEntries(memberships.map((m) => [m.group_id, m.role]));

  const { data: groups, error: gErr } = await client
    .from('groups')
    .select('id, name, invite_code, created_by, created_at')
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (gErr) throw gErr;

  const { data: allMembers, error: cErr } = await client
    .from('group_members')
    .select('group_id')
    .in('group_id', ids);

  if (cErr) throw cErr;

  const countByGroup = {};
  (allMembers ?? []).forEach((row) => {
    countByGroup[row.group_id] = (countByGroup[row.group_id] || 0) + 1;
  });

  return (groups ?? []).map((g) => ({
    ...g,
    member_count: countByGroup[g.id] || 0,
    my_role: roleByGroup[g.id] || 'member',
  }));
}

/** @param {string} name */
export async function createGroup(name) {
  const { client } = await requireUser();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Group name is required.');
  if (trimmed.length > 60) throw new Error('Group name must be 60 characters or fewer.');

  const { data, error } = await client.rpc('create_group', { p_name: trimmed });
  if (error) {
    const msg = error.message || 'Could not create group';
    if (/row-level security/i.test(msg)) {
      throw new Error('Could not create group. Try again after updating the database.');
    }
    throw new Error(msg);
  }
  return { ...data, member_count: 1, my_role: 'owner' };
}

/** @param {string} code */
export async function joinByCode(code) {
  const { client } = await requireUser();
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Enter an invite code.');

  const { data, error } = await client.rpc('join_group_by_code', { p_code: normalized });
  if (error) {
    const msg = error.message || 'Could not join group';
    if (/invalid invite/i.test(msg)) throw new Error('Invalid invite code.');
    if (/cannot join/i.test(msg)) throw new Error('You cannot join this group.');
    throw new Error(msg);
  }
  return data;
}

/** @param {string} groupId */
export async function leaveGroup(groupId) {
  const { client, user } = await requireUser();
  const { error } = await client
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);
  if (error) throw error;
}

/** @param {string} groupId */
export async function deleteGroup(groupId) {
  const { client } = await requireUser();
  const { error } = await client.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

/** @param {string} groupId */
export async function getGroup(groupId) {
  const { client, user } = await requireUser();
  const { data: group, error } = await client
    .from('groups')
    .select('id, name, invite_code, created_by, created_at')
    .eq('id', groupId)
    .single();
  if (error) throw error;

  const { data: membership, error: mErr } = await client
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (mErr) throw mErr;

  return { ...group, my_role: membership?.role || 'member' };
}

/** @param {string} groupId */
export async function getMembers(groupId) {
  const { client } = await requireUser();
  const { data, error } = await client
    .from('group_members')
    .select('user_id, role, joined_at, profiles(id, username, full_name, email, avatar_url, streak_count)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    profile: row.profiles,
  }));
}

/**
 * @param {string} groupId
 * @param {'week' | 'month' | 'all'} period
 */
export async function getLeaderboard(groupId, period = 'week') {
  const { client } = await requireUser();
  const { data, error } = await client.rpc('get_group_leaderboard', {
    p_group_id: groupId,
    p_period: period,
  });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} groupId */
export async function regenerateInviteCode(groupId) {
  const { client } = await requireUser();
  const { data, error } = await client.rpc('regenerate_group_invite_code', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}
