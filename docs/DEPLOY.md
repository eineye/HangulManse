# 배포 가이드 — 웹(관리자 포함) + Android APK

한글만세는 **웹 서버 하나**에 사용자 앱과 관리자 페이지가 함께 들어 있습니다.
Android 앱(APK)은 이 웹사이트를 Chrome으로 전체 화면 실행하는 **TWA(Trusted Web Activity)** 방식이라,
웹을 먼저 배포하고 그 주소로 APK를 만듭니다.

```
[스마트폰 APK] ──(Chrome 엔진)──▶ https://내도메인/courses   ← 학습자
[PC 브라우저]  ─────────────────▶ https://내도메인/admin     ← 관리자
                                     │
                              Next.js 서버 + 영구 디스크(data/, content/)
```

> 왜 WebView 앱이 아니라 TWA인가요? 발음 연습에 쓰는 브라우저 음성 인식(Web Speech API)이
> Android 기본 WebView에서는 동작하지 않고 Chrome에서만 동작하기 때문입니다.
> 그래서 **휴대폰에 Chrome이 설치되어 있어야** 합니다(대부분 기본 설치).

---

## 1단계. 웹 서버 배포

계정·학습 기록(`data/`)과 관리자가 편집한 콘텐츠(`content/`)를 파일로 저장하므로,
**영구 디스크를 붙일 수 있는 Node/Docker 호스팅**이 필요합니다.
(Vercel·Netlify 같은 서버리스 호스팅은 파일 저장이 유지되지 않아 맞지 않습니다.)

### 방법 A — Render (저장소에 설정 포함, 가장 간단)

1. https://render.com 가입 → GitHub 계정 연결
2. 대시보드 **New → Blueprint** → `eineye/hangulmanse` 저장소 선택
   - 저장소의 `render.yaml`이 자동으로 읽힙니다: Docker 빌드, 싱가포르 리전, 1GB 영구 디스크(`/var/data`).
   - 영구 디스크는 유료 플랜에서만 쓸 수 있어 `starter` 플랜으로 설정되어 있습니다. 요금은 Render 요금표에서 확인하세요.
3. 입력을 요구하는 환경 변수를 채웁니다.
   | 변수 | 값 |
   |-|-|
   | `ADMIN_PASSWORD` | 관리자 비밀번호 (**최초 실행 때만** 적용되니 첫 배포 전에 꼭 입력) |
   | `ANTHROPIC_API_KEY` | Claude API 키 (비우면 AI 대화가 오프라인 안내 모드) |
   | `ANDROID_SHA256_FINGERPRINTS` | 지금은 비워 두고 3단계에서 입력 |
4. **Apply** → 빌드가 끝나면 `https://hangulmanse-xxxx.onrender.com` 같은 주소가 생깁니다.
5. 확인
   - 학습자: `https://<주소>/` → 로그인 → 코스
   - **관리자: `https://<주소>/admin`** → `admin@hangulmanse.kr` / 3번에서 정한 비밀번호
   - 관리자 화면 → 계정 관리에서 데모 계정(`demo@…`)과 샘플 학습자를 정리하세요.

`main` 브랜치에 푸시하면 Render가 자동으로 다시 배포합니다. 디스크의 계정·학습 기록·콘텐츠는 유지됩니다.

### 방법 B — Docker가 되는 아무 서버 (Fly.io, Railway, 개인 VPS 등)

```bash
docker build -t hangulmanse .
```

```bash
docker run -d --name hangulmanse -p 3000:3000 \
  -v hangulmanse-data:/var/data \
  -e DATA_DIR=/var/data/data -e CONTENT_DIR=/var/data/content \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e ADMIN_PASSWORD='바꿀-비밀번호' \
  -e ANTHROPIC_API_KEY='sk-ant-...' \
  hangulmanse
```

- 반드시 **HTTPS**(도메인 + 인증서, 또는 플랫폼 기본 HTTPS) 뒤에 두세요. 마이크 사용과 로그인 쿠키에 HTTPS가 필요합니다.
- `AUTH_SECRET`은 한 번 정한 값을 계속 쓰세요(바꾸면 모두 로그아웃됩니다). 디스크가 유지되면 생략해도 자동 생성·보관됩니다.
- 헬스 체크 경로: `/api/health`

---

## 2단계. APK 만들기 (GitHub Actions)

이 PC에 Android 개발 도구가 없어도 GitHub가 대신 빌드합니다.

1. GitHub 저장소 → **Actions** 탭 → 왼쪽 **Android APK** → **Run workflow**
2. `host`에 1단계 주소의 도메인만 입력 (예: `hangulmanse-xxxx.onrender.com`) → Run
   - 매번 입력하기 싫으면 Settings → Secrets and variables → Actions → **Variables**에 `TWA_HOST`를 저장하세요.
3. 3~5분 뒤 실행 결과 페이지 하단 **Artifacts → hangulmanse-apk** 다운로드(zip 안에 `.apk`)
4. 실행 결과 요약(Summary)에 표시된 **서명 SHA-256 지문**을 복사해 둡니다(3단계에서 사용).

### 스마트폰에 설치

1. APK 파일을 휴대폰으로 옮깁니다(카카오톡 나에게 보내기, 구글 드라이브, USB 등).
2. 파일을 눌러 설치 → "출처를 알 수 없는 앱 설치" 허용 안내가 나오면 허용
3. 홈 화면의 **한글만세** 아이콘 실행 → 로그인
4. 따라 말하기를 처음 누르면 Chrome이 **마이크 권한**을 묻습니다 → 허용

---

## 3단계. 주소창 없이 전체 화면으로 (권장)

설치한 앱 상단에 주소창이 보이면, 웹사이트가 "이 앱은 내 것"이라고 아직 인증하지 않은 상태입니다.

1. 2단계 요약에 나온 SHA-256 지문을 웹 서버 환경 변수 `ANDROID_SHA256_FINGERPRINTS`에 넣고 재배포
   (Render: 서비스 → Environment). 여러 개면 콤마로 구분합니다.
2. `https://<주소>/.well-known/assetlinks.json` 에 지문이 보이는지 확인
3. 휴대폰에서 앱을 지웠다 다시 설치하거나, Chrome 앱 데이터를 지운 뒤 실행

### 고정 서명 키 등록 (업데이트 설치·전체 화면 유지에 필요)

시크릿이 없으면 빌드할 때마다 **임시 키**로 서명되어, 새 APK를 기존 앱 위에 업데이트 설치할 수 없고
지문도 매번 바뀝니다. 실제로 나눠 줄 앱이라면 키를 한 번 만들어 등록하세요(JDK의 `keytool` 필요 — Android Studio에 포함).

```bash
keytool -genkeypair -v -keystore hangulmanse.jks -alias hangulmanse -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 hangulmanse.jks > hangulmanse.jks.b64
```

저장소 Settings → Secrets and variables → Actions → **Secrets**에 추가:

| 시크릿 | 값 |
|-|-|
| `ANDROID_KEYSTORE_BASE64` | `hangulmanse.jks.b64` 파일 내용 |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | `hangulmanse` |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호(키스토어와 같으면 생략 가능) |

`hangulmanse.jks`와 비밀번호는 **잃어버리면 같은 앱으로 업데이트할 수 없으니** 안전한 곳에 백업하세요.
저장소에는 절대 커밋하지 마세요. 이후 2단계를 다시 실행하고, 새 지문을 3단계대로 서버에 넣으면 됩니다.

---

## APK 없이 바로 써 보기 (PWA)

휴대폰 Chrome으로 `https://<주소>/` 접속 → 메뉴(⋮) → **홈 화면에 추가 / 앱 설치**.
APK와 거의 같은 모양으로 홈 화면 아이콘이 생깁니다. iPhone은 Safari → 공유 → 홈 화면에 추가
(단, iOS Safari는 음성 인식 지원이 제한적이라 입력 연습으로 대체될 수 있습니다).

## 자주 묻는 문제

| 증상 | 해결 |
|-|-|
| 로그인해도 다시 로그인 화면 | HTTPS가 아닌 주소로 접속 중. 플랫폼 HTTPS 주소를 쓰세요(테스트용 HTTP라면 `INSECURE_COOKIES=1`). |
| 관리자 비밀번호가 안 맞음 | `ADMIN_PASSWORD`는 최초 실행 시에만 적용. 다른 관리자 계정으로 계정 관리에서 재설정하거나, 디스크의 `data/users.json`을 지우고 재시작(모든 계정 초기화). |
| 앱 상단에 주소창이 보임 | 3단계(지문 등록) 확인. 지문은 APK 서명 키마다 다릅니다. |
| 마이크가 안 됨 | Chrome 설정 → 사이트 설정 → 마이크에서 해당 주소 허용. "마이크 대신 입력하기"로도 연습 가능. |
| 관리자에서 고친 콘텐츠가 재배포 후 사라짐 | `CONTENT_DIR`이 영구 디스크 경로인지 확인(Render 설정은 자동). |
