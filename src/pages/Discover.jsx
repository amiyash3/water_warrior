import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Search, UserPlus, Check, Clock, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import ContentActionsMenu from '@/components/ContentActionsMenu';
import { isUserBlocked } from '@/services/moderation';
import { toast } from 'sonner';

export default function Discover() {
  const { user: me, checkUserAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const onBlocked = () => load();
    window.addEventListener('ww:user-blocked', onBlocked);
    window.addEventListener('ww:user-unblocked', onBlocked);
    return () => {
      window.removeEventListener('ww:user-blocked', onBlocked);
      window.removeEventListener('ww:user-unblocked', onBlocked);
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [allUsers, allReqs] = await Promise.all([
        api.entities.User.list().catch(() => []),
        api.entities.FriendRequest.list('-created_date', 200).catch(() => []),
      ]);
      setUsers(allUsers);
      setRequests(allReqs);
    } finally {
      setLoading(false);
    }
  };

  const friendEmails = me?.friends || [];
  const friendSet = new Set(friendEmails);
  const incoming = me
    ? requests.filter((r) => r.to_email === me.email && r.status === 'pending')
    : [];
  const outgoing = me
    ? requests.filter((r) => r.from_email === me.email && r.status === 'pending')
    : [];

  const friends = useMemo(() => {
    return users
      .filter((u) => friendSet.has(u.email))
      .sort((a, b) =>
        String(a.username || a.full_name || a.email).localeCompare(
          String(b.username || b.full_name || b.email)
        )
      );
  }, [users, me?.friends]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [friends, query]);

  /** Search-only: find people who aren't already friends */
  const discoverMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter((u) => u.email !== me?.email && !friendSet.has(u.email))
      .filter(
        (u) =>
          u.username?.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [users, query, me?.email, me?.friends]);

  const sendRequest = async (user) => {
    try {
      if (await isUserBlocked(user.id)) {
        toast.error('You cannot interact with a blocked user.');
        return;
      }
    } catch (_) {
      // proceed; RLS will reject if blocked the other way
    }
    await api.entities.FriendRequest.create({
      from_email: me.email,
      to_email: user.email,
      from_username: me.username || me.full_name,
      to_username: user.username || user.full_name,
      status: 'pending',
    });
    toast.success(`Request sent to ${user.username || user.full_name}`);
    load();
  };

  const acceptRequest = async (req) => {
    await api.entities.FriendRequest.update(req.id, { status: 'accepted' });
    await api.addFriendConnection(me.email, req.from_email);
    await checkUserAuth();
    toast.success('Friend added!');
    load();
  };

  const declineRequest = async (req) => {
    await api.entities.FriendRequest.update(req.id, { status: 'declined' });
    load();
  };

  const getStatus = (user) => {
    if (friendSet.has(user.email)) return 'friend';
    if (outgoing.some((r) => r.to_email === user.email)) return 'pending';
    if (incoming.some((r) => r.from_email === user.email)) return 'incoming';
    return 'none';
  };

  return (
    <div className="p-5 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Friends</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {friends.length} friend{friends.length !== 1 ? 's' : ''} · search to find people
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username"
          className="pl-11 h-12 rounded-2xl border-border bg-card"
        />
      </div>

      {incoming.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Friend requests ({incoming.length})
          </h3>
          <div className="space-y-2">
            {incoming.map((req) => {
              const user =
                users.find((u) => u.email === req.from_email) || {
                  email: req.from_email,
                  username: req.from_username,
                };
              return (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border/50"
                >
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {user.username || user.full_name || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">wants to hydrate with you</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => acceptRequest(req)}
                    className="rounded-full water-gradient border-0"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => declineRequest(req)}
                    className="rounded-full"
                  >
                    Decline
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {discoverMatches.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Find people
          </h3>
          <div className="space-y-2">
            {discoverMatches.map((user) => {
              const status = getStatus(user);
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border/50"
                >
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {user.username || user.full_name || user.email}
                    </p>
                    {user.bio && (
                      <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                    )}
                  </div>
                  {status === 'pending' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold px-3 py-1.5 bg-muted rounded-full">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </div>
                  )}
                  {status === 'incoming' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const req = incoming.find((r) => r.from_email === user.email);
                        if (req) acceptRequest(req);
                      }}
                      className="rounded-full water-gradient border-0"
                    >
                      Accept
                    </Button>
                  )}
                  {status === 'none' && (
                    <Button
                      size="sm"
                      onClick={() => sendRequest(user)}
                      className="rounded-full water-gradient border-0"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  )}
                  <ContentActionsMenu
                    targetType="profile"
                    targetId={user.id}
                    reportedUserId={user.id}
                    isOwn={false}
                    onBlocked={() => load()}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Your friends
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card rounded-2xl border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border/50">
            <div className="w-14 h-14 mx-auto rounded-2xl water-gradient-soft flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? 'No friends match that search'
                : 'No friends yet — search above to find people'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFriends.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border/50"
              >
                <UserAvatar user={user} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {user.username || user.full_name || user.email}
                  </p>
                  {user.bio && (
                    <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-semibold px-3 py-1.5 bg-primary/10 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Friend
                </div>
                <ContentActionsMenu
                  targetType="profile"
                  targetId={user.id}
                  reportedUserId={user.id}
                  isOwn={false}
                  onBlocked={() => load()}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
