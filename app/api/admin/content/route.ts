import { NextResponse } from "next/server";
import { apiAdmin, jsonError, readJson } from "@/lib/api";
import { getCourse, getCourses, saveCourse } from "@/lib/content";
import type { Course } from "@/lib/types";

export async function GET(req: Request) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  return NextResponse.json({ courses: await getCourses({ includeUnpublished: true }) });
}

/** 새 코스 생성 */
export async function POST(req: Request) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const course = await readJson<Course>(req);
  if (!course) return jsonError(400, "잘못된 요청입니다.");
  if (await getCourse(course.id)) return jsonError(409, `코스 ID '${course.id}'가 이미 있습니다.`);
  const errors = await saveCourse(course);
  if (errors.length) return jsonError(422, "저장할 수 없습니다.", { errors });
  return NextResponse.json({ course });
}
