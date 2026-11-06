"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./types";

// 설계 §1 "모든 안내는 한국어·다문화 언어 병기" — UI 문구 사전.
// 기본은 한국어를 크게, 선택 언어(영어)를 작게 함께 표시한다. EN 모드에서는 순서를 바꾼다.
const dict = {
  appName: { ko: "한글만세", en: "HangulManse" },
  unit: { ko: "유닛", en: "Unit" },
  situation: { ko: "상황", en: "Situation" },
  goal: { ko: "학습 목표", en: "Learning goal" },
  keyTerms: { ko: "필수 생활 용어", en: "Key terms" },
  repeat: { ko: "따라 읽기", en: "Repeat after me" },
  record: { ko: "따라 말하기", en: "Speak" },
  stop: { ko: "녹음 끝내기", en: "Stop" },
  listenNormal: { ko: "원래 속도", en: "Normal" },
  listenSlow: { ko: "느리게 듣기", en: "Slow" },
  avatarTitle: { ko: "AI 아바타 선생님", en: "AI avatar teacher" },
  replay: { ko: "다시 듣기", en: "Listen again" },
  mouth: { ko: "입모양 보기", en: "Show mouth" },
  startTalk: { ko: "대화 시작", en: "Start talking" },
  stats: { ko: "나의 학습", en: "My learning" },
  totalWords: { ko: "학습 단어", en: "Words" },
  avgAccuracy: { ko: "평균 정확도", en: "Avg. accuracy" },
  weekly: { ko: "이번 주 학습", en: "This week" },
  streak: { ko: "연속 학습", en: "Streak" },
  score: { ko: "발음 정확도", en: "Pronunciation" },
  accuracy: { ko: "정확도", en: "Accuracy" },
  fluency: { ko: "유창성", en: "Fluency" },
  intonation: { ko: "억양", en: "Intonation" },
  feedback: { ko: "AI 피드백", en: "AI feedback" },
  focus: { ko: "집중 연습", en: "Focus practice" },
  nextSentence: { ko: "다음 문장", en: "Next sentence" },
  chat: { ko: "AI 대화", en: "AI chat" },
  moreExamples: { ko: "예문 더 보기", en: "More examples" },
  roleplay: { ko: "역할극 시작", en: "Start role-play" },
  endRoleplay: { ko: "역할극 끝내기", en: "End role-play" },
  chatPlaceholder: { ko: "모국어로 질문해도 돼요", en: "You can ask in your own language" },
  send: { ko: "보내기", en: "Send" },
  courses: { ko: "학습 코스", en: "Courses" },
  logout: { ko: "로그아웃", en: "Log out" },
  admin: { ko: "관리자", en: "Admin" },
  stateIdle: { ko: "대기 중", en: "Idle" },
  stateSpeaking: { ko: "말하는 중", en: "Speaking" },
  stateListening: { ko: "듣는 중", en: "Listening" },
  stateThinking: { ko: "생각하는 중", en: "Thinking" },
  scoring: { ko: "채점 중…", en: "Scoring…" },
  noScore: { ko: "문장을 듣고 '따라 말하기'를 눌러 보세요.", en: "Listen, then press 'Speak'." },
  heard: { ko: "인식된 문장", en: "What we heard" },
  typeInstead: { ko: "마이크 대신 입력하기", en: "Type instead of mic" },
  unitDone: { ko: "이 상황을 완료했어요!", en: "Situation complete!" },
  nextSituation: { ko: "다음 상황으로", en: "Next situation" },
  backToCourses: { ko: "코스로 돌아가기", en: "Back to courses" },
  approx: { ko: "브라우저 음성인식 기반 근사 점수", en: "Approximate score from browser speech recognition" },
} as const;

export type DictKey = keyof typeof dict;

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>()(
  persist((set) => ({ lang: "ko", setLang: (lang) => set({ lang }) }), { name: "hm-lang", skipHydration: true }),
);

export function useT() {
  const lang = useLang((s) => s.lang);
  const t = (k: DictKey) => dict[k][lang];
  /** 반대 언어(보조 표기) */
  const sub = (k: DictKey) => dict[k][lang === "ko" ? "en" : "ko"];
  /** ko/en 쌍 콘텐츠 선택 */
  const pick = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const pickSub = (ko: string, en: string) => (lang === "ko" ? en : ko);
  return { lang, t, sub, pick, pickSub };
}
