import { NextResponse } from "next/server";
import { apiUser, jsonError, readJson, str } from "@/lib/api";
import { getCourses } from "@/lib/content";
import { getProgress, listRecordings, toPublicUser, updateUser } from "@/lib/db";
import { NATIVE_LANGUAGES } from "@/lib/languages";
import { computeStats } from "@/lib/stats";

// 설계 §4.1 GET /api/users/me, /api/users/me/stats, PATCH /api/users/me/preferences
export async function GET(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const [p, recs, courses] = await Promise.all([getProgress(g.user.id), listRecordings(g.user.id), getCourses()]);
  return NextResponse.json({ user: g.user, stats: computeStats(p, recs, courses) });
}

export async function PATCH(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const patch: { native_language?: string; name?: string } = {};
  if (b?.native_language !== undefined) {
    const code = str(b.native_language, 8);
    if (!NATIVE_LANGUAGES.some((l) => l.code === code)) return jsonError(400, "지원하지 않는 언어입니다.");
    patch.native_language = code;
  }
  if (b?.name !== undefined && str(b.name, 60)) patch.name = str(b.name, 60);
  const u = await updateUser(g.user.id, patch);
  return u ? NextResponse.json({ user: toPublicUser(u) }) : jsonError(404, "사용자를 찾을 수 없습니다.");
}
