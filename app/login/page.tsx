import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const u = await getCurrentUser();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (u) redirect(safeNext ?? (u.role === "admin" ? "/admin" : "/courses"));
  const initialError = error === "403" ? "비활성화된 계정입니다. / This account is disabled." : error ? "이메일 또는 비밀번호가 올바르지 않습니다. / Incorrect email or password." : null;
  return <LoginForm next={safeNext} initialError={initialError} />;
}
