"use client";

import ContentEditor from "@/components/admin/ContentEditor";
import { PageTitle } from "@/components/admin/ui";
import Loading from "@/components/demo/Loading";
import { courses } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

export default function ContentPage() {
  // 편집기는 처음 받은 값으로 자체 상태를 관리하므로 한 번만 읽어 넘긴다.
  const initial = useDemo(() => courses(true), []);
  if (!initial) return <Loading />;
  return (
    <>
      <PageTitle title="콘텐츠 관리" sub="Content · 코스 › 유닛 › 상황 › 용어·문장 편집 (체험판: 이 브라우저에 저장, 저장 즉시 학습 화면에 반영)" />
      <ContentEditor initial={initial} />
    </>
  );
}
