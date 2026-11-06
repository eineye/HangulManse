import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Course, Situation, Unit } from "./types";

// 콘텐츠는 content/*.json 에 코스 단위로 저장되고, 매 요청마다 다시 읽는다.
// → 관리자 화면에서 저장하거나 파일을 직접 고치면 재빌드 없이 다음 요청부터 반영된다.
const CONTENT_DIR = path.join(process.cwd(), "content");

async function listCourseFiles(): Promise<string[]> {
  const entries = await fs.readdir(CONTENT_DIR);
  return entries.filter((f) => f.endsWith(".json")).sort();
}

async function readCourseFile(file: string): Promise<Course> {
  const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
  return JSON.parse(raw) as Course;
}

export async function getCourses(opts: { includeUnpublished?: boolean } = {}): Promise<Course[]> {
  const files = await listCourseFiles();
  const courses = await Promise.all(files.map(readCourseFile));
  return courses
    .filter((c) => opts.includeUnpublished || c.published)
    .map((c) => ({ ...c, units: [...c.units].sort((a, b) => a.order - b.order) }))
    .sort((a, b) => a.order - b.order);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const courses = await getCourses({ includeUnpublished: true });
  return courses.find((c) => c.id === courseId) ?? null;
}

export interface SituationBundle {
  course: Course;
  unit: Unit;
  situation: Situation;
  unitIndex: number; // 코스 내 유닛 순번(1부터)
  unitCount: number;
  nextHref: string | null;
}

/** 화면 1회 렌더용 번들 (설계 §4.1 GET /api/units/:unitId/situations/:situationId) */
export async function getSituationBundle(unitId: string, situationId: string): Promise<SituationBundle | null> {
  const courses = await getCourses();
  for (const course of courses) {
    const ui = course.units.findIndex((u) => u.id === unitId);
    if (ui < 0) continue;
    const unit = course.units[ui];
    const si = unit.situations.findIndex((s) => s.id === situationId);
    if (si < 0) return null;
    // 다음 학습 위치: 같은 유닛의 다음 상황 → 다음 유닛의 첫 상황
    let nextHref: string | null = null;
    if (si + 1 < unit.situations.length) nextHref = `/learn/${unit.id}/${unit.situations[si + 1].id}`;
    else {
      const nextUnit = course.units.slice(ui + 1).find((u) => u.situations.length > 0);
      if (nextUnit) nextHref = `/learn/${nextUnit.id}/${nextUnit.situations[0].id}`;
    }
    return { course, unit, situation: unit.situations[si], unitIndex: ui + 1, unitCount: course.units.length, nextHref };
  }
  return null;
}

/** situationId → 소속 코스/유닛 조회 (진도 기록 검증용) */
export async function locateSituation(situationId: string) {
  const courses = await getCourses({ includeUnpublished: true });
  for (const course of courses)
    for (const unit of course.units)
      for (const situation of unit.situations)
        if (situation.id === situationId) return { course, unit, situation };
  return null;
}

// ---------------------------------------------------------------------------
// 관리자 편집
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

function req(obj: Record<string, unknown>, key: string, where: string, errors: string[]) {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) errors.push(`${where}: '${key}' 값이 비어 있습니다.`);
}

/** 저장 전 구조 검증. 문제 목록을 반환(빈 배열이면 통과). */
export function validateCourse(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return ["코스 데이터 형식이 올바르지 않습니다."];
  const c = input as Record<string, unknown>;
  if (typeof c.id !== "string" || !ID_RE.test(c.id)) errors.push("코스 ID는 영문 소문자·숫자·하이픈만 사용할 수 있습니다.");
  for (const k of ["title_ko", "title_en"]) req(c, k, "코스", errors);
  if (!Array.isArray(c.units)) return [...errors, "units 배열이 없습니다."];
  const ids = new Set<string>();
  const dup = (id: unknown, where: string) => {
    if (typeof id !== "string" || !ID_RE.test(id)) errors.push(`${where}: ID '${String(id)}' 형식이 올바르지 않습니다.`);
    else if (ids.has(id)) errors.push(`${where}: ID '${id}'가 중복됩니다.`);
    else ids.add(id);
  };
  (c.units as Record<string, unknown>[]).forEach((u, ui) => {
    const uw = `유닛 ${ui + 1}`;
    dup(u.id, uw);
    for (const k of ["title_ko", "title_en"]) req(u, k, uw, errors);
    if (!Array.isArray(u.situations)) return errors.push(`${uw}: situations 배열이 없습니다.`);
    (u.situations as Record<string, unknown>[]).forEach((s, si) => {
      const sw = `${uw} > 상황 ${si + 1}`;
      dup(s.id, sw);
      for (const k of ["title_ko", "title_en", "description_ko", "description_en"]) req(s, k, sw, errors);
      if (!Array.isArray(s.roles) || s.roles.length < 2) errors.push(`${sw}: 역할극 역할을 2개 이상 지정하세요.`);
      if (!Array.isArray(s.terms)) errors.push(`${sw}: terms 배열이 없습니다.`);
      else (s.terms as Record<string, unknown>[]).forEach((t, ti) => req(t, "hangul", `${sw} > 용어 ${ti + 1}`, errors));
      if (!Array.isArray(s.sentences) || s.sentences.length === 0) errors.push(`${sw}: 따라 읽기 문장이 최소 1개 필요합니다.`);
      else
        (s.sentences as Record<string, unknown>[]).forEach((t, ti) => {
          dup(t.id, `${sw} > 문장 ${ti + 1}`);
          req(t, "text_ko", `${sw} > 문장 ${ti + 1}`, errors);
        });
    });
  });
  return errors;
}

async function fileForCourse(courseId: string): Promise<string | null> {
  for (const f of await listCourseFiles()) {
    const c = await readCourseFile(f);
    if (c.id === courseId) return f;
  }
  return null;
}

/** 다른 코스와의 유닛/상황 ID 충돌 검사 (URL이 /learn/:unitId/:situationId 이므로 전역 유일해야 함) */
async function crossCourseConflicts(course: Course): Promise<string[]> {
  const others = (await getCourses({ includeUnpublished: true })).filter((c) => c.id !== course.id);
  const taken = new Set<string>();
  for (const o of others) for (const u of o.units) { taken.add(u.id); for (const s of u.situations) taken.add(s.id); }
  const errors: string[] = [];
  for (const u of course.units) {
    if (taken.has(u.id)) errors.push(`유닛 ID '${u.id}'가 다른 코스에서 이미 사용 중입니다.`);
    for (const s of u.situations) if (taken.has(s.id)) errors.push(`상황 ID '${s.id}'가 다른 코스에서 이미 사용 중입니다.`);
  }
  return errors;
}

export async function saveCourse(course: Course): Promise<string[]> {
  const errors = [...validateCourse(course), ...(await crossCourseConflicts(course))];
  if (errors.length) return errors;
  const file = (await fileForCourse(course.id)) ?? `${String(course.order ?? 9).padStart(2, "0")}-${course.id}.json`;
  const target = path.join(CONTENT_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(course, null, 2) + "\n", "utf8");
  await fs.rename(tmp, target);
  return [];
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const file = await fileForCourse(courseId);
  if (!file) return false;
  await fs.unlink(path.join(CONTENT_DIR, file));
  return true;
}

export function countSituations(courses: Course[]): number {
  return courses.reduce((n, c) => n + c.units.reduce((m, u) => m + u.situations.length, 0), 0);
}
