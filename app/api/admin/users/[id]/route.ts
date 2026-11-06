import { NextResponse } from "next/server";
import { apiAdmin, jsonError, readJson, str } from "@/lib/api";
import { deleteUser, findUserById, listUsers, toPublicUser, updateUser } from "@/lib/db";
import { NATIVE_LANGUAGES } from "@/lib/languages";
import type { StoredUser } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function wouldRemoveLastAdmin(target: StoredUser) {
  if (target.role !== "admin" || !target.active) return false;
  const admins = (await listUsers()).filter((u) => u.role === "admin" && u.active);
  return admins.length <= 1;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  const target = await findUserById(id);
  if (!target) return jsonError(404, "사용자를 찾을 수 없습니다.");
  const b = await readJson(req);
  if (!b) return jsonError(400, "잘못된 요청입니다.");

  const patch: Partial<StoredUser> & { password?: string } = {};
  for (const k of ["name", "nationality", "institution", "level"] as const) if (typeof b[k] === "string") patch[k] = str(b[k], 60);
  if (typeof b.native_language === "string" && NATIVE_LANGUAGES.some((l) => l.code === b.native_language)) patch.native_language = b.native_language;
  if (b.role === "admin" || b.role === "learner") patch.role = b.role;
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.password === "string" && b.password) {
    if (b.password.length < 8) return jsonError(400, "비밀번호는 8자 이상이어야 합니다.");
    patch.password = b.password;
  }
  const demotes = (patch.role && patch.role !== "admin") || patch.active === false;
  if (demotes && (await wouldRemoveLastAdmin(target))) return jsonError(400, "마지막 관리자 계정은 권한을 내리거나 비활성화할 수 없습니다.");
  if (demotes && id === g.user.id) return jsonError(400, "자기 자신의 관리자 권한은 내리거나 비활성화할 수 없습니다.");

  const u = await updateUser(id, patch);
  return u ? NextResponse.json({ user: toPublicUser(u) }) : jsonError(404, "사용자를 찾을 수 없습니다.");
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await apiAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  if (id === g.user.id) return jsonError(400, "자기 자신은 삭제할 수 없습니다.");
  const target = await findUserById(id);
  if (!target) return jsonError(404, "사용자를 찾을 수 없습니다.");
  if (await wouldRemoveLastAdmin(target)) return jsonError(400, "마지막 관리자 계정은 삭제할 수 없습니다.");
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
