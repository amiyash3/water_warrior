import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/utils/date';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function HydrationCalendar({ posts, onDayClick }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { year, month } = viewDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build a map: "YYYY-MM-DD" -> array of posts
  const postsByDay = {};
  posts.forEach(p => {
    const day = p.created_date ? toLocalDateString(p.created_date) : null;
    if (day) {
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(p);
    }
  });

  const prevMonth = () => {
    setViewDate(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewDate(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  };

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold">{monthName}</span>
        <button
          onClick={nextMonth}
          disabled={year === today.getFullYear() && month === today.getMonth()}
          className="p-1.5 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayPosts = postsByDay[dateStr] || [];
          const isToday = dateStr === toLocalDateString(today);
          const hasPosts = dayPosts.length > 0;

          return (
            <button
              key={dateStr}
              onClick={() => hasPosts && onDayClick && onDayClick(dateStr, dayPosts)}
              className={cn(
                "relative flex flex-col items-center justify-center aspect-square rounded-xl text-xs font-medium transition-all",
                hasPosts ? "cursor-pointer hover:scale-105" : "cursor-default",
                isToday && !hasPosts && "ring-1 ring-primary text-primary",
                hasPosts && "water-gradient text-white shadow-sm shadow-primary/20",
              )}
            >
              <span>{day}</span>
              {hasPosts && dayPosts.length > 1 && (
                <span className="text-[8px] leading-none opacity-80">{dayPosts.length}x</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Highlighted days = hydration logged
      </p>
    </div>
  );
}