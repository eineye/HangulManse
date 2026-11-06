"use client";

import { useRef, useState } from "react";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/chat";
import { useDemo } from "@/lib/demo/hooks";
import { exportJson, get, importJson, mutate, resetAll } from "@/lib/demo/store";

export default function DemoSettings() {
  const settings = useDemo(() => ({ ...get().settings, created_at: get().created_at, size: JSON.stringify(get()).length }));
  const [key, setKey] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!settings) return null;

  const keyValue = key ?? settings.claudeKey ?? "";
  const modelValue = model ?? settings.claudeModel ?? "";

  function saveAi(e: React.FormEvent) {
    e.preventDefault();
    mutate((s) => { s.settings.claudeKey = keyValue.trim() || undefined; s.settings.claudeModel = modelValue.trim() || undefined; });
    setKey(null); setModel(null);
    setMsg({ ok: true, text: keyValue.trim() ? "AI 키를 저장했습니다. 학습 화면의 AI 대화에서 실제 Claude 응답을 시험할 수 있어요." : "AI 키를 지웠습니다. AI 대화는 오프라인 응답으로 동작합니다." });
  }

  function download() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hangulmanse-demo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(file: File) {
    try {
      importJson(await file.text());
      setMsg({ ok: true, text: "백업을 불러왔습니다. 다시 로그인해 주세요." });
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function reset() {
    if (!confirm("이 브라우저의 체험판 데이터(계정·학습 기록·콘텐츠 수정)를 모두 지우고 처음 상태로 되돌릴까요?")) return;
    await resetAll();
    window.location.reload();
  }

  return (
    <div className="grid max-w-3xl gap-4">
      {msg && <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-forest-50 text-forest-900" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-bold">체험판 안내</h2>
        <ul className="list-disc space-y-1 pl-5 text-black/70">
          <li>서버 없이 이 기기의 브라우저 안에서만 동작합니다. 계정·학습 기록·콘텐츠 수정은 <b>이 브라우저에만</b> 저장되고, 다른 기기·다른 브라우저와 공유되지 않습니다.</li>
          <li>그래서 휴대폰에서 학습한 기록은 PC 관리자 화면에 보이지 않습니다. 관리자 화면은 시연용 샘플 학습자와 <b>같은 기기</b>에서 학습한 기록으로 확인하세요.</li>
          <li>브라우저 데이터를 지우면 체험판 데이터도 사라집니다. 필요하면 아래에서 백업하세요.</li>
          <li>정식 운영은 서버 배포판(docs/DEPLOY.md)을 사용하세요.</li>
        </ul>
        <p className="sub">시작: {new Date(settings.created_at).toLocaleString()} · 사용 중인 저장 공간 약 {Math.ceil(settings.size / 1024)}KB</p>
      </section>

      <form onSubmit={saveAi} className="card space-y-3 p-5">
        <h2 className="font-bold">AI 대화 시험용 Claude API 키 (선택)</h2>
        <p className="text-sm text-black/65">
          비워 두면 AI 대화가 콘텐츠 기반 <b>오프라인 응답</b>으로 동작합니다. 키를 넣으면 이 브라우저에서 Claude API를 직접 호출합니다.
          키는 이 브라우저에만 저장되며 백업 파일에도 포함되지 않습니다. 사용량 한도를 걸어 둔 <b>테스트용 키</b>를 쓰고, 공용 PC에서는 입력하지 마세요.
        </p>
        <div>
          <label className="label" htmlFor="ck">API 키</label>
          <input id="ck" className="input font-mono" type="password" autoComplete="off" placeholder="sk-ant-..." value={keyValue} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cm">모델 (비우면 {DEFAULT_CLAUDE_MODEL})</label>
          <input id="cm" className="input font-mono" placeholder={DEFAULT_CLAUDE_MODEL} value={modelValue} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">저장</button>
          {settings.claudeKey && <span className="chip self-center bg-forest-600 text-white">키 설정됨</span>}
        </div>
      </form>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">데이터 백업 · 복원 · 초기화</h2>
        <p className="text-sm text-black/65">백업 파일로 다른 기기·브라우저에 체험판 데이터를 옮길 수 있습니다(API 키 제외).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={download}>⬇ 백업 내려받기</button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>⬆ 백업 불러오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="btn-danger ml-auto" onClick={reset}>처음 상태로 초기화</button>
        </div>
      </section>
    </div>
  );
}
