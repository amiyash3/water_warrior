import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/api/client';
import { Link } from 'react-router-dom';
import { Camera, Droplets, RefreshCw } from 'lucide-react';
import PostCard from '@/components/PostCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PULL_THRESHOLD = 72; // px needed to trigger refresh

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);

  const touchStartY = useRef(0);
  const scrollRef = useRef(null);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const me = await api.auth.me();
      const friendEmails = me.friends || [];
      const visibleEmails = [me.email, ...friendEmails];

      const [allPosts, allUsers] = await Promise.all([
        api.entities.WaterPost.list('-created_date', 100),
        api.entities.User.list(),
      ]);
      const filtered = allPosts.filter(p => visibleEmails.includes(p.created_by));

      const userMap = {};
      allUsers.forEach(u => { userMap[u.email] = u; });

      setPosts(filtered);
      setUsers(userMap);
    } catch (e) {
      console.error('Feed load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── Pull-to-refresh touch handlers ──────────────────────────
  const onTouchStart = (e) => {
    const el = scrollRef.current;
    if (el && el.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  };

  const onTouchMove = (e) => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      e.preventDefault();
      setPullY(Math.min(delta, PULL_THRESHOLD * 1.5));
    }
  };

  const onTouchEnd = () => {
    if (pullY >= PULL_THRESHOLD && !refreshing) {
      loadFeed(true);
    }
    setPullY(0);
    setPulling(false);
  };

  const pullProgress = Math.min(pullY / PULL_THRESHOLD, 1);
  const showIndicator = pullY > 8;

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-card rounded-3xl border border-border/50 overflow-hidden animate-pulse">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-2 bg-muted rounded w-16" />
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="aspect-[3/4] bg-muted rounded-3xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0 && !refreshing) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl water-gradient-soft flex items-center justify-center mb-6 animate-float">
          <Droplets className="w-10 h-10 text-primary" strokeWidth={2} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Your feed is dry</h2>
        <p className="text-muted-foreground max-w-xs mx-auto mb-8 leading-relaxed">
          Capture your first water break or add friends to see their hydration moments.
        </p>
        <Link to="/capture">
          <Button size="lg" className="rounded-full px-8 water-gradient border-0 shadow-lg shadow-primary/30">
            <Camera className="w-4 h-4 mr-2" />
            Capture a drink
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{ height: showIndicator ? `${Math.min(pullY * 0.6, 52)}px` : refreshing ? '52px' : '0px' }}
      >
        <div className={cn(
          "flex items-center gap-2 text-primary text-sm font-medium transition-all",
          (pullProgress >= 1 || refreshing) ? "opacity-100" : "opacity-60"
        )}>
          <RefreshCw
            className={cn("w-4 h-4 transition-transform", refreshing && "animate-spin")}
            style={{ transform: refreshing ? undefined : `rotate(${pullProgress * 360}deg)` }}
          />
          {refreshing ? 'Refreshing…' : pullProgress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {posts.map(post => (
          <PostCard key={post.id} post={post} author={users[post.created_by]} />
        ))}
      </div>
    </div>
  );
}