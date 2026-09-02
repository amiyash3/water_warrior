import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Clock, Droplets, UserPlus, Waves, Check } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import AccountStatsSummary from '@/components/AccountStatsSummary';
import AccountStatsDetails from '@/components/AccountStatsDetails';
import ContentActionsMenu from '@/components/ContentActionsMenu';
import { HydrationMomentThumb, HydrationMomentViewer } from '@/components/HydrationMomentMedia';
import { Button } from '@/components/ui/button';
import { Bottle } from '@/components/icons/Bottle';
import { isUserBlocked } from '@/services/moderation';
import { toast } from 'sonner';

function formatLiters(ml) {
  if (!ml) return '0 L';
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`;
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm text-left w-full">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
        {label}
      </p>
    </div>
  );
}

export default function UserProfile() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: me, checkUserAuth } = useAuth();
  const groupStats = location.state?.groupStats;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingPost, setViewingPost] = useState(null);

  const isSelf = Boolean(me?.id && userId === me.id);

  const load = useCallback(async () => {
    if (!userId || isSelf) return;
    setLoading(true);
    try {
      const [user, allReqs] = await Promise.all([
        api.entities.User.get(userId),
        api.entities.FriendRequest.list('-created_date', 200).catch(() => []),
      ]);
      setProfile(user);
      setRequests(allReqs);

      const friendSet = new Set(me?.friends || []);
      if (friendSet.has(user.email)) {
        const userPosts = await api.entities.WaterPost.filter(
          { created_by: user.email },
          '-created_date',
          500
        );
        setPosts(userPosts);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error(err);
      setProfile(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, isSelf, me?.friends]);

  useEffect(() => {
    if (isSelf) {
      navigate('/account', { replace: true });
      return;
    }
    load();
  }, [isSelf, load, navigate]);

  const friendSet = useMemo(() => new Set(me?.friends || []), [me?.friends]);
  const isFriend = profile ? friendSet.has(profile.email) : false;

  const outgoing = me
    ? requests.filter((r) => r.from_email === me.email && r.status === 'pending')
    : [];
  const incoming = me
    ? requests.filter((r) => r.to_email === me.email && r.status === 'pending')
    : [];

  const friendStatus = useMemo(() => {
    if (!profile) return 'none';
    if (friendSet.has(profile.email)) return 'friend';
    if (outgoing.some((r) => r.to_email === profile.email)) return 'pending';
    if (incoming.some((r) => r.from_email === profile.email)) return 'incoming';
    return 'none';
  }, [profile, friendSet, outgoing, incoming]);

  const sendRequest = async () => {
    if (!profile || !me) return;
    try {
      if (await isUserBlocked(profile.id)) {
        toast.error('You cannot interact with a blocked user.');
        return;
      }
    } catch {
      // RLS will reject if blocked the other way
    }
    await api.entities.FriendRequest.create({
      from_email: me.email,
      to_email: profile.email,
      from_username: me.username || me.full_name,
      to_username: profile.username || profile.full_name,
      status: 'pending',
    });
    toast.success(`Request sent to ${profile.username || profile.full_name}`);
    load();
  };

  const acceptRequest = async () => {
    if (!profile || !me) return;
    const req = incoming.find((r) => r.from_email === profile.email);
    if (!req) return;
    await api.entities.FriendRequest.update(req.id, { status: 'accepted' });
    await api.addFriendConnection(me.email, profile.email);
    await checkUserAuth();
    toast.success('Friend added!');
    load();
  };

  if (isSelf) return null;

  if (loading) {
    return (
      <div className="p-5 space-y-4 animate-pulse pb-10">
        <div className="h-8 w-24 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card rounded-3xl border border-border/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-5 pb-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center py-16 bg-card rounded-3xl border border-border/50">
          <p className="font-semibold">Profile not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This user may not exist or may be unavailable.
          </p>
        </div>
      </div>
    );
  }

  const galleryPosts = posts.slice(0, 6);
  const displayName = profile.username || profile.full_name || profile.email;

  return (
    <div className="pb-10">
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="relative water-gradient pt-8 pb-20 px-5 mt-2">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
        <div className="relative flex items-start justify-between gap-3">
          <UserAvatar user={profile} size="xl" className="ring-4 ring-white/30" />
          <ContentActionsMenu
            targetType="profile"
            targetId={profile.id}
            reportedUserId={profile.id}
            isOwn={false}
            onBlocked={() => navigate(-1)}
            className="text-white/90 hover:bg-white/15"
          />
        </div>
        <div className="relative mt-4 text-white">
          <h2 className="text-2xl font-bold tracking-tight">{displayName}</h2>
          {profile.bio && (
            <p className="text-white/90 text-sm mt-3 leading-relaxed max-w-md">{profile.bio}</p>
          )}
        </div>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Bottle} label="Bottles" value={isFriend ? posts.length : '—'} />
          <StatCard icon={Waves} label="Streak" value={`${profile.streak_count || 0}d`} />
          <StatCard
            icon={Droplets}
            label="Water"
            value={
              groupStats?.water_ml != null
                ? formatLiters(groupStats.water_ml)
                : isFriend
                  ? formatLiters(posts.reduce((s, p) => s + (p.bottle_size_ml || 0), 0))
                  : '—'
            }
          />
        </div>
      </div>

      <div className="px-5 mt-4">
        {friendStatus === 'friend' && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-primary font-semibold py-2">
            <Check className="w-4 h-4" /> Friends
          </div>
        )}
        {friendStatus === 'pending' && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground font-semibold py-2">
            <Clock className="w-4 h-4" /> Request pending
          </div>
        )}
        {friendStatus === 'incoming' && (
          <Button
            className="w-full rounded-2xl water-gradient border-0"
            onClick={acceptRequest}
          >
            Accept friend request
          </Button>
        )}
        {friendStatus === 'none' && (
          <Button
            className="w-full rounded-2xl water-gradient border-0"
            onClick={sendRequest}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add friend
          </Button>
        )}
      </div>

      {isFriend && posts.length > 0 && (
        <>
          <div className="px-5 mt-4">
            <AccountStatsSummary posts={posts} accountCreated={profile.created_date} />
          </div>

          <div className="px-5 mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Hydration moments
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {galleryPosts.map((p) => (
                <HydrationMomentThumb key={p.id} post={p} onClick={setViewingPost} />
              ))}
            </div>
          </div>

          <div className="px-5 mt-6">
            <AccountStatsDetails posts={posts} bottles={[]} />
          </div>
        </>
      )}

      {!isFriend && (
        <div className="px-5 mt-6">
          <div className="text-center py-10 bg-card rounded-3xl border border-border/50 px-4">
            <p className="text-sm text-muted-foreground">
              {groupStats
                ? 'Group stats are shown above. Add them as a friend to see full hydration history.'
                : 'Add this person as a friend to see their hydration stats and moments.'}
            </p>
          </div>
        </div>
      )}

      {viewingPost && (
        <HydrationMomentViewer post={viewingPost} onClose={() => setViewingPost(null)} />
      )}
    </div>
  );
}
