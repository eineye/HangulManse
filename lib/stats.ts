import "server-only";
import type { Course, RecordingResult, UserProgress, UserStats } from "./types";
import { countSituations } from "./content";

export function streakOf(days: string[]): number {
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  // 오늘 학습 안 했으면 어제부터 센다
  if (!set.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export function computeStats(p: UserProgress, recs: RecordingResult[], courses: Course[]): UserStats {
  const situations = Object.values(p.situations);
  const recent = recs.slice(-30);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekDays = p.active_days.filter((d) => new Date(d).getTime() >= weekAgo).length;
  const totalDays = Math.max(1, p.active_days.length);
  return {
    total_words: p.learned_terms.length,
    avg_accuracy: recent.length ? Math.round(recent.reduce((s, r) => s + r.accuracy, 0) / recent.length) : 0,
    // 일자별 학습 시간을 따로 저장하지 않으므로 활동 일수 비율로 주간 시간을 근사
    weekly_minutes: Math.round((p.study_seconds / 60) * (weekDays / totalDays)),
    streak: streakOf(p.active_days),
    completed_situations: situations.filter((s) => s.completed).length,
    total_situations: countSituations(courses),
    recordings: recs.length,
  };
}

export function courseProgress(p: UserProgress, course: Course) {
  const ids = course.units.flatMap((u) => u.situations.map((s) => s.id));
  const done = ids.filter((id) => p.situations[id]?.completed).length;
  return { done, total: ids.length, pct: ids.length ? Math.round((done / ids.length) * 100) : 0 };
}
