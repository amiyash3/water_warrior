import { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getComments, addComment, deleteComment } from '@/services/comments';
import UserAvatar from './UserAvatar';
import ContentActionsMenu from './ContentActionsMenu';
import { toast } from 'sonner';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { LEGAL_URLS } from '@/components/AccountSettings';

export default function CommentSection({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getComments(postId)
      .then((data) => {
        if (isMounted) setComments(data);
      })
      .catch((err) => console.error('Failed to load comments:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const onBlocked = (e) => {
      const blockedId = e.detail?.userId;
      if (!blockedId) return;
      setComments((prev) => prev.filter((c) => c.user_id !== blockedId));
    };
    window.addEventListener('ww:user-blocked', onBlocked);
    return () => {
      isMounted = false;
      window.removeEventListener('ww:user-blocked', onBlocked);
    };
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !user) return;

    setIsSubmitting(true);
    try {
      const comment = await addComment({
        postId,
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      toast.error(err?.message || 'Failed to add comment');
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const visibleComments = showAll ? comments : comments.slice(-2);
  const hiddenCount = comments.length - visibleComments.length;

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border/50">
      {!isLoading && comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              View {hiddenCount} earlier comment{hiddenCount > 1 ? 's' : ''}
            </button>
          )}
          {visibleComments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 group">
              <UserAvatar
                user={{
                  email: comment.profiles?.email,
                  username: comment.profiles?.username,
                  full_name: comment.profiles?.full_name,
                }}
                size="sm"
              />
              <div className="flex-1 min-w-0 bg-muted/50 rounded-2xl px-3 py-2">
                <p className="text-xs font-semibold leading-tight truncate">
                  {comment.profiles?.username ||
                    comment.profiles?.full_name ||
                    comment.author_email?.split('@')[0]}
                </p>
                <p className="text-sm leading-snug break-words">{comment.content}</p>
              </div>
              {comment.user_id === user?.id ? (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <ContentActionsMenu
                  targetType="comment"
                  targetId={comment.id}
                  reportedUserId={comment.user_id}
                  isOwn={false}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-muted/50 rounded-full px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!newComment.trim() || isSubmitting}
          className="text-primary disabled:text-muted-foreground disabled:opacity-50 p-1.5"
          aria-label="Post comment"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
        Be kind — follow our{' '}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => openExternalUrl(LEGAL_URLS.communityGuidelines)}
        >
          Community Guidelines
        </button>
        .
      </p>
    </div>
  );
}
