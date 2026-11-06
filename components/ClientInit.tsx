"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";

/** 저장된 UI 언어 복원 + (프로덕션) 서비스워커 등록 */
export default function ClientInit() {
  useEffect(() => {
    useLang.persist.rehydrate();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  useEffect(() => {
    return useLang.subscribe((s) => { document.documentElement.lang = s.lang; });
  }, []);
  return null;
}
