import Link from "next/link";
import type { LearnerDetail } from "@/lib/admin-calc";
import { languageName } from "@/lib/languages";
import { BarList, PageTitle, ScoreBadge, StatTile, fmtDate, relTime } from "./ui";

export default function LearnerDetailView({ d }: { d: LearnerDetail }) {
  const { row, courses, progress, recordings } = d;
  const u = row.user;

  // 최근 20회 점수 추이(오래된 → 최근)
  const trend = recordings.slice(0, 20).reverse();

  return (
    <>
      <Link href="/admin/learners" className="sub mb-2 inline-block hover:underline">← 학습자 목록</Link>
      <PageTitle title={u.name} sub={`${u.email} · 가입 ${fmtDate(u.created_at)} · 최근 활동 ${relTime(u.last_active_at)}`}>
        <Link href={`/admin/users/?focus=${u.id}`} className="btn-ghost">계정 설정</Link>
      </PageTitle>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="chip">🌏 {u.nationality || "국적 미입력"}</span>
        <span className="chip">🗣 {languageName(u.native_language)}</span>
        <span className="chip">🏫 {u.institution || "기관 미입력"}</span>
        <span className="chip">📶 {u.level}</span>
        {u.sample && <span className="chip bg-black/5 text-black/50">샘플 데이터</span>}
        {!u.active && <span className="chip bg-danger/10 text-danger">비활성 계정</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*]:min-w-0">
        <StatTile label="완료한 상황" value={`${row.stats.completed_situations}/${row.stats.total_situations}`} />
        <StatTile label="평균 정확도" value={row.stats.avg_accuracy ? `${row.stats.avg_accuracy}%` : "-"} />
        <StatTile label="학습 단어" value={row.stats.total_words} />
        <StatTile label="누적 학습 시간" value={`${Math.round(progress.study_seconds / 60)}분`} hint={`AI 대화 ${progress.chat_messages}회`} />
        <StatTile label="연속 학습" value={`${row.stats.streak}일`} hint={`총 활동일 ${progress.active_days.length}일`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">코스별 진도 (%)</h2>
          <BarList rows={row.courses.map((c) => ({ label: c.title, value: c.pct, sub: `${c.done}/${c.total} 상황` }))} max={100} unit="%" />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-bold">최근 점수 추이</h2>
          <p className="sub mb-3">최근 {trend.length}회 녹음의 종합 점수 (0–100)</p>
          {trend.length === 0 ? <p className="py-6 text-center text-sm text-black/50">녹음 기록이 없습니다.</p> : (
            <div className="flex h-36 items-end gap-1 border-b border-black/10">
              {trend.map((r) => (
                <div key={r.id} className="group relative flex h-full flex-1 items-end" title={`${fmtDate(r.created_at)} · ${r.target} · ${r.overall}점`}>
                  <div className="w-full rounded-t bg-forest-600 transition group-hover:bg-forest-800" style={{ height: `${Math.max(2, r.overall)}%` }} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <h2 className="px-5 pt-5 font-bold">상황별 진도</h2>
        <div className="overflow-x-auto p-5 pt-3">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-black/50"><tr><th className="pb-2 font-medium">코스 · 유닛</th><th className="pb-2 font-medium">상황</th><th className="pb-2 font-medium">상태</th><th className="pb-2 text-right font-medium">최고점</th><th className="pb-2 text-right font-medium">시도</th><th className="pb-2 text-right font-medium">최근</th></tr></thead>
            <tbody>
              {courses.flatMap((c) => c.units.flatMap((un) => un.situations.map((s) => {
                const sp = progress.situations[s.id];
                return (
                  <tr key={s.id} className="border-t border-black/5">
                    <td className="py-2 text-black/60">{c.title_ko} · {un.title_ko}</td>
                    <td className="py-2">{s.image} {s.title_ko}</td>
                    <td className="py-2">{sp?.completed ? <span className="chip bg-forest-600 text-white">✓ 완료</span> : sp ? <span className="chip bg-accent/20">진행 중</span> : <span className="chip bg-black/5 text-black/45">미시작</span>}</td>
                    <td className="py-2 text-right"><ScoreBadge score={sp ? sp.best_score : null} /></td>
                    <td className="py-2 text-right tabular-nums">{sp?.attempts ?? 0}</td>
                    <td className="py-2 text-right text-xs text-black/50">{sp ? relTime(sp.last_at) : "-"}</td>
                  </tr>
                );
              })))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="mb-3 font-bold">최근 녹음 결과</h2>
        {recordings.length === 0 ? <p className="py-6 text-center text-sm text-black/50">녹음 기록이 없습니다.</p> : (
          <ul className="divide-y divide-black/5">
            {recordings.slice(0, 15).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <ScoreBadge score={r.overall} />
                  <span className="font-semibold">{r.target}</span>
                  <span className="text-xs text-black/45">정확도 {r.accuracy} · 유창성 {r.fluency} · 억양 {r.intonation}</span>
                  <span className="ml-auto text-xs text-black/45">{fmtDate(r.created_at)} ({relTime(r.created_at)})</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {r.per_syllable.map((p, i) => (
                    <span key={i} title={`${p.score}`} className={`rounded px-1 text-xs font-semibold ${p.score >= 85 ? "bg-forest-100 text-forest-800" : p.score >= 70 ? "bg-accent/20" : "bg-danger/15 text-danger"}`}>{p.syllable}</span>
                  ))}
                  <span className="ml-2 text-xs text-black/45">인식: {r.recognized || "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
