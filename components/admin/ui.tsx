// 관리자 화면 공통 표시 요소 (서버/클라이언트 공용, 상태 없음)

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-forest-900">{title}</h1>
        {sub && <p className="sub mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums text-forest-900">{value}</div>
      {hint && <div className="sub mt-0.5">{hint}</div>}
    </div>
  );
}

/** 단일 계열 가로 막대 — 한 가지 색, 값 라벨은 본문색, 마우스오버 시 title 툴팁 */
export function BarList({ rows, max, unit = "", empty = "데이터가 없습니다." }: { rows: { label: string; value: number; sub?: string }[]; max?: number; unit?: string; empty?: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-black/50">{empty}</p>;
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}${unit}${r.sub ? ` (${r.sub})` : ""}`} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-black/75">{r.label}</span>
          <span className="h-2.5 rounded-r bg-black/[0.04]">
            <span className="block h-full rounded-r bg-forest-600" style={{ width: `${Math.max(1.5, (r.value / m) * 100)}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-ink">{r.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || Number.isNaN(score)) return <span className="text-black/35">-</span>;
  const cls = score >= 85 ? "bg-forest-100 text-forest-800" : score >= 70 ? "bg-accent/20 text-forest-950" : "bg-danger/15 text-danger";
  const icon = score >= 85 ? "●" : score >= 70 ? "◐" : "▲";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}><span aria-hidden className="text-[8px]">{icon}</span>{score}</span>;
}

export function fmtDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function relTime(iso?: string) {
  if (!iso) return "기록 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}일 전` : fmtDate(iso);
}
