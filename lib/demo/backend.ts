"use client";

// 브라우저 체험판의 "서버": app/api/* 라우트와 같은 요청·응답 형식을 브라우저 안에서 처리한다.
// 화면 컴포넌트는 서버판과 똑같이 fetch("/api/...")를 부르고, install.ts가 그 요청을 여기로 돌린다.
import Anthropic from "@anthropic-ai/sdk";
import { buildDashboard, buildLearnerDetail, buildLearnerRows, emptyProgress } from "../admin-calc";
import { CHAT_MODES, DEFAULT_CLAUDE_MODEL, claudeReply, normalizeHistory, offlineReply, systemPrompt, textStream, type Mode } from "../chat";
import { crossCourseConflicts, findSituation, findSituationBundle, sortCourses, validateCourse } from "../content-utils";
import { NATIVE_LANGUAGES } from "../languages";
import { scorePronunciation } from "../scoring";
import { computeStats } from "../stats";
import type { Course, StoredUser, User, UserProgress } from "../types";
import { get, hashPassword, mutate, newId, verifyPassword } from "./store";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const err = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const today = () => new Date().toISOString().slice(0, 10);

export function toPublicUser(u: StoredUser): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = u;
  return rest;
}

// ---------------------------------------------------------------------------
// 화면(페이지)에서 직접 읽는 함수들
// ---------------------------------------------------------------------------
export function currentUser(): User | null {
  const s = get();
  const u = s.users.find((x) => x.id === s.session);
  return u && u.active ? toPublicUser(u) : null;
}
export const courses = (includeUnpublished = false) => sortCourses(get().courses, includeUnpublished);
export const progressOf = (uid: string): UserProgress => get().progress.find((p) => p.user_id === uid) ?? emptyProgress(uid);
export const recordingsOf = (uid: string) => get().recordings.filter((r) => r.user_id === uid);
export const statsOf = (uid: string) => computeStats(progressOf(uid), recordingsOf(uid), courses());
export const bundle = (unitId: string, situationId: string) => findSituationBundle(courses(), unitId, situationId);
export const users = () => get().users.map(toPublicUser);

export function learnerRows() {
  const s = get();
  const all = courses(true);
  return { rows: buildLearnerRows(users(), s.progress, s.recordings, all), courses: all };
}
export function dashboard() {
  const { rows, courses: all } = learnerRows();
  return buildDashboard(rows, all, get().recordings);
}
export function learnerDetail(id: string) {
  const { rows, courses: all } = learnerRows();
  return buildLearnerDetail(id, rows, all, get().progress, get().recordings);
}

// ---------------------------------------------------------------------------
// API 요청 처리
// ---------------------------------------------------------------------------
type Body = Record<string, unknown> | null;

function updateProgress(uid: string, fn: (p: UserProgress) => void) {
  return mutate((s) => {
    let p = s.progress.find((x) => x.user_id === uid);
    if (!p) { p = emptyProgress(uid); s.progress.push(p); }
    fn(p);
    if (!p.active_days.includes(today())) p.active_days.push(today());
    const u = s.users.find((x) => x.id === uid);
    if (u) u.last_active_at = new Date().toISOString();
    return p;
  });
}

function requireUser(): User | Response {
  return currentUser() ?? err(401, "로그인이 필요합니다.");
}
function requireAdmin(): User | Response {
  const u = currentUser();
  if (!u) return err(401, "로그인이 필요합니다.");
  return u.role === "admin" ? u : err(403, "관리자 권한이 필요합니다.");
}

function wouldRemoveLastAdmin(target: StoredUser) {
  if (target.role !== "admin" || !target.active) return false;
  return get().users.filter((u) => u.role === "admin" && u.active).length <= 1;
}

export async function handle(path: string, method: string, b: Body): Promise<Response> {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean); // ["api", ...]
  const route = "/" + parts.join("/");

  // --- 인증 ---------------------------------------------------------------
  if (route === "/api/auth/login" && method === "POST") {
    const email = str(b?.email, 120).toLowerCase();
    const u = get().users.find((x) => x.email === email);
    if (!u || !(await verifyPassword(typeof b?.password === "string" ? b.password : "", u.password_hash)))
      return err(401, "이메일 또는 비밀번호가 올바르지 않습니다. / Incorrect email or password.");
    if (!u.active) return err(403, "비활성화된 계정입니다. 관리자에게 문의하세요. / This account is disabled.");
    mutate((s) => { s.session = u.id; });
    return json({ user: toPublicUser(u) });
  }
  if (route === "/api/auth/signup" && method === "POST") {
    const email = str(b?.email, 120).toLowerCase();
    const password = typeof b?.password === "string" ? b.password : "";
    const name = str(b?.name, 60);
    const native_language = str(b?.native_language, 8);
    if (!EMAIL_RE.test(email)) return err(400, "이메일 형식이 올바르지 않습니다. / Invalid email.");
    if (password.length < 8) return err(400, "비밀번호는 8자 이상이어야 합니다. / Password must be at least 8 characters.");
    if (!name) return err(400, "이름을 입력하세요. / Please enter your name.");
    if (!NATIVE_LANGUAGES.some((l) => l.code === native_language)) return err(400, "모국어를 선택하세요. / Choose your native language.");
    if (get().users.some((u) => u.email === email)) return err(409, "이미 가입된 이메일입니다. / This email is already registered.");
    const user: StoredUser = {
      id: newId(), email, name, native_language, role: "learner", nationality: str(b?.nationality, 40), institution: str(b?.institution, 60),
      level: "입문", active: true, created_at: new Date().toISOString(), password_hash: await hashPassword(password),
    };
    mutate((s) => { s.users.push(user); s.session = user.id; });
    return json({ user: toPublicUser(user) });
  }
  if (route === "/api/auth/logout" && method === "POST") {
    mutate((s) => { s.session = null; });
    return json({ ok: true });
  }

  // --- 내 정보·진도 ---------------------------------------------------------
  if (route === "/api/me") {
    const u = requireUser();
    if (u instanceof Response) return u;
    if (method === "GET") return json({ user: u, stats: statsOf(u.id) });
    if (method === "PATCH") {
      const code = b?.native_language !== undefined ? str(b.native_language, 8) : undefined;
      if (code !== undefined && !NATIVE_LANGUAGES.some((l) => l.code === code)) return err(400, "지원하지 않는 언어입니다.");
      const nu = mutate((s) => {
        const x = s.users.find((y) => y.id === u.id)!;
        if (code) x.native_language = code;
        if (str(b?.name, 60)) x.name = str(b?.name, 60);
        return x;
      });
      return json({ user: toPublicUser(nu) });
    }
  }
  if (route === "/api/progress/recording" && method === "POST") {
    const u = requireUser();
    if (u instanceof Response) return u;
    const situationId = str(b?.situationId, 60);
    const sentenceId = str(b?.sentenceId, 60);
    const recognized = str(b?.recognized, 500);
    const durationSec = typeof b?.durationSec === "number" && isFinite(b.durationSec) ? Math.min(60, Math.max(0, b.durationSec)) : undefined;
    const confidence = typeof b?.confidence === "number" && b.confidence >= 0 && b.confidence <= 1 ? b.confidence : undefined;
    const loc = findSituation(courses(true), situationId);
    const sentence = loc?.situation.sentences.find((s) => s.id === sentenceId);
    if (!loc || !sentence) return err(404, "문장을 찾을 수 없습니다.");
    const score = scorePronunciation({ target: sentence.text_ko, recognized, durationSec, confidence });
    const rec = {
      ...score, id: newId(), created_at: new Date().toISOString(), user_id: u.id, course_id: loc.course.id, unit_id: loc.unit.id,
      situation_id: situationId, sentence_id: sentenceId, target: sentence.text_ko, recognized,
    };
    mutate((s) => {
      s.recordings.push(rec);
      // 기기 저장 공간을 아끼기 위해 사용자당 최근 200건만 보관
      const mine = s.recordings.filter((r) => r.user_id === u.id);
      if (mine.length > 200) {
        const drop = new Set(mine.slice(0, mine.length - 200).map((r) => r.id));
        s.recordings = s.recordings.filter((r) => !drop.has(r.id));
      }
    });
    const mine = recordingsOf(u.id).filter((r) => r.situation_id === situationId);
    const passed = new Set(mine.filter((r) => r.overall >= 70).map((r) => r.sentence_id));
    const completed = loc.situation.sentences.every((s) => passed.has(s.id));
    const p = updateProgress(u.id, (p) => {
      const prev = p.situations[situationId];
      p.situations[situationId] = {
        situation_id: situationId, course_id: loc.course.id, unit_id: loc.unit.id,
        completed: completed || !!prev?.completed,
        best_score: Math.max(prev?.best_score ?? 0, score.overall),
        attempts: (prev?.attempts ?? 0) + 1,
        last_at: new Date().toISOString(),
      };
    });
    return json({ result: rec, situation: p.situations[situationId], passedSentences: [...passed] });
  }
  if (route === "/api/progress/terms" && method === "POST") {
    const u = requireUser();
    if (u instanceof Response) return u;
    const loc = findSituation(courses(true), str(b?.situationId, 60));
    const termId = str(b?.termId, 60);
    if (!loc || !loc.situation.terms.some((t) => t.id === termId)) return err(404, "용어를 찾을 수 없습니다.");
    const p = updateProgress(u.id, (p) => { if (!p.learned_terms.includes(termId)) p.learned_terms.push(termId); });
    return json({ total_words: p.learned_terms.length });
  }
  if (route === "/api/progress/time" && method === "POST") {
    const u = requireUser();
    if (u instanceof Response) return u;
    const sec = typeof b?.seconds === "number" && isFinite(b.seconds) ? Math.min(120, Math.max(0, Math.round(b.seconds))) : 0;
    if (sec > 0) updateProgress(u.id, (p) => { p.study_seconds += sec; });
    return json({ ok: true });
  }

  // --- AI 대화 --------------------------------------------------------------
  if (route === "/api/chat" && method === "POST") {
    const u = requireUser();
    if (u instanceof Response) return u;
    const loc = findSituation(courses(true), str(b?.situationId, 60));
    if (!loc) return err(404, "상황을 찾을 수 없습니다.");
    const mode: Mode = CHAT_MODES.find((m) => m === b?.mode) ?? "qa";
    const history = normalizeHistory(Array.isArray(b?.messages) ? (b!.messages as unknown[]) : [], mode);
    if (history.length === 0 || history[history.length - 1].role !== "user") return err(400, "메시지를 입력하세요.");
    updateProgress(u.id, (p) => { p.chat_messages += 1; });
    const last = history[history.length - 1].content as string;
    const offline = () => offlineReply(loc.situation, mode, last);
    const { claudeKey, claudeModel } = get().settings;
    if (!claudeKey) return textStream((async function* () { yield offline(); })());
    // 관리자가 '체험판 설정'에 넣은 테스트용 키로 브라우저에서 바로 Claude를 호출한다.
    const client = new Anthropic({ apiKey: claudeKey, dangerouslyAllowBrowser: true });
    const system = systemPrompt(loc.situation, { nativeLang: u.native_language, mode, feedback: str(b?.feedback, 400) });
    return textStream(claudeReply(client, { model: claudeModel || DEFAULT_CLAUDE_MODEL, system, messages: history, offline }));
  }

  // --- 관리자: 콘텐츠 ---------------------------------------------------------
  if (parts[1] === "admin" && parts[2] === "content") {
    const a = requireAdmin();
    if (a instanceof Response) return a;
    const all = get().courses;
    if (parts.length === 3) {
      if (method === "GET") return json({ courses: courses(true) });
      if (method === "POST") {
        const course = b as unknown as Course;
        if (!course) return err(400, "잘못된 요청입니다.");
        if (all.some((c) => c.id === course.id)) return err(409, `코스 ID '${course.id}'가 이미 있습니다.`);
        const errors = [...validateCourse(course), ...crossCourseConflicts(course, all)];
        if (errors.length) return err(422, "저장할 수 없습니다.", { errors });
        mutate((s) => { s.courses.push(course); });
        return json({ course });
      }
    } else {
      const id = decodeURIComponent(parts[3]);
      const idx = all.findIndex((c) => c.id === id);
      if (idx < 0) return err(404, "코스를 찾을 수 없습니다.");
      if (method === "PUT") {
        const course = b as unknown as Course;
        if (!course) return err(400, "잘못된 요청입니다.");
        if (course.id !== id) return err(400, "코스 ID는 변경할 수 없습니다.");
        const errors = [...validateCourse(course), ...crossCourseConflicts(course, all)];
        if (errors.length) return err(422, "저장할 수 없습니다.", { errors });
        mutate((s) => { s.courses[idx] = course; });
        return json({ course });
      }
      if (method === "DELETE") {
        mutate((s) => { s.courses.splice(idx, 1); });
        return json({ ok: true });
      }
    }
  }

  // --- 관리자: 계정 ---------------------------------------------------------
  if (parts[1] === "admin" && parts[2] === "users") {
    const a = requireAdmin();
    if (a instanceof Response) return a;
    if (parts.length === 3) {
      if (method === "GET") return json({ users: users() });
      if (method === "POST") {
        const email = str(b?.email, 120).toLowerCase();
        const password = typeof b?.password === "string" ? b.password : "";
        const name = str(b?.name, 60);
        if (!EMAIL_RE.test(email)) return err(400, "이메일 형식이 올바르지 않습니다.");
        if (password.length < 8) return err(400, "비밀번호는 8자 이상이어야 합니다.");
        if (!name) return err(400, "이름을 입력하세요.");
        if (get().users.some((u) => u.email === email)) return err(409, "이미 등록된 이메일입니다.");
        const user: StoredUser = {
          id: newId(), email, name, role: b?.role === "admin" ? "admin" : "learner",
          native_language: NATIVE_LANGUAGES.some((l) => l.code === b?.native_language) ? (b!.native_language as string) : "en",
          nationality: str(b?.nationality, 40), institution: str(b?.institution, 60), level: str(b?.level, 20) || "입문",
          active: true, created_at: new Date().toISOString(), password_hash: await hashPassword(password),
        };
        mutate((s) => { s.users.push(user); });
        return json({ user: toPublicUser(user) });
      }
    } else {
      const id = decodeURIComponent(parts[3]);
      const target = get().users.find((u) => u.id === id);
      if (!target) return err(404, "사용자를 찾을 수 없습니다.");
      if (method === "PATCH") {
        const patch: Partial<StoredUser> = {};
        for (const k of ["name", "nationality", "institution", "level"] as const) if (typeof b?.[k] === "string") patch[k] = str(b[k], 60);
        if (typeof b?.native_language === "string" && NATIVE_LANGUAGES.some((l) => l.code === b.native_language)) patch.native_language = b.native_language;
        if (b?.role === "admin" || b?.role === "learner") patch.role = b.role;
        if (typeof b?.active === "boolean") patch.active = b.active;
        if (typeof b?.password === "string" && b.password) {
          if (b.password.length < 8) return err(400, "비밀번호는 8자 이상이어야 합니다.");
          patch.password_hash = await hashPassword(b.password);
        }
        const demotes = (patch.role && patch.role !== "admin") || patch.active === false;
        if (demotes && wouldRemoveLastAdmin(target)) return err(400, "마지막 관리자 계정은 권한을 내리거나 비활성화할 수 없습니다.");
        if (demotes && id === a.id) return err(400, "자기 자신의 관리자 권한은 내리거나 비활성화할 수 없습니다.");
        const nu = mutate((s) => Object.assign(s.users.find((u) => u.id === id)!, patch));
        return json({ user: toPublicUser(nu) });
      }
      if (method === "DELETE") {
        if (id === a.id) return err(400, "자기 자신은 삭제할 수 없습니다.");
        if (wouldRemoveLastAdmin(target)) return err(400, "마지막 관리자 계정은 삭제할 수 없습니다.");
        mutate((s) => {
          s.users = s.users.filter((u) => u.id !== id);
          s.progress = s.progress.filter((p) => p.user_id !== id);
          s.recordings = s.recordings.filter((r) => r.user_id !== id);
        });
        return json({ ok: true });
      }
    }
  }

  return err(404, `체험판에서 지원하지 않는 요청입니다: ${method} ${route}`);
}
