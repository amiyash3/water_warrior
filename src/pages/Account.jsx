import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Waves, Users, Pencil, Check, X, Target, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import UserAvatar from '@/components/UserAvatar';
import ProfilePhotoChooser from '@/components/ProfilePhotoChooser';
import HydrationCalendar from '@/components/HydrationCalendar';
import MyBottlesManager from '@/components/MyBottlesManager';
import CustomAmountInput from '@/components/CustomAmountInput';
import AccountSettings from '@/components/AccountSettings';
import AccountStatsSummary from '@/components/AccountStatsSummary';
import AccountStatsDetails from '@/components/AccountStatsDetails';
import AccountFriendsList from '@/components/AccountFriendsList';
import {
  HydrationMomentThumb,
  HydrationMomentViewer,
} from '@/components/HydrationMomentMedia';
import { Bottle } from '@/components/icons/Bottle';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GOAL_OPTIONS = [1000, 1500, 2000, 2500, 3000, 3500, 4000];

export default function Account() {
  const { user: me, checkUserAuth } = useAuth();
  const [posts, setPosts] = useState([]);
  const [bottles, setBottles] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: '', bio: '' });
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showAllMoments, setShowAllMoments] = useState(false);
  const [viewingPost, setViewingPost] = useState(null);

  useEffect(() => {
    if (!me || postsLoaded) return;
    setForm({ username: me.username || '', bio: me.bio || '' });
    setPhotoPreview(me.avatar_url || null);
    Promise.all([
      api.entities.WaterPost.filter({ created_by: me.email }, '-created_date', 500),
      api.entities.UserBottle.list(),
    ])
      .then(([myPosts, myBottles]) => {
        setPosts(myPosts);
        setBottles(myBottles);
      })
      .catch((e) => console.error(e))
      .finally(() => setPostsLoaded(true));
  }, [me]);
  if (!me) {
    return (
      <div className="p-5 space-y-4 animate-pulse">
        <div className="h-48 bg-muted rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card rounded-3xl border border-border/50" />
          ))}
        </div>
      </div>
    );
  }

  const galleryPosts = posts.slice(0, 6);
  const hasMoreMoments = posts.length > 6;

  const resetEditState = () => {
    setEditing(false);
    setForm({ username: me.username || '', bio: me.bio || '' });
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(me.avatar_url || null);
    setRemovePhoto(false);
  };

  const persistAvatar = async (blob) => {
    setSavingProfile(true);
    try {
      let avatarUrl = null;
      if (blob) {
        const upload = await api.integrations.Core.UploadFile({
          file: blob,
          bucket: 'avatars',
        });
        avatarUrl = upload.file_url;
      }
      await api.auth.updateMe({ avatar_url: avatarUrl });
      await checkUserAuth();
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoBlob(null);
      setRemovePhoto(false);
      setPhotoPreview(avatarUrl);
      toast.success(blob ? 'Profile photo updated' : 'Profile photo removed');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not update profile photo');
      throw err;
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoChange = async ({ blob, previewUrl }) => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(blob);
    setPhotoPreview(previewUrl);
    setRemovePhoto(false);
    try {
      await persistAvatar(blob);
    } catch {
      // Keep local preview so they can retry via Save if needed
    }
  };

  const clearPhoto = async () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    try {
      await persistAvatar(null);
    } catch {
      // Toast already shown
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates = {
        username: form.username.trim(),
        bio: form.bio,
      };

      // Photo usually saves on pick; still flush pending blob / remove if needed
      if (photoBlob) {
        const upload = await api.integrations.Core.UploadFile({
          file: photoBlob,
          bucket: 'avatars',
        });
        updates.avatar_url = upload.file_url;
      } else if (removePhoto) {
        updates.avatar_url = null;
      }

      await api.auth.updateMe(updates);
      await checkUserAuth();
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoBlob(null);
      setRemovePhoto(false);
      setPhotoPreview(updates.avatar_url !== undefined ? updates.avatar_url : me.avatar_url);
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveGoal = async (ml) => {
    setSavingGoal(true);
    await api.auth.updateMe({ daily_goal_ml: ml });
    await checkUserAuth();
    setSavingGoal(false);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.auth.deleteAccount();
      toast.success('Account data deleted. Goodbye, Warrior!');
      window.location.href = isSupabaseConfigured ? '/auth' : '/';
    } catch (err) {
      console.error(err);
      toast.error('Could not delete account.');
      setDeletingAccount(false);
    }
  };

  if (showSettings) {
    return (
      <div className="pt-4 pb-10">
        <AccountSettings
          me={me}
          onClose={() => setShowSettings(false)}
          onDeleteAccount={handleDeleteAccount}
          deletingAccount={deletingAccount}
        />
      </div>
    );
  }

  if (showFriends) {
    return (
      <div className="pt-4 pb-10">
        <AccountFriendsList me={me} onClose={() => setShowFriends(false)} />
      </div>
    );
  }

  if (showAllMoments) {
    return (
      <div className="pt-4 pb-10 px-5 space-y-5">
        <button
          type="button"
          onClick={() => setShowAllMoments(false)}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Account
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hydration moments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {posts.length} post{posts.length !== 1 ? 's' : ''} all time
          </p>
        </div>
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border/50">
            <p className="text-sm text-muted-foreground">No posts yet. Capture your first drink!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {posts.map((p) => (
              <HydrationMomentThumb key={p.id} post={p} onClick={setViewingPost} />
            ))}
          </div>
        )}
        {viewingPost && (
          <HydrationMomentViewer post={viewingPost} onClose={() => setViewingPost(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="relative water-gradient pt-10 pb-20 px-5">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
        <div className="relative flex items-start justify-between gap-3">
          {!editing ? (
            <>
              <UserAvatar user={me} size="xl" className="ring-4 ring-white/30" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" /> Settings
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur"
                  onClick={() => {
                    setEditing(true);
                    setForm({ username: me.username || '', bio: me.bio || '' });
                    setPhotoPreview(me.avatar_url || null);
                    setPhotoBlob(null);
                    setRemovePhoto(false);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full space-y-4">
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur"
                  disabled={savingProfile}
                  onClick={resetEditState}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-white text-primary hover:bg-white/90"
                  disabled={savingProfile}
                  onClick={saveProfile}
                >
                  {savingProfile ? (
                    <span className="text-xs">Saving…</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Save
                    </>
                  )}
                </Button>
              </div>
              <ProfilePhotoChooser
                previewUrl={photoPreview}
                onChange={handlePhotoChange}
                onClear={clearPhoto}
                size="xl"
                uploading={savingProfile}
              />
            </div>
          )}
        </div>
        <div className="relative mt-4 text-white">
          {editing ? (
            <div className="space-y-2 mt-6">
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Username"
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-2xl"
              />
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Bio"
                rows={2}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-2xl resize-none"
              />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{me.username || me.full_name}</h2>
              {me.bio && <p className="text-white/90 text-sm mt-3 leading-relaxed max-w-md">{me.bio}</p>}
            </>
          )}
        </div>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Bottle} label="Bottles" value={posts.length} />
          <StatCard icon={Waves} label="Streak" value={`${me.streak_count || 0}d`} />
          <StatCard
            icon={Users}
            label="Friends"
            value={(me.friends || []).length}
            onClick={() => setShowFriends(true)}
          />
        </div>
      </div>

      <div className="px-5 mt-4">
        <AccountStatsSummary posts={posts} accountCreated={me.created_date} />
      </div>

      <div className="px-5 mt-6">
        <button
          type="button"
          onClick={() => posts.length > 0 && setShowAllMoments(true)}
          className={cn(
            'w-full flex items-center justify-between gap-2 mb-3 text-left',
            posts.length > 0 && 'active:opacity-80'
          )}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your hydration moments
          </h3>
          {posts.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
              See all
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
        {galleryPosts.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border/50">
            <p className="text-sm text-muted-foreground">No posts yet. Capture your first drink!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {galleryPosts.map((p) => (
                <HydrationMomentThumb key={p.id} post={p} onClick={setViewingPost} />
              ))}
            </div>
            {hasMoreMoments && (
              <Button
                variant="secondary"
                className="w-full mt-3 rounded-2xl"
                onClick={() => setShowAllMoments(true)}
              >
                See all {posts.length} moments
              </Button>
            )}
          </>
        )}
      </div>

      <div className="px-5 mt-6">
        <MyBottlesManager />
      </div>

      <div className="px-5 mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Hydration calendar</h3>
        <HydrationCalendar posts={posts} onDayClick={(date, dayPosts) => setSelectedDay({ date, posts: dayPosts })} />
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-card w-full max-w-2xl rounded-t-3xl p-5 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
            <h3 className="font-semibold text-base mb-1">
              {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('default', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {selectedDay.posts.length} post{selectedDay.posts.length !== 1 ? 's' : ''} ·{' '}
              {selectedDay.posts.reduce((s, p) => s + (p.bottle_size_ml || 500), 0)} ml
            </p>
            <div className="grid grid-cols-3 gap-2">
              {selectedDay.posts.map((p) => (
                <HydrationMomentThumb key={p.id} post={p} onClick={setViewingPost} />
              ))}
            </div>
          </div>
        </div>
      )}

      {viewingPost && !showAllMoments && (
        <HydrationMomentViewer post={viewingPost} onClose={() => setViewingPost(null)} />
      )}

      <div className="px-5 mt-6">
        <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Daily Goal</h3>
            <span className="ml-auto text-sm font-bold text-primary">{(me.daily_goal_ml || 2000) / 1000} L</span>
          </div>
          <p className="text-xs text-muted-foreground mb-1">ml</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {GOAL_OPTIONS.map((ml) => (
              <button
                key={ml}
                disabled={savingGoal}
                onClick={() => saveGoal(ml)}
                className={`py-2.5 rounded-2xl text-xs font-semibold transition-all border ${
                  (me.daily_goal_ml || 2000) === ml
                    ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                    : 'bg-background border-border hover:border-primary/40'
                }`}
              >
                {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-1">oz</p>
          <div className="grid grid-cols-4 gap-2">
            {[32, 48, 64, 80, 96, 112, 128].map((oz) => (
              <button
                key={oz}
                disabled={savingGoal}
                onClick={() => saveGoal(Math.round(oz * 29.574))}
                className={`py-2.5 rounded-2xl text-xs font-semibold transition-all border ${
                  Math.abs((me.daily_goal_ml || 2000) - Math.round(oz * 29.574)) < 10
                    ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                    : 'bg-background border-border hover:border-primary/40'
                }`}
              >
                {oz}oz
              </button>
            ))}
          </div>
          <CustomAmountInput onSubmit={saveGoal} disabled={savingGoal} />
          <p className="text-xs text-muted-foreground mt-1">
            Currently set to {(me.daily_goal_ml || 2000)}ml · {Math.round((me.daily_goal_ml || 2000) / 29.574)}oz
          </p>
          <p className="text-xs text-muted-foreground mt-3">Your streak increases each day you hit this goal.</p>
        </div>
      </div>

      <div className="px-5 mt-6">
        <AccountStatsDetails posts={posts} bottles={bottles} />
      </div>

      <div className="px-5 mt-8">
        <Button
          variant="secondary"
          className="w-full rounded-2xl h-12 justify-start"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-4 h-4 mr-2" /> Settings
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'bg-card rounded-3xl border border-border/50 p-4 shadow-sm text-left w-full',
        onClick && 'hover:border-primary/40 active:scale-[0.98] transition-all'
      )}
    >
      <Icon className="w-5 h-5 text-primary mb-2" />
      <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">{label}</p>
    </Comp>
  );
}
