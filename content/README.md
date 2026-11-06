# 학습 콘텐츠

코스 하나당 JSON 파일 하나입니다. 관리자 웹(`/admin/content`)에서 편집하는 것을 권장하며, 파일을 직접 고쳐도
다음 요청부터 바로 반영됩니다(재빌드 불필요).

구조: `Course { id, title_ko/en, description_ko/en, icon, order, published, units[] }`
→ `Unit { id, title_ko/en, order, level, situations[] }`
→ `Situation { id, title_ko/en, description_ko/en, goal_ko/en, place_tag, formality_tag, difficulty_tag, image, roles[학습자, AI], terms[], sentences[] }`

- 유닛·상황 ID는 학습 화면 URL(`/learn/:unitId/:situationId`)에 쓰이므로 전체 코스에서 유일해야 합니다.
- 학습자가 이미 있는 상황·문장의 ID를 바꾸면 기존 진도 기록과 연결이 끊깁니다.
- 타입 정의: `lib/types.ts`
