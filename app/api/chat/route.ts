import Anthropic from "@anthropic-ai/sdk";
import { apiUser, jsonError, readJson, str } from "@/lib/api";
import { locateSituation } from "@/lib/content";
import { updateProgress } from "@/lib/db";
import { languageName } from "@/lib/languages";
import type { Situation } from "@/lib/types";

// 설계 §6.3 LLM 대화 학습 — Claude API. 응답은 텍스트 스트림으로 흘려보내
// 아바타가 "말하는 중" 상태를 실시간으로 반영할 수 있게 한다.

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_HISTORY = 20;

type Mode = "qa" | "roleplay" | "roleplay_start" | "examples";

function systemPrompt(s: Situation, opts: { nativeLang: string; mode: Mode; feedback: string }) {
  const lang = languageName(opts.nativeLang, "ko");
  const langEn = languageName(opts.nativeLang, "en");
  const terms = s.terms.map((t) => `- ${t.hangul} (${t.romanization}): ${t.gloss_en}`).join("\n");
  const sentences = s.sentences.map((t) => `- ${t.text_ko} — ${t.text_en}`).join("\n");
  const learnerRole = s.roles[0];
  const aiRole = s.roles[1] ?? "상대방";
  const base = `당신은 '한글만세'의 AI 한국어 선생님입니다. 학습자는 한국에 사는 다문화 가정의 학생 또는 성인이며, 모국어는 ${lang}(${langEn})입니다.

## 현재 학습 맥락
- 상황: ${s.title_ko} (${s.title_en}) / 장소: ${s.place_tag} / 말투: ${s.formality_tag} / 난이도: ${s.difficulty_tag}
- 상황 설명: ${s.description_ko}
- 학습 목표: ${s.goal_ko}
- 필수 용어:
${terms}
- 따라 읽기 문장:
${sentences}
${opts.feedback ? `- 학습자의 직전 발음 피드백: ${opts.feedback}\n` : ""}
## 답변 원칙
- 위 상황·용어와 관련된 한국어, 한국 생활 예절과 규칙을 중심으로 돕습니다. 상관없는 주제는 짧게 답하고 학습으로 자연스럽게 돌아옵니다.
- 학습자가 ${lang}로 물으면 설명은 ${lang}로, 한국어 예문은 한국어로 씁니다. 한국어로 물으면 쉬운 한국어로 답하고 필요하면 ${lang} 해설을 덧붙입니다.
- 난이도(${s.difficulty_tag})에 맞게 짧고 쉬운 문장을 씁니다. 상황에 맞는 ${s.formality_tag}을 사용하고, 반말·존댓말 차이를 짚어 줍니다.
- 응답은 짧게(보통 3~6줄). 마크다운 표나 제목은 쓰지 말고, 예문은 줄을 바꿔 씁니다.
- 학습자의 실수는 비난하지 말고, 올바른 표현을 먼저 보여 준 뒤 이유를 한 줄로 설명합니다.
- 의료·법률·체류(비자)·응급 상황처럼 전문적 판단이 필요한 질문에는 판단을 내리지 말고, "이 앱은 한국어 학습용이에요"라고 알린 뒤 해당 기관(응급 119, 외국인종합안내센터 1345, 다누리콜센터 1577-1366 등)에 문의하도록 안내하되, 그 상황에서 쓸 수 있는 한국어 표현은 가르쳐 줍니다.`;

  if (opts.mode === "roleplay" || opts.mode === "roleplay_start")
    return `${base}

## 지금은 역할극 모드입니다
- 당신은 '${aiRole}', 학습자는 '${learnerRole}' 역할입니다. 장소는 ${s.place_tag}입니다.
- 매 턴 '${aiRole}'로서 한국어 대사 1~2문장만 말합니다. 대사는 첫 줄에 씁니다(따옴표·역할명 표시 없이).
- 대사 아래 줄에는 "💡 "로 시작하는 짧은 도움말을 ${lang}로 한 줄 씁니다: 대사의 뜻과, 학습자가 이어서 말할 수 있는 한국어 답 예시 1개.
- 학습자의 한국어가 어색하면 대사 전에 고치지 말고, 도움말 줄에서 더 자연스러운 표현을 알려 줍니다.
- 위 필수 용어와 따라 읽기 문장을 자연스럽게 쓰도록 대화를 이끕니다. 4~6턴쯤 지나 목표를 이루면 '${aiRole}'로서 자연스럽게 대화를 마무리합니다.`;
  if (opts.mode === "examples")
    return `${base}

## 요청: 예문 더 보기
위 상황에서 쓸 수 있는 새 한국어 예문 3개를 보여 줍니다. 형식: 한 줄에 "한국어 예문 — ${lang} 뜻". 따라 읽기 문장과 겹치지 않게, 필수 용어를 활용합니다.`;
  return base;
}

/** API 키가 없을 때의 오프라인 응답 (콘텐츠 기반 안내) */
function offlineReply(s: Situation, mode: Mode, last: string): string {
  if (mode === "examples")
    return s.sentences.map((t) => `${t.text_ko} — ${t.text_en}`).join("\n") +
      "\n\n(오프라인 모드: AI 연결 없이 수록된 문장을 보여 드려요. / Offline mode: showing built-in sentences.)";
  if (mode === "roleplay_start" || mode === "roleplay") {
    const i = Math.min(s.sentences.length - 1, Math.floor(Math.random() * s.sentences.length));
    return `네, 말씀하세요.\n💡 (오프라인 모드) 이렇게 말해 보세요: ${s.sentences[i].text_ko} — ${s.sentences[i].text_en}`;
  }
  const hit = s.terms.find((t) => last.includes(t.hangul) || last.toLowerCase().includes(t.gloss_en.toLowerCase()));
  if (hit) return `'${hit.hangul}'(${hit.romanization})는 "${hit.gloss_en}"라는 뜻이에요.\n\n(오프라인 모드: AI 선생님이 연결되지 않아 용어 사전으로 답했어요.)`;
  return "지금은 AI 선생님이 연결되어 있지 않아요(오프라인 모드). 용어 카드와 따라 읽기로 먼저 연습해 보세요!\nThe AI teacher is offline right now. Please practice with the term cards and Repeat-after-me.";
}

function textStream(gen: AsyncGenerator<string>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(value));
      } catch (e) {
        console.error("[chat] stream error", e);
        controller.enqueue(enc.encode("\n\n(응답 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.)"));
        controller.close();
      }
    },
    async cancel() { await gen.return(undefined); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

let client: Anthropic | null = null;
const hasCredentials = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function POST(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const loc = await locateSituation(str(b?.situationId, 60));
  if (!loc) return jsonError(404, "상황을 찾을 수 없습니다.");
  const mode: Mode = (["qa", "roleplay", "roleplay_start", "examples"] as const).find((m) => m === b?.mode) ?? "qa";

  // 대화 기록 정리: user/assistant 교대, user로 시작·끝나도록
  const raw = Array.isArray(b?.messages) ? (b!.messages as unknown[]) : [];
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    const mm = m as { role?: unknown; content?: unknown };
    const role = mm.role === "assistant" ? "assistant" : mm.role === "user" ? "user" : null;
    const content = str(mm.content, 1000);
    if (!role || !content) continue;
    if (history.length === 0 && role !== "user") continue;
    const prev = history[history.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content as string}\n${content}`;
    else history.push({ role, content });
  }
  if (mode === "roleplay_start") history.push({ role: "user", content: "역할극을 시작해 주세요. 먼저 말을 걸어 주세요." });
  if (mode === "examples") history.push({ role: "user", content: "이 상황에서 쓸 수 있는 예문을 더 보여 주세요." });
  if (history.length === 0 || history[history.length - 1].role !== "user") return jsonError(400, "메시지를 입력하세요.");

  await updateProgress(g.user.id, (p) => { p.chat_messages += 1; });
  const last = history[history.length - 1].content as string;

  if (!hasCredentials()) {
    return textStream((async function* () { yield offlineReply(loc.situation, mode, last); })());
  }

  client ??= new Anthropic();
  const system = systemPrompt(loc.situation, { nativeLang: g.user.native_language, mode, feedback: str(b?.feedback, 400) });
  const anthropic = client;

  return textStream((async function* () {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      // 짧은 학습 대화이므로 낮은 effort로 응답 지연을 줄인다.
      output_config: { effort: "low" },
      // 안전 분류기가 요청을 거절하면 서버 측에서 대체 모델로 이어서 응답 (refusal fallback)
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: history,
    });
    let any = false;
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          any = true;
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal")
        yield (any ? "\n\n" : "") + "이 질문에는 답하기 어려워요. 지금 배우는 상황에 대해 물어봐 주세요. / I can't help with that one — let's get back to the lesson.";
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        console.error("[chat] Claude 인증 실패 — 오프라인 응답으로 대체", e.message);
        yield offlineReply(loc.situation, mode, last);
      } else if (e instanceof Anthropic.RateLimitError) {
        yield "지금 질문이 많아 잠시 쉬고 있어요. 조금 뒤에 다시 물어봐 주세요. / Too many requests — please try again shortly.";
      } else if (e instanceof Anthropic.APIError) {
        console.error("[chat] Claude API 오류", e.status, e.message);
        yield "AI 선생님과 연결이 잠시 불안정해요. 다시 시도해 주세요. / The AI teacher is temporarily unavailable.";
      } else throw e;
    }
  })());
}
