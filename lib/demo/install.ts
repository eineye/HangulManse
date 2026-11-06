"use client";

// 체험판: 화면 코드의 fetch("/api/...") 요청을 브라우저 안의 backend.ts로 돌린다.
// 이 모듈을 import하는 순간(첫 렌더 전) 설치된다.
import { BASE_PATH, IS_DEMO } from "../routes";
import { handle } from "./backend";
import { ready } from "./store";

declare global {
  interface Window { __hangulmanseDemo?: boolean }
}

if (typeof window !== "undefined" && IS_DEMO && !window.__hangulmanseDemo) {
  window.__hangulmanseDemo = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    let path = url.pathname;
    if (BASE_PATH && path.startsWith(BASE_PATH + "/")) path = path.slice(BASE_PATH.length);
    if (url.origin !== window.location.origin || !path.startsWith("/api/")) return original(input, init);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    let body: Record<string, unknown> | null = null;
    if (typeof init?.body === "string") {
      try { body = JSON.parse(init.body); } catch { body = null; }
    }
    await ready();
    try {
      return await handle(path, method, body);
    } catch (e) {
      console.error("[demo]", method, path, e);
      return new Response(JSON.stringify({ error: "체험판 처리 중 오류가 발생했습니다." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  };
}

export {};
