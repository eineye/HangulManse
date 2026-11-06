// 발음 정확도 채점 (설계 §6.2의 자리표시자 구현).
//
// 실제 서비스는 음소 단위 강제 정렬(Forced Alignment) + 피치 분석 모델을 쓰지만, 이 프로토타입은
// 브라우저 STT가 돌려준 "인식 텍스트"를 목표 문장과 음절·자모 단위로 정렬해 점수를 근사한다.
// 클라이언트(즉시 표시)와 서버(저장 시 재계산) 양쪽에서 같은 함수를 쓴다.
// 상용 발음평가 API로 교체할 때는 scorePronunciation()의 반환 형태만 유지하면 된다.

import type { FeedbackItem, PronunciationScore } from "./types";

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

export function isHangulSyllable(ch: string) {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

export function decompose(ch: string): [string, string, string] | null {
  if (!isHangulSyllable(ch)) return null;
  const idx = ch.charCodeAt(0) - 0xac00;
  return [CHO[Math.floor(idx / 588)], JUNG[Math.floor((idx % 588) / 28)], JONG[idx % 28]];
}

// --- 숫자 → 한글 읽기 (STT가 "502호"처럼 숫자로 돌려주는 경우 대비) --------------------------
const DIGIT = ["공", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
function sinoNumber(n: number): string {
  if (n === 0) return "영";
  const units = ["", "십", "백", "천"];
  const big = ["", "만", "억"];
  let out = "";
  let groupIdx = 0;
  while (n > 0) {
    const group = n % 10000;
    if (group > 0) {
      let g = "";
      const digits = String(group).padStart(4, "0").split("").map(Number);
      digits.forEach((d, i) => {
        const pos = 3 - i;
        if (d === 0) return;
        g += (d === 1 && pos > 0 ? "" : DIGIT[d]) + units[pos];
      });
      out = g + big[groupIdx] + out;
    }
    n = Math.floor(n / 10000);
    groupIdx++;
  }
  return out;
}
export function readDigits(text: string): string {
  return text.replace(/\d+/g, (m) => (m.startsWith("0") || m.length > 8 ? m.split("").map((d) => DIGIT[+d]).join("") : sinoNumber(+m)));
}

/** 채점용 음절 배열: 숫자를 한글로 읽고, 한글 음절만 남긴다. */
export function toSyllables(text: string): string[] {
  return Array.from(readDigits(text)).filter(isHangulSyllable);
}

/** 화면 표시용 음절 분해(어절 경계 유지) */
export function syllableBreakdown(text: string): string[][] {
  return text
    .split(/\s+/)
    // 연속된 숫자는 하나의 토큰으로 묶는다(채점 시 여러 음절로 읽힘)
    .map((w) => w.match(/\d+|[\uac00-\ud7a3]/g) ?? [])
    .filter((w) => w.length > 0);
}

// --- 자모 유사도 ----------------------------------------------------------------------------
const CONFUSABLE_GROUPS = [
  ["ㄱ", "ㅋ", "ㄲ"], ["ㄷ", "ㅌ", "ㄸ"], ["ㅂ", "ㅍ", "ㅃ"], ["ㅈ", "ㅊ", "ㅉ"], ["ㅅ", "ㅆ"],
  ["ㄹ", "ㄴ"], ["ㅐ", "ㅔ"], ["ㅒ", "ㅖ"], ["ㅓ", "ㅗ"], ["ㅡ", "ㅜ"], ["ㅙ", "ㅚ", "ㅞ"], ["ㅢ", "ㅣ"],
];
function jamoSim(a: string, b: string): number {
  if (a === b) return 1;
  if (CONFUSABLE_GROUPS.some((g) => g.includes(a) && g.includes(b))) return 0.6;
  return 0;
}

function syllableSim(a: string, b: string): number {
  if (a === b) return 1;
  const da = decompose(a), db = decompose(b);
  if (!da || !db) return 0;
  // 초성 35%, 중성 45%, 종성 20%
  return jamoSim(da[0], db[0]) * 0.35 + jamoSim(da[1], db[1]) * 0.45 + (da[2] === db[2] ? 1 : jamoSim(da[2], db[2]) * 0.7) * 0.2;
}

type Op = { t: number; r: number | null }; // 목표 음절 t ↔ 인식 음절 r(null이면 누락)

function align(target: string[], said: string[]): { pairs: Op[]; insertions: number } {
  const n = target.length, m = said.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (1 - syllableSim(target[i - 1], said[j - 1])));
  const pairs: Op[] = [];
  let insertions = 0;
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + (1 - syllableSim(target[i - 1], said[j - 1])))) < 1e-9) {
      pairs.push({ t: i - 1, r: j - 1 }); i--; j--;
    } else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) {
      pairs.push({ t: i - 1, r: null }); i--;
    } else { insertions++; j--; }
  }
  return { pairs: pairs.reverse(), insertions };
}

// --- 피드백 규칙 사전 (설계 §6.2 "규칙 기반 발음 오류 패턴 사전") ----------------------------
function ruleFeedback(t: string, r: string): FeedbackItem | null {
  const dt = decompose(t), dr = decompose(r);
  if (!dt || !dr) return null;
  const has = (pair: string[], a: string, b: string) => pair.includes(a) && pair.includes(b);
  if (dt[1] !== dr[1]) {
    if (has(["ㅐ", "ㅔ"], dt[1], dr[1]))
      return { kind: "warning", ko: `'${t}'의 모음 ${dt[1]}: 입을 조금 더 크게 벌려 보세요.`, en: `Vowel ${dt[1]} in '${t}': open your mouth a little wider.` };
    if (has(["ㅓ", "ㅗ"], dt[1], dr[1]))
      return dt[1] === "ㅗ"
        ? { kind: "warning", ko: `'${t}'의 ㅗ: 입술을 동그랗게 앞으로 내밀어 보세요.`, en: `ㅗ in '${t}': round your lips and push them forward.` }
        : { kind: "warning", ko: `'${t}'의 ㅓ: 입술을 둥글게 하지 말고 턱을 내려 보세요.`, en: `ㅓ in '${t}': keep lips unrounded and drop your jaw.` };
    if (has(["ㅡ", "ㅜ"], dt[1], dr[1]))
      return dt[1] === "ㅡ"
        ? { kind: "warning", ko: `'${t}'의 ㅡ: 입술을 옆으로 편 채로 소리 내 보세요.`, en: `ㅡ in '${t}': keep your lips spread flat.` }
        : { kind: "warning", ko: `'${t}'의 ㅜ: 입술을 둥글게 모아 보세요.`, en: `ㅜ in '${t}': round your lips.` };
    return { kind: "warning", ko: `'${t}'의 모음(${dt[1]})을 '${r}'처럼 발음했어요.`, en: `The vowel (${dt[1]}) in '${t}' sounded like '${r}'.` };
  }
  if (dt[0] !== dr[0]) {
    const aspirated = ["ㅋ", "ㅌ", "ㅍ", "ㅊ"], tense = ["ㄲ", "ㄸ", "ㅃ", "ㅉ", "ㅆ"];
    if (aspirated.includes(dt[0]))
      return { kind: "warning", ko: `'${t}'의 ${dt[0]}: 숨을 세게 내뱉으며 발음하세요(거센소리).`, en: `${dt[0]} in '${t}': release a strong puff of air (aspirated).` };
    if (tense.includes(dt[0]))
      return { kind: "warning", ko: `'${t}'의 ${dt[0]}: 목에 힘을 주고 숨 없이 짧게 발음하세요(된소리).`, en: `${dt[0]} in '${t}': tense your throat, no puff of air (tense).` };
    if (has(["ㄹ", "ㄴ"], dt[0], dr[0]))
      return { kind: "warning", ko: `'${t}'의 ${dt[0]}: 혀끝 위치를 확인하세요(ㄹ은 혀를 가볍게 튕겨요).`, en: `${dt[0]} in '${t}': check your tongue tip (ㄹ is a light tap).` };
    return { kind: "warning", ko: `'${t}'의 첫소리(${dt[0]})를 '${r}'처럼 발음했어요.`, en: `The initial sound (${dt[0]}) in '${t}' sounded like '${r}'.` };
  }
  if (dt[2] !== dr[2])
    return dt[2]
      ? { kind: "warning", ko: `'${t}'의 받침 ${dt[2]}을(를) 끝까지 닫아 주세요.`, en: `Close the final consonant ${dt[2]} in '${t}' fully.` }
      : { kind: "warning", ko: `'${t}'에는 받침이 없어요. 소리를 열린 채로 끝내 보세요.`, en: `'${t}' has no final consonant; end the sound open.` };
  return null;
}

export interface ScoreInput {
  target: string;
  recognized: string;
  durationSec?: number; // 녹음 길이
  confidence?: number; // STT 신뢰도 0~1 (브라우저가 주지 않으면 undefined)
}

export function scorePronunciation({ target, recognized, durationSec, confidence }: ScoreInput): PronunciationScore {
  const t = toSyllables(target);
  const r = toSyllables(recognized);
  if (t.length === 0) return { overall: 0, accuracy: 0, fluency: 0, intonation: 0, per_syllable: [], feedback: [] };
  if (r.length === 0)
    return {
      overall: 0, accuracy: 0, fluency: 0, intonation: 0,
      per_syllable: t.map((s) => ({ syllable: s, score: 0 })),
      feedback: [{ kind: "warning", ko: "목소리가 인식되지 않았어요. 마이크 가까이에서 다시 말해 보세요.", en: "No speech was recognized. Move closer to the mic and try again." }],
    };

  const { pairs, insertions } = align(t, r);
  const per_syllable = pairs.map(({ t: ti, r: ri }) => ({
    syllable: t[ti],
    score: ri === null ? 15 : Math.round(30 + 70 * syllableSim(t[ti], r[ri])),
  }));
  const accuracy = Math.round(per_syllable.reduce((s, p) => s + p.score, 0) / per_syllable.length);

  // 유창성: 누락/추가 음절 비율 + (있으면) 말하기 속도. 한국어 낭독은 대략 초당 3~6음절.
  const missing = pairs.filter((p) => p.r === null).length;
  let fluency = 100 - Math.round(((missing + insertions) / t.length) * 100);
  if (durationSec && durationSec > 0) {
    const rate = r.length / durationSec;
    if (rate < 2) fluency -= Math.round((2 - rate) * 20); // 지나치게 느림/머뭇거림
    if (rate > 7.5) fluency -= Math.round((rate - 7.5) * 10); // 지나치게 빠름
  }
  fluency = Math.max(0, Math.min(100, fluency));

  // 억양: 피치 분석 대신 STT 신뢰도와 정확도로 근사(신뢰도가 없으면 정확도 기반).
  const intonation = Math.max(0, Math.min(100, Math.round(confidence !== undefined && confidence > 0 ? confidence * 60 + accuracy * 0.4 : accuracy * 0.9 + 8)));

  const overall = Math.round(accuracy * 0.6 + fluency * 0.25 + intonation * 0.15);

  // 피드백: 점수가 낮은 음절부터 최대 3개
  const feedback: FeedbackItem[] = [];
  const weak = pairs
    .map((p, i) => ({ ...p, score: per_syllable[i].score }))
    .filter((p) => p.score < 85)
    .sort((a, b) => a.score - b.score);
  for (const w of weak) {
    if (feedback.length >= 3) break;
    if (w.r === null) feedback.push({ kind: "warning", ko: `'${t[w.t]}' 소리가 빠졌어요. 천천히 한 음절씩 말해 보세요.`, en: `The syllable '${t[w.t]}' was missing. Try saying each syllable slowly.` });
    else {
      const fb = ruleFeedback(t[w.t], r[w.r]);
      if (fb && !feedback.some((f) => f.ko === fb.ko)) feedback.push(fb);
    }
  }
  if (insertions > 0 && feedback.length < 3)
    feedback.push({ kind: "info", ko: "문장에 없는 소리가 조금 더 들렸어요. 문장만 또박또박 읽어 보세요.", en: "Some extra sounds were heard. Read only the sentence, clearly." });
  if (overall >= 85) feedback.unshift({ kind: "success", ko: "아주 좋아요! 자연스럽게 잘 말했어요.", en: "Excellent! That sounded natural." });
  else if (overall >= 70 && feedback.length === 0) feedback.push({ kind: "success", ko: "잘했어요. 조금만 더 또렷하게 말해 보세요.", en: "Good job. Try to be a little clearer." });

  return { overall, accuracy, fluency, intonation, per_syllable, feedback };
}
