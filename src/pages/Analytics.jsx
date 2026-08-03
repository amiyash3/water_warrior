import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Droplets, TrendingUp, Trophy, Sparkles } from 'lucide-react';
import { format, eachDayOfInterval, subMonths, eachMonthOfInterval } from 'date-fns';
import { toLocalDateString } from '@/utils/date';
import {
  getAccountDayCount,
  getTotalMl,
  getAverageLitersPerDay,
  buildBottleStats,
} from '@/lib/hydrationStats';
import {
  getHydrationMilestones,
  formatMilestoneProgress,
} from '@/lib/hydrationMilestones';
import { cn } from '@/lib/utils';

function buildWeeklyData(posts) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const days = eachDayOfInterval({ start, end: today });
  return days.map((day) => {
    const label = format(day, 'EEE');
    const dateStr = format(day, 'yyyy-MM-dd');
    const liters = posts
      .filter((p) => toLocalDateString(p.created_date) === dateStr)
      .reduce((sum, p) => sum + (p.bottle_size_ml || 500) / 1000, 0);
    return { label, liters: parseFloat(liters.toFixed(2)) };
  });
}

function buildMonthlyData(posts) {
  const today = new Date();
  const months = eachMonthOfInterval({ start: subMonths(today, 5), end: today });
  return months.map((month) => {
    const label = format(month, 'MMM');
    const monthStr = format(month, 'yyyy-MM');
    const liters = posts
      .filter((p) => toLocalDateString(p.created_date).slice(0, 7) === monthStr)
      .reduce((sum, p) => sum + (p.bottle_size_ml || 500) / 1000, 0);
    return { label, liters: parseFloat(liters.toFixed(2)) };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-2xl px-4 py-2 shadow-lg text-sm">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-primary font-bold">{payload[0].value} L</p>
      </div>
    );
  }
  return null;
};

function ChartCard({ title, data, color }) {
  const total = data.reduce((s, d) => s + d.liters, 0).toFixed(1);
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Droplets className="w-3.5 h-3.5" />
          {total} L total
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 8 }} />
          <Bar dataKey="liters" fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const [posts, setPosts] = useState([]);
  const [bottles, setBottles] = useState([]);
  const [accountCreated, setAccountCreated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.auth.me();
        const [myPosts, myBottles] = await Promise.all([
          api.entities.WaterPost.filter({ created_by: me.email }, '-created_date', 500),
          api.entities.UserBottle.list(),
        ]);
        setPosts(myPosts);
        setBottles(myBottles);
        setAccountCreated(me.created_date);
      } catch (e) {
        console.error('Analytics load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weeklyData = buildWeeklyData(posts);
  const monthlyData = buildMonthlyData(posts);
  const totalMl = getTotalMl(posts);
  const totalLiters = (totalMl / 1000).toFixed(1);
  const accountDays = getAccountDayCount(accountCreated);
  const avgPerDay = getAverageLitersPerDay(posts, accountDays).toFixed(2);
  const { featured, next, unlocked } = getHydrationMilestones(totalMl);
  const bottleStats = buildBottleStats(posts, bottles);

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-3xl border border-border/50 h-52 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 pb-10 space-y-5">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Your hydration at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm">
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold tracking-tight">{totalLiters} L</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">All time</p>
        </div>
        <div className="bg-card rounded-3xl border border-border/50 p-4 shadow-sm">
          <Droplets className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold tracking-tight">{avgPerDay} L</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">Avg / day</p>
          <p className="text-[10px] text-muted-foreground mt-1">Over {accountDays} day{accountDays !== 1 ? 's' : ''} on Water Warrior</p>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-start gap-3 relative">
          <div className="w-12 h-12 rounded-2xl water-gradient-soft flex items-center justify-center text-2xl shrink-0">
            {featured?.emoji ?? '💧'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-base">Hydration milestone</h3>
            </div>
            {featured ? (
              <>
                <p className="text-sm font-semibold text-primary">{featured.title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{featured.message}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Capture your first drink to unlock fun comparisons.</p>
            )}
            {next && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Next: {next.title}</span>
                  <span>{formatMilestoneProgress(totalMl, next)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full water-gradient rounded-full transition-all"
                    style={{ width: `${formatMilestoneProgress(totalMl, next)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {unlocked.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Unlocked ({unlocked.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {unlocked.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {m.emoji} {m.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {bottleStats.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Your bottles</h3>
          <p className="text-xs text-muted-foreground mb-4">Totals per bottle from your capture history</p>
          <div className="space-y-3">
            {bottleStats.map((bottle) => (
              <div
                key={bottle.id}
                className={cn(
                  'rounded-2xl border border-border/50 p-4',
                  bottle.id !== 'unassigned' && 'bg-background/50'
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{bottle.name}</p>
                    {bottle.size_ml && (
                      <p className="text-xs text-muted-foreground">{bottle.size_ml} ml bottle</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-primary shrink-0">
                    {bottle.totalLiters.toFixed(1)} L
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{bottle.postCount} fill{bottle.postCount !== 1 ? 's' : ''}</span>
                  <span>{bottle.totalMl.toLocaleString()} ml total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChartCard title="Last 7 Days" data={weeklyData} color="hsl(var(--primary))" />
      <ChartCard title="Last 6 Months" data={monthlyData} color="hsl(var(--accent))" />
    </div>
  );
}
