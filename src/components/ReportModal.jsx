import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { REPORT_REASONS, reportContent } from '@/services/moderation';
import { toast } from 'sonner';

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   targetType: 'post' | 'comment' | 'profile',
 *   targetId: string,
 *   reportedUserId: string,
 * }} props
 */
export default function ReportModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  reportedUserId,
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setDetails('');
    setSubmitting(false);
  };

  const handleOpenChange = (next) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await reportContent({
        targetType,
        targetId,
        reportedUserId,
        reason,
        details,
      });
      toast.success('Thank you. Your report has been submitted for review.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Could not submit report.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription>
            Reports are reviewed by the Water Warrior team. False reports may affect your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-3 rounded-2xl border border-border/50 px-3 py-2.5">
                <RadioGroupItem value={r.value} id={`report-${r.value}`} />
                <Label htmlFor={`report-${r.value}`} className="flex-1 cursor-pointer text-sm font-medium">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label htmlFor="report-details" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-2 rounded-2xl resize-none"
              placeholder="Add any context that helps us review this report"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            className="rounded-2xl"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-2xl water-gradient border-0"
            disabled={!reason || submitting}
            onClick={submit}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
