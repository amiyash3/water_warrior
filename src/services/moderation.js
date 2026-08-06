import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/** @typedef {'post' | 'comment' | 'profile'} ReportTargetType */

export const REPORT_REASONS = /** @type {const} */ ([
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'sexual_content', label: 'Sexual or exploitative content' },
  { value: 'violence', label: 'Threats or violence' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'dangerous_health_advice', label: 'Dangerous health advice' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
]);

const GUIDELINES_MESSAGE =
  'This content may violate the Water Warrior Community Guidelines.';

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

function friendlyError(err, fallback) {
  return Object.assign(new Error(err?.message || fallback), {
    code: err?.code,
    status: err?.status,
  });
}

/**
 * @param {{
 *   targetType: ReportTargetType,
 *   targetId: string,
 *   reportedUserId: string,
 *   reason: string,
 *   details?: string,
 * }} params
 */
export async function reportContent({
  targetType,
  targetId,
  reportedUserId,
  reason,
  details,
}) {
  const { client, user } = await requireUser();

  if (!targetType || !targetId || !reportedUserId || !reason) {
    throw new Error('Please choose a reason for your report.');
  }
  if (reportedUserId === user.id) {
    throw new Error('You cannot report yourself.');
  }

  const { error } = await client.from('content_reports').insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details?.trim() ? details.trim().slice(0, 1000) : null,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already reported this content.');
    }
    throw friendlyError(error, 'Could not submit report. Please try again.');
  }

  return { ok: true };
}

/** @param {string} blockedUserId */
export async function blockUser(blockedUserId) {
  const { client, user } = await requireUser();

  if (!blockedUserId) throw new Error('Missing user to block.');
  if (blockedUserId === user.id) {
    throw new Error('You cannot block yourself.');
  }

  const { error } = await client.from('user_blocks').insert({
    blocker_id: user.id,
    blocked_id: blockedUserId,
  });

  if (error) {
    if (error.code === '23505') {
      // Already blocked — treat as success
      window.dispatchEvent(
        new CustomEvent('ww:user-blocked', { detail: { userId: blockedUserId } })
      );
      return { ok: true };
    }
    throw friendlyError(error, 'Could not block user. Please try again.');
  }

  window.dispatchEvent(
    new CustomEvent('ww:user-blocked', { detail: { userId: blockedUserId } })
  );
  return { ok: true };
}

/** @param {string} blockedUserId */
export async function unblockUser(blockedUserId) {
  const { client, user } = await requireUser();

  const { error } = await client
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  if (error) {
    throw friendlyError(error, 'Could not unblock user. Please try again.');
  }

  window.dispatchEvent(
    new CustomEvent('ww:user-unblocked', { detail: { userId: blockedUserId } })
  );
  return { ok: true };
}

export async function getBlockedUsers() {
  const { client, user } = await requireUser();

  const { data: blocks, error } = await client
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw friendlyError(error, 'Could not load blocked users.');
  if (!blocks?.length) return [];

  const ids = blocks.map((b) => b.blocked_id);
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, email, username, full_name, avatar_url')
    .in('id', ids);

  if (pErr) throw friendlyError(pErr, 'Could not load blocked users.');

  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return blocks.map((b) => ({
    blocked_id: b.blocked_id,
    created_at: b.created_at,
    profile: byId[b.blocked_id] || { id: b.blocked_id },
  }));
}

/** @param {string} otherUserId */
export async function isUserBlocked(otherUserId) {
  if (!otherUserId) return false;
  const { client, user } = await requireUser();
  if (otherUserId === user.id) return false;

  const { data, error } = await client
    .from('user_blocks')
    .select('blocker_id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', otherUserId)
    .maybeSingle();

  if (error) throw friendlyError(error, 'Could not check block status.');
  return Boolean(data);
}

/**
 * Publish post or comment via trusted Edge Function.
 * @param {{ type: 'post' | 'comment' } & Record<string, unknown>} payload
 */
export async function publishSocialContent(payload) {
  const { client } = await requireUser();

  const { data, error } = await client.functions.invoke('publish-social-content', {
    body: payload,
  });

  // Prefer the function JSON body; supabase-js often only exposes a generic
  // "non-2xx" message on error.
  let body = data;
  if (error && !body && error.context && typeof error.context.json === 'function') {
    try {
      body = await error.context.json();
    } catch {
      // ignore parse failures
    }
  }

  if (error || (body && body.ok === false)) {
    const code = body?.code || 'PUBLISH_FAILED';
    const msg =
      code === 'CONTENT_REJECTED'
        ? GUIDELINES_MESSAGE
        : body?.message ||
          (error?.message && !/non-2xx/i.test(error.message)
            ? error.message
            : null) ||
          'Could not publish content. Please try again.';
    if (body?.detail && !msg.includes(body.detail)) {
      throw Object.assign(new Error(`${msg}: ${body.detail}`), { code });
    }
    throw Object.assign(new Error(msg), { code });
  }

  return body;
}

export { GUIDELINES_MESSAGE };
