import { requireAdmin } from "@/lib/auth";
import { listUsers, toPublicUser } from "@/lib/db";
import { PageTitle } from "@/components/admin/ui";
import UsersManager from "@/components/admin/UsersManager";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const me = await requireAdmin();
  const { focus } = await searchParams;
  const users = (await listUsers()).map(toPublicUser).sort((a, b) => (a.role === b.role ? b.created_at.localeCompare(a.created_at) : a.role === "admin" ? -1 : 1));
  return (
    <>
      <PageTitle title="계정 관리" sub="Accounts · 학습자·관리자 계정 생성, 권한, 비활성화, 비밀번호 재설정, 삭제" />
      <UsersManager users={users} meId={me.id} focus={focus ?? null} />
    </>
  );
}
