import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Droplets, Waves, Users, LogOut, Pencil, Check, X, Trash2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import UserAvatar from '@/components/UserAvatar';
import ProfilePhotoChooser from '@/components/ProfilePhotoChooser';
import HydrationCalendar from '@/components/HydrationCalendar';
import MyBottlesManager from '@/components/MyBottlesManager';
import CustomAmountInput from '@/components/CustomAmountInput';
import { Bottle } from '@/components/icons/Bottle';
import { toast } from 'sonner';

const GOAL_OPTIONS = [1000, 1500, 2000, 2500, 3000, 3500, 4000];

export default function Account() {
  const { user: me, checkUserAuth } = useAuth();
  const [posts, setPosts] = useState([]);
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

  useEffect(() => {
    if (!me || postsLoaded) return;
    setForm({ username: me.username || '', bio: me.bio || '' });
    setPhotoPreview(me.avatar_url || null);
    api.entities.WaterPost.filter({ created_by: me.email }, '-created_date', 50)
      .then(setPosts)
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

  const totalMl = posts.reduce((sum, p) => sum + (p.bottle_size_ml || 0), 0);

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

  return (
    <div className="pb-10">
      <div className="relative water-gradient pt-10 pb-20 px-5">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
        <div className="relative flex items-start justify-between gap-3">
          {!editing ? (
            <>
              <UserAvatar user={me} size="xl" className="ring-4 ring-white/30" />
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
              <p className="text-white/80 text-sm mt-1">{me.email}</p>
              {me.bio && <p className="text-white/90 text-sm mt-3 leading-relaxed max-w-md">{me.bio}</p>}
            </>
          )}
        </div>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Bottle} label="Bottles" value={posts.length} />
          <StatCard icon={Waves} label="Streak" value={`${me.streak_count || 0}d`} />
          <StatCard icon={Users} label="Friends" value={(me.friends || []).length} />
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-card rounded-3xl border border-border/50 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl water-gradient-soft flex items-center justify-center">
            <Droplets className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total hydrated</p>
            <p className="text-2xl font-bold tracking-tight">{(totalMl / 1000).toFixed(1)} L</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your hydration moments</h3>
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border/50">
            <p className="text-sm text-muted-foreground">No posts yet. Capture your first drink!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {posts.map((p) => (
              <div key={p.id} className="aspect-[3/4] rounded-2xl overflow-hidden relative bg-muted">
                <img src={p.back_photo_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-1.5 left-1.5 w-10 aspect-[3/4] rounded-lg overflow-hidden border border-white/80">
                  <img src={p.front_photo_url} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            ))}
          </div>
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedDay(null)}
        >
          <div className="bg-card w-full max-w-2xl rounded-t-3xl p-5 pb-10" onClick={(e) => e.stopPropagation()}>
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
                <div key={p.id} className="aspect-[3/4] rounded-2xl overflow-hidden relative bg-muted">
                  <img src={p.back_photo_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 w-10 aspect-[3/4] rounded-lg overflow-hidden border border-white/80">
                    <img src={p.front_photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      <div className="px-5 mt-8 space-y-3">
        <Button
          variant="ghost"
          className="w-full rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/5"
          onClick={() => api.auth.logout()}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              disabled={deletingAccount}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all your hydration posts. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">{label}</p>
    </div>
  );
}
