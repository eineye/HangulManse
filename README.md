# 한글만세 (HangulManse)

국내 거주 다문화 가정 학생·일반인을 위한 AI 한국어 학습 서비스.
**사용자 학습 앱**과 이를 운영하는 **관리자 웹페이지**가 하나의 Next.js 앱으로 구성되어 있습니다.
설계 문서: [`docs/PROGRAM_DESIGN.md`](docs/PROGRAM_DESIGN.md)

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 접속 → 로그인 화면.

| 계정 | 이메일 | 비밀번호 |
|-|-|-|
| 학습자(데모) | demo@hangulmanse.kr | demo1234! |
| 관리자 | admin@hangulmanse.kr | admin1234! (`ADMIN_PASSWORD`로 변경 가능) |

계정과 학습 기록은 최초 실행 시 `data/`에 생성됩니다(관리자 화면 시연용 샘플 학습자 6명 포함, 계정 관리에서 일괄 삭제 가능).
**운영 배포 전 반드시 관리자 비밀번호를 바꾸세요.**

### 환경 변수 (`.env.local`, 선택)

| 변수 | 설명 |
|-|-|
| `ANTHROPIC_API_KEY` | Claude API 키. 없으면 AI 대화창이 콘텐츠 기반 오프라인 응답으로 동작 |
| `CLAUDE_MODEL` | 대화 모델 (기본 `claude-opus-5-5`) |
| `AUTH_SECRET` | 세션 쿠키 서명 키 (미설정 시 `data/.secret` 자동 생성) |
| `ADMIN_PASSWORD` | 최초 실행 시 만들어지는 관리자 계정 비밀번호 |

### 운영 빌드

```bash
npm run build
```

```bash
npm start
```

`content/`와 `data/`를 런타임에 읽고 쓰므로 Node 서버(자체 호스팅, 컨테이너 등)로 실행해야 합니다.
HTTPS가 아닌 환경에서 `npm start`로 테스트할 때는 `INSECURE_COOKIES=1`을 지정해야 로그인 쿠키가 저장됩니다.

## 기능

### 사용자 앱
- **로그인/회원가입** — 모국어·국적·소속 기관 입력
- **코스 선택** (`/courses`) — 기초한글 / 생활한글 / 예절한글, 코스·상황별 진도와 통계
- **학습 화면** (`/learn/:unitId/:situationId`) — 한 화면 6영역, 페이지 이동 없이 한 사이클 완료
  1. 헤더: 유닛 진도, KO/EN 전환
  2. 상황 설명·학습 목표 (한/영 병기)
  3. 필수 생활 용어 카드(발음 듣기) + 따라 읽기(음절 분해, 원래 속도/느리게, 녹음)
  4. AI 아바타 선생님 — 2D 일러스트, 말하는 동안 입모양 애니메이션, 입모양 확대 보기, 역할극 상대
  5. 사용자 정보·학습 통계 (학습 단어, 평균 정확도, 주간 학습 시간, 연속 학습일)
  6. 발음 정확도(정확도·유창성·억양·음절별) / AI 피드백(집중 연습) / AI 대화(모국어 질문, 예문, 역할극)
- 모든 문장을 70점 이상으로 읽으면 상황 완료 → 다음 상황 안내
- PWA 매니페스트 + 최소 서비스워커

> 음성 인식·합성은 브라우저 Web Speech API를 사용합니다(Chrome/Edge 권장). 음성 인식이 없는 브라우저에서는 입력으로 연습할 수 있습니다.
> 발음 점수는 인식된 문장을 음절·자모 단위로 비교한 **근사치**이며, 상용 발음평가 API로 교체할 수 있도록 `lib/scoring.ts`에 분리되어 있습니다.

### 관리자 웹 (`/admin`)
- **대시보드** — 학습자 수, 7일 활동, 평균 정확도, 녹음 수, 코스별 완료율, 국적 분포, 어려워하는 문장, 최근 활동
- **학습자 진도** — 검색·기관 필터·정렬·CSV 내보내기, 학습자별 상세(상황별 진도, 점수 추이, 음절별 녹음 결과)
- **콘텐츠 관리** — 코스/유닛/상황/용어/문장 추가·수정·삭제·순서 변경, 공개 여부, 발음 미리듣기, JSON 내보내기.
  저장 시 서버 검증 후 `content/*.json`에 기록되어 **재빌드 없이 즉시 반영**
- **계정 관리** — 계정 생성, 권한(학습자/관리자), 비활성화, 비밀번호 재설정, 삭제(학습 기록 포함)

## 구조

```
app/
  login, courses, learn/[unitId]/[situationId]   사용자 앱
  admin/ (대시보드, learners, content, users)      관리자 웹
  api/auth, api/progress, api/me, api/chat         사용자 API
  api/admin/content, api/admin/users               관리자 API
components/       LessonScreen(6영역), Avatar2D, admin/*
lib/
  content.ts      콘텐츠 읽기·검증·저장 (content/*.json)
  db.ts           계정·진도·녹음 결과 저장소 (data/*.json)
  auth.ts         서명 쿠키 세션, 권한 확인
  scoring.ts      발음 근사 채점 + 규칙 기반 피드백
  speech.ts       브라우저 TTS/STT
content/          학습 콘텐츠 (코스별 JSON)
```

## 프로토타입의 한계
- 저장소는 단일 Node 프로세스용 JSON 파일입니다. 다중 인스턴스 운영 시 PostgreSQL 등으로 `lib/db.ts`를 교체하세요.
- 아바타 입모양은 실제 음소가 아닌 타이머 기반 근사입니다(viseme 제공 TTS로 교체 가능).
- 억양 점수는 피치 분석이 아닌 인식 신뢰도 기반 근사치입니다.
