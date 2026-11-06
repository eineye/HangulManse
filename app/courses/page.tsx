import { requireUser } from "@/lib/auth";
import { getCourses } from "@/lib/content";
import { getProgress, listRecordings } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import CoursesView from "@/components/CoursesView";

export const dynamic = "force-dynamic";

/** 진도관리(코스 선택) — 학습 화면 진입 전 단계 선택 */
export default async function CoursesPage() {
  const user = await requireUser();
  const [courses, progress, recs] = await Promise.all([getCourses(), getProgress(user.id), listRecordings(user.id)]);
  return <CoursesView user={user} courses={courses} progress={progress} stats={computeStats(progress, recs, courses)} />;
}
