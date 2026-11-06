"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import UsersManager from "@/components/admin/UsersManager";
import { PageTitle } from "@/components/admin/ui";
import Loading from "@/components/demo/Loading";
import { currentUser, users } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

function Users() {
  const focus = useSearchParams().get("focus");
  const d = useDemo(() => ({
    me: currentUser(),
    users: users().sort((a, b) => (a.role === b.role ? b.created_at.localeCompare(a.created_at) : a.role === "admin" ? -1 : 1)),
  }));
  if (!d?.me) return <Loading />;
  return (
    <>
      <PageTitle title="계정 관리" sub="Accounts · 학습자·관리자 계정 생성, 권한, 비활성화, 비밀번호 재설정, 삭제" />
      <UsersManager users={d.users} meId={d.me.id} focus={focus} />
    </>
  );
}

export default function UsersPage() {
  return <Suspense fallback={<Loading />}><Users /></Suspense>;
}
