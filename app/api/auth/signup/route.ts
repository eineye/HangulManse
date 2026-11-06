import { NextResponse } from "next/server";
import { createUser, toPublicUser } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { jsonError, readJson, sameOrigin, str } from "@/lib/api";
import { NATIVE_LANGUAGES } from "@/lib/languages";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "허용되지 않은 요청 출처입니다.");
  const b = await readJson(req);
  const email = str(b?.email, 120).toLowerCase();
  const password = typeof b?.password === "string" ? b.password : "";
  const name = str(b?.name, 60);
  const native_language = str(b?.native_language, 8);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(400, "이메일 형식이 올바르지 않습니다. / Invalid email.");
  if (password.length < 8) return jsonError(400, "비밀번호는 8자 이상이어야 합니다. / Password must be at least 8 characters.");
  if (!name) return jsonError(400, "이름을 입력하세요. / Please enter your name.");
  if (!NATIVE_LANGUAGES.some((l) => l.code === native_language)) return jsonError(400, "모국어를 선택하세요. / Choose your native language.");
  const user = await createUser({
    email, password, name, native_language, role: "learner",
    nationality: str(b?.nationality, 40), institution: str(b?.institution, 60), level: "입문",
  });
  if (user === "exists") return jsonError(409, "이미 가입된 이메일입니다. / This email is already registered.");
  await setSessionCookie(user.id);
  return NextResponse.json({ user: toPublicUser(user) });
}
