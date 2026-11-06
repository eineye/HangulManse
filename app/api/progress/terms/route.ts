import { NextResponse } from "next/server";
import { apiUser, jsonError, readJson, str } from "@/lib/api";
import { locateSituation } from "@/lib/content";
import { updateProgress } from "@/lib/db";

/** 용어 카드를 들어본 것을 '학습 단어'로 기록 */
export async function POST(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const loc = await locateSituation(str(b?.situationId, 60));
  const termId = str(b?.termId, 60);
  if (!loc || !loc.situation.terms.some((t) => t.id === termId)) return jsonError(404, "용어를 찾을 수 없습니다.");
  const p = await updateProgress(g.user.id, (p) => { if (!p.learned_terms.includes(termId)) p.learned_terms.push(termId); });
  return NextResponse.json({ total_words: p.learned_terms.length });
}
