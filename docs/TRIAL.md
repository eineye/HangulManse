# 체험판 (서버 없이 테스트하기)

정식 서버(Render 등)를 배포하기 전에, **서버 없이** 스마트폰 앱과 관리자 웹을 시험해 보는 방법입니다.
`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 다시 배포합니다.

| | 주소 | 용도 |
|-|-|-|
| 웹 체험판 (PC·휴대폰) | https://eineye.github.io/HangulManse/ | 학습 앱 + 관리자 화면 |
| Android 앱 (APK) | https://github.com/eineye/HangulManse/releases/download/android-latest/hangulmanse.apk | 휴대폰에 설치 |

체험 계정 — 학습자 `demo@hangulmanse.kr` / `demo1234!`, 관리자 `admin@hangulmanse.kr` / `admin1234!`

## 어떻게 동작하나요?

- 서버판과 **같은 화면 코드**를 정적 사이트로 빌드하고(`npm run build:demo`), 서버 API(`app/api/*`)가 하던 일을
  브라우저 안의 `lib/demo/backend.ts`가 대신 처리합니다. 데이터는 그 기기 브라우저의 **localStorage**에 저장됩니다.
- APK는 위 웹 체험판 주소를 **Chrome으로 여는 앱**(TWA)입니다. 그래서 발음 연습의 음성 인식·읽어 주기가 Chrome 그대로 동작하고,
  웹을 고치면 앱을 다시 설치하지 않아도 바로 반영됩니다. 모든 APK가 같은 공개 테스트 키(`android/app/test-signing.jks`)로
  서명되어, 새 APK를 덮어 설치해도 기록이 유지됩니다.

## 제한 사항 (정식 서버판과 다른 점)

| 항목 | 체험판 | 정식 서버판 |
|-|-|-|
| 데이터 저장 | 각 기기 브라우저에만 저장. **휴대폰에서 학습한 기록은 PC 관리자 화면에 보이지 않음** | 서버에 모아 저장 |
| 관리자 화면 | 시연용 샘플 학습자 + **같은 기기(브라우저)**에서 학습한 기록만 보임 | 모든 학습자 |
| 콘텐츠 수정 | 수정한 그 브라우저에서만 반영 | 모든 학습자에게 즉시 반영 |
| AI 대화 | 기본은 콘텐츠 기반 오프라인 응답. 관리자 › **체험판 설정**에 테스트용 Claude API 키를 넣으면 그 브라우저에서 실제 AI 응답 | 서버의 API 키로 응답 |
| 보안 | 계정·비밀번호가 기기 안에만 있는 **시험용** — 실제 개인정보를 넣지 마세요 | 서버 인증 |
| APK 상단 | 주소 표시줄이 보임(아래 '주소창 없애기' 참고) | 지문 등록 시 전체 화면 |

> 같은 기기에서 학습자 → 관리자로 바꿔 로그인하면 방금 학습한 기록을 관리자 화면에서 확인할 수 있습니다.
> 기기를 바꿔 이어서 시험하려면 관리자 › 체험판 설정 › **백업 내려받기 / 불러오기**를 쓰세요.

## 처음 한 번 설정 (저장소 관리자)

1. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택
   (이미 설정되어 있으면 생략. 설정 전에는 "Pages 체험판" 워크플로의 deploy 단계가 실패합니다 — 설정 후 Actions에서 **Re-run** 하세요.)
2. 저장소가 공개(public)여야 무료 GitHub Pages를 쓸 수 있습니다.

## 휴대폰에서 시험하기

- **APK:** 휴대폰 Chrome으로 위 APK 주소(또는 웹 체험판 로그인 화면의 「🤖 Android 앱(APK) 내려받기」)를 열어 내려받기 →
  설치("출처를 알 수 없는 앱" 허용) → 홈 화면의 **한글만세** 실행. 따라 말하기를 처음 누르면 마이크 권한을 허용하세요.
- **APK 없이:** 휴대폰 Chrome으로 웹 체험판 접속 → 메뉴(⋮) → **홈 화면에 추가 / 앱 설치**.
- iPhone: Safari → 공유 → 홈 화면에 추가 (iOS는 음성 인식이 제한적이라 '마이크 대신 입력하기'로 연습될 수 있습니다).

> APK와 Chrome 브라우저는 같은 저장 공간을 씁니다. 즉, 휴대폰 Chrome으로 웹 체험판에서 학습한 기록이 APK에서도 그대로 보입니다.

## 주소창 없애기 (선택)

APK가 열 때 위에 주소 표시줄이 보이는 것은, `eineye.github.io` 도메인이 "이 앱은 내 것"이라고 인증하지 않았기 때문입니다.
GitHub 사용자 사이트 저장소 **`eineye/eineye.github.io`** 를 만들고 아래 파일을 넣으면 전체 화면으로 열립니다.

`.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "kr.hangulmanse.app",
    "sha256_cert_fingerprints": ["E8:8D:B9:C9:77:B6:41:93:8E:F4:CA:60:51:CB:C9:B9:D1:55:3E:D5:4E:C9:11:83:61:A3:D1:B3:8E:19:75:0A"]
  }
}]
```

그리고 같은 저장소 루트에 `_config.yml` 파일을 만들어 `include: [".well-known"]` 한 줄을 넣으세요(점으로 시작하는 폴더를 GitHub Pages가 공개하도록).
지문은 공개 테스트 키의 값입니다. 앱을 지웠다 다시 설치하면 적용됩니다.

## 로컬에서 체험판 빌드

```bash
npm run build:demo
```

```bash
npx serve out
```

`out/` 폴더가 정적 사이트입니다. 하위 경로에 올릴 때는 `NEXT_PUBLIC_BASE_PATH=/경로`를 지정해 빌드하세요.

## 정식 버전으로 넘어갈 때

서버판(`docs/DEPLOY.md`)을 Render 등에 배포한 뒤, Actions › **Android APK** › Run workflow에 서버 도메인을 넣거나
저장소 변수 `TWA_HOST`를 설정하면 같은 앱이 서버에 연결된 정식 앱으로 빌드됩니다.
배포용으로는 공개 테스트 키 대신 자기 서명 키를 등록하세요(`docs/DEPLOY.md` 3단계).
