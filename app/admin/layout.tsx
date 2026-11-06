import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="bg-forest-950 text-paper lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/admin" className="block">
            <div className="text-xl font-black">한글만세</div>
            <div className="text-xs text-paper/60">관리자 콘솔 · Admin</div>
          </Link>
          <div className="lg:hidden"><LogoutButton className="btn bg-white/10 text-paper" /></div>
        </div>
        <AdminNav />
        <div className="hidden px-5 py-4 text-xs text-paper/60 lg:absolute lg:bottom-0 lg:block lg:w-full">
          <div className="mb-2 truncate">{admin.name} · {admin.email}</div>
          <div className="flex gap-2">
            <Link href="/courses" className="btn bg-white/10 px-2.5 py-1.5 text-xs text-paper hover:bg-white/20">학습 화면</Link>
            <LogoutButton className="btn bg-white/10 px-2.5 py-1.5 text-xs text-paper hover:bg-white/20" />
          </div>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 lg:px-8">{children}</div>
    </div>
  );
}
