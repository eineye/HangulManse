import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourses, getSituationBundle } from "@/lib/content";
import { getProgress, listRecordings } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import LessonScreen from "@/components/LessonScreen";

export const dynamic = "force-dynamic";

/** 학습 화면 — 한 화면 = 한 학습 사이클 (설계 §3.2, §3.3) */
export default async function LearnPage({ params }: { params: Promise<{ unitId: string; situationId: string }> }) {
  const { unitId, situationId } = await params;
  const user = await requireUser();
  const bundle = await getSituationBundle(unitId, situationId);
  if (!bundle) notFound();
  const [progress, recs, courses] = await Promise.all([getProgress(user.id), listRecordings(user.id), getCourses()]);
  const passed = [...new Set(recs.filter((r) => r.situation_id === situationId && r.overall >= 70).map((r) => r.sentence_id))];
  return (
    <LessonScreen
      key={situationId}
      user={user}
      course={bundle.course}
      unit={bundle.unit}
      situation={bundle.situation}
      unitIndex={bundle.unitIndex}
      unitCount={bundle.unitCount}
      nextHref={bundle.nextHref}
      initialStats={computeStats(progress, recs, courses)}
      initialProgress={progress.situations[situationId] ?? null}
      passedSentences={passed}
    />
  );
}
