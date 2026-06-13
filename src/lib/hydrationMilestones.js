/** Fun volume comparisons — threshold in ml, message uses {count} for times reached. */
export const HYDRATION_MILESTONES = [
  {
    id: 'coffee-mug',
    ml: 350,
    emoji: '☕',
    title: 'Coffee mug crew',
    message: "You've drunk about a coffee mug's worth of water. Every sip counts!",
  },
  {
    id: 'water-bottle',
    ml: 500,
    emoji: '🍶',
    title: 'Standard bottle',
    message: "That's a full standard water bottle — nice start.",
  },
  {
    id: 'daily-goal',
    ml: 2000,
    emoji: '💧',
    title: 'Daily goal zone',
    message: "You've hit roughly a full day's hydration goal.",
  },
  {
    id: 'backpack',
    ml: 10000,
    emoji: '🎒',
    title: 'Hydration backpack',
    message: "You've drunk enough to fill a small hiking hydration pack.",
  },
  {
    id: 'bathtub',
    ml: 80000,
    emoji: '🛁',
    title: 'Bathtub splash',
    message: "You've drunk about a bathtub full of water. That's dedication.",
  },
  {
    id: 'elephant',
    ml: 190000,
    emoji: '🐘',
    title: 'Elephant approved',
    message: "You've drunk the amount of water an elephant drinks in a day!",
  },
  {
    id: 'hot-tub',
    ml: 1000000,
    emoji: '🫧',
    title: 'Hot tub hero',
    message: "You've drunk enough to fill a hot tub. Legend status.",
  },
  {
    id: 'pool',
    ml: 2000000,
    emoji: '🏊',
    title: 'Swimming pool',
    message: "You've drunk a swimming pool of water. The lifeguard is impressed.",
  },
];

export function getHydrationMilestones(totalMl) {
  const unlocked = HYDRATION_MILESTONES.filter((m) => totalMl >= m.ml);
  const next = HYDRATION_MILESTONES.find((m) => totalMl < m.ml) ?? null;
  const featured = unlocked[unlocked.length - 1] ?? null;

  return { unlocked, next, featured };
}

export function formatMilestoneProgress(totalMl, milestone) {
  if (!milestone) return 100;
  return Math.min(100, Math.round((totalMl / milestone.ml) * 100));
}
