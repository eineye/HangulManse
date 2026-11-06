"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LangToggle from "./LangToggle";
import { useT } from "@/lib/i18n";
import { NATIVE_LANGUAGES } from "@/lib/languages";

export default function LoginForm({ next, initialError }: { next: string | null; initialError?: string | null }) {
  const router = useRouter();
  const { lang } = useT();
  const L = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [form, setForm] = useState({ email: "", password: "", name: "", nationality: "", native_language: "vi", institution: "" });
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? L("오류가 발생했습니다.", "Something went wrong."));
    router.replace(next ?? (data.user.role === "admin" ? "/admin" : "/courses"));
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-forest-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between text-paper">
          <div>
            <h1 className="text-3xl font-black tracking-tight">한글만세</h1>
            <p className="text-sm text-paper/70">HangulManse · {L("다문화 가정을 위한 AI 한국어 학습", "AI Korean learning for multicultural families")}</p>
          </div>
          <LangToggle dark />
        </div>

        <form onSubmit={submit} method="post" action="/api/auth/login" className="card space-y-4 p-6">
          <div className="grid grid-cols-2 rounded-xl bg-forest-50 p-1 text-sm font-bold">
            {(["login", "signup"] as const).map((m) => (
              <button type="button" key={m} onClick={() => { setMode(m); setError(null); }} className={`rounded-lg py-2 ${mode === m ? "bg-white text-forest-900 shadow-sm" : "text-forest-700"}`}>
                {m === "login" ? L("로그인", "Log in") : L("회원가입", "Sign up")}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <div>
              <label className="label" htmlFor="name">{L("이름", "Name")}</label>
              <input id="name" className="input" value={form.name} onChange={upd("name")} required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">{L("이메일", "Email")}</label>
            <input id="email" name="email" type="email" className="input" value={form.email} onChange={upd("email")} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{L("비밀번호", "Password")}{mode === "signup" && <span className="sub"> · {L("8자 이상", "8+ characters")}</span>}</label>
            <input id="password" name="password" type="password" className="input" value={form.password} onChange={upd("password")} required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="nat">{L("국적", "Nationality")}</label>
                  <input id="nat" className="input" value={form.nationality} onChange={upd("nationality")} placeholder={L("예: 베트남", "e.g. Vietnam")} />
                </div>
                <div>
                  <label className="label" htmlFor="lang">{L("모국어", "Native language")}</label>
                  <select id="lang" className="input" value={form.native_language} onChange={upd("native_language")}>
                    {NATIVE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} ({lang === "ko" ? l.ko : l.en})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="inst">{L("소속 기관 (선택)", "Institution (optional)")}</label>
                <input id="inst" className="input" value={form.institution} onChange={upd("institution")} placeholder={L("예: 가족센터, 학교", "e.g. family center, school")} />
              </div>
              <p className="sub">{L("음성은 기기에서 인식되며, 서버에는 인식된 문장과 점수만 저장돼요.", "Speech is recognized on your device; only the recognized text and scores are stored.")}</p>
            </>
          )}

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? "…" : mode === "login" ? L("로그인", "Log in") : L("가입하고 시작하기", "Sign up & start")}</button>

          {mode === "login" && (
            <div className="rounded-xl bg-paper px-3 py-2 text-xs text-forest-800">
              <b>{L("체험 계정", "Demo accounts")}</b>
              <div>{L("학습자", "Learner")}: demo@hangulmanse.kr / demo1234!</div>
              <div>{L("관리자", "Admin")}: admin@hangulmanse.kr / admin1234!</div>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
