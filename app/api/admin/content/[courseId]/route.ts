import { NextResponse } from "next/server";
import { apiAdmin, jsonError, readJson } from "@/lib/api";
import { deleteCourse, getCourse, saveCourse } from "@/lib/content";
import type { Course } from "@/lib/types";

type Ctx = { params: Promise<{ courseId: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const { courseId } = await params;
  const course = await readJson<Course>(req);
  if (!course) return jsonError(400, "잘못된 요청입니다.");
  if (course.id !== courseId) return jsonError(400, "코스 ID는 변경할 수 없습니다.");
  if (!(await getCourse(courseId))) return jsonError(404, "코스를 찾을 수 없습니다.");
  const errors = await saveCourse(course);
  if (errors.length) return jsonError(422, "저장할 수 없습니다.", { errors });
  return NextResponse.json({ course });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const { courseId } = await params;
  return (await deleteCourse(courseId)) ? NextResponse.json({ ok: true }) : jsonError(404, "코스를 찾을 수 없습니다.");
}
