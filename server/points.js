// Points and streaks are computed from the underlying activity (steps, check-ins,
// photo posts, completed program weeks) rather than stored, so changing a rule in
// shared/catalog.js re-scores everyone consistently.
import { POINTS, stepPoints } from "../shared/catalog.js";
import { db, journeys, blocks, logs } from "./db.js";

const DAY = 86400000;
const toMs = (d) => new Date(d + "T00:00:00Z").getTime();
export const addDays = (d, n) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
/** Monday of the week containing d. */
export const weekStart = (d) => addDays(d, -((new Date(toMs(d)).getUTCDay() + 6) % 7));

export function summarize(userId, today) {
  const byDate = new Map();
  const at = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, steps: null, stepPts: 0, photoPts: 0, weekPts: 0, streakPts: 0 });
    return byDate.get(date);
  };

  // Steps
  for (const r of db.prepare(`SELECT date, steps FROM steps WHERE user_id = ?`).all(userId)) {
    const e = at(r.date);
    e.steps = r.steps;
    e.stepPts = stepPoints(r.steps);
  }

  // Photo posts (capped per day)
  for (const r of db.prepare(`SELECT date, COUNT(*) n FROM posts WHERE user_id = ? AND photo_file IS NOT NULL GROUP BY date`).all(userId))
    at(r.date).photoPts = Math.min(r.n, POINTS.photoDailyMax) * POINTS.photo;

  // Completed program weeks (every non-rest session logged done)
  let weeksDone = 0;
  for (const j of journeys.forUser(userId)) {
    const done = new Set(logs.forJourney(j.id).filter((l) => l.done).map((l) => `${l.blockIdx}:${l.week}:${l.day}`));
    for (const b of blocks.forJourney(j.id)) {
      if (!b.program) continue;
      for (const w of b.program.weeks) {
        const sessions = w.days.filter((d) => d.type !== "rest");
        if (sessions.length && sessions.every((d) => done.has(`${b.idx}:${w.week}:${d.day}`))) {
          weeksDone++;
          // Award on the week's last day, or today if finished early.
          const end = addDays(b.startDate, w.week * 7 - 1);
          at(end > today ? today : end).weekPts += POINTS.weekComplete;
        }
      }
    }
  }

  // Streaks: days in a row the app was used
  const days = db.prepare(`SELECT date FROM checkins WHERE user_id = ? ORDER BY date`).all(userId).map((r) => r.date);
  let run = 0, best = 0, prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    if (run % POINTS.streakEvery === 0) at(d).streakPts += POINTS.streakBonus;
    prev = d;
  }
  const last = days[days.length - 1];
  const current = last === today || last === addDays(today, -1) ? run : 0;

  const total = (e) => e.stepPts + e.photoPts + e.weekPts + e.streakPts;
  let all = 0;
  for (const e of byDate.values()) all += total(e);

  const ws = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const e = byDate.get(d) || { date: d, steps: null, stepPts: 0, photoPts: 0, weekPts: 0, streakPts: 0 };
    return { ...e, points: total(e) };
  });

  return {
    today: { ...(byDate.get(today) || at(today)), points: total(byDate.get(today) || at(today)) },
    week,
    weekPoints: week.reduce((s, e) => s + e.points, 0),
    totalPoints: all,
    streak: current,
    bestStreak: best,
    weeksCompleted: weeksDone,
  };
}
