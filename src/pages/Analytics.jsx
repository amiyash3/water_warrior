import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Droplets, TrendingUp } from 'lucide-react';
import { format, startOfWeek, eachDayOfInterval, subMonths, eachMonthOfInterval } from 'date-fns';

function buildWeeklyData(posts) {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: today });
  return days.map(day => {
    const label = format(day, 'EEE');
    const dateStr = format(day, 'yyyy-MM-dd');
    const liters = posts
      .filter(p => p.created_date?.slice(0, 10) === dateStr)
      .reduce((sum, p) => sum + (p.bottle_size_ml || 500) / 1000, 0);
    return { label, liters: parseFloat(liters.toFixed(2)) };
  });
}

function buildMonthlyData(posts) {
  const today = new Date();
  const months = eachMonthOfInterval({ start: subMonths(today, 5), end: today });
  return months.map(month => {
    const label = format(month, 'MMM');
    const monthStr = format(month, 'yyyy-MM');
    const liters = posts
      .filter(p => p.created_date?.slice(0, 7) === monthStr)
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.auth.me();
        const myPosts = await api.entities.WaterPost.filter({ created_by: me.email }, '-created_date', 500);
        setPosts(myPosts);
      } catch (e) {
        console.error('Analytics load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weeklyData = buildWeeklyData(posts);
  const monthlyData = buildMonthlyData(posts);
  const totalLiters = posts.reduce((s, p) => s + (p.bottle_size_ml || 500) / 1000, 0).toFixed(1);
  const avgPerDay = posts.length
    ? (posts.reduce((s, p) => s + (p.bottle_size_ml || 500), 0) / 1000 / Math.max(1, new Set(posts.map(p => p.created_date?.slice(0, 10))).size)).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2].map(i => <div key={i} className="bg-card rounded-3xl border border-border/50 h-52 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-5 pb-10 space-y-5">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Your hydration at a glance</p>
      </div>

      {/* Summary stats */}
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
        </div>
      </div>

      <ChartCard title="This Week" data={weeklyData} color="hsl(var(--primary))" />
      <ChartCard title="Last 6 Months" data={monthlyData} color="hsl(var(--accent))" />
    </div>
  );
}