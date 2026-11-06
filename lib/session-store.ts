"use client";

import { create } from "zustand";
import type { PronunciationScore } from "./types";

// 설계 §3.3 학습 사이클 상태 머신. 페이지 이동 없이 이 상태만 바뀐다.
export type CycleState =
  | "situation" // 상황제시
  | "terms" // 용어학습
  | "demo" // 아바타시범
  | "recording" // 녹음중
  | "scoring" // 채점중
  | "result" // 결과표시
  | "focus" // 집중연습
  | "chat"; // 대화학습

export type AvatarState = "idle" | "speaking" | "listening" | "thinking";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface SessionState {
  situationId: string | null;
  state: CycleState;
  sentenceIndex: number;
  avatar: AvatarState;
  subtitle: { ko: string; en: string } | null;
  lastScore: (PronunciationScore & { recognized: string }) | null;
  interim: string;
  chatHistory: ChatMsg[];
  roleplay: boolean;
  completed: Set<string>; // 이번 상황에서 70점 이상 받은 문장 id
  init: (situationId: string) => void;
  set: (p: Partial<Omit<SessionState, "init" | "set">>) => void;
}

export const useSession = create<SessionState>((set, get) => ({
  situationId: null,
  state: "situation",
  sentenceIndex: 0,
  avatar: "idle",
  subtitle: null,
  lastScore: null,
  interim: "",
  chatHistory: [],
  roleplay: false,
  completed: new Set(),
  init: (situationId) => {
    if (get().situationId === situationId) return;
    set({ situationId, state: "situation", sentenceIndex: 0, avatar: "idle", subtitle: null, lastScore: null, interim: "", chatHistory: [], roleplay: false, completed: new Set() });
  },
  set: (p) => set(p),
}));
