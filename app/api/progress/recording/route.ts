import { NextResponse } from "next/server";
import { apiUser, jsonError, readJson, str } from "@/lib/api";
import { locateSituation } from "@/lib/content";
import { addRecording, listRecordings, updateProgress } from "@/lib/db";
import { scorePronunciation } from "@/lib/scoring";

// 설계 §4.1 POST /api/sessions/:sessionId/recordings 의 프로토타입.
// 오디오 원본 대신(민감정보 최소 수집) 브라우저 STT 인식 결과만 받아 서버에서 다시 채점·저장한다.
export async function POST(req: Request) {
  const g = await apiUser(req);
  if (g.error) return g.error;
  const b = await readJson(req);
  const situationId = str(b?.situationId, 60);
  const sentenceId = str(b?.sentenceId, 60);
  const recognized = str(b?.recognized, 500);
  const durationSec = typeof b?.durationSec === "number" && isFinite(b.durationSec) ? Math.min(60, Math.max(0, b.durationSec)) : undefined;
  const confidence = typeof b?.confidence === "number" && b.confidence >= 0 && b.confidence <= 1 ? b.confidence : undefined;

  const loc = await locateSituation(situationId);
  const sentence = loc?.situation.sentences.find((s) => s.id === sentenceId);
  if (!loc || !sentence) return jsonError(404, "문장을 찾을 수 없습니다.");

  const score = scorePronunciation({ target: sentence.text_ko, recognized, durationSec, confidence });
  const rec = await addRecording({
    ...score, user_id: g.user.id, course_id: loc.course.id, unit_id: loc.unit.id, situation_id: situationId,
    sentence_id: sentenceId, target: sentence.text_ko, recognized,
  });

  // 상황 완료 조건: 그 상황의 모든 문장을 한 번 이상 70점 이상으로 읽음
  const mine = (await listRecordings(g.user.id)).filter((r) => r.situation_id === situationId);
  const passed = new Set(mine.filter((r) => r.overall >= 70).map((r) => r.sentence_id));
  const completed = loc.situation.sentences.every((s) => passed.has(s.id));
  const progress = await updateProgress(g.user.id, (p) => {
    const prev = p.situations[situationId];
    p.situations[situationId] = {
      situation_id: situationId, course_id: loc.course.id, unit_id: loc.unit.id,
      completed: completed || !!prev?.completed,
      best_score: Math.max(prev?.best_score ?? 0, score.overall),
      attempts: (prev?.attempts ?? 0) + 1,
      last_at: new Date().toISOString(),
    };
  });
  return NextResponse.json({ result: rec, situation: progress.situations[situationId], passedSentences: [...passed] });
}
