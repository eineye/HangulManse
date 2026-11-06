"use client";

// 브라우저 체험판(GitHub Pages·APK)의 저장소. 서버 대신 이 기기 브라우저의 localStorage에 저장한다.
// 같은 github.io 주소를 쓰는 다른 앱과 섞이지 않도록 고유한 키를 쓴다.
import defaultContent from "./default-content.json";
import { buildSeed } from "../seed";
import type { Course, RecordingResult, StoredUser, UserProgress } from "../types";

const KEY = "hangulmanse-demo-v1";
export const CHANGE_EVENT = "hangulmanse-demo-change";

export interface DemoSettings {
  claudeKey?: string;
  claudeModel?: string;
}

export interface DemoState {
  users: StoredUser[];
  progress: UserProgress[];
  recordings: RecordingResult[];
  courses: Course[];
  session: string | null; // 로그인한 사용자 id
  settings: DemoSettings;
  created_at: string;
}

export const DEMO_ADMIN_PASSWORD = "admin1234!";

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === "x" ? 0 : 8)).toString(16));

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 체험판 비밀번호 해시 (기기 안에만 저장되는 시험용 — 서버판은 scrypt 사용) */
export async function hashPassword(pw: string) {
  const salt = uuid().slice(0, 8);
  return `sha256$${salt}$${await sha256(salt + pw)}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const [algo, salt, hex] = stored.split("$");
  return algo === "sha256" && (await sha256(salt + pw)) === hex;
}

export const newId = uuid;

let state: DemoState | null = null;
let loading: Promise<DemoState> | null = null;

async function fresh(): Promise<DemoState> {
  const seed = await buildSeed({ hash: hashPassword, uuid, adminPassword: DEMO_ADMIN_PASSWORD });
  return { ...seed, courses: defaultContent as Course[], session: null, settings: {}, created_at: new Date().toISOString() };
}

function read(): DemoState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoState) : null;
  } catch {
    return null;
  }
}

/** 저장소 준비(최초 1회 시드) */
export function ready(): Promise<DemoState> {
  if (state) return Promise.resolve(state);
  loading ??= (async () => {
    state = read() ?? (await fresh());
    persist();
    return state;
  })();
  return loading;
}

/** 준비된 상태를 동기적으로 읽는다(ready() 이후에만) */
export function get(): DemoState {
  if (!state) throw new Error("demo store not ready");
  return state;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[demo] 저장 실패(저장 공간 부족 또는 개인정보 보호 모드)", e);
  }
}

/** 상태를 바꾸고 저장한 뒤 화면에 알린다 */
export function mutate<T>(fn: (s: DemoState) => T): T {
  const s = get();
  const r = fn(s);
  persist();
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return r;
}

/** 체험판 데이터를 처음 상태로 되돌린다 */
export async function resetAll() {
  const settings = state?.settings ?? {};
  state = { ...(await fresh()), settings };
  persist();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function exportJson() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { settings, ...rest } = get(); // API 키는 내보내지 않는다
  return JSON.stringify(rest, null, 2);
}

export function importJson(text: string) {
  const data = JSON.parse(text) as Partial<DemoState>;
  if (!Array.isArray(data.users) || !Array.isArray(data.courses) || !Array.isArray(data.progress) || !Array.isArray(data.recordings))
    throw new Error("한글만세 체험판 백업 파일이 아닙니다.");
  mutate((s) => {
    s.users = data.users!;
    s.courses = data.courses!;
    s.progress = data.progress!;
    s.recordings = data.recordings!;
    s.session = null;
  });
}
