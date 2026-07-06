# Google Play Store 배포 가이드 (Android)

에드가공매는 **Capacitor**로 웹앱을 Android 앱으로 감쌉니다.  
앱은 `https://edgauction.com` 서버의 API·프록시를 사용합니다.

---

## 사전 준비 (한 번만)

| 항목 | 비용 | 설명 |
|------|------|------|
| Google Play 개발자 계정 | **$25 (1회)** | https://play.google.com/console/signup |
| Android Studio | 무료 | https://developer.android.com/studio |
| JDK 17+ | 무료 | Android Studio에 포함 |

---

## 1단계: 개발자 계정 등록

1. https://play.google.com/console/signup 접속
2. Google 계정으로 로그인
3. 개발자 등록비 **$25** 결제
4. 개발자 이름·연락처 입력 (심사 1~2일 걸릴 수 있음)

---

## 2단계: PC에 Android Studio 설치

1. Android Studio 설치
2. **SDK Manager** → Android SDK 34+ 설치
3. (선택) `npm run phone:setup` — USB 디버깅용 adb 설정

---

## 3단계: 프로젝트 Android 빌드 준비

프로젝트 폴더에서:

```bash
npm install
npx cap add android
npm run build:android
```

- `android/` 폴더가 생성됩니다
- `VITE_API_ORIGIN=https://edgauction.com` 으로 빌드됩니다

---

## 4단계: Android Studio에서 열기

```bash
npm run android:open
```

또는 Android Studio → **Open** → `android` 폴더 선택

### 실기기 테스트

1. 폰에서 **개발자 옵션** → **USB 디버깅** 켜기
2. USB 연결
3. Android Studio 상단 **Run** (▶) 클릭

---

## 5단계: 서명 키(Keystore) 만들기

Play Store 업로드용 **AAB**는 서명이 필요합니다.

Android Studio:

1. **Build** → **Generate Signed App Bundle / APK**
2. **Android App Bundle** 선택
3. **Create new...** (키스토어 생성)
   - 경로: 안전한 곳에 보관 (예: `C:\keys\edgauction-release.jks`)
   - 비밀번호: 꼭 기록해 두기
   - Alias: `edgauction`
   - Validity: 25년 이상 권장
4. **release** 빌드 선택
5. 완료 후 `android/app/release/app-release.aab` 생성

> **키스토어 분실 시 앱 업데이트 불가** — 반드시 백업하세요.

---

## 6단계: Play Console에 앱 등록

1. https://play.google.com/console → **앱 만들기**
2. 앱 이름: **에드가공매**
3. 기본 언어: **한국어**
4. 앱 / 게임: **앱**
5. 무료 / 유료: **무료**

### 스토어 등록정보

| 항목 | 예시 |
|------|------|
| 짧은 설명 | 온비드 공매 물건 실시간 조회·관심저장 |
| 전체 설명 | 온비드 공매 물건 검색, 상세정보, 관심 물건, 질문게시판 |
| 앱 아이콘 | 512×512 PNG (`public/icons/icon-512.png` 사용) |
| 스크린샷 | 폰에서 캡처 2장 이상 (1080×1920 등) |
| 개인정보처리방침 URL | **필수** — 웹사이트에 페이지 필요 |

### 개인정보처리방침

Play Store는 **개인정보처리방침 URL**이 필수입니다.  
예: `https://edgauction.com/#notice` 또는 별도 페이지 제작

### 데이터 안전

- 이메일, 비밀번호 수집 (회원가입)
- 서버: `edgauction.com`

---

## 7단계: AAB 업로드

1. Play Console → **프로덕션** (또는 **내부 테스트** 먼저 권장)
2. **새 버전 만들기**
3. `app-release.aab` 업로드
4. 출시 노트 작성
5. **검토 제출**

심사 보통 **수일~1주** 소요.

---

## 앱 업데이트 시 (코드 수정 후)

```bash
# 1. 버전 올리기 — android/app/build.gradle
#    versionCode +1, versionName 변경

# 2. 빌드
npm run build:android

# 3. Android Studio → Generate Signed Bundle → AAB 업로드
```

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `VITE_API_ORIGIN` | 앱이 붙을 서버 (기본: `https://edgauction.com`) |

로컬 서버 테스트:

```bash
set VITE_API_ORIGIN=http://192.168.0.10:3010
npm run build:android
```

---

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run build:android` | 웹 빌드 + Capacitor sync |
| `npm run android:open` | Android Studio 열기 |
| `npm run android:sync` | dist만 다시 동기화 |

---

## 주의사항

- 앱은 **웹뷰** 기반이라 서버(`edgauction.com`)가 꺼지면 앱도 동작 안 함
- 온비드 API 키는 **서버에만** 있음 (앱에 포함 안 됨) — 안전
- 회원 데이터는 서버 DB에 저장 (기기 간 동기화)
