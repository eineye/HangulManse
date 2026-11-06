import { NextResponse } from "next/server";
import { apiAdmin, jsonError, readJson, str } from "@/lib/api";
import { createUser, listUsers, toPublicUser } from "@/lib/db";
import { NATIVE_LANGUAGES } from "@/lib/languages";

export async function GET(req: Request) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  return NextResponse.json({ users: (await listUsers()).map(toPublicUser) });
}

export async function POST(req: Request) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const email = str(b?.email, 120).toLowerCase();
  const password = typeof b?.password === "string" ? b.password : "";
  const name = str(b?.name, 60);
  const role = b?.role === "admin" ? "admin" : "learner";
  const native_language = NATIVE_LANGUAGES.some((l) => l.code === b?.native_language) ? (b!.native_language as string) : "en";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(400, "이메일 형식이 올바르지 않습니다.");
  if (password.length < 8) return jsonError(400, "비밀번호는 8자 이상이어야 합니다.");
  if (!name) return jsonError(400, "이름을 입력하세요.");
  const u = await createUser({
    email, password, name, role, native_language,
    nationality: str(b?.nationality, 40), institution: str(b?.institution, 60), level: str(b?.level, 20) || "입문",
  });
  if (u === "exists") return jsonError(409, "이미 등록된 이메일입니다.");
  return NextResponse.json({ user: toPublicUser(u) });
}
