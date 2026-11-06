import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 배포 플랫폼의 헬스 체크용 */
export function GET() {
  return NextResponse.json({ ok: true });
}
