import React, { useState } from 'react';
import { MoreHorizontal, Flag, Ban, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import ReportModal from '@/components/ReportModal';
import { blockUser } from '@/services/moderation';
import { toast } from 'sonner';

/**
 * Three-dot menu for reporting / blocking others, or deleting your own content.
 * @param {{
 *   targetType: 'post' | 'comment' | 'profile',
 *   targetId: string,
 *   reportedUserId: string,
 *   isOwn: boolean,
 *   onBlocked?: () => void,
 *   onDelete?: () => void | Promise<void>,
 *   className?: string,
 * }} props
 */
export default function ContentActionsMenu({
  targetType,
  targetId,
  reportedUserId,
  isOwn,
  onBlocked,
  onDelete,
  className,
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showOwnDelete = Boolean(isOwn && onDelete);
  const showModeration = Boolean(!isOwn && reportedUserId && targetId);

  if (!showOwnDelete && !showModeration) return null;

  const reportLabel = targetType === 'profile' ? 'Report profile' : 'Report';
  const deleteLabel = targetType === 'post' ? 'Delete post' : 'Delete comment';

  const confirmBlock = async () => {
    if (blocking) return;
    setBlocking(true);
    try {
      await blockUser(reportedUserId);
      toast.success('User blocked');
      setBlockOpen(false);
      onBlocked?.();
    } catch (err) {
      toast.error(err?.message || 'Could not block user.');
    } finally {
      setBlocking(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={
              className ||
              'w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70'
            }
            aria-label="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl">
          {showModeration && (
            <>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={() => setReportOpen(true)}
              >
                <Flag className="w-4 h-4" />
                {reportLabel}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => setBlockOpen(true)}
              >
                <Ban className="w-4 h-4" />
                Block user
              </DropdownMenuItem>
            </>
          )}
          {showOwnDelete && (
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              {deleteLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showModeration && (
        <>
          <ReportModal
            open={reportOpen}
            onOpenChange={setReportOpen}
            targetType={targetType}
            targetId={targetId}
            reportedUserId={reportedUserId}
          />

          <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Block this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  Blocking this user will hide your profiles, posts, comments, and social activity from each other.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl" disabled={blocking}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={blocking}
                  onClick={(e) => {
                    e.preventDefault();
                    confirmBlock();
                  }}
                >
                  Block
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {showOwnDelete && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {targetType === 'post' ? 'Delete this post?' : 'Delete this comment?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {targetType === 'post'
                  ? 'This removes the post and its comments from the feed. This can’t be undone.'
                  : 'This removes the comment permanently.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl" disabled={deleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
