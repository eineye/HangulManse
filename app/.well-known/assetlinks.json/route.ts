import { NextResponse } from "next/server";

// Android 앱(TWA)과 이 웹사이트의 소유 관계를 증명하는 Digital Asset Links.
// APK 서명 인증서의 SHA-256 지문이 여기에 있어야 앱이 주소창 없이 전체 화면으로 열린다.
// ANDROID_SHA256_FINGERPRINTS: 콤마로 구분 (예: "AB:CD:...,12:34:...")
export const dynamic = "force-dynamic";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME || "kr.hangulmanse.app";
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const body = fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
