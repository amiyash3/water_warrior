import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Droplets, MapPin } from 'lucide-react';
import UserAvatar from './UserAvatar';
import DualPhotoView from './DualPhotoView';

export default function PostCard({ post, author }) {
  const user = author || { email: post.created_by, username: post.created_by?.split('@')[0] };
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : '';

  return (
    <article className="bg-card rounded-3xl overflow-hidden border border-border/50 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all">
      <header className="flex items-center gap-3 p-4">
        <UserAvatar user={user} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {user.username || user.full_name || user.email}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Droplets className="w-3.5 h-3.5" />
{post.bottle_size_ml >= 1000
  ? `${(post.bottle_size_ml / 1000).toFixed(1)}L`
  : `${post.bottle_size_ml || 500}ml`
} · {Math.round((post.bottle_size_ml || 500) / 29.574)}oz
        </div>
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
    </article>
  );
}