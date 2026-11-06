"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_DEMO } from "@/lib/routes";

const items = [
  { href: "/admin", label: "대시보드", en: "Dashboard", icon: "📊" },
  { href: "/admin/learners", label: "학습자 진도", en: "Learners", icon: "🧑‍🎓" },
  { href: "/admin/content", label: "콘텐츠 관리", en: "Content", icon: "📚" },
  { href: "/admin/users", label: "계정 관리", en: "Accounts", icon: "🔐" },
  // 체험판 전용: 테스트용 Claude 키, 데이터 초기화·백업
  ...(IS_DEMO ? [{ href: "/admin/settings", label: "체험판 설정", en: "Demo", icon: "⚙️" }] : []),
];

export default function AdminNav() {
  const path = (usePathname() || "/").replace(/\/+$/, "") || "/";
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {items.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href) || (it.href === "/admin/learners" && path.startsWith("/admin/learner"));
        return (
          <Link key={it.href} href={it.href} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${active ? "bg-paper font-bold text-forest-900" : "text-paper/80 hover:bg-white/10"}`}>
            <span aria-hidden>{it.icon}</span>
            <span>{it.label}</span>
            <span className={`hidden text-[10px] lg:inline ${active ? "text-forest-700" : "text-paper/40"}`}>{it.en}</span>
          </Link>
        );
      })}
    </nav>
  );
}
