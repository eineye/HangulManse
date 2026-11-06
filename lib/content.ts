import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "./paths";
import { crossCourseConflicts, findSituation, findSituationBundle, sortCourses, validateCourse } from "./content-utils";
import type { Course } from "./types";

export { countSituations, validateCourse, type SituationBundle } from "./content-utils";

// 콘텐츠는 content/*.json 에 코스 단위로 저장되고, 매 요청마다 다시 읽는다.
// → 관리자 화면에서 저장하거나 파일을 직접 고치면 재빌드 없이 다음 요청부터 반영된다.

async function listCourseFiles(): Promise<string[]> {
  const entries = await fs.readdir(CONTENT_DIR);
  return entries.filter((f) => f.endsWith(".json")).sort();
}

async function readCourseFile(file: string): Promise<Course> {
  const raw = await fs.readFile(path.join(/*turbopackIgnore: true*/ CONTENT_DIR, file), "utf8");
  return JSON.parse(raw) as Course;
}

export async function getCourses(opts: { includeUnpublished?: boolean } = {}): Promise<Course[]> {
  const files = await listCourseFiles();
  return sortCourses(await Promise.all(files.map(readCourseFile)), opts.includeUnpublished);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const courses = await getCourses({ includeUnpublished: true });
  return courses.find((c) => c.id === courseId) ?? null;
}

export async function getSituationBundle(unitId: string, situationId: string) {
  return findSituationBundle(await getCourses(), unitId, situationId);
}

/** situationId → 소속 코스/유닛 조회 (진도 기록 검증용) */
export async function locateSituation(situationId: string) {
  return findSituation(await getCourses({ includeUnpublished: true }), situationId);
}

// ---------------------------------------------------------------------------
// 관리자 편집
// ---------------------------------------------------------------------------

async function fileForCourse(courseId: string): Promise<string | null> {
  for (const f of await listCourseFiles()) {
    const c = await readCourseFile(f);
    if (c.id === courseId) return f;
  }
  return null;
}

export async function saveCourse(course: Course): Promise<string[]> {
  const errors = [...validateCourse(course), ...crossCourseConflicts(course, await getCourses({ includeUnpublished: true }))];
  if (errors.length) return errors;
  const file = (await fileForCourse(course.id)) ?? `${String(course.order ?? 9).padStart(2, "0")}-${course.id}.json`;
  const target = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(course, null, 2) + "\n", "utf8");
  await fs.rename(tmp, target);
  return [];
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const file = await fileForCourse(courseId);
  if (!file) return false;
  await fs.unlink(path.join(/*turbopackIgnore: true*/ CONTENT_DIR, file));
  return true;
}
