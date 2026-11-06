// 관리자 화면 집계 (순수 함수 — 서버·브라우저 체험판 공용)
import { computeStats, courseProgress } from "./stats";
import type { Course, RecordingResult, User, UserProgress, UserStats } from "./types";

export interface LearnerRow {
  user: User;
  stats: UserStats;
  courses: { id: string; title: string; done: number; total: number; pct: number }[];
}

export const emptyProgress = (user_id: string): UserProgress => ({ user_id, situations: {}, learned_terms: [], study_seconds: 0, active_days: [], chat_messages: 0 });

export function buildLearnerRows(users: User[], progress: UserProgress[], recordings: RecordingResult[], courses: Course[]): LearnerRow[] {
  const byUser = new Map<string, UserProgress>(progress.map((p) => [p.user_id, p]));
  const recsByUser = new Map<string, RecordingResult[]>();
  for (const r of recordings) (recsByUser.get(r.user_id) ?? recsByUser.set(r.user_id, []).get(r.user_id)!).push(r);
  return users
    .filter((u) => u.role === "learner")
    .map((u) => {
      const p = byUser.get(u.id) ?? emptyProgress(u.id);
      return {
        user: u,
        stats: computeStats(p, recsByUser.get(u.id) ?? [], courses),
        courses: courses.map((c) => ({ id: c.id, title: c.title_ko, ...courseProgress(p, c) })),
      };
    });
}

export type DashboardData = ReturnType<typeof buildDashboard>;

export function buildDashboard(rows: LearnerRow[], courses: Course[], recordings: RecordingResult[]) {
  const weekAgo = Date.now() - 7 * 86400000;
  const active7 = rows.filter((r) => r.user.last_active_at && new Date(r.user.last_active_at).getTime() >= weekAgo).length;
  const scored = rows.filter((r) => r.stats.avg_accuracy > 0);
  const avgAcc = scored.length ? Math.round(scored.reduce((s, r) => s + r.stats.avg_accuracy, 0) / scored.length) : 0;

  // 코스별 평균 완료율
  const courseCompletion = courses.map((c) => {
    const pcts = rows.map((r) => r.courses.find((x) => x.id === c.id)?.pct ?? 0);
    return { label: c.title_ko, value: rows.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / rows.length) : 0, sub: c.published ? "공개" : "비공개" };
  });

  // 국적 분포
  const nat = new Map<string, number>();
  for (const r of rows) nat.set(r.user.nationality || "미입력", (nat.get(r.user.nationality || "미입력") ?? 0) + 1);
  const nationalities = [...nat.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  // 어려워하는 문장(평균 점수 낮은 순)
  const bySentence = new Map<string, { target: string; sum: number; n: number }>();
  for (const r of recordings) {
    const e = bySentence.get(r.sentence_id) ?? { target: r.target, sum: 0, n: 0 };
    e.sum += r.overall; e.n++;
    bySentence.set(r.sentence_id, e);
  }
  const hardSentences = [...bySentence.entries()]
    .map(([id, e]) => ({ id, target: e.target, avg: Math.round(e.sum / e.n), n: e.n }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);

  const userName = new Map(rows.map((r) => [r.user.id, r.user.name]));
  const recent = [...recordings].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map((r) => ({ ...r, name: userName.get(r.user_id) ?? "(삭제된 사용자)" }));

  const contentCount = {
    courses: courses.length,
    units: courses.reduce((n, c) => n + c.units.length, 0),
    situations: courses.reduce((n, c) => n + c.units.reduce((m, u) => m + u.situations.length, 0), 0),
    sentences: courses.reduce((n, c) => n + c.units.reduce((m, u) => m + u.situations.reduce((k, s) => k + s.sentences.length, 0), 0), 0),
  };

  return { learners: rows.length, active7, avgAcc, recordings: recordings.length, courseCompletion, nationalities, hardSentences, recent, contentCount, sampleCount: rows.filter((r) => r.user.sample).length };
}

export interface LearnerDetail {
  row: LearnerRow;
  courses: Course[];
  progress: UserProgress;
  recordings: RecordingResult[];
}

export function buildLearnerDetail(userId: string, rows: LearnerRow[], courses: Course[], progress: UserProgress[], recordings: RecordingResult[]): LearnerDetail | null {
  const row = rows.find((r) => r.user.id === userId);
  if (!row) return null;
  return {
    row,
    courses,
    progress: progress.find((p) => p.user_id === userId) ?? emptyProgress(userId),
    recordings: recordings.filter((r) => r.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}
