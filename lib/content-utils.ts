// 콘텐츠 관련 순수 함수 (서버·브라우저 체험판 공용, 파일시스템 접근 없음)
import { learnHref } from "./routes";
import type { Course, Situation, Unit } from "./types";

export function sortCourses(courses: Course[], includeUnpublished = false): Course[] {
  return courses
    .filter((c) => includeUnpublished || c.published)
    .map((c) => ({ ...c, units: [...c.units].sort((a, b) => a.order - b.order) }))
    .sort((a, b) => a.order - b.order);
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
export function findSituationBundle(courses: Course[], unitId: string, situationId: string): SituationBundle | null {
  for (const course of courses) {
    const ui = course.units.findIndex((u) => u.id === unitId);
    if (ui < 0) continue;
    const unit = course.units[ui];
    const si = unit.situations.findIndex((s) => s.id === situationId);
    if (si < 0) return null;
    // 다음 학습 위치: 같은 유닛의 다음 상황 → 다음 유닛의 첫 상황
    let nextHref: string | null = null;
    if (si + 1 < unit.situations.length) nextHref = learnHref(unit.id, unit.situations[si + 1].id);
    else {
      const nextUnit = course.units.slice(ui + 1).find((u) => u.situations.length > 0);
      if (nextUnit) nextHref = learnHref(nextUnit.id, nextUnit.situations[0].id);
    }
    return { course, unit, situation: unit.situations[si], unitIndex: ui + 1, unitCount: course.units.length, nextHref };
  }
  return null;
}

/** situationId → 소속 코스/유닛 조회 */
export function findSituation(courses: Course[], situationId: string) {
  for (const course of courses)
    for (const unit of course.units)
      for (const situation of unit.situations)
        if (situation.id === situationId) return { course, unit, situation };
  return null;
}

export function countSituations(courses: Course[]): number {
  return courses.reduce((n, c) => n + c.units.reduce((m, u) => m + u.situations.length, 0), 0);
}

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

/** 다른 코스와의 유닛/상황 ID 충돌 검사 (학습 화면 주소에 쓰이므로 전역 유일해야 함) */
export function crossCourseConflicts(course: Course, all: Course[]): string[] {
  const taken = new Set<string>();
  for (const o of all.filter((c) => c.id !== course.id)) for (const u of o.units) { taken.add(u.id); for (const s of u.situations) taken.add(s.id); }
  const errors: string[] = [];
  for (const u of course.units) {
    if (taken.has(u.id)) errors.push(`유닛 ID '${u.id}'가 다른 코스에서 이미 사용 중입니다.`);
    for (const s of u.situations) if (taken.has(s.id)) errors.push(`상황 ID '${s.id}'가 다른 코스에서 이미 사용 중입니다.`);
  }
  return errors;
}
