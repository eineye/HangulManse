import { getCourses } from "@/lib/content";
import { PageTitle } from "@/components/admin/ui";
import ContentEditor from "@/components/admin/ContentEditor";

export default async function ContentPage() {
  const courses = await getCourses({ includeUnpublished: true });
  return (
    <>
      <PageTitle title="콘텐츠 관리" sub="Content · 코스 › 유닛 › 상황 › 용어·문장 편집 (저장 즉시 학습 화면에 반영, content/*.json)" />
      <ContentEditor initial={courses} />
    </>
  );
}
