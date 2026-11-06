import { getLearnerRows } from "@/lib/admin-data";
import { PageTitle } from "@/components/admin/ui";
import LearnerTable from "@/components/admin/LearnerTable";

export default async function LearnersPage() {
  const { rows, courses } = await getLearnerRows();
  return (
    <>
      <PageTitle title="학습자 진도" sub="Learners · 학습자별 코스 진도와 발음 정확도" />
      <LearnerTable rows={rows} courses={courses.map((c) => ({ id: c.id, title: c.title_ko }))} />
    </>
  );
}
