import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById, toPublicUser } from "./db";
import type { User } from "./types";

// 서버 측 세션: HMAC 서명된 httpOnly 쿠키. (설계 §9 "세션 토큰 만료·갱신")
export const SESSION_COOKIE = "hm_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

let secretCache: Buffer | null = null;
async function secret(): Promise<Buffer> {
  if (secretCache) return secretCache;
  if (process.env.AUTH_SECRET) return (secretCache = Buffer.from(process.env.AUTH_SECRET));
  const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, ".secret");
  try {
    secretCache = Buffer.from(await fs.readFile(file, "utf8"), "base64");
  } catch {
    const s = randomBytes(32);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, s.toString("base64"), { mode: 0o600 });
    secretCache = s;
  }
  return secretCache;
}

async function sign(payload: string) {
  return createHmac("sha256", await secret()).update(payload).digest("base64url");
}

export async function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_SEC * 1000 })).toString("base64url");
  return `${payload}.${await sign(payload)}`;
}

async function readToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(await sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof uid !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 현재 로그인 사용자 (비활성 계정은 로그인 안 된 것으로 처리) */
export async function getCurrentUser(): Promise<User | null> {
  const uid = await readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const u = await findUserById(uid);
  return u && u.active ? toPublicUser(u) : null;
}

/** 페이지용: 로그인 필요 */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** 페이지용: 관리자 권한 필요 */
export async function requireAdmin(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/courses");
  return u;
}
