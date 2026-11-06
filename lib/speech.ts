"use client";

// 설계 §6.1/§6.2의 TTS·STT 자리표시자 — 브라우저 Web Speech API를 사용한다.
// 상용 TTS(viseme 포함)/STT로 교체할 때는 speak()/listen()의 시그니처만 유지하면 된다.

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function koreanVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ko-KR" && /female|여|Yuna|SunHi|Heami/i.test(v.name)) ??
    voices.find((v) => v.lang === "ko-KR") ??
    voices.find((v) => v.lang.startsWith("ko"))
  );
}

export interface SpeakHandle {
  cancel: () => void;
  done: Promise<void>;
}

/** 한국어 문장을 읽는다. slow=true면 느리게. */
export function speak(text: string, opts: { slow?: boolean; onStart?: () => void; onEnd?: () => void } = {}): SpeakHandle {
  if (!ttsSupported()) {
    opts.onEnd?.();
    return { cancel: () => {}, done: Promise.resolve() };
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  const v = koreanVoice();
  if (v) u.voice = v;
  u.rate = opts.slow ? 0.6 : 0.95;
  u.pitch = 1.05;
  let finished = false;
  const done = new Promise<void>((resolve) => {
    const finish = () => {
      if (finished) return;
      finished = true;
      opts.onEnd?.();
      resolve();
    };
    u.onstart = () => opts.onStart?.();
    u.onend = finish;
    u.onerror = finish;
    // 일부 브라우저는 onend를 보내지 않는 경우가 있어 안전 타이머를 둔다.
    setTimeout(finish, Math.max(3000, text.length * (opts.slow ? 450 : 260) + 2500));
  });
  synth.speak(u);
  return { cancel: () => synth.cancel(), done };
}

// --- STT ------------------------------------------------------------------------------------
interface SRResult { transcript: string; confidence: number }
interface SREvent { results: ArrayLike<ArrayLike<SRResult> & { isFinal: boolean }> }
interface SR {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}

function recognitionCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported() {
  return recognitionCtor() !== null;
}

export interface ListenResult {
  transcript: string;
  confidence?: number;
  durationSec: number;
  error?: string;
}

export interface ListenHandle {
  stop: () => void;
  result: Promise<ListenResult>;
}

/** 마이크로 한국어 발화를 인식한다. onInterim으로 중간 결과를 받는다. */
export function listen(onInterim?: (text: string) => void): ListenHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) return { stop: () => {}, result: Promise.resolve({ transcript: "", durationSec: 0, error: "unsupported" }) };
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  const started = performance.now();
  let finalText = "";
  let interim = "";
  let confSum = 0, confN = 0;
  let error: string | undefined;
  const result = new Promise<ListenResult>((resolve) => {
    rec.onresult = (e) => {
      interim = "";
      finalText = "";
      confSum = 0; confN = 0;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
          if (r[0].confidence > 0) { confSum += r[0].confidence; confN++; }
        } else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") error = e.error; };
    rec.onend = () =>
      resolve({
        transcript: (finalText || interim).trim(),
        confidence: confN ? confSum / confN : undefined,
        durationSec: (performance.now() - started) / 1000,
        error,
      });
  });
  try {
    rec.start();
  } catch {
    return { stop: () => {}, result: Promise.resolve({ transcript: "", durationSec: 0, error: "start-failed" }) };
  }
  // 최대 15초 후 자동 종료
  const timer = setTimeout(() => rec.stop(), 15000);
  return { stop: () => { clearTimeout(timer); rec.stop(); }, result };
}
