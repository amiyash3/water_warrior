import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserAvatar from '@/components/UserAvatar';
import { getBlockedUsers, unblockUser } from '@/services/moderation';
import { toast } from 'sonner';

function PanelHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <button
        type="button"
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

/**
 * @param {{ onBack: () => void }} props
 */
export default function BlockedUsersPanel({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingUnblock, setPendingUnblock] = useState(null);
  const [unblocking, setUnblocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBlockedUsers();
      setRows(data);
    } catch (err) {
      toast.error(err?.message || 'Could not load blocked users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmUnblock = async () => {
    if (!pendingUnblock || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(pendingUnblock.blocked_id);
      toast.success('User unblocked');
      setPendingUnblock(null);
      await load();
    } catch (err) {
      toast.error(err?.message || 'Could not unblock user.');
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <div className="px-5 pb-10">
      <PanelHeader title="Blocked Users" onBack={onBack} />
      <p className="text-sm text-muted-foreground mb-5">
        Blocked users cannot see your profile, posts, or comments, and you will not see theirs.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No blocked users</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const user = row.profile;
            return (
              <div
                key={row.blocked_id}
                className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border/50"
              >
                <UserAvatar user={user} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {user.username || user.full_name || user.email || 'User'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setPendingUnblock(row)}
                >
                  Unblock
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingUnblock)}
        onOpenChange={(open) => {
          if (!open && !unblocking) setPendingUnblock(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock this user?</AlertDialogTitle>
            <AlertDialogDescription>
              They may be able to find you again in Discover and send friend requests. Existing
              friendship is not restored automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={unblocking}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              disabled={unblocking}
              onClick={(e) => {
                e.preventDefault();
                confirmUnblock();
              }}
            >
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
