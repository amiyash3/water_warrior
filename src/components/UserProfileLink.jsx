import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

/**
 * Tappable avatar / name that opens a user's profile (or Account for self).
 * @param {{
 *   userId?: string | null,
 *   user?: object,
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 *   showName?: boolean,
 *   className?: string,
 *   nameClassName?: string,
 *   children?: React.ReactNode,
 *   groupStats?: { water_ml?: number, streak_count?: number },
 * }} props
 */
export default function UserProfileLink({
  userId,
  user,
  size = 'md',
  showName = false,
  className,
  nameClassName,
  children,
  groupStats,
}) {
  const { user: me } = useAuth();
  const display =
    user?.username || user?.full_name || user?.email?.split('@')[0] || 'User';

  const content =
    children ??
    (
      <>
        <UserAvatar user={user} size={size} />
        {showName && (
          <span className={cn('font-semibold text-sm truncate', nameClassName)}>
            {display}
          </span>
        )}
      </>
    );

  if (!userId) {
    return (
      <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
        {content}
      </span>
    );
  }

  const isSelf = userId === me?.id;
  const to = isSelf ? '/account' : `/user/${userId}`;
  const state = !isSelf && groupStats ? { groupStats } : undefined;

  return (
    <Link
      to={to}
      state={state}
      className={cn(
        'inline-flex items-center gap-2 min-w-0 hover:opacity-90 active:opacity-80 transition-opacity',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  );
}
