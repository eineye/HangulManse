import { NextResponse } from "next/server";
import { apiUser, readJson } from "@/lib/api";
import { updateProgress } from "@/lib/db";

/** 학습 화면이 열려 있는 동안 주기적으로 보내는 학습 시간 하트비트 (1회 최대 120초) */
export async function POST(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const sec = typeof b?.seconds === "number" && isFinite(b.seconds) ? Math.min(120, Math.max(0, Math.round(b.seconds))) : 0;
  if (sec > 0) await updateProgress(g.user.id, (p) => { p.study_seconds += sec; });
  return NextResponse.json({ ok: true });
}
