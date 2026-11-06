import Anthropic from "@anthropic-ai/sdk";
import { apiUser, jsonError, readJson, str } from "@/lib/api";
import { locateSituation } from "@/lib/content";
import { updateProgress } from "@/lib/db";
import { CHAT_MODES, DEFAULT_CLAUDE_MODEL, claudeReply, normalizeHistory, offlineReply, systemPrompt, textStream, type Mode } from "@/lib/chat";

// 설계 §6.3 LLM 대화 학습 — Claude API. 응답은 텍스트 스트림으로 흘려보내
// 아바타가 "말하는 중" 상태를 실시간으로 반영할 수 있게 한다.

const MODEL = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;

let client: Anthropic | null = null;
const hasCredentials = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function POST(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const loc = await locateSituation(str(b?.situationId, 60));
  if (!loc) return jsonError(404, "상황을 찾을 수 없습니다.");
  const mode: Mode = CHAT_MODES.find((m) => m === b?.mode) ?? "qa";
  const history = normalizeHistory(Array.isArray(b?.messages) ? (b!.messages as unknown[]) : [], mode);
  if (history.length === 0 || history[history.length - 1].role !== "user") return jsonError(400, "메시지를 입력하세요.");

  await updateProgress(g.user.id, (p) => { p.chat_messages += 1; });
  const last = history[history.length - 1].content as string;
  const offline = () => offlineReply(loc.situation, mode, last);

  if (!hasCredentials()) return textStream((async function* () { yield offline(); })());

  client ??= new Anthropic();
  const system = systemPrompt(loc.situation, { nativeLang: g.user.native_language, mode, feedback: str(b?.feedback, 400) });
  return textStream(claudeReply(client, { model: MODEL, system, messages: history, offline }));
}
