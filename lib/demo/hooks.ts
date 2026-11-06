"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "../routes";
import type { User } from "../types";
import { currentUser } from "./backend";
import { CHANGE_EVENT, ready } from "./store";

/** 체험판 저장소에서 값을 읽고, 저장소가 바뀌면 다시 읽는다. 첫 렌더(정적 HTML)에서는 undefined. */
export function useDemo<T>(fn: () => T, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) setValue(fn()); };
    ready().then(run);
    window.addEventListener(CHANGE_EVENT, run);
    return () => { alive = false; window.removeEventListener(CHANGE_EVENT, run); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

/** 로그인 확인(체험판). 로그인 안 했으면 로그인 화면으로, 권한이 없으면 코스 화면으로 보낸다. */
export function useDemoUser(role?: "admin"): User | undefined {
  const router = useRouter();
  const box = useDemo(() => ({ u: currentUser() }));
  const u = box?.u;
  useEffect(() => {
    if (!box) return;
    if (!u) {
      // 특정 학습 화면 같은 깊은 주소만 로그인 후 돌아갈 곳으로 기억한다
      // (기본 화면까지 기억하면 로그아웃 후 다른 역할로 로그인할 때 엉뚱한 곳으로 간다)
      const here = window.location.pathname.slice(BASE_PATH.length) + window.location.search;
      const deep = !["/", "/courses/", "/admin/"].includes(here);
      router.replace(deep ? `/login/?next=${encodeURIComponent(here)}` : "/login/");
    } else if (role === "admin" && u.role !== "admin") router.replace("/courses/");
  }, [box, u, role, router]);
  return u && (role !== "admin" || u.role === "admin") ? u : undefined;
}
