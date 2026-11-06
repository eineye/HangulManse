"use client";

import Link from "next/link";
import { useState } from "react";
import LangToggle from "./LangToggle";
import LogoutButton from "./LogoutButton";
import { useT } from "@/lib/i18n";
import type { Course, User, UserProgress, UserStats } from "@/lib/types";

export default function CoursesView({ user, courses, progress, stats }: { user: User; courses: Course[]; progress: UserProgress; stats: UserStats }) {
  const { t, pick, pickSub, lang } = useT();
  const [open, setOpen] = useState<string | null>(() => {
    // 마지막으로 학습한 코스를 펼쳐 둔다
    const last = Object.values(progress.situations).sort((a, b) => b.last_at.localeCompare(a.last_at))[0];
    return last?.course_id ?? courses[0]?.id ?? null;
  });
  const L = (ko: string, en: string) => (lang === "ko" ? ko : en);

  return (
    <div className="min-h-dvh">
      <header className="bg-forest-900 text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/courses" className="text-xl font-black">한글만세</Link>
          <div className="flex items-center gap-2">
            {user.role === "admin" && <Link href="/admin" className="btn bg-white/10 text-paper hover:bg-white/20">{t("admin")}</Link>}
            <LangToggle dark />
            <LogoutButton className="btn bg-white/10 text-paper hover:bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-4">
          <p className="text-sm text-paper/70">{L("어서 오세요", "Welcome")},</p>
          <h1 className="text-2xl font-bold">{user.name}{L("님", "")} 👋</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("totalWords"), `${stats.total_words}`],
              [t("avgAccuracy"), stats.avg_accuracy ? `${stats.avg_accuracy}%` : "-"],
              [L("완료한 상황", "Completed"), `${stats.completed_situations}/${stats.total_situations}`],
              [t("streak"), `${stats.streak}${L("일", " days")}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-xs text-paper/70">{k}</div>
                <div className="text-xl font-bold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h2 className="text-lg font-bold text-forest-900">{t("courses")} <span className="sub font-normal">{pickSub("학습 코스", "Courses")}</span></h2>
        {courses.length === 0 && <p className="card p-6 text-center text-sm">{L("아직 공개된 코스가 없어요.", "No courses published yet.")}</p>}
        {courses.map((c) => {
          const ids = c.units.flatMap((u) => u.situations.map((s) => s.id));
          const done = ids.filter((id) => progress.situations[id]?.completed).length;
          const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
          const isOpen = open === c.id;
          return (
            <section key={c.id} className="card overflow-hidden">
              <button className="flex w-full items-center gap-4 p-5 text-left" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-forest-900 text-2xl font-black text-paper">{c.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-bold">{pick(c.title_ko, c.title_en)}</h3>
                    <span className="sub">{pickSub(c.title_ko, c.title_en)}</span>
                  </div>
                  <p className="truncate text-sm text-black/60">{pick(c.description_ko, c.description_en)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-forest-50"><div className="h-full rounded-full bg-forest-600" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs font-semibold text-forest-800">{done}/{ids.length}</span>
                  </div>
                </div>
                <span className={`text-forest-700 transition ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {isOpen && (
                <div className="space-y-4 border-t border-black/5 bg-paper/50 p-5">
                  {c.units.map((u, ui) => (
                    <div key={u.id}>
                      <div className="mb-2 text-sm font-bold text-forest-800">
                        {t("unit")} {ui + 1}. {pick(u.title_ko, u.title_en)} <span className="sub font-normal">{pickSub(u.title_ko, u.title_en)} · {u.level}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {u.situations.map((s) => {
                          const sp = progress.situations[s.id];
                          return (
                            <Link key={s.id} href={`/learn/${u.id}/${s.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5 transition hover:ring-forest-600">
                              <span className="text-2xl">{s.image}</span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold">{pick(s.title_ko, s.title_en)}</div>
                                <div className="truncate text-xs text-black/50">{pickSub(s.title_ko, s.title_en)} · {s.place_tag} · {s.formality_tag}</div>
                              </div>
                              {sp?.completed ? (
                                <span className="chip bg-forest-600 text-white">✓ {sp.best_score}</span>
                              ) : sp ? (
                                <span className="chip">{sp.best_score}{L("점", "pt")}</span>
                              ) : (
                                <span className="chip bg-accent/20 text-forest-900">{L("시작", "Start")}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
