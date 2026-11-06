"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar2D from "./Avatar2D";
import LangToggle from "./LangToggle";
import { useT } from "@/lib/i18n";
import { useSession, type ChatMsg } from "@/lib/session-store";
import { listen, speak, sttSupported, ttsSupported, type ListenHandle } from "@/lib/speech";
import { scorePronunciation, syllableBreakdown, toSyllables } from "@/lib/scoring";
import { languageName } from "@/lib/languages";
import type { Course, Sentence, Situation, Unit, User, UserStats, SituationProgress } from "@/lib/types";

interface Props {
  user: User;
  course: Course;
  unit: Unit;
  situation: Situation;
  unitIndex: number;
  unitCount: number;
  nextHref: string | null;
  initialStats: UserStats;
  initialProgress: SituationProgress | null;
  passedSentences: string[];
}

const scoreColor = (s: number) => (s >= 85 ? "text-forest-600" : s >= 70 ? "text-accent" : "text-danger");
const scoreBg = (s: number) => (s >= 85 ? "bg-forest-100 text-forest-800" : s >= 70 ? "bg-accent/20 text-forest-950" : "bg-danger/15 text-danger");

export default function LessonScreen(props: Props) {
  const { user, course, unit, situation, unitIndex, unitCount, nextHref } = props;
  const { t, sub, pick, pickSub, lang } = useT();
  const L = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const S = useSession();
  const { set } = S;
  const [stats, setStats] = useState(props.initialStats);
  const [progress, setProgress] = useState(props.initialProgress);
  const [passed, setPassed] = useState<Set<string>>(() => new Set(props.passedSentences));
  const [zoomMouth, setZoomMouth] = useState(false);
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [sttOk, setSttOk] = useState(true);
  const [ttsOk, setTtsOk] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const ignoreListenRef = useRef(false); // 입력으로 대신 제출하면 진행 중인 음성인식 결과는 버린다

  useEffect(() => { S.init(situation.id); }, [situation.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSttOk(sttSupported()); setTtsOk(ttsSupported()); }, []);

  // 학습 시간 하트비트 (화면이 보일 때만 60초마다)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetch("/api/progress/time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seconds: 60 }) }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const sentence: Sentence = situation.sentences[Math.min(S.sentenceIndex, situation.sentences.length - 1)];
  const scoreForThis = S.lastScore && S.state !== "recording" ? S.lastScore : null;

  const refreshStats = useCallback(async () => {
    const r = await fetch("/api/me");
    if (r.ok) setStats((await r.json()).stats);
  }, []);

  /** 아바타가 문장을 말한다 */
  const say = useCallback(async (ko: string, en: string, opts: { slow?: boolean } = {}) => {
    set({ subtitle: { ko, en } });
    const h = speak(ko, { slow: opts.slow, onStart: () => set({ avatar: "speaking" }), onEnd: () => set({ avatar: "idle" }) });
    set({ avatar: "speaking" });
    await h.done;
  }, [set]);

  // --- 용어 카드 ---------------------------------------------------------------------------
  async function playTerm(termId: string) {
    const term = situation.terms.find((x) => x.id === termId)!;
    if (S.state === "situation") set({ state: "terms" });
    fetch("/api/progress/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ situationId: situation.id, termId }) })
      .then((r) => r.ok && r.json()).then((d) => d && setStats((s) => ({ ...s, total_words: d.total_words }))).catch(() => {});
    await say(term.hangul, term.gloss_en);
  }

  // --- 따라 읽기 ---------------------------------------------------------------------------
  async function demo(slow = false) {
    set({ state: "demo" });
    await say(sentence.text_ko, sentence.text_en, { slow });
  }

  async function submitScore(recognized: string, durationSec?: number, confidence?: number) {
    set({ state: "scoring", avatar: "thinking" });
    // 즉시 표시용 클라이언트 채점 → 서버 채점 결과로 확정
    const local = scorePronunciation({ target: sentence.text_ko, recognized, durationSec, confidence });
    set({ lastScore: { ...local, recognized } });
    try {
      const r = await fetch("/api/progress/recording", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situationId: situation.id, sentenceId: sentence.id, recognized, durationSec, confidence }),
      });
      if (r.ok) {
        const d = await r.json();
        set({ lastScore: { ...d.result, recognized } });
        setPassed(new Set(d.passedSentences));
        if (d.situation?.completed && !progress?.completed) setJustCompleted(true);
        setProgress(d.situation);
        refreshStats();
      }
    } finally {
      set({ state: "result", avatar: "idle" });
    }
  }

  async function startRecording() {
    if (!sttOk) { setShowTyped(true); return; }
    window.speechSynthesis?.cancel();
    set({ state: "recording", avatar: "listening", interim: "", lastScore: null });
    const h = listen((txt) => set({ interim: txt }));
    listenRef.current = h;
    const res = await h.result;
    listenRef.current = null;
    if (ignoreListenRef.current) { ignoreListenRef.current = false; return; }
    if (res.error === "not-allowed" || res.error === "service-not-allowed") {
      set({ state: "result", avatar: "idle", lastScore: null, subtitle: { ko: "마이크 권한을 허용해 주세요.", en: "Please allow microphone access." } });
      setShowTyped(true);
      return;
    }
    await submitScore(res.transcript, res.durationSec, res.confidence);
  }

  function stopRecording() {
    listenRef.current?.stop();
  }

  async function focusPractice() {
    set({ state: "focus" });
    const weak = S.lastScore?.per_syllable.filter((p) => p.score < 85).map((p) => p.syllable) ?? [];
    if (weak.length) await say(weak.join(" "), "", { slow: true });
    await say(sentence.text_ko, sentence.text_en, { slow: true });
  }

  function gotoSentence(i: number) {
    set({ sentenceIndex: (i + situation.sentences.length) % situation.sentences.length, lastScore: null, state: "demo", interim: "" });
    setShowTyped(false);
    setTyped("");
  }

  // --- 대화 --------------------------------------------------------------------------------
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [S.chatHistory]);

  async function sendChat(mode: "qa" | "roleplay" | "roleplay_start" | "examples", text?: string) {
    if (chatBusy) return;
    const history: ChatMsg[] = [...useSession.getState().chatHistory];
    if (text) history.push({ role: "user", content: text });
    const roleplay = mode === "roleplay_start" ? true : useSession.getState().roleplay;
    set({ chatHistory: [...history, { role: "assistant", content: "" }], state: "chat", avatar: "thinking", roleplay });
    setChatBusy(true);
    const fb = S.lastScore?.feedback.map((f) => f.ko).join(" ") ?? "";
    let acc = "";
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situationId: situation.id, mode: roleplay && mode === "qa" ? "roleplay" : mode, messages: history, feedback: fb }),
      });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        acc = d.error ?? L("오류가 발생했어요.", "Something went wrong.");
      } else {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          set({ chatHistory: [...history, { role: "assistant", content: acc }] });
        }
      }
    } catch {
      acc ||= L("네트워크 오류가 발생했어요.", "Network error.");
    }
    set({ chatHistory: [...history, { role: "assistant", content: acc }], avatar: "idle" });
    setChatBusy(false);
    // 역할극에서는 아바타가 한국어 대사(💡 도움말 줄 제외)를 소리 내어 말한다
    if (roleplay) {
      const line = acc.split("\n").filter((l) => l.trim() && !l.trim().startsWith("💡")).join(" ").trim();
      if (line && /[가-힣]/.test(line)) say(line, "");
    }
  }

  function endRoleplay() {
    set({ roleplay: false, state: "result" });
    window.speechSynthesis?.cancel();
  }

  // --- 렌더 --------------------------------------------------------------------------------
  const avatarLabel = { idle: t("stateIdle"), speaking: t("stateSpeaking"), listening: t("stateListening"), thinking: t("stateThinking") }[S.avatar];
  const sylScores = scoreForThis?.per_syllable ?? null;
  let sylCursor = 0;

  return (
    <div className="min-h-dvh pb-10">
      {/* 1. 헤더 — 유닛 진도 · 언어 전환 */}
      <header className="sticky top-0 z-20 bg-forest-900 text-paper shadow">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link href="/courses" className="rounded-lg px-2 py-1 text-lg hover:bg-white/10" aria-label={t("backToCourses")}>←</Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-paper/70">{pick(course.title_ko, course.title_en)} · {t("unit")} {unitIndex}/{unitCount} · {pick(unit.title_ko, unit.title_en)}</div>
            <div className="flex items-center gap-2">
              <div className="truncate font-bold">{pick(situation.title_ko, situation.title_en)}</div>
              <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/15 sm:block" title={`${passed.size}/${situation.sentences.length}`}>
                <div className="h-full bg-accent transition-all" style={{ width: `${(passed.size / situation.sentences.length) * 100}%` }} />
              </div>
            </div>
          </div>
          <LangToggle dark />
        </div>
      </header>

      {justCompleted && (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-forest-600 px-5 py-4 text-white">
            <span className="text-2xl">🎉</span>
            <div className="flex-1"><b>{t("unitDone")}</b> <span className="text-white/80">{sub("unitDone")}</span></div>
            {nextHref ? <Link href={nextHref} className="btn-accent">{t("nextSituation")} →</Link> : <Link href="/courses" className="btn-accent">{t("backToCourses")}</Link>}
          </div>
        </div>
      )}

      <main className="mx-auto mt-4 grid max-w-7xl gap-4 px-4 lg:grid-cols-[1.35fr_1fr]">
        {/* 좌측 */}
        <div className="space-y-4">
          {/* 2. 상황 설명 · 학습 목표 */}
          <section className="card p-5">
            <div className="flex gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-paper text-5xl" aria-hidden>{situation.image}</div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap gap-1.5">
                  <span className="chip">📍 {situation.place_tag}</span>
                  <span className="chip">{situation.formality_tag}</span>
                  <span className="chip">{situation.difficulty_tag}</span>
                </div>
                <p className="text-[15px] leading-relaxed">{pick(situation.description_ko, situation.description_en)}</p>
                <p className="sub mt-1">{pickSub(situation.description_ko, situation.description_en)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-forest-50 px-4 py-3">
              <div className="text-xs font-bold text-forest-700">🎯 {t("goal")} <span className="font-normal text-black/40">{sub("goal")}</span></div>
              <div className="text-sm">{pick(situation.goal_ko, situation.goal_en)}</div>
            </div>
          </section>

          {/* 3. 필수 생활 용어 카드 */}
          <section className="card p-5">
            <h2 className="mb-3 font-bold">{t("keyTerms")} <span className="sub font-normal">{sub("keyTerms")}</span></h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {situation.terms.map((term) => (
                <button key={term.id} onClick={() => playTerm(term.id)} className="group rounded-xl bg-paper p-3 text-left ring-1 ring-black/5 transition hover:bg-forest-50 hover:ring-forest-600">
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-lg font-bold leading-tight">{term.hangul}</div>
                    <span className="text-forest-600 opacity-60 group-hover:opacity-100" aria-hidden>🔊</span>
                  </div>
                  <div className="mt-1 text-xs text-forest-700">[{term.romanization}]</div>
                  <div className="text-xs text-black/60">{term.gloss_en}</div>
                </button>
              ))}
            </div>
          </section>

          {/* 3. 따라 읽기 */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">{t("repeat")} <span className="sub font-normal">{sub("repeat")}</span></h2>
              <div className="flex items-center gap-1">
                <button className="btn-ghost px-2 py-1" onClick={() => gotoSentence(S.sentenceIndex - 1)} aria-label="previous">‹</button>
                {situation.sentences.map((s, i) => (
                  <button key={s.id} onClick={() => gotoSentence(i)} aria-label={`${i + 1}`}
                    className={`size-2.5 rounded-full ${i === S.sentenceIndex ? "bg-forest-900" : passed.has(s.id) ? "bg-forest-500" : "bg-black/15"}`} />
                ))}
                <button className="btn-ghost px-2 py-1" onClick={() => gotoSentence(S.sentenceIndex + 1)} aria-label="next">›</button>
              </div>
            </div>

            <div className="rounded-2xl bg-forest-900 px-5 py-6 text-center text-paper">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {syllableBreakdown(sentence.text_ko).map((word, wi) => (
                  <div key={wi} className="flex gap-0.5">
                    {word.map((syl, si) => {
                      // 숫자 토큰은 채점 시 여러 음절(예: 502 → 오백이)로 읽히므로 그만큼 건너뛰고 색은 칠하지 않는다
                      let sc: number | null | undefined = null;
                      if (/\d/.test(syl)) sylCursor += toSyllables(syl).length;
                      else sc = sylScores?.[sylCursor++]?.score;
                      return (
                        <span key={si} className={`rounded-md px-1 text-3xl font-bold sm:text-4xl ${sc === undefined || sc === null ? "" : sc >= 85 ? "bg-forest-600/60" : sc >= 70 ? "bg-accent/60 text-forest-950" : "bg-danger/80"}`} title={sc != null ? `${sc}` : undefined}>
                          {syl}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-paper/70">[{sentence.romanization}]</div>
              <div className="text-sm text-paper/90">{sentence.text_en}</div>
              {passed.has(sentence.id) && <div className="mt-2 text-xs text-accent">✓ {L("통과한 문장", "Passed")}</div>}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button className="btn-ghost" onClick={() => demo(false)} disabled={S.state === "recording"}>▶ {t("listenNormal")}</button>
              <button className="btn-ghost" onClick={() => demo(true)} disabled={S.state === "recording"}>🐢 {t("listenSlow")}</button>
              {S.state === "recording" ? (
                <button className="btn bg-danger px-6 py-3 text-base text-white" onClick={stopRecording}>
                  <span className="size-2.5 animate-pulse rounded-full bg-white" /> {t("stop")}
                </button>
              ) : (
                <button className="btn-primary px-6 py-3 text-base" onClick={startRecording} disabled={S.state === "scoring"}>🎙 {t("record")}</button>
              )}
            </div>
            {S.state === "recording" && (
              <p className="mt-3 min-h-6 text-center text-sm text-forest-700">{S.interim || L("말해 보세요…", "Start speaking…")}</p>
            )}
            {!ttsOk && <p className="sub mt-2 text-center">{L("이 브라우저는 음성 합성을 지원하지 않아요.", "This browser doesn't support speech synthesis.")}</p>}
            {(!sttOk || showTyped) ? (
              <form className="mt-3 flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                if (!typed.trim()) return;
                if (listenRef.current) { ignoreListenRef.current = true; listenRef.current.stop(); }
                submitScore(typed.trim());
              }}>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={L("들은 문장을 한글로 입력해 보세요", "Type the sentence in Hangul")} />
                <button className="btn-primary shrink-0">{L("확인", "Check")}</button>
              </form>
            ) : (
              <button className="sub mx-auto mt-2 block underline" onClick={() => setShowTyped(true)}>{t("typeInstead")}</button>
            )}
            {!sttOk && <p className="sub mt-1 text-center">{L("이 브라우저는 음성 인식을 지원하지 않아 입력으로 연습해요(크롬 권장).", "Speech recognition isn't supported here; practice by typing (Chrome recommended).")}</p>}
          </section>
        </div>

        {/* 우측 */}
        <div className="space-y-4">
          {/* 4. AI 아바타 선생님 */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="font-bold">{t("avatarTitle")}</h2>
              <span className={`chip ${S.avatar === "speaking" ? "bg-accent/25" : S.avatar === "listening" ? "bg-forest-600 text-white" : ""}`}>
                <span className={`mr-1.5 size-1.5 rounded-full ${S.avatar === "idle" ? "bg-black/30" : "animate-pulse bg-current"}`} />{avatarLabel}
              </span>
            </div>
            <div className="mx-auto aspect-square w-full max-w-[220px] p-3 sm:max-w-[300px]">
              <Avatar2D state={S.avatar} zoomMouth={zoomMouth} className="size-full" />
            </div>
            <div className="min-h-16 bg-forest-900/95 px-5 py-3 text-center text-paper">
              {S.subtitle ? (<><div className="text-lg font-semibold">{S.subtitle.ko}</div>{S.subtitle.en && <div className="text-xs text-paper/70">{S.subtitle.en}</div>}</>) : (
                <div className="text-sm text-paper/70">{L("용어 카드나 ▶ 버튼을 눌러 발음을 들어 보세요.", "Tap a term card or ▶ to hear the pronunciation.")}</div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 [&>button]:px-2 [&>button]:text-xs sm:[&>button]:text-sm">
              <button className="btn-ghost" onClick={() => demo(false)}>🔁 {t("replay")}</button>
              <button className={zoomMouth ? "btn-primary" : "btn-ghost"} onClick={async () => { setZoomMouth(true); await demo(true); setTimeout(() => setZoomMouth(false), 600); }}>👄 {t("mouth")}</button>
              <button className="btn-accent" onClick={() => (S.roleplay ? endRoleplay() : sendChat("roleplay_start"))} disabled={chatBusy}>💬 {S.roleplay ? t("endRoleplay") : t("startTalk")}</button>
            </div>
          </section>

          {/* 5. 사용자 정보 · 학습 통계 */}
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-forest-900 text-lg font-bold text-paper">{user.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{user.name}</div>
                <div className="truncate text-xs text-black/50">{user.nationality || "-"} · {languageName(user.native_language, lang)} · {user.level}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-accent">🔥 {stats.streak}</div>
                <div className="sub">{t("streak")}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[[t("totalWords"), stats.total_words], [t("avgAccuracy"), stats.avg_accuracy ? `${stats.avg_accuracy}%` : "-"], [t("weekly"), `${stats.weekly_minutes}${L("분", "m")}`]].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl bg-paper py-2.5">
                  <div className="text-lg font-bold text-forest-900">{v}</div>
                  <div className="sub">{k}</div>
                </div>
              ))}
            </div>
            {progress && (
              <div className="mt-3 text-xs text-black/60">
                {L("이 상황 최고 점수", "Best score here")}: <b>{progress.best_score}</b> · {L("시도", "Attempts")}: {progress.attempts}
              </div>
            )}
          </section>
        </div>

        {/* 6. 하단 — 발음 정확도 · AI 피드백 · 대화창 */}
        <div className="grid gap-4 lg:col-span-2 lg:grid-cols-3">
          <section className="card p-5" aria-live="polite">
            <h2 className="font-bold">{t("score")} <span className="sub font-normal">{sub("score")}</span></h2>
            {S.state === "scoring" ? (
              <p className="py-10 text-center text-sm text-forest-700">{t("scoring")}</p>
            ) : scoreForThis ? (
              <>
                <div className="mt-3 flex items-center gap-4">
                  <div className={`text-5xl font-black ${scoreColor(scoreForThis.overall)}`}>{scoreForThis.overall}</div>
                  <div className="flex-1 space-y-1.5">
                    {([["accuracy", scoreForThis.accuracy], ["fluency", scoreForThis.fluency], ["intonation", scoreForThis.intonation]] as const).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-14 shrink-0 text-black/60">{t(k)}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-forest-600" style={{ width: `${v}%` }} /></div>
                        <span className="w-7 text-right font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {scoreForThis.per_syllable.map((p, i) => (
                    <span key={i} className={`rounded-md px-1.5 py-0.5 text-sm font-semibold ${scoreBg(p.score)}`} title={`${p.score}`}>{p.syllable}<sub className="ml-0.5 text-[9px] opacity-70">{p.score}</sub></span>
                  ))}
                </div>
                <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs">
                  <span className="text-black/50">{t("heard")}:</span> {scoreForThis.recognized || "—"}
                </div>
                <p className="sub mt-2">ⓘ {t("approx")}</p>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-black/50">{t("noScore")}</p>
            )}
          </section>

          <section className="card flex flex-col p-5">
            <h2 className="font-bold">{t("feedback")} <span className="sub font-normal">{sub("feedback")}</span></h2>
            <div className="mt-3 flex-1 space-y-2">
              {scoreForThis?.feedback.length ? scoreForThis.feedback.map((f, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 text-sm ${f.kind === "success" ? "bg-forest-50 text-forest-900" : f.kind === "warning" ? "bg-accent/15" : "bg-paper"}`}>
                  <div>{f.kind === "success" ? "✅" : f.kind === "warning" ? "⚠️" : "ℹ️"} {pick(f.ko, f.en)}</div>
                  <div className="sub mt-0.5">{pickSub(f.ko, f.en)}</div>
                </div>
              )) : (
                <p className="py-8 text-center text-sm text-black/50">{L("녹음하면 발음 피드백이 여기에 나와요.", "Feedback appears here after recording.")}</p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={focusPractice} disabled={!scoreForThis}>🎯 {t("focus")}</button>
              <button className="btn-primary" onClick={() => gotoSentence(S.sentenceIndex + 1)}>{t("nextSentence")} →</button>
            </div>
          </section>

          <section className="card flex h-[420px] flex-col p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t("chat")} <span className="sub font-normal">{sub("chat")}</span></h2>
              {S.roleplay && <span className="chip bg-accent/25">🎭 {situation.roles[1]} ↔ {situation.roles[0]}</span>}
            </div>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {S.chatHistory.length === 0 && (
                <div className="rounded-xl bg-paper px-3 py-2 text-sm text-black/60">
                  {L(`이 상황에 대해 무엇이든 물어보세요. ${languageName(user.native_language)}로 물어봐도 돼요.`, `Ask anything about this situation — in ${languageName(user.native_language, "en")} too.`)}
                </div>
              )}
              {S.chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "rounded-br-sm bg-forest-900 text-paper" : "rounded-bl-sm bg-forest-50"}`}>
                    {m.content || <span className="animate-pulse">…</span>}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div className="mt-2 flex gap-1.5">
              <button className="chip hover:bg-forest-100" onClick={() => sendChat("examples")} disabled={chatBusy}>📚 {t("moreExamples")}</button>
              {S.roleplay ? (
                <button className="chip hover:bg-forest-100" onClick={endRoleplay}>⏹ {t("endRoleplay")}</button>
              ) : (
                <button className="chip hover:bg-forest-100" onClick={() => sendChat("roleplay_start")} disabled={chatBusy}>🎭 {t("roleplay")}</button>
              )}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = chatInput.trim(); if (!v) return; setChatInput(""); sendChat("qa", v); }}>
              <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={S.roleplay ? L(`'${situation.roles[0]}'(으)로 한국어로 답해 보세요`, `Reply in Korean as '${situation.roles[0]}'`) : t("chatPlaceholder")} maxLength={1000} />
              <button className="btn-primary shrink-0" disabled={chatBusy || !chatInput.trim()}>{t("send")}</button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
