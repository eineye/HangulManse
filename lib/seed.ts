// 최초 실행 시드: 관리자·데모 학습자 계정 + 관리자 화면 시연용 샘플 학습자 (서버·브라우저 체험판 공용)
import type { RecordingResult, StoredUser, UserProgress } from "./types";

export interface SeedDeps {
  hash: (password: string) => Promise<string>;
  uuid: () => string;
  adminPassword: string;
}

export async function buildSeed({ hash, uuid, adminPassword }: SeedDeps): Promise<{ users: StoredUser[]; progress: UserProgress[]; recordings: RecordingResult[] }> {
  const now = Date.now();
  const day = 86400000;
  const iso = (d: number) => new Date(now - d * day).toISOString();
  const mk = async (u: Omit<StoredUser, "id" | "password_hash" | "active"> & { password: string }): Promise<StoredUser> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = u;
    return { ...rest, id: uuid(), active: true, password_hash: await hash(u.password) };
  };

  const users: StoredUser[] = [
    await mk({ email: "admin@hangulmanse.kr", password: adminPassword, name: "관리자", role: "admin", nationality: "대한민국", native_language: "ko", level: "-", institution: "한글만세 운영팀", created_at: iso(30) }),
    await mk({ email: "demo@hangulmanse.kr", password: "demo1234!", name: "응우옌 마이", role: "learner", nationality: "베트남", native_language: "vi", level: "입문", institution: "행복동 가족센터", created_at: iso(14) }),
  ];

  // 샘플 학습자 (sample: true — 관리자 화면에서 '샘플' 배지로 구분, 언제든 삭제 가능)
  const samples: [string, string, string, string, string][] = [
    ["리 웨이", "중국", "zh", "초급", "행복동 가족센터"],
    ["마리아 산토스", "필리핀", "tl", "입문", "새빛초등학교"],
    ["솜차이 분마", "태국", "th", "초급", "행복동 가족센터"],
    ["아나스타시아 이바노바", "러시아", "ru", "중급", "새빛초등학교"],
    ["딜노자 카리모바", "우즈베키스탄", "uz", "입문", "다온 다문화센터"],
    ["사토 유키", "일본", "ja", "중급", "다온 다문화센터"],
  ];
  const progress: UserProgress[] = [];
  const recordings: RecordingResult[] = [];
  const sampleSituations = [
    ["basic", "b1", "b1-s1", "b1-s1-1", "안녕하세요. 처음 뵙겠습니다."],
    ["basic", "b1", "b1-s2", "b1-s2-1", "만나서 반가웠어요."],
    ["basic", "b2", "b2-s1", "b2-s1-3", "다시 한번 말씀해 주세요."],
    ["daily", "d1", "d1-s1", "d1-s1-2", "이거 얼마예요?"],
    ["daily", "d2", "d2-s1", "d2-s1-2", "아이가 어제부터 열이 나요."],
    ["etiquette", "e2", "e2-s1", "e2-s1-2", "죄송합니다. 규칙을 몰랐어요."],
  ];
  let k = 0;
  for (const [name, nationality, lang, level, institution] of samples) {
    k++;
    const u = await mk({ email: `sample${k}@hangulmanse.kr`, password: uuid(), name, role: "learner", nationality, native_language: lang, level, institution, created_at: iso(28 - k * 2), sample: true, last_active_at: iso(k % 4) });
    users.push(u);
    const done = 1 + ((k * 3) % sampleSituations.length);
    const p: UserProgress = { user_id: u.id, situations: {}, learned_terms: [], study_seconds: 1200 * k + 900, active_days: [], chat_messages: k * 4 };
    for (let d = 0; d < 3 + k; d++) p.active_days.push(new Date(now - ((d * 2 + k) % 20) * day).toISOString().slice(0, 10));
    p.active_days = [...new Set(p.active_days)].sort();
    sampleSituations.slice(0, done).forEach(([course_id, unit_id, situation_id, sentence_id, target], i) => {
      const score = 58 + ((k * 7 + i * 11) % 38);
      p.situations[situation_id] = { course_id, unit_id, situation_id, completed: score >= 70, best_score: score, attempts: 2 + ((k + i) % 4), last_at: iso((k + i) % 10) };
      p.learned_terms.push(`${situation_id}-t1`, `${situation_id}-t2`, `${situation_id}-t3`);
      recordings.push({
        id: uuid(), user_id: u.id, course_id, unit_id, situation_id, sentence_id, target, recognized: target,
        overall: score, accuracy: Math.min(100, score + 4), fluency: Math.max(0, score - 6), intonation: score,
        per_syllable: Array.from(target).filter((c) => c >= "가" && c <= "힣").map((s, j) => ({ syllable: s, score: j === 1 ? Math.max(40, score - 20) : Math.min(100, score + 8) })),
        feedback: [], created_at: iso((k + i) % 10),
      });
    });
    progress.push(p);
  }
  return { users, progress, recordings };
}
