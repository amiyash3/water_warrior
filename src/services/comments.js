import { supabase } from '@/lib/supabase';
import { publishSocialContent, GUIDELINES_MESSAGE } from '@/services/moderation';

export async function getComments(postId) {
  const { data, error } = await supabase
    .from('water_post_comments')
    .select('*, profiles(username, full_name, email)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create a comment via the trusted publish Edge Function.
 * Author is derived server-side from the session — do not pass userId.
 * @param {{ postId: string, content: string }} params
 */
export async function addComment({ postId, content }) {
  const data = await publishSocialContent({
    type: 'comment',
    post_id: postId,
    content,
  });

  if (!data?.comment) {
    throw Object.assign(new Error(data?.message || GUIDELINES_MESSAGE), {
      code: data?.code,
    });
  }
  return data.comment;
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('water_post_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}
