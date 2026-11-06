"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, Sentence, Situation, Term, Unit } from "@/lib/types";
import { speak } from "@/lib/speech";

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function newSituation(): Situation {
  return {
    id: uid("s"), title_ko: "새 상황", title_en: "New situation", description_ko: "", description_en: "", goal_ko: "", goal_en: "",
    place_tag: "", formality_tag: "존댓말", difficulty_tag: "초급", image: "💬", roles: ["학습자", "상대방"],
    terms: [], sentences: [{ id: uid("st"), text_ko: "", text_en: "", romanization: "" }],
  };
}
function newUnit(order: number): Unit {
  return { id: uid("u"), title_ko: "새 유닛", title_en: "New unit", order, level: "초급", situations: [] };
}

type Sel = { unit: number; situation: number | null } | null;

export default function ContentEditor({ initial }: { initial: Course[] }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>(() => clone(initial));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(initial));
  const [ci, setCi] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set()); // 아직 서버에 없는 새 코스

  const course = courses[ci];
  const savedCourses = useMemo(() => JSON.parse(saved) as Course[], [saved]);
  const dirty = (c: Course) => newIds.has(c.id) || JSON.stringify(c) !== JSON.stringify(savedCourses.find((x) => x.id === c.id));
  const anyDirty = courses.some(dirty);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (anyDirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [anyDirty]);

  /** 현재 코스를 불변 방식으로 수정 */
  const edit = (fn: (c: Course) => void) => setCourses((cs) => cs.map((c, i) => { if (i !== ci) return c; const n = clone(c); fn(n); return n; }));

  async function save() {
    if (!course) return;
    setBusy(true); setErrors([]); setMsg(null);
    const isNew = newIds.has(course.id);
    const ordered = { ...course, units: course.units.map((u, i) => ({ ...u, order: i + 1 })) };
    const r = await fetch(isNew ? "/api/admin/content" : `/api/admin/content/${course.id}`, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ordered) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErrors(d.errors ?? [d.error ?? "저장에 실패했습니다."]); return; }
    setCourses((cs) => cs.map((c, i) => (i === ci ? ordered : c)));
    const next = JSON.parse(saved) as Course[];
    const idx = next.findIndex((c) => c.id === ordered.id);
    if (idx >= 0) next[idx] = ordered; else next.push(ordered);
    setSaved(JSON.stringify(next));
    setNewIds((s) => { const n = new Set(s); n.delete(ordered.id); return n; });
    setMsg("저장했습니다. 학습 화면에 바로 반영됩니다.");
    router.refresh();
  }

  function revert() {
    if (!course) return;
    if (newIds.has(course.id)) { removeLocal(); return; }
    const orig = savedCourses.find((c) => c.id === course.id);
    if (orig) setCourses((cs) => cs.map((c, i) => (i === ci ? clone(orig) : c)));
    setErrors([]);
  }

  function removeLocal() {
    setCourses((cs) => cs.filter((_, i) => i !== ci));
    setCi(0); setSel(null);
  }

  async function deleteCourse() {
    if (!course || !confirm(`'${course.title_ko}' 코스를 삭제할까요? 콘텐츠 파일이 삭제되며, 학습자의 기존 진도 기록은 남지만 화면에서 볼 수 없게 됩니다.`)) return;
    if (newIds.has(course.id)) return removeLocal();
    const r = await fetch(`/api/admin/content/${course.id}`, { method: "DELETE" });
    if (r.ok) {
      setSaved(JSON.stringify(savedCourses.filter((c) => c.id !== course.id)));
      removeLocal();
      setMsg("코스를 삭제했습니다.");
      router.refresh();
    }
  }

  function addCourse() {
    const id = prompt("새 코스 ID (영문 소문자·숫자·하이픈, 예: work)");
    if (!id) return;
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) return alert("ID 형식이 올바르지 않습니다.");
    if (courses.some((c) => c.id === id)) return alert("이미 있는 ID입니다.");
    const c: Course = { id, title_ko: "새 코스", title_en: "New course", description_ko: "", description_en: "", icon: "📘", order: courses.length + 1, published: false, units: [] };
    setCourses((cs) => [...cs, c]);
    setNewIds((s) => new Set(s).add(id));
    setCi(courses.length); setSel(null);
  }

  function exportJson() {
    if (!course) return;
    const blob = new Blob([JSON.stringify(course, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${course.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const unit = sel && course ? course.units[sel.unit] : null;
  const situation = sel && sel.situation !== null && unit ? unit.situations[sel.situation] : null;

  return (
    <div>
      {/* 코스 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {courses.map((c, i) => (
          <button key={c.id} onClick={() => { setCi(i); setSel(null); setErrors([]); setMsg(null); }} className={`btn ${i === ci ? "bg-forest-900 text-paper" : "bg-white text-forest-900 ring-1 ring-black/10"}`}>
            <span>{c.icon}</span>{c.title_ko}{!c.published && <span className="text-[10px] opacity-70">(비공개)</span>}{dirty(c) && <span className="size-1.5 rounded-full bg-accent" title="저장 안 됨" />}
          </button>
        ))}
        <button className="btn-ghost" onClick={addCourse}>+ 코스</button>
      </div>

      {!course ? <p className="card p-8 text-center text-sm">코스가 없습니다. ‘+ 코스’로 추가하세요.</p> : (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          {/* 트리 */}
          <aside className="card h-fit p-3 xl:sticky xl:top-4">
            <button onClick={() => setSel(null)} className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${sel === null ? "bg-forest-50 text-forest-900" : "hover:bg-black/5"}`}>⚙️ 코스 정보</button>
            {course.units.map((u, ui) => (
              <div key={u.id} className="mb-1">
                <div className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${sel?.unit === ui && sel.situation === null ? "bg-forest-50 font-bold" : "hover:bg-black/5"}`}>
                  <button className="flex-1 truncate text-left" onClick={() => setSel({ unit: ui, situation: null })}>📁 {ui + 1}. {u.title_ko}</button>
                  <button className="px-1 text-xs opacity-40 hover:opacity-100" title="위로" disabled={ui === 0} onClick={() => { edit((c) => { [c.units[ui - 1], c.units[ui]] = [c.units[ui], c.units[ui - 1]]; }); setSel({ unit: ui - 1, situation: null }); }}>▲</button>
                  <button className="px-1 text-xs opacity-40 hover:opacity-100" title="아래로" disabled={ui === course.units.length - 1} onClick={() => { edit((c) => { [c.units[ui + 1], c.units[ui]] = [c.units[ui], c.units[ui + 1]]; }); setSel({ unit: ui + 1, situation: null }); }}>▼</button>
                </div>
                <div className="ml-4 border-l border-black/10 pl-2">
                  {u.situations.map((s, si) => (
                    <button key={s.id} onClick={() => setSel({ unit: ui, situation: si })} className={`block w-full truncate rounded-lg px-2 py-1 text-left text-sm ${sel?.unit === ui && sel.situation === si ? "bg-forest-900 text-paper" : "text-black/75 hover:bg-black/5"}`}>
                      {s.image} {s.title_ko}
                    </button>
                  ))}
                  <button className="block px-2 py-1 text-xs text-forest-700 hover:underline" onClick={() => { edit((c) => { c.units[ui].situations.push(newSituation()); }); setSel({ unit: ui, situation: u.situations.length }); }}>+ 상황 추가</button>
                </div>
              </div>
            ))}
            <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-forest-700 hover:bg-black/5" onClick={() => { edit((c) => { c.units.push(newUnit(c.units.length + 1)); }); setSel({ unit: course.units.length, situation: null }); }}>+ 유닛 추가</button>
          </aside>

          {/* 편집 패널 */}
          <div className="min-w-0 space-y-4">
            <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="text-sm">{dirty(course) ? <b className="text-accent">● 저장하지 않은 변경사항</b> : <span className="text-black/50">변경사항 없음</span>}</span>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost" onClick={exportJson}>JSON 내보내기</button>
                <button className="btn-ghost" onClick={revert} disabled={!dirty(course)}>되돌리기</button>
                <button className="btn-primary" onClick={save} disabled={busy || !dirty(course)}>{busy ? "저장 중…" : "저장"}</button>
              </div>
            </div>
            {msg && <p role="status" className="rounded-xl bg-forest-50 px-4 py-2.5 text-sm text-forest-900">{msg}</p>}
            {errors.length > 0 && (
              <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                <b>저장할 수 없습니다:</b>
                <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}

            {sel === null && (
              <section className="card space-y-4 p-5">
                <h2 className="font-bold">코스 정보</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="코스 ID (변경 불가)"><input className="input bg-black/5" value={course.id} readOnly /></Field>
                  <Field label="아이콘 (이모지/글자)"><input className="input" value={course.icon} onChange={(e) => edit((c) => { c.icon = e.target.value; })} /></Field>
                  <Field label="제목 (한국어)"><input className="input" value={course.title_ko} onChange={(e) => edit((c) => { c.title_ko = e.target.value; })} /></Field>
                  <Field label="Title (English)"><input className="input" value={course.title_en} onChange={(e) => edit((c) => { c.title_en = e.target.value; })} /></Field>
                  <Field label="설명 (한국어)"><textarea className="input" rows={2} value={course.description_ko} onChange={(e) => edit((c) => { c.description_ko = e.target.value; })} /></Field>
                  <Field label="Description (English)"><textarea className="input" rows={2} value={course.description_en} onChange={(e) => edit((c) => { c.description_en = e.target.value; })} /></Field>
                  <Field label="표시 순서"><input className="input" type="number" min={1} value={course.order} onChange={(e) => edit((c) => { c.order = Number(e.target.value) || 1; })} /></Field>
                  <Field label="공개 여부">
                    <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={course.published} onChange={(e) => edit((c) => { c.published = e.target.checked; })} /> 학습자에게 공개</label>
                  </Field>
                </div>
                <div className="flex justify-end border-t border-black/5 pt-4"><button className="btn-danger" onClick={deleteCourse}>코스 삭제</button></div>
              </section>
            )}

            {unit && sel && sel.situation === null && (
              <section className="card space-y-4 p-5">
                <h2 className="font-bold">유닛 정보</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="유닛 ID"><input className="input" value={unit.id} onChange={(e) => edit((c) => { c.units[sel.unit].id = e.target.value.trim(); })} /></Field>
                  <Field label="수준"><input className="input" value={unit.level} onChange={(e) => edit((c) => { c.units[sel.unit].level = e.target.value; })} /></Field>
                  <Field label="제목 (한국어)"><input className="input" value={unit.title_ko} onChange={(e) => edit((c) => { c.units[sel.unit].title_ko = e.target.value; })} /></Field>
                  <Field label="Title (English)"><input className="input" value={unit.title_en} onChange={(e) => edit((c) => { c.units[sel.unit].title_en = e.target.value; })} /></Field>
                </div>
                <p className="sub">⚠️ 이미 학습자가 있는 유닛·상황의 ID를 바꾸면 기존 진도와 연결이 끊깁니다.</p>
                <div className="flex justify-end border-t border-black/5 pt-4">
                  <button className="btn-danger" onClick={() => { if (confirm(`'${unit.title_ko}' 유닛과 포함된 상황 ${unit.situations.length}개를 삭제할까요?`)) { edit((c) => { c.units.splice(sel.unit, 1); }); setSel(null); } }}>유닛 삭제</button>
                </div>
              </section>
            )}

            {situation && sel && sel.situation !== null && (
              <SituationEditor
                key={`${sel.unit}-${sel.situation}`}
                s={situation}
                canUp={sel.situation > 0}
                canDown={sel.situation < unit!.situations.length - 1}
                onChange={(fn) => edit((c) => fn(c.units[sel.unit].situations[sel.situation!]))}
                onMove={(d) => { const to = sel.situation! + d; edit((c) => { const arr = c.units[sel.unit].situations; [arr[to], arr[sel.situation!]] = [arr[sel.situation!], arr[to]]; }); setSel({ unit: sel.unit, situation: to }); }}
                onDelete={() => { if (confirm(`'${situation.title_ko}' 상황을 삭제할까요?`)) { edit((c) => { c.units[sel.unit].situations.splice(sel.situation!, 1); }); setSel({ unit: sel.unit, situation: null }); } }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function SituationEditor({ s, onChange, onDelete, onMove, canUp, canDown }: { s: Situation; onChange: (fn: (s: Situation) => void) => void; onDelete: () => void; onMove: (d: -1 | 1) => void; canUp: boolean; canDown: boolean }) {
  const text = (k: keyof Situation, label: string, area = false) => (
    <Field label={label}>
      {area
        ? <textarea className="input" rows={2} value={s[k] as string} onChange={(e) => onChange((x) => { (x[k] as string) = e.target.value; })} />
        : <input className="input" value={s[k] as string} onChange={(e) => onChange((x) => { (x[k] as string) = e.target.value; })} />}
    </Field>
  );
  const setTerm = (i: number, k: keyof Term, v: string) => onChange((x) => { x.terms[i][k] = v; });
  const setSent = (i: number, k: keyof Sentence, v: string) => onChange((x) => { x.sentences[i][k] = v; });

  return (
    <>
      <section className="card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">상황 · 학습 목표</h2>
          <div className="ml-auto flex gap-1.5">
            <button className="btn-ghost px-2 py-1 text-xs" disabled={!canUp} onClick={() => onMove(-1)}>▲ 위로</button>
            <button className="btn-ghost px-2 py-1 text-xs" disabled={!canDown} onClick={() => onMove(1)}>▼ 아래로</button>
            <button className="btn-danger px-2 py-1 text-xs" onClick={onDelete}>삭제</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("id", "상황 ID")}
          {text("image", "이미지 (이모지 또는 URL)")}
          {text("title_ko", "제목 (한국어)")}
          {text("title_en", "Title (English)")}
          {text("description_ko", "상황 설명 (한국어)", true)}
          {text("description_en", "Description (English)", true)}
          {text("goal_ko", "학습 목표 (한국어)", true)}
          {text("goal_en", "Learning goal (English)", true)}
          {text("place_tag", "장소 태그")}
          <div className="grid grid-cols-2 gap-3">
            <Field label="말투">
              <select className="input" value={s.formality_tag} onChange={(e) => onChange((x) => { x.formality_tag = e.target.value as Situation["formality_tag"]; })}>{["존댓말", "반말", "혼합"].map((v) => <option key={v}>{v}</option>)}</select>
            </Field>
            <Field label="난이도">
              <select className="input" value={s.difficulty_tag} onChange={(e) => onChange((x) => { x.difficulty_tag = e.target.value as Situation["difficulty_tag"]; })}>{["초급", "중급", "고급"].map((v) => <option key={v}>{v}</option>)}</select>
            </Field>
          </div>
          <Field label="역할극: 학습자 역할">
            <input className="input" value={s.roles[0] ?? ""} onChange={(e) => onChange((x) => { x.roles[0] = e.target.value; })} />
          </Field>
          <Field label="역할극: AI 아바타 역할">
            <input className="input" value={s.roles[1] ?? ""} onChange={(e) => onChange((x) => { x.roles[1] = e.target.value; })} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center"><h2 className="font-bold">필수 생활 용어 <span className="sub font-normal">{s.terms.length}개 · 4개 권장</span></h2>
          <button className="btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={() => onChange((x) => { x.terms.push({ id: uid("t"), hangul: "", romanization: "", gloss_en: "", category: "" }); })}>+ 용어</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-black/50"><tr><th className="pb-1 font-medium">한글</th><th className="pb-1 font-medium">로마자 발음</th><th className="pb-1 font-medium">영어 뜻</th><th className="pb-1 font-medium">분류</th><th /></tr></thead>
            <tbody>
              {s.terms.map((t, i) => (
                <tr key={t.id}>
                  <td className="py-1 pr-1.5"><input className="input py-1.5" value={t.hangul} onChange={(e) => setTerm(i, "hangul", e.target.value)} /></td>
                  <td className="py-1 pr-1.5"><input className="input py-1.5" value={t.romanization} onChange={(e) => setTerm(i, "romanization", e.target.value)} /></td>
                  <td className="py-1 pr-1.5"><input className="input py-1.5" value={t.gloss_en} onChange={(e) => setTerm(i, "gloss_en", e.target.value)} /></td>
                  <td className="py-1 pr-1.5"><input className="input w-24 py-1.5" value={t.category} onChange={(e) => setTerm(i, "category", e.target.value)} /></td>
                  <td className="whitespace-nowrap py-1">
                    <button className="px-1.5" title="발음 듣기" onClick={() => speak(t.hangul)}>🔊</button>
                    <button className="px-1.5 text-danger" title="삭제" onClick={() => onChange((x) => { x.terms.splice(i, 1); })}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center"><h2 className="font-bold">따라 읽기 문장 <span className="sub font-normal">{s.sentences.length}개</span></h2>
          <button className="btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={() => onChange((x) => { x.sentences.push({ id: uid("st"), text_ko: "", text_en: "", romanization: "" }); })}>+ 문장</button></div>
        <div className="space-y-2">
          {s.sentences.map((t, i) => (
            <div key={t.id} className="grid gap-1.5 rounded-xl bg-paper p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input className="input" placeholder="한국어 문장" value={t.text_ko} onChange={(e) => setSent(i, "text_ko", e.target.value)} />
              <input className="input" placeholder="English" value={t.text_en} onChange={(e) => setSent(i, "text_en", e.target.value)} />
              <div className="flex items-center gap-0.5 sm:row-span-2">
                <button className="px-1.5" disabled={i === 0} title="위로" onClick={() => onChange((x) => { [x.sentences[i - 1], x.sentences[i]] = [x.sentences[i], x.sentences[i - 1]]; })}>▲</button>
                <button className="px-1.5" disabled={i === s.sentences.length - 1} title="아래로" onClick={() => onChange((x) => { [x.sentences[i + 1], x.sentences[i]] = [x.sentences[i], x.sentences[i + 1]]; })}>▼</button>
                <button className="px-1.5" title="발음 듣기" onClick={() => speak(t.text_ko)}>🔊</button>
                <button className="px-1.5 text-danger" title="삭제" onClick={() => onChange((x) => { x.sentences.splice(i, 1); })}>✕</button>
              </div>
              <input className="input sm:col-span-2" placeholder="로마자 발음 (romanization)" value={t.romanization} onChange={(e) => setSent(i, "romanization", e.target.value)} />
            </div>
          ))}
        </div>
        <p className="sub mt-2">문장 ID는 자동으로 관리되며, 문장을 수정해도 기존 녹음 기록은 유지됩니다.</p>
      </section>
    </>
  );
}
