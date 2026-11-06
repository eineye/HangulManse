"use client";

import LearnerTable from "@/components/admin/LearnerTable";
import { PageTitle } from "@/components/admin/ui";
import Loading from "@/components/demo/Loading";
import { learnerRows } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

export default function LearnersPage() {
  const d = useDemo(learnerRows);
  if (!d) return <Loading />;
  return (
    <>
      <PageTitle title="학습자 진도" sub="Learners · 학습자별 코스 진도와 발음 정확도" />
      <LearnerTable rows={d.rows} courses={d.courses.map((c) => ({ id: c.id, title: c.title_ko }))} />
    </>
  );
}
