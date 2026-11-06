"use client";

import { useLang } from "@/lib/i18n";

/** 헤더 언어 전환(KO/EN) — 설계 §1 화면 6영역 중 1번 */
export default function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex rounded-full p-0.5 text-xs font-bold ${dark ? "bg-white/10" : "bg-forest-50"}`} role="group" aria-label="Language">
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? (dark ? "bg-paper text-forest-900" : "bg-forest-900 text-paper") : dark ? "text-paper/70" : "text-forest-800"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
