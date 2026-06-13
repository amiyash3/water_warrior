import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export function createSupabaseApi(supabase) {
  if (!isSupabaseConfigured) {
    throw new Error('createSupabaseApi called without Supabase env');
  }

  async function requireSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    return session;
  }

  async function ensureProfile(user) {
    const { data: existing, error: selErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return;

    const email = user.email ?? '';
    const fullName =
      user.user_metadata?.full_name ?? (email ? email.split('@')[0] : 'Water Warrior');

    const { error: insErr } = await supabase.from('profiles').insert({
      id: user.id,
      email,
      full_name: fullName,
    });
    if (insErr) throw insErr;
  }

  async function loadFriendEmails(userId) {
    const { data: rows, error } = await supabase
      .from('friendships')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

    if (error) throw error;
    if (!rows?.length) return [];

    const otherIds = rows.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id));
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', otherIds);
    if (pErr) throw pErr;
    return (profs ?? []).map((p) => p.email);
  }

  function mapProfileRow(row, friends = []) {
    return {
      id: row.id,
      email: row.email,
      username: row.username ?? '',
      full_name: row.full_name ?? '',
      bio: row.bio ?? '',
      friends,
      daily_goal_ml: row.daily_goal_ml ?? 2000,
      streak_count: row.streak_count ?? 0,
      last_goal_date: row.last_goal_date ?? null,
      created_date: row.created_at,
    };
  }

  function mapPostRow(row) {
    return {
      id: row.id,
      created_by: row.author_email,
      created_date: row.created_at,
      front_photo_url: row.front_photo_url,
      back_photo_url: row.back_photo_url,
      caption: row.caption ?? '',
      location: row.location ?? '',
      bottle_size_ml: row.bottle_size_ml ?? 500,
      bottle_id: row.bottle_id ?? null,
    };
  }

  function mapBottleRow(row) {
    return {
      id: row.id,
      name: row.name,
      size_ml: row.size_ml,
      is_default: row.is_default ?? false,
      created_date: row.created_at,
    };
  }

  function orderAscending(sort) {
    return sort?.startsWith('-') === false;
  }

  const auth = {
    async me() {
      const session = await requireSession();
      await ensureProfile(session.user);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      const friends = await loadFriendEmails(session.user.id);
      return mapProfileRow(profile, friends);
    },

    async updateMe(updates) {
      const session = await requireSession();
      await ensureProfile(session.user);

      const patch = {};
      if ('username' in updates) patch.username = updates.username;
      if ('bio' in updates) patch.bio = updates.bio;
      if ('daily_goal_ml' in updates) patch.daily_goal_ml = updates.daily_goal_ml;
      if ('streak_count' in updates) patch.streak_count = updates.streak_count;
      if ('last_goal_date' in updates) patch.last_goal_date = updates.last_goal_date;
      if ('full_name' in updates) patch.full_name = updates.full_name;

      if (Object.keys(patch).length === 0) {
        return auth.me();
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select('*')
        .single();

      if (error) throw error;
      const friends = await loadFriendEmails(session.user.id);
      return mapProfileRow(data, friends);
    },

    logout(redirectUrl) {
      supabase.auth.signOut().then(() => {
        if (redirectUrl) window.location.href = redirectUrl;
        else window.location.reload();
      });
    },

    async deleteAccount() {
      await requireSession();
      const { error } = await supabase.rpc('delete_my_account_data');
      if (error) throw error;
      await supabase.auth.signOut();
    },

    redirectToLogin(returnUrl) {
      const next = returnUrl || window.location.pathname + window.location.search;
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
    },
  };

  async function addFriendConnection() {
    // Friendships are created by DB trigger when a request is accepted.
  }

  const entities = {
    WaterPost: {
      async list(sort = '-created_date', limit = 100) {
        await requireSession();
        const ascending = orderAscending(sort);
        const { data, error } = await supabase
          .from('water_posts')
          .select('*')
          .order('created_at', { ascending })
          .limit(limit);

        if (error) throw error;
        return (data ?? []).map(mapPostRow);
      },

      async filter(query = {}, sort = '-created_date', limit = 100) {
        await requireSession();
        let q = supabase.from('water_posts').select('*');

        if (query.created_by) {
          q = q.eq('author_email', query.created_by);
        }

        const ascending = orderAscending(sort);
        const { data, error } = await q.order('created_at', { ascending }).limit(limit);

        if (error) throw error;
        return (data ?? []).map(mapPostRow);
      },

      async create(data) {
        const session = await requireSession();
        await ensureProfile(session.user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', session.user.id)
          .single();

        const row = {
          user_id: session.user.id,
          author_email: profile?.email ?? session.user.email ?? '',
          front_photo_url: data.front_photo_url,
          back_photo_url: data.back_photo_url,
          caption: data.caption ?? '',
          location: data.location ?? '',
          bottle_size_ml: data.bottle_size_ml ?? 500,
          bottle_id: data.bottle_id ?? null,
        };

        const { data: inserted, error } = await supabase
          .from('water_posts')
          .insert(row)
          .select('*')
          .single();

        if (error) throw error;
        return mapPostRow(inserted);
      },

      async delete(id) {
        await requireSession();
        const { error } = await supabase.from('water_posts').delete().eq('id', id);
        if (error) throw error;
      },
    },

    UserBottle: {
      async list() {
        const session = await requireSession();
        const { data, error } = await supabase
          .from('user_bottles')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return (data ?? []).map(mapBottleRow);
      },

      async create(data) {
        const session = await requireSession();
        await ensureProfile(session.user);

        if (data.is_default) {
          await supabase
            .from('user_bottles')
            .update({ is_default: false })
            .eq('user_id', session.user.id);
        }

        const { data: inserted, error } = await supabase
          .from('user_bottles')
          .insert({
            user_id: session.user.id,
            name: data.name,
            size_ml: data.size_ml,
            is_default: data.is_default ?? false,
          })
          .select('*')
          .single();

        if (error) throw error;
        return mapBottleRow(inserted);
      },

      async update(id, data) {
        const session = await requireSession();

        if (data.is_default) {
          await supabase
            .from('user_bottles')
            .update({ is_default: false })
            .eq('user_id', session.user.id);
        }

        const patch = {};
        if ('name' in data) patch.name = data.name;
        if ('size_ml' in data) patch.size_ml = data.size_ml;
        if ('is_default' in data) patch.is_default = data.is_default;

        const { data: updated, error } = await supabase
          .from('user_bottles')
          .update(patch)
          .eq('id', id)
          .eq('user_id', session.user.id)
          .select('*')
          .single();

        if (error) throw error;
        return mapBottleRow(updated);
      },

      async delete(id) {
        const session = await requireSession();
        const { error } = await supabase
          .from('user_bottles')
          .delete()
          .eq('id', id)
          .eq('user_id', session.user.id);
        if (error) throw error;
      },
    },

    User: {
      async list() {
        await requireSession();
        const { data, error } = await supabase.from('profiles').select('*').order('email');
        if (error) throw error;
        return (data ?? []).map((r) => mapProfileRow(r, []));
      },
    },

    FriendRequest: {
      async list(sort = '-created_date', limit = 200) {
        await requireSession();
        const ascending = orderAscending(sort);
        const { data: rows, error } = await supabase
          .from('friend_requests')
          .select('*')
          .order('created_at', { ascending })
          .limit(limit);

        if (error) throw error;
        if (!rows?.length) return [];

        const ids = new Set();
        rows.forEach((r) => {
          ids.add(r.from_user_id);
          ids.add(r.to_user_id);
        });

        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', [...ids]);

        if (pErr) throw pErr;
        const emailById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));

        return rows.map((r) => ({
          id: r.id,
          from_email: emailById[r.from_user_id],
          to_email: emailById[r.to_user_id],
          from_username: r.from_username,
          to_username: r.to_username,
          status: r.status,
          created_date: r.created_at,
        }));
      },

      async create(data) {
        const session = await requireSession();
        await ensureProfile(session.user);

        const { data: target, error: tErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', data.to_email)
          .maybeSingle();

        if (tErr) throw tErr;
        if (!target) throw new Error('User not found');

        const row = {
          from_user_id: session.user.id,
          to_user_id: target.id,
          from_username: data.from_username ?? '',
          to_username: data.to_username ?? '',
          status: data.status ?? 'pending',
        };

        const { data: inserted, error } = await supabase
          .from('friend_requests')
          .insert(row)
          .select('*')
          .single();

        if (error) throw error;

        return {
          id: inserted.id,
          from_email: data.from_email,
          to_email: data.to_email,
          from_username: inserted.from_username,
          to_username: inserted.to_username,
          status: inserted.status,
          created_date: inserted.created_at,
        };
      },

      async update(id, data) {
        await requireSession();
        const { data: updated, error } = await supabase
          .from('friend_requests')
          .update(data)
          .eq('id', id)
          .select('*')
          .single();

        if (error) throw error;

        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', [updated.from_user_id, updated.to_user_id]);

        const emailById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));

        return {
          id: updated.id,
          from_email: emailById[updated.from_user_id],
          to_email: emailById[updated.to_user_id],
          from_username: updated.from_username,
          to_username: updated.to_username,
          status: updated.status,
          created_date: updated.created_at,
        };
      },
    },
  };

  const integrations = {
    Core: {
      async UploadFile({ file }) {
        const session = await requireSession();
        await ensureProfile(session.user);

        const ext = file.type?.includes('png') ? 'png' : 'jpg';
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage.from('post-photos').upload(path, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

        if (upErr) throw upErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from('post-photos').getPublicUrl(path);

        return { file_url: publicUrl };
      },
    },
  };

  return {
    auth,
    addFriendConnection,
    entities,
    integrations,
  };
}
