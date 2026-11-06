import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { User } from "./types";

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** 변경 요청의 Origin이 같은 사이트인지 확인 (CSRF 완화. 쿠키도 SameSite=Lax) */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // 일부 클라이언트(동일 출처 fetch)는 Origin을 생략
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Guard = { user: User; error?: undefined } | { user?: undefined; error: NextResponse };

export async function apiUser(req: Request): Promise<Guard> {
  if (req.method !== "GET" && !sameOrigin(req)) return { error: jsonError(403, "허용되지 않은 요청 출처입니다.") };
  const user = await getCurrentUser();
  if (!user) return { error: jsonError(401, "로그인이 필요합니다.") };
  return { user };
}

export async function apiAdmin(req: Request): Promise<Guard> {
  const g = await apiUser(req);
  if (g.error) return g;
  if (g.user.role !== "admin") return { error: jsonError(403, "관리자 권한이 필요합니다.") };
  return g;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
