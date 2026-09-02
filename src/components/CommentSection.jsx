import { useState, useEffect, useMemo } from 'react';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  getComments,
  addComment,
  deleteComment,
  toggleCommentLike,
} from '@/services/comments';
import UserProfileLink from './UserProfileLink';
import ContentActionsMenu from './ContentActionsMenu';
import { toast } from 'sonner';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { LEGAL_URLS } from '@/components/AccountSettings';
import { cn } from '@/lib/utils';

function displayName(comment) {
  return (
    comment.profiles?.username ||
    comment.profiles?.full_name ||
    comment.author_email?.split('@')[0] ||
    'User'
  );
}

function CommentRow({
  comment,
  isReply,
  canDelete,
  onReply,
  onDelete,
  onToggleLike,
}) {
  return (
    <div className={cn('flex items-start gap-2 group', isReply && 'ml-8')}>
      <UserProfileLink
        userId={comment.user_id}
        user={{
          email: comment.profiles?.email,
          username: comment.profiles?.username,
          full_name: comment.profiles?.full_name,
          avatar_url: comment.profiles?.avatar_url,
        }}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="bg-muted/50 rounded-2xl px-3 py-2">
          <UserProfileLink
            userId={comment.user_id}
            user={{
              email: comment.profiles?.email,
              username: comment.profiles?.username,
              full_name: comment.profiles?.full_name,
            }}
            className="block"
          >
            <p className="text-xs font-semibold leading-tight truncate text-left">
              {displayName(comment)}
            </p>
          </UserProfileLink>
          <p className="text-sm leading-snug break-words">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          <button
            type="button"
            onClick={() => onToggleLike(comment)}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
              comment.liked_by_me
                ? 'text-rose-500'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={comment.liked_by_me ? 'Unlike comment' : 'Like comment'}
          >
            <Heart
              className={cn('w-3.5 h-3.5', comment.liked_by_me && 'fill-current')}
            />
            {comment.like_count > 0 ? comment.like_count : ''}
          </button>
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive shrink-0"
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
  );
}

/**
 * @param {{ postId: string, postAuthorId?: string | null }} props
 */
export default function CommentSection({ postId, postAuthorId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getComments(postId, user?.id)
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
  }, [postId, user?.id]);

  const { threads, hiddenThreadCount } = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parent_id);
    const repliesByParent = {};
    comments.forEach((c) => {
      if (!c.parent_id) return;
      if (!repliesByParent[c.parent_id]) repliesByParent[c.parent_id] = [];
      repliesByParent[c.parent_id].push(c);
    });

    const allThreads = topLevel.map((parent) => ({
      parent,
      replies: repliesByParent[parent.id] || [],
    }));

    const visible = showAll ? allThreads : allThreads.slice(-2);
    return {
      threads: visible,
      hiddenThreadCount: Math.max(0, allThreads.length - visible.length),
    };
  }, [comments, showAll]);

  const canDeleteComment = (comment) =>
    Boolean(
      user?.id &&
        (comment.user_id === user.id || postAuthorId === user.id)
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !user) return;

    setIsSubmitting(true);
    try {
      const comment = await addComment({
        postId,
        content: newComment.trim(),
        parentId: replyTo?.id || null,
      });
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      setReplyTo(null);
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
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parent_id !== commentId)
      );
      if (replyTo?.id === commentId) setReplyTo(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete comment');
      console.error('Failed to delete comment:', err);
    }
  };

  const handleToggleLike = async (comment) => {
    if (!user) return;
    const wasLiked = Boolean(comment.liked_by_me);
    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              liked_by_me: !wasLiked,
              like_count: Math.max(0, (c.like_count || 0) + (wasLiked ? -1 : 1)),
            }
          : c
      )
    );
    try {
      await toggleCommentLike(comment.id, wasLiked);
    } catch (err) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                liked_by_me: wasLiked,
                like_count: Math.max(0, (c.like_count || 0) + (wasLiked ? 1 : -1)),
              }
            : c
        )
      );
      toast.error(err?.message || 'Could not update like');
    }
  };

  const placeholder = replyTo
    ? `Reply to ${displayName(replyTo)}...`
    : 'Add a comment...';

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border/50">
      {!isLoading && comments.length > 0 && (
        <div className="space-y-3 mb-3">
          {hiddenThreadCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              View {hiddenThreadCount} earlier comment
              {hiddenThreadCount > 1 ? 's' : ''}
            </button>
          )}
          {threads.map(({ parent, replies }) => (
            <div key={parent.id} className="space-y-2">
              <CommentRow
                comment={parent}
                isReply={false}
                canDelete={canDeleteComment(parent)}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onToggleLike={handleToggleLike}
              />
              {replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isReply
                  canDelete={canDeleteComment(reply)}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  onToggleLike={handleToggleLike}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="flex items-center justify-between gap-2 mb-2 text-xs text-muted-foreground">
          <span className="truncate">
            Replying to <span className="font-semibold text-foreground">{displayName(replyTo)}</span>
          </span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="shrink-0 font-medium hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={placeholder}
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
