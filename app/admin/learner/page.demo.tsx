"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LearnerDetailView from "@/components/admin/LearnerDetailView";
import Loading from "@/components/demo/Loading";
import { learnerDetail } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

// 체험판 학습자 상세: /admin/learner/?id=사용자ID
function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const box = useDemo(() => ({ d: learnerDetail(id) }), [id]);
  if (!box) return <Loading />;
  if (!box.d) return <p className="card p-8 text-center text-sm">학습자를 찾을 수 없습니다. <Link className="underline" href="/admin/learners/">목록으로</Link></p>;
  return <LearnerDetailView d={box.d} />;
}

export default function LearnerPage() {
  return <Suspense fallback={<Loading />}><Detail /></Suspense>;
}
