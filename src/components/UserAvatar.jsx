import React from 'react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export default function UserAvatar({ user, size = 'md', className }) {
  const name = user?.username || user?.full_name || user?.email || '?';
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = user?.avatar_url;

  return (
    <div className={cn(
      "rounded-full overflow-hidden flex items-center justify-center water-gradient text-white font-semibold shrink-0 ring-2 ring-white shadow-md",
      sizes[size],
      className
    )}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}