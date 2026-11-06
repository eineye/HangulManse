// 모국어 목록 (대화창 모국어 해설, 회원가입 선택지에 사용)
export const NATIVE_LANGUAGES: { code: string; ko: string; native: string; en: string }[] = [
  { code: "vi", ko: "베트남어", native: "Tiếng Việt", en: "Vietnamese" },
  { code: "zh", ko: "중국어", native: "中文", en: "Chinese" },
  { code: "tl", ko: "필리핀어(타갈로그어)", native: "Tagalog", en: "Filipino (Tagalog)" },
  { code: "th", ko: "태국어", native: "ภาษาไทย", en: "Thai" },
  { code: "ja", ko: "일본어", native: "日本語", en: "Japanese" },
  { code: "ru", ko: "러시아어", native: "Русский", en: "Russian" },
  { code: "uz", ko: "우즈베크어", native: "Oʻzbekcha", en: "Uzbek" },
  { code: "km", ko: "크메르어", native: "ភាសាខ្មែរ", en: "Khmer" },
  { code: "mn", ko: "몽골어", native: "Монгол", en: "Mongolian" },
  { code: "ne", ko: "네팔어", native: "नेपाली", en: "Nepali" },
  { code: "en", ko: "영어", native: "English", en: "English" },
  { code: "ko", ko: "한국어", native: "한국어", en: "Korean" },
];

export function languageName(code: string, lang: "ko" | "en" = "ko") {
  const l = NATIVE_LANGUAGES.find((x) => x.code === code);
  return l ? (lang === "ko" ? l.ko : l.en) : code;
}
