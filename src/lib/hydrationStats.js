import { differenceInCalendarDays, startOfDay } from 'date-fns';

/** Inclusive calendar days since the account was created (minimum 1). */
export function getAccountDayCount(createdDate) {
  if (!createdDate) return 1;
  const start = startOfDay(new Date(createdDate));
  const today = startOfDay(new Date());
  return Math.max(1, differenceInCalendarDays(today, start) + 1);
}

export function getTotalMl(posts) {
  return posts.reduce((sum, p) => sum + (p.bottle_size_ml || 500), 0);
}

export function getAverageLitersPerDay(posts, accountDayCount) {
  const days = Math.max(1, accountDayCount);
  return getTotalMl(posts) / 1000 / days;
}

export function buildBottleStats(posts, bottles) {
  const stats = bottles.map((bottle) => {
    const bottlePosts = posts.filter((p) => p.bottle_id === bottle.id);
    const totalMl = bottlePosts.reduce((sum, p) => sum + (p.bottle_size_ml || bottle.size_ml), 0);
    return {
      ...bottle,
      postCount: bottlePosts.length,
      totalMl,
      totalLiters: totalMl / 1000,
    };
  });

  const unassigned = posts.filter((p) => !p.bottle_id);
  if (unassigned.length > 0) {
    const totalMl = unassigned.reduce((sum, p) => sum + (p.bottle_size_ml || 500), 0);
    stats.push({
      id: 'unassigned',
      name: 'Other / no bottle saved',
      size_ml: null,
      is_default: false,
      postCount: unassigned.length,
      totalMl,
      totalLiters: totalMl / 1000,
    });
  }

  return stats.filter((s) => s.postCount > 0).sort((a, b) => b.totalMl - a.totalMl);
}
