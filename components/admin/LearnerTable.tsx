"use client";

import { learnerHref } from "@/lib/routes";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { LearnerRow } from "@/lib/admin-calc";
import { languageName } from "@/lib/languages";
import { ScoreBadge, relTime } from "./ui";

type SortKey = "name" | "accuracy" | "completed" | "last" | "words";

function toCsv(rows: LearnerRow[], courses: { id: string; title: string }[]) {
  const head = ["이름", "이메일", "국적", "모국어", "기관", "수준", "완료 상황", "평균 정확도", "학습 단어", "녹음 수", "연속 학습일", ...courses.map((c) => `${c.title} 진도(%)`), "최근 활동"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [
    r.user.name, r.user.email, r.user.nationality, languageName(r.user.native_language), r.user.institution, r.user.level,
    r.stats.completed_situations, r.stats.avg_accuracy, r.stats.total_words, r.stats.recordings, r.stats.streak,
    ...courses.map((c) => r.courses.find((x) => x.id === c.id)?.pct ?? 0), r.user.last_active_at ?? "",
  ].map(esc).join(","));
  return "﻿" + [head.map(esc).join(","), ...lines].join("\n");
}

export default function LearnerTable({ rows, courses }: { rows: LearnerRow[]; courses: { id: string; title: string }[] }) {
  const [q, setQ] = useState("");
  const [inst, setInst] = useState("");
  const [sort, setSort] = useState<SortKey>("last");
  const institutions = useMemo(() => [...new Set(rows.map((r) => r.user.institution).filter(Boolean))].sort(), [rows]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (!inst || r.user.institution === inst) &&
      (!k || [r.user.name, r.user.email, r.user.nationality, r.user.institution].some((v) => v?.toLowerCase().includes(k))));
    const cmp: Record<SortKey, (a: LearnerRow, b: LearnerRow) => number> = {
      name: (a, b) => a.user.name.localeCompare(b.user.name, "ko"),
      accuracy: (a, b) => b.stats.avg_accuracy - a.stats.avg_accuracy,
      completed: (a, b) => b.stats.completed_situations - a.stats.completed_situations,
      words: (a, b) => b.stats.total_words - a.stats.total_words,
      last: (a, b) => (b.user.last_active_at ?? "").localeCompare(a.user.last_active_at ?? ""),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, q, inst, sort]);

  function download() {
    const blob = new Blob([toCsv(shown, courses)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hangulmanse-learners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 p-4">
        <input className="input max-w-xs" placeholder="이름·이메일·국적·기관 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={inst} onChange={(e) => setInst(e.target.value)} aria-label="기관 필터">
          <option value="">전체 기관</option>
          {institutions.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
          <option value="last">최근 활동순</option>
          <option value="accuracy">정확도 높은순</option>
          <option value="completed">완료 많은순</option>
          <option value="words">학습 단어순</option>
          <option value="name">이름순</option>
        </select>
        <span className="sub ml-auto">{shown.length}명</span>
        <button className="btn-ghost" onClick={download}>⬇ CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-paper/60 text-left text-xs text-black/55">
            <tr>
              <th className="px-4 py-2.5 font-medium">학습자</th>
              <th className="px-3 py-2.5 font-medium">국적 · 모국어</th>
              <th className="px-3 py-2.5 font-medium">기관</th>
              {courses.map((c) => <th key={c.id} className="px-3 py-2.5 font-medium">{c.title}</th>)}
              <th className="px-3 py-2.5 text-right font-medium">정확도</th>
              <th className="px-3 py-2.5 text-right font-medium">단어</th>
              <th className="px-4 py-2.5 text-right font-medium">최근 활동</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.user.id} className="border-t border-black/5 hover:bg-forest-50/50">
                <td className="px-4 py-2.5">
                  <Link href={learnerHref(r.user.id)} className="font-semibold hover:underline">{r.user.name}</Link>
                  {r.user.sample && <span className="chip ml-1.5 bg-black/5 text-black/50">샘플</span>}
                  {!r.user.active && <span className="chip ml-1.5 bg-danger/10 text-danger">비활성</span>}
                  <div className="text-xs text-black/45">{r.user.email}</div>
                </td>
                <td className="px-3 py-2.5">{r.user.nationality || "-"}<div className="text-xs text-black/45">{languageName(r.user.native_language)}</div></td>
                <td className="px-3 py-2.5 text-black/70">{r.user.institution || "-"}</td>
                {courses.map((c) => {
                  const cp = r.courses.find((x) => x.id === c.id);
                  return (
                    <td key={c.id} className="px-3 py-2.5" title={`${cp?.done ?? 0}/${cp?.total ?? 0} 상황 완료`}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-r bg-black/[0.05]"><div className="h-full rounded-r bg-forest-600" style={{ width: `${cp?.pct ?? 0}%` }} /></div>
                        <span className="text-xs tabular-nums text-black/60">{cp?.done ?? 0}/{cp?.total ?? 0}</span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right"><ScoreBadge score={r.stats.avg_accuracy || null} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.stats.total_words}</td>
                <td className="px-4 py-2.5 text-right text-xs text-black/55">{relTime(r.user.last_active_at)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7 + courses.length} className="py-10 text-center text-black/50">조건에 맞는 학습자가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
