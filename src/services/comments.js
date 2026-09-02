import { supabase } from '@/lib/supabase';
import { publishSocialContent, GUIDELINES_MESSAGE } from '@/services/moderation';

/**
 * Load comments for a post with like counts + whether the current user liked each.
 * Avoids ambiguous PostgREST embeds after parent_id self-FK was added.
 * @param {string} postId
 * @param {string | null | undefined} currentUserId
 */
export async function getComments(postId, currentUserId) {
  const { data, error } = await supabase
    .from('water_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const comments = data ?? [];
  if (comments.length === 0) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
  let profilesById = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, avatar_url')
      .in('id', userIds);
    (profiles ?? []).forEach((p) => {
      profilesById[p.id] = p;
    });
  }

  const withProfiles = comments.map((c) => ({
    ...c,
    profiles: profilesById[c.user_id]
      ? {
          username: profilesById[c.user_id].username,
          full_name: profilesById[c.user_id].full_name,
          email: profilesById[c.user_id].email,
          avatar_url: profilesById[c.user_id].avatar_url,
        }
      : null,
  }));

  return attachLikes(withProfiles, currentUserId);
}

async function attachLikes(comments, currentUserId) {
  if (comments.length === 0) return [];

  const ids = comments.map((c) => c.id);
  const { data: likes, error: likesErr } = await supabase
    .from('water_comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', ids);

  // Likes table may not exist until the migration is applied — still show comments
  if (likesErr) {
    console.warn('Comment likes unavailable:', likesErr.message);
    return comments.map((c) => ({
      ...c,
      like_count: 0,
      liked_by_me: false,
    }));
  }

  const countByComment = {};
  const likedByMe = new Set();
  (likes ?? []).forEach((row) => {
    countByComment[row.comment_id] = (countByComment[row.comment_id] || 0) + 1;
    if (currentUserId && row.user_id === currentUserId) {
      likedByMe.add(row.comment_id);
    }
  });

  return comments.map((c) => ({
    ...c,
    like_count: countByComment[c.id] || 0,
    liked_by_me: likedByMe.has(c.id),
  }));
}

/**
 * Create a comment (or reply) via the trusted publish Edge Function.
 * @param {{ postId: string, content: string, parentId?: string | null }} params
 */
export async function addComment({ postId, content, parentId = null }) {
  const payload = {
    type: 'comment',
    post_id: postId,
    content,
  };
  if (parentId) payload.parent_id = parentId;

  const data = await publishSocialContent(payload);

  if (!data?.comment) {
    throw Object.assign(new Error(data?.message || GUIDELINES_MESSAGE), {
      code: data?.code,
    });
  }
  return {
    ...data.comment,
    like_count: 0,
    liked_by_me: false,
  };
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('water_post_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

/** @param {string} commentId */
export async function likeComment(commentId) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('You must be signed in.');

  const { error } = await supabase.from('water_comment_likes').insert({
    comment_id: commentId,
    user_id: user.id,
  });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

/** @param {string} commentId */
export async function unlikeComment(commentId) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('You must be signed in.');

  const { error } = await supabase
    .from('water_comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function toggleCommentLike(commentId, currentlyLiked) {
  if (currentlyLiked) {
    await unlikeComment(commentId);
    return false;
  }
  await likeComment(commentId);
  return true;
}
