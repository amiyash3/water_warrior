import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UsersRound,
  Plus,
  LogIn,
  ChevronLeft,
  Copy,
  RefreshCw,
  LogOut,
  Trash2,
  Flame,
  Droplets,
  Share2,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { shareGroupInvite } from '@/lib/groupInvite';
import {
  listMyGroups,
  createGroup,
  joinByCode,
  leaveGroup,
  deleteGroup,
  getGroup,
  getLeaderboard,
  regenerateInviteCode,
} from '@/services/groups';

const PERIODS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

const MEMBER_CARD_TONES = [
  'from-sky-600 to-cyan-700',
  'from-teal-600 to-emerald-700',
  'from-blue-700 to-indigo-800',
  'from-cyan-700 to-slate-800',
  'from-indigo-600 to-blue-800',
];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch {
    toast.error('Could not copy');
  }
}

async function handleShareInvite(groupName, inviteCode) {
  try {
    const result = await shareGroupInvite({ groupName, inviteCode });
    if (result === 'copied') toast.success('Invite copied — paste into Messages or Mail');
    else if (result === 'shared') toast.success('Invite shared');
  } catch (e) {
    toast.error(e?.message || 'Could not share invite');
  }
}

function formatLiters(ml) {
  return `${((ml || 0) / 1000).toFixed(1)} L`;
}

function periodLabel(period) {
  return PERIODS.find((p) => p.id === period)?.label || 'This week';
}

export default function Groups() {
  const { user: me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [sheet, setSheet] = useState(null); // 'create' | 'join' | null
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  const loadGroups = useCallback(async () => {
    try {
      const list = await listMyGroups();
      setGroups(list);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Could not load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Open join sheet from ?join=CODE (web or deep link)
  useEffect(() => {
    const joinCode = (searchParams.get('join') || '').trim().toUpperCase();
    if (!joinCode) return;
    setSelectedId(null);
    setCodeInput(joinCode);
    setSheet('join');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const openCreate = () => {
    setNameInput('');
    setCreatedInvite(null);
    setSheet('create');
  };

  const openJoin = () => {
    setCodeInput('');
    setSheet('join');
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const group = await createGroup(nameInput);
      setCreatedInvite(group);
      await loadGroups();
      toast.success('Group created');
    } catch (e) {
      toast.error(e?.message || 'Could not create group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setSubmitting(true);
    try {
      const group = await joinByCode(codeInput);
      setSheet(null);
      await loadGroups();
      setSelectedId(group.id);
      toast.success(`Joined ${group.name}`);
    } catch (e) {
      toast.error(e?.message || 'Could not join group');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedId) {
    return (
      <GroupDetail
        groupId={selectedId}
        me={me}
        onBack={() => {
          setSelectedId(null);
          loadGroups();
        }}
        onLeft={() => {
          setSelectedId(null);
          loadGroups();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card rounded-3xl border border-border/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 pb-10 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Groups</h2>
          <p className="text-sm text-muted-foreground mt-1">Compete with friends on water and streaks</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="secondary" className="rounded-full" onClick={openJoin}>
            <LogIn className="w-3.5 h-3.5 mr-1.5" /> Join
          </Button>
          <Button size="sm" className="rounded-full" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-3xl border border-border/50">
          <UsersRound className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="font-semibold">No groups yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Create a group and share an invite, or join with a code.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <Button variant="secondary" className="rounded-full" onClick={openJoin}>
              Join with code
            </Button>
            <Button className="rounded-full" onClick={openCreate}>
              Create group
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedId(g.id)}
              className="w-full text-left bg-card rounded-3xl border border-border/50 p-4 shadow-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                    {g.my_role === 'owner' ? ' · Owner' : ''}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                  {g.invite_code}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {sheet === 'create' && (
        <BottomSheet onClose={() => !submitting && setSheet(null)}>
          {createdInvite ? (
            <InviteSharePanel
              groupName={createdInvite.name}
              inviteCode={createdInvite.invite_code}
              onOpen={() => {
                setSheet(null);
                setSelectedId(createdInvite.id);
              }}
            />
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Create a group</h3>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Group name"
                maxLength={60}
                className="rounded-2xl h-12"
                autoFocus
              />
              <Button
                className="w-full rounded-2xl h-12"
                disabled={submitting || !nameInput.trim()}
                onClick={handleCreate}
              >
                {submitting ? 'Creating…' : 'Create'}
              </Button>
            </div>
          )}
        </BottomSheet>
      )}

      {sheet === 'join' && (
        <BottomSheet onClose={() => !submitting && setSheet(null)}>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Join with invite code</h3>
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={10}
              className="rounded-2xl h-12 font-mono tracking-widest text-center text-lg uppercase"
              autoFocus
            />
            <Button
              className="w-full rounded-2xl h-12"
              disabled={submitting || !codeInput.trim()}
              onClick={handleJoin}
            >
              {submitting ? 'Joining…' : 'Join group'}
            </Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function InviteSharePanel({ groupName, inviteCode, onOpen, showOpen = true }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Invite friends</h3>
      <p className="text-sm text-muted-foreground">
        Share a link via Messages, Mail, and more — or copy the code for{' '}
        <span className="font-medium text-foreground">{groupName}</span>.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center font-mono text-2xl font-bold tracking-[0.2em] py-4 rounded-2xl bg-primary/10 text-primary">
          {inviteCode}
        </div>
        <Button
          size="icon"
          variant="secondary"
          className="rounded-2xl h-12 w-12 shrink-0"
          onClick={() => copyText(inviteCode)}
        >
          <Copy className="w-4 h-4" />
        </Button>
      </div>
      <Button
        className="w-full rounded-2xl h-12"
        onClick={() => handleShareInvite(groupName, inviteCode)}
      >
        <Share2 className="w-4 h-4 mr-2" /> Share invite
      </Button>
      {showOpen && onOpen && (
        <Button variant="secondary" className="w-full rounded-2xl h-12" onClick={onOpen}>
          Open group
        </Button>
      )}
    </div>
  );
}

function GroupDetail({ groupId, me, onBack, onLeft }) {
  const [group, setGroup] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('water'); // water | streak
  const [period, setPeriod] = useState('week');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [g, board] = await Promise.all([
          getGroup(groupId),
          getLeaderboard(groupId, period),
        ]);
        if (cancelled) return;
        setGroup(g);
        setRows(board);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        toast.error(e?.message || 'Could not load group');
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, period]);

  const ranked = useMemo(() => {
    const list = [...rows];
    if (metric === 'streak') {
      list.sort(
        (a, b) =>
          (b.streak_count || 0) - (a.streak_count || 0) ||
          (b.water_ml || 0) - (a.water_ml || 0) ||
          String(a.username || '').localeCompare(String(b.username || ''))
      );
    }
    return list;
  }, [rows, metric]);

  const avatarStack = ranked.slice(0, 4);

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const updated = await regenerateInviteCode(groupId);
      setGroup((prev) => ({ ...prev, ...updated }));
      toast.success('Invite code refreshed');
    } catch (e) {
      toast.error(e?.message || 'Could not regenerate code');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(group?.my_role === 'owner'
      ? 'Delete this group for everyone?'
      : 'Leave this group?')) {
      return;
    }
    setBusy(true);
    try {
      if (group?.my_role === 'owner') {
        await deleteGroup(groupId);
        toast.success('Group deleted');
      } else {
        await leaveGroup(groupId);
        toast.success('Left group');
      }
      onLeft();
    } catch (e) {
      toast.error(e?.message || 'Could not leave group');
      setBusy(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-10 w-32 bg-muted rounded-full animate-pulse" />
        <div className="h-56 bg-card rounded-3xl border border-border/50 animate-pulse" />
      </div>
    );
  }

  const boardSubtitle = metric === 'streak' ? 'Current streak' : periodLabel(period);

  return (
    <div className="pb-10">
      <div className="px-5 pt-1 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center shrink-0"
          aria-label="Back to groups"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <div className="flex -space-x-2 shrink-0">
            {avatarStack.length === 0 ? (
              <div className="w-8 h-8 rounded-full bg-primary/15" />
            ) : (
              avatarStack.map((row) => (
                <UserAvatar
                  key={row.user_id}
                  user={{
                    username: row.username,
                    full_name: row.full_name,
                    avatar_url: row.avatar_url,
                  }}
                  size="sm"
                  className="ring-2 ring-background w-8 h-8 text-[10px]"
                />
              ))
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-lg tracking-tight truncate leading-tight">{group.name}</h2>
            <p className="text-[11px] text-muted-foreground">
              {ranked.length} member{ranked.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center shrink-0"
          aria-label="Group settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 space-y-3 mb-5">
        <div className="flex p-1 rounded-2xl bg-muted/60">
          {[
            { id: 'water', label: 'Water', icon: Droplets },
            { id: 'streak', label: 'Streak', icon: Flame },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMetric(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                metric === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {metric === 'water' && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap',
                  period === p.id
                    ? 'water-gradient text-white border-transparent'
                    : 'bg-card border-border text-muted-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 space-y-5">
        {/* Top leaderboard */}
        <div className="rounded-[1.75rem] bg-slate-900 text-white p-5 shadow-xl shadow-slate-900/20">
          <p className="text-2xl font-bold tracking-tight uppercase leading-none">
            {metric === 'streak' ? 'Top streaks' : 'Top hydrators'}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mt-2">
            {boardSubtitle}
          </p>

          {ranked.length === 0 ? (
            <p className="text-sm text-white/60 text-center py-10">No members yet — invite friends</p>
          ) : (
            <ul className="mt-5 space-y-1">
              {ranked.map((row, index) => {
                const isMe = me?.id === row.user_id;
                const primary =
                  metric === 'water'
                    ? formatLiters(row.water_ml)
                    : `${row.streak_count || 0}d`;
                return (
                  <li
                    key={row.user_id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-2 py-2.5',
                      isMe && 'bg-white/10'
                    )}
                  >
                    <span
                      className={cn(
                        'w-7 text-center text-lg font-bold tabular-nums',
                        index < 3 ? 'text-sky-300' : 'text-white/40'
                      )}
                    >
                      {index + 1}
                    </span>
                    <UserAvatar
                      user={{
                        username: row.username,
                        full_name: row.full_name,
                        avatar_url: row.avatar_url,
                      }}
                      size="sm"
                      className="ring-0 shadow-none"
                    />
                    <p className="flex-1 min-w-0 font-semibold text-sm truncate">
                      {row.username || row.full_name || 'Warrior'}
                      {isMe ? ' · You' : ''}
                    </p>
                    <p className="font-bold text-sm tabular-nums shrink-0 text-sky-200">
                      {primary}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Button
          className="w-full rounded-2xl h-12"
          onClick={() => handleShareInvite(group.name, group.invite_code)}
        >
          <Share2 className="w-4 h-4 mr-2" /> Invite friends
        </Button>

        {/* Member profile cards */}
        {ranked.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Members · {boardSubtitle}
              </p>
              <div className="h-px flex-1 bg-border" />
            </div>

            {ranked.map((row, index) => {
              const isMe = me?.id === row.user_id;
              const tone = MEMBER_CARD_TONES[index % MEMBER_CARD_TONES.length];
              return (
                <div
                  key={row.user_id}
                  className={cn(
                    'rounded-[1.75rem] bg-gradient-to-br text-white p-5 shadow-lg',
                    tone
                  )}
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      user={{
                        username: row.username,
                        full_name: row.full_name,
                        avatar_url: row.avatar_url,
                      }}
                      size="md"
                      className="ring-2 ring-white/30 shadow-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">
                        {row.username || row.full_name || 'Warrior'}
                        {isMe ? ' · You' : ''}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                        #{index + 1} · {boardSubtitle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-black/15 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wider">
                        <Droplets className="w-3.5 h-3.5" /> Water
                      </div>
                      <p className="text-xl font-bold mt-1 tabular-nums">{formatLiters(row.water_ml)}</p>
                    </div>
                    <div className="rounded-2xl bg-black/15 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wider">
                        <Flame className="w-3.5 h-3.5" /> Streak
                      </div>
                      <p className="text-xl font-bold mt-1 tabular-nums">{row.streak_count || 0}d</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {settingsOpen && (
        <BottomSheet onClose={() => !busy && setSettingsOpen(false)}>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Group settings</h3>
            <InviteSharePanel
              groupName={group.name}
              inviteCode={group.invite_code}
              showOpen={false}
            />
            {group.my_role === 'owner' && (
              <Button
                variant="secondary"
                className="w-full rounded-2xl"
                disabled={busy}
                onClick={handleRegenerate}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh invite code
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full rounded-2xl text-destructive"
              disabled={busy}
              onClick={handleLeave}
            >
              {group.my_role === 'owner' ? (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete group
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" /> Leave group
                </>
              )}
            </Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function BottomSheet({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-2xl rounded-t-3xl p-5 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>
  );
}
