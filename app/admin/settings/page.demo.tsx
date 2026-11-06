"use client";

import DemoSettings from "@/components/demo/DemoSettings";
import { PageTitle } from "@/components/admin/ui";

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="체험판 설정" sub="Demo settings · 테스트용 AI 키, 데이터 백업·복원·초기화" />
      <DemoSettings />
    </>
  );
}
