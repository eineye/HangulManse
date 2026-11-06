"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LessonScreen from "@/components/LessonScreen";
import Loading from "@/components/demo/Loading";
import { bundle, progressOf, recordingsOf, statsOf } from "@/lib/demo/backend";
import { useDemo, useDemoUser } from "@/lib/demo/hooks";

// 체험판 학습 화면: /learn/?u=유닛ID&s=상황ID
function Learn() {
  const params = useSearchParams();
  const unitId = params.get("u") ?? "";
  const situationId = params.get("s") ?? "";
  const user = useDemoUser();
  const data = useDemo(() => {
    if (!user) return null;
    const b = bundle(unitId, situationId);
    if (!b) return { b: null } as const;
    const recs = recordingsOf(user.id);
    const passed = [...new Set(recs.filter((r) => r.situation_id === situationId && r.overall >= 70).map((r) => r.sentence_id))];
    return { b, stats: statsOf(user.id), sp: progressOf(user.id).situations[situationId] ?? null, passed };
  }, [user?.id, unitId, situationId]);

  if (!user || !data) return <Loading />;
  if (!data.b)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🧭</div>
        <p>학습 상황을 찾을 수 없어요. / Lesson not found.</p>
        <Link href="/courses/" className="btn-primary">코스로 / Courses</Link>
      </main>
    );
  const { b } = data;
  return (
    <LessonScreen
      key={situationId}
      user={user}
      course={b.course}
      unit={b.unit}
      situation={b.situation}
      unitIndex={b.unitIndex}
      unitCount={b.unitCount}
      nextHref={b.nextHref}
      initialStats={data.stats}
      initialProgress={data.sp}
      passedSentences={data.passed}
    />
  );
}

export default function LearnPage() {
  return <Suspense fallback={<Loading />}><Learn /></Suspense>;
}
