import React from 'react';
import { Droplets, TrendingUp } from 'lucide-react';
import {
  getAccountDayCount,
  getTotalMl,
  getAverageLitersPerDay,
} from '@/lib/hydrationStats';

/**
 * Compact avg/day + all-time totals for the top of Account.
 * @param {{ posts: Array, accountCreated: string | null | undefined }} props
 */
export default function AccountStatsSummary({ posts, accountCreated }) {
  const totalMl = getTotalMl(posts);
  const totalLiters = (totalMl / 1000).toFixed(1);
  const accountDays = getAccountDayCount(accountCreated);
  const avgPerDay = getAverageLitersPerDay(posts, accountDays).toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm">
        <Droplets className="w-5 h-5 text-primary mb-2" />
        <p className="text-2xl font-bold tracking-tight">{avgPerDay} L</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">Avg / day</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Over {accountDays} day{accountDays !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm">
        <TrendingUp className="w-5 h-5 text-primary mb-2" />
        <p className="text-2xl font-bold tracking-tight">{totalLiters} L</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">All time</p>
      </div>
    </div>
  );
}
