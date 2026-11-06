import Link from "next/link";
import { getDashboard } from "@/lib/admin-data";
import { BarList, PageTitle, ScoreBadge, StatTile, relTime } from "@/components/admin/ui";

export default async function AdminDashboard() {
  const d = await getDashboard();
  return (
    <>
      <PageTitle title="대시보드" sub="Dashboard · 학습 현황 한눈에 보기">
        <Link href="/admin/content" className="btn-primary">+ 콘텐츠 추가</Link>
      </PageTitle>

      {d.sampleCount > 0 && (
        <p className="mb-4 rounded-xl bg-accent/15 px-4 py-2.5 text-sm text-forest-950">
          ℹ️ 시연용 <b>샘플 학습자 {d.sampleCount}명</b>이 포함되어 있습니다. <Link className="underline" href="/admin/users">계정 관리</Link>에서 삭제할 수 있어요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="전체 학습자" value={d.learners} hint="Learners" />
        <StatTile label="최근 7일 활동" value={d.active7} hint={`활동률 ${d.learners ? Math.round((d.active7 / d.learners) * 100) : 0}%`} />
        <StatTile label="평균 발음 정확도" value={d.avgAcc ? `${d.avgAcc}%` : "-"} hint="학습자별 최근 30회 평균" />
        <StatTile label="누적 녹음(채점) 수" value={d.recordings} hint="Recordings" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-bold">코스별 평균 완료율</h2>
          <p className="sub mb-4">학습자 1명당 완료한 상황 비율의 평균 (%)</p>
          <BarList rows={d.courseCompletion} max={100} unit="%" />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-bold">학습자 국적 분포</h2>
          <p className="sub mb-4">명</p>
          <BarList rows={d.nationalities} unit="명" />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-bold">어려워하는 문장 TOP 5</h2>
          <p className="sub mb-3">평균 점수가 낮은 따라 읽기 문장 — 콘텐츠 보강 우선순위</p>
          {d.hardSentences.length === 0 ? <p className="py-6 text-center text-sm text-black/50">아직 채점 기록이 없습니다.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-black/50"><th className="pb-2 font-medium">문장</th><th className="pb-2 text-right font-medium">시도</th><th className="pb-2 text-right font-medium">평균</th></tr></thead>
              <tbody>
                {d.hardSentences.map((s) => (
                  <tr key={s.id} className="border-t border-black/5"><td className="py-2">{s.target}</td><td className="py-2 text-right tabular-nums text-black/60">{s.n}</td><td className="py-2 text-right"><ScoreBadge score={s.avg} /></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">최근 학습 활동</h2>
          {d.recent.length === 0 ? <p className="py-6 text-center text-sm text-black/50">아직 활동이 없습니다.</p> : (
            <ul className="divide-y divide-black/5 text-sm">
              {d.recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <Link href={`/admin/learners/${r.user_id}`} className="w-28 shrink-0 truncate font-semibold hover:underline">{r.name}</Link>
                  <span className="min-w-0 flex-1 truncate text-black/70">{r.target}</span>
                  <ScoreBadge score={r.overall} />
                  <span className="w-16 shrink-0 text-right text-xs text-black/45">{relTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 p-5 text-sm">
        <b>콘텐츠 현황</b>
        <span>코스 <b className="tabular-nums">{d.contentCount.courses}</b></span>
        <span>유닛 <b className="tabular-nums">{d.contentCount.units}</b></span>
        <span>상황 <b className="tabular-nums">{d.contentCount.situations}</b></span>
        <span>따라 읽기 문장 <b className="tabular-nums">{d.contentCount.sentences}</b></span>
        <Link href="/admin/content" className="ml-auto text-forest-700 underline">콘텐츠 관리 →</Link>
      </section>
    </>
  );
}
