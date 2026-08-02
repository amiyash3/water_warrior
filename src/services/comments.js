import { supabase } from '@/lib/supabase';

export async function getComments(postId) {
  const { data, error } = await supabase
    .from('water_post_comments')
    .select('*, profiles(username, full_name, email)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function addComment({ postId, userId, authorEmail, content }) {
  const { data, error } = await supabase
    .from('water_post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      author_email: authorEmail,
      content,
    })
    .select('*, profiles(username, full_name, email)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('water_post_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}
