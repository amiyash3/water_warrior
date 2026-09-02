import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Droplets, MapPin } from 'lucide-react';
import UserAvatar from './UserAvatar';
import UserProfileLink from './UserProfileLink';
import DualPhotoView from './DualPhotoView';
import CommentSection from './CommentSection';
import ContentActionsMenu from './ContentActionsMenu';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/client';
import { toast } from 'sonner';

export default function PostCard({ post, author, onAuthorBlocked, onPostDeleted }) {
  const { user } = useAuth();
  const userProfile = author || { email: post.created_by, username: post.created_by?.split('@')[0] };
  const authorId = post.user_id || author?.id;
  const isOwn = Boolean(user?.id && authorId && user.id === authorId);
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : '';

  const handleDeletePost = async () => {
    try {
      await api.entities.WaterPost.delete(post.id);
      toast.success('Post deleted');
      onPostDeleted?.(post.id);
    } catch (err) {
      toast.error(err?.message || 'Could not delete post');
      throw err;
    }
  };

  return (
    <article className="bg-card rounded-3xl overflow-hidden border border-border/50 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all">
      <header className="flex items-center gap-3 p-4">
        <UserProfileLink userId={authorId} user={userProfile} className="flex-1 min-w-0">
          <UserAvatar user={userProfile} size="md" />
          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-sm leading-tight truncate">
              {userProfile.username || userProfile.full_name || userProfile.email}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
          </div>
        </UserProfileLink>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Droplets className="w-3.5 h-3.5" />
          {post.bottle_size_ml >= 1000
            ? `${(post.bottle_size_ml / 1000).toFixed(1)}L`
            : `${post.bottle_size_ml || 500}ml`}{' '}
          · {Math.round((post.bottle_size_ml || 500) / 29.574)}oz
        </div>
        <ContentActionsMenu
          targetType="post"
          targetId={post.id}
          reportedUserId={authorId}
          isOwn={isOwn}
          onBlocked={onAuthorBlocked}
          onDelete={isOwn ? handleDeletePost : undefined}
        />
      </header>
      <div className="px-4">
        <DualPhotoView frontUrl={post.front_photo_url} backUrl={post.back_photo_url} />
      </div>
      {(post.caption || post.location) && (
        <div className="p-4 space-y-2">
          {post.caption && (
            <p className="text-sm leading-relaxed">{post.caption}</p>
          )}
          {post.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {post.location}
            </div>
          )}
        </div>
      )}
      <CommentSection postId={post.id} postAuthorId={authorId} />
    </article>
  );
}
