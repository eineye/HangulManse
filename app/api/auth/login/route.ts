import { NextResponse } from "next/server";
import { findUserByEmail, toPublicUser } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";
import { jsonError, readJson, sameOrigin, str } from "@/lib/api";

// JSON(fetch) 요청과, 자바스크립트 로드 전에 제출된 일반 폼 POST(303 리다이렉트) 둘 다 처리한다.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "허용되지 않은 요청 출처입니다.");
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  const body = isForm ? Object.fromEntries(await req.formData()) : await readJson(req);
  const email = str(body?.email, 120).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const user = email ? await findUserByEmail(email) : null;
  const fail = (status: number, msg: string) => (isForm ? NextResponse.redirect(new URL(`/login?error=${status}`, req.url), 303) : jsonError(status, msg));
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return fail(401, "이메일 또는 비밀번호가 올바르지 않습니다. / Incorrect email or password.");
  if (!user.active) return fail(403, "비활성화된 계정입니다. 관리자에게 문의하세요. / This account is disabled.");
  await setSessionCookie(user.id);
  if (isForm) return NextResponse.redirect(new URL(user.role === "admin" ? "/admin" : "/courses", req.url), 303);
  return NextResponse.json({ user: toPublicUser(user) });
}
