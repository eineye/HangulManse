import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./password";
import { buildSeed } from "./seed";
import { emptyProgress } from "./admin-calc";
import type { RecordingResult, StoredUser, User, UserProgress } from "./types";

// 설계 §4 User/Session/Speech Service의 저장소 자리표시자.
// data/*.json 파일 기반의 아주 작은 저장소로, 단일 Node 프로세스 기준으로 쓰기를 직렬화한다.
// PostgreSQL 등으로 옮길 때는 이 모듈의 함수 시그니처만 유지하면 된다.


interface Tables {
  users: StoredUser[];
  progress: UserProgress[];
  recordings: RecordingResult[];
}
type TableName = keyof Tables;

let queue: Promise<unknown> = Promise.resolve();
/** 파일 쓰기 경합을 막기 위한 프로세스 내 직렬 큐 */
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readTable<K extends TableName>(name: K): Promise<Tables[K]> {
  await ensureSeeded();
  try {
    return JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ DATA_DIR, `${name}.json`), "utf8")) as Tables[K];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [] as unknown as Tables[K];
    throw e;
  }
}

async function writeTable<K extends TableName>(name: K, rows: Tables[K]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function mutate<K extends TableName, R>(name: K, fn: (rows: Tables[K]) => R | Promise<R>): Promise<R> {
  return serialize(async () => {
    const rows = await readTable(name);
    const result = await fn(rows);
    await writeTable(name, rows);
    return result;
  });
}

export function toPublicUser(u: StoredUser): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = u;
  return rest;
}

// ---------------------------------------------------------------------------
// 사용자
// ---------------------------------------------------------------------------
export async function listUsers(): Promise<StoredUser[]> {
  return readTable("users");
}
export async function findUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return (await readTable("users")).find((u) => u.email === e) ?? null;
}
export async function findUserById(id: string) {
  return (await readTable("users")).find((u) => u.id === id) ?? null;
}

export type NewUser = Omit<User, "id" | "created_at" | "active"> & { password: string; active?: boolean };

export async function createUser(input: NewUser): Promise<StoredUser | "exists"> {
  const password_hash = await hashPassword(input.password);
  return mutate("users", (rows) => {
    const email = input.email.trim().toLowerCase();
    if (rows.some((u) => u.email === email)) return "exists" as const;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = input;
    const user: StoredUser = { ...rest, email, id: randomUUID(), active: input.active ?? true, created_at: new Date().toISOString(), password_hash };
    rows.push(user);
    return user;
  });
}

export async function updateUser(id: string, patch: Partial<Omit<StoredUser, "id" | "email" | "created_at">> & { password?: string }) {
  const password_hash = patch.password ? await hashPassword(patch.password) : undefined;
  return mutate("users", (rows) => {
    const u = rows.find((x) => x.id === id);
    if (!u) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = patch;
    Object.assign(u, rest, password_hash ? { password_hash } : {});
    return u;
  });
}

export async function deleteUser(id: string) {
  const ok = await mutate("users", (rows) => {
    const i = rows.findIndex((u) => u.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  });
  if (ok) {
    // 설계 §9: 삭제 요청 시 학습·녹음 기록도 함께 삭제
    await mutate("progress", (rows) => { const i = rows.findIndex((p) => p.user_id === id); if (i >= 0) rows.splice(i, 1); });
    await mutate("recordings", (rows) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_id === id) rows.splice(i, 1); });
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 진도 / 녹음 결과
// ---------------------------------------------------------------------------


export async function getProgress(user_id: string): Promise<UserProgress> {
  return (await readTable("progress")).find((p) => p.user_id === user_id) ?? emptyProgress(user_id);
}
export async function listProgress(): Promise<UserProgress[]> {
  return readTable("progress");
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function updateProgress(user_id: string, fn: (p: UserProgress) => void) {
  const result = await mutate("progress", (rows) => {
    let p = rows.find((x) => x.user_id === user_id);
    if (!p) { p = emptyProgress(user_id); rows.push(p); }
    fn(p);
    if (!p.active_days.includes(today())) p.active_days.push(today());
    return p;
  });
  await mutate("users", (rows) => { const u = rows.find((x) => x.id === user_id); if (u) u.last_active_at = new Date().toISOString(); });
  return result;
}

export async function addRecording(rec: Omit<RecordingResult, "id" | "created_at">) {
  return mutate("recordings", (rows) => {
    const full: RecordingResult = { ...rec, id: randomUUID(), created_at: new Date().toISOString() };
    rows.push(full);
    // 파일이 끝없이 커지지 않도록 사용자당 최근 200건만 보관
    const mine = rows.filter((r) => r.user_id === rec.user_id);
    if (mine.length > 200) {
      const drop = new Set(mine.slice(0, mine.length - 200).map((r) => r.id));
      for (let i = rows.length - 1; i >= 0; i--) if (drop.has(rows[i].id)) rows.splice(i, 1);
    }
    return full;
  });
}

export async function listRecordings(user_id?: string): Promise<RecordingResult[]> {
  const rows = await readTable("recordings");
  return user_id ? rows.filter((r) => r.user_id === user_id) : rows;
}

// ---------------------------------------------------------------------------
// 최초 실행 시드: 관리자·데모 학습자 계정 + 관리자 화면 시연용 샘플 학습자
// ---------------------------------------------------------------------------
let seeding: Promise<void> | null = null;
function ensureSeeded() {
  if (!seeding) seeding = seed().catch((e) => { seeding = null; throw e; });
  return seeding;
}

async function seed() {
  const usersFile = path.join(/*turbopackIgnore: true*/ DATA_DIR, "users.json");
  try {
    await fs.access(usersFile);
    return;
  } catch { /* 없으면 생성 */ }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const { users, progress, recordings } = await buildSeed({ hash: hashPassword, uuid: randomUUID, adminPassword: process.env.ADMIN_PASSWORD || "admin1234!" });
  await writeTable("users", users);
  await writeTable("progress", progress);
  await writeTable("recordings", recordings);
}
