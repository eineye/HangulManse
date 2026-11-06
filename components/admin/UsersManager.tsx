"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NATIVE_LANGUAGES, languageName } from "@/lib/languages";
import type { User } from "@/lib/types";
import { fmtDate, relTime } from "./ui";

const blank = { name: "", email: "", password: "", role: "learner", nationality: "", native_language: "vi", institution: "", level: "입문" };

export default function UsersManager({ users, meId, focus }: { users: User[]; meId: string; focus: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(focus);
  const [q, setQ] = useState("");

  useEffect(() => { if (focus) document.getElementById(`u-${focus}`)?.scrollIntoView({ block: "center" }); }, [focus]);

  async function call(url: string, method: string, body?: unknown, okText = "저장했습니다.") {
    setBusy(url + method);
    setMsg(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: d.error ?? "오류가 발생했습니다." });
    if (r.ok) router.refresh();
    return r.ok;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/admin/users", "POST", form, `${form.name} 계정을 만들었습니다.`)) { setForm(blank); setShowForm(false); }
  }

  async function resetPassword(u: User) {
    const pw = prompt(`${u.name}의 새 비밀번호 (8자 이상)`);
    if (!pw) return;
    await call(`/api/admin/users/${u.id}`, "PATCH", { password: pw }, "비밀번호를 변경했습니다.");
  }

  async function remove(u: User) {
    if (!confirm(`${u.name}(${u.email}) 계정과 모든 학습·녹음 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await call(`/api/admin/users/${u.id}`, "DELETE", undefined, "삭제했습니다.");
  }

  async function removeSamples() {
    const samples = users.filter((u) => u.sample);
    if (!samples.length || !confirm(`샘플 학습자 ${samples.length}명을 모두 삭제할까요?`)) return;
    for (const u of samples) await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    setMsg({ ok: true, text: "샘플 학습자를 삭제했습니다." });
    router.refresh();
  }

  const k = q.trim().toLowerCase();
  const shown = users.filter((u) => !k || [u.name, u.email, u.institution, u.nationality].some((v) => v?.toLowerCase().includes(k)));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="이름·이메일·기관 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="sub">{shown.length}개 계정</span>
        <div className="ml-auto flex gap-2">
          {users.some((u) => u.sample) && <button className="btn-danger" onClick={removeSamples}>샘플 학습자 삭제</button>}
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "닫기" : "+ 새 계정"}</button>
        </div>
      </div>

      {msg && <p role="status" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-forest-50 text-forest-900" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}

      {showForm && (
        <form onSubmit={create} className="card mb-4 grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div><label className="label">이름 *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">이메일 *</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">초기 비밀번호 * (8자 이상)</label><input className="input" type="text" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">권한</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="learner">학습자</option><option value="admin">관리자</option></select></div>
          <div><label className="label">국적</label><input className="input" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
          <div><label className="label">모국어</label>
            <select className="input" value={form.native_language} onChange={(e) => setForm({ ...form, native_language: e.target.value })}>{NATIVE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.ko}</option>)}</select></div>
          <div><label className="label">소속 기관</label><input className="input" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
          <div><label className="label">수준</label>
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{["입문", "초급", "중급", "고급"].map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="sm:col-span-2 xl:col-span-4"><button className="btn-primary" disabled={!!busy}>계정 만들기</button></div>
        </form>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-paper/60 text-left text-xs text-black/55">
            <tr><th className="px-4 py-2.5 font-medium">계정</th><th className="px-3 py-2.5 font-medium">권한</th><th className="px-3 py-2.5 font-medium">국적 · 모국어 · 수준</th><th className="px-3 py-2.5 font-medium">기관</th><th className="px-3 py-2.5 font-medium">상태</th><th className="px-3 py-2.5 font-medium">가입 · 최근 활동</th><th className="px-4 py-2.5 text-right font-medium">관리</th></tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const isMe = u.id === meId;
              return (
                <tr key={u.id} id={`u-${u.id}`} className={`border-t border-black/5 align-top ${focus === u.id ? "bg-accent/10" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{u.name} {isMe && <span className="chip ml-1">나</span>} {u.sample && <span className="chip ml-1 bg-black/5 text-black/50">샘플</span>}</div>
                    <div className="text-xs text-black/45">{u.email}</div>
                    {u.role === "learner" && <Link href={`/admin/learners/${u.id}`} className="text-xs text-forest-700 underline">진도 보기</Link>}
                  </td>
                  <td className="px-3 py-3">
                    <select className="input w-auto py-1 text-xs" value={u.role} disabled={isMe || !!busy} onChange={(e) => call(`/api/admin/users/${u.id}`, "PATCH", { role: e.target.value }, "권한을 변경했습니다.")}>
                      <option value="learner">학습자</option><option value="admin">관리자</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    {editing === u.id ? (
                      <EditInline u={u} onSave={async (p) => { if (await call(`/api/admin/users/${u.id}`, "PATCH", p)) setEditing(null); }} onCancel={() => setEditing(null)} />
                    ) : (
                      <button className="text-left hover:underline" onClick={() => setEditing(u.id)} title="클릭해서 수정">
                        {u.nationality || "-"} · {languageName(u.native_language)} · {u.level}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-black/70">{u.institution || "-"}</td>
                  <td className="px-3 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input type="checkbox" checked={u.active} disabled={isMe || !!busy} onChange={(e) => call(`/api/admin/users/${u.id}`, "PATCH", { active: e.target.checked }, e.target.checked ? "활성화했습니다." : "비활성화했습니다.")} />
                      {u.active ? "활성" : <span className="text-danger">비활성</span>}
                    </label>
                  </td>
                  <td className="px-3 py-3 text-xs text-black/55">{fmtDate(u.created_at)}<div>{relTime(u.last_active_at)}</div></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => resetPassword(u)}>비밀번호</button>
                      {!isMe && <button className="btn-danger px-2.5 py-1 text-xs" onClick={() => remove(u)}>삭제</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

function EditInline({ u, onSave, onCancel }: { u: User; onSave: (p: Partial<User>) => void; onCancel: () => void }) {
  const [p, setP] = useState({ name: u.name, nationality: u.nationality, native_language: u.native_language, level: u.level, institution: u.institution });
  return (
    <div className="grid w-64 gap-1.5">
      <input className="input py-1 text-xs" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="이름" />
      <input className="input py-1 text-xs" value={p.nationality} onChange={(e) => setP({ ...p, nationality: e.target.value })} placeholder="국적" />
      <select className="input py-1 text-xs" value={p.native_language} onChange={(e) => setP({ ...p, native_language: e.target.value })}>{NATIVE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.ko}</option>)}</select>
      <select className="input py-1 text-xs" value={p.level} onChange={(e) => setP({ ...p, level: e.target.value })}>{["-", "입문", "초급", "중급", "고급"].map((l) => <option key={l}>{l}</option>)}</select>
      <input className="input py-1 text-xs" value={p.institution} onChange={(e) => setP({ ...p, institution: e.target.value })} placeholder="기관" />
      <div className="flex gap-1.5"><button className="btn-primary px-2.5 py-1 text-xs" onClick={() => onSave(p)}>저장</button><button className="btn-ghost px-2.5 py-1 text-xs" onClick={onCancel}>취소</button></div>
    </div>
  );
}
