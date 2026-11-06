// 설계 문서 §5 데이터 모델을 프론트/백엔드가 공유하는 도메인 타입으로 옮긴 것.

export type Lang = "ko" | "en";

export interface Term {
  id: string;
  hangul: string;
  romanization: string;
  gloss_en: string;
  category: string;
}

export interface Sentence {
  id: string;
  text_ko: string;
  text_en: string;
  romanization: string;
}

export interface Situation {
  id: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  goal_ko: string;
  goal_en: string;
  place_tag: string;
  formality_tag: "존댓말" | "반말" | "혼합";
  difficulty_tag: "초급" | "중급" | "고급";
  image: string; // 이모지 또는 이미지 URL
  roles: string[]; // 역할극 역할 (예: ["손님", "점원"]) — 첫 번째가 학습자 역할
  terms: Term[];
  sentences: Sentence[];
}

export interface Unit {
  id: string;
  title_ko: string;
  title_en: string;
  order: number;
  level: string;
  situations: Situation[];
}

export interface Course {
  id: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  icon: string;
  order: number;
  published: boolean;
  units: Unit[];
}

export type Role = "learner" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  nationality: string;
  native_language: string; // 예: "vi", "zh", "en", "tl", "th", "ru", "uz", "ja", "km", "mn", "ne"
  level: string; // 예: "입문", "초급", "중급"
  institution: string;
  active: boolean;
  sample?: boolean; // 관리자 화면 시연용 샘플 데이터 여부
  created_at: string;
  last_active_at?: string;
}

export interface StoredUser extends User {
  password_hash: string;
}

export interface PronunciationScore {
  overall: number; // 0-100
  accuracy: number;
  fluency: number;
  intonation: number;
  per_syllable: { syllable: string; score: number }[];
  feedback: FeedbackItem[];
}

export interface FeedbackItem {
  kind: "success" | "warning" | "info";
  ko: string;
  en: string;
}

export interface RecordingResult extends PronunciationScore {
  id: string;
  user_id: string;
  course_id: string;
  unit_id: string;
  situation_id: string;
  sentence_id: string;
  target: string;
  recognized: string;
  created_at: string;
}

export interface SituationProgress {
  situation_id: string;
  course_id: string;
  unit_id: string;
  completed: boolean;
  best_score: number;
  attempts: number;
  last_at: string;
}

export interface UserProgress {
  user_id: string;
  situations: Record<string, SituationProgress>;
  learned_terms: string[];
  study_seconds: number;
  active_days: string[]; // YYYY-MM-DD
  chat_messages: number;
}

export interface UserStats {
  total_words: number;
  avg_accuracy: number;
  weekly_minutes: number;
  streak: number;
  completed_situations: number;
  total_situations: number;
  recordings: number;
}

export interface PublicSession {
  user: User;
}
