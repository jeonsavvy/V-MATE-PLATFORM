# V-MATE Platform

캐릭터의 **겉말(response)** 과 **속마음(inner_heart)** 을 분리해 보여주는 웹 기반 AI 캐릭터 채팅 프로젝트입니다.

---

## 핵심 흐름

```mermaid
graph TD
    U[User] --> A[React + Vite Client]
    A -->|POST /.netlify/functions/chat| B[Netlify Function]
    B --> C[Google Gemini API]
    C -->|JSON text| B
    B -->|text(json string)| A

    A --> D[LocalStorage (Guest)]
    A --> E[Supabase (Logged-in User)]
```

---

## 현재 구현 기능

- **Dual Psychology 출력**: `emotion`, `inner_heart`, `response`
- **표정 변경**: 응답 emotion 값에 따라 캐릭터 이미지 변경
- **하이브리드 저장**:
  - 비로그인: LocalStorage
  - 로그인: Supabase `chat_messages` 테이블
- **서버리스 프록시**: Gemini API Key는 Netlify Function에서만 사용
- **모델 fallback**: 여러 Gemini 모델 후보를 순차 시도
- **JSON Mode 요청**: `responseMimeType: "application/json"`

---

## 빠른 시작

### 1) 의존성 설치

```bash
npm install
```

### 2) 환경 변수

프로젝트 루트 `.env` 파일:

```env
# Client
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Netlify Function
GOOGLE_API_KEY=...

# Optional
GEMINI_HISTORY_MESSAGES=8
GEMINI_MAX_PART_CHARS=1200
GEMINI_MODEL_TIMEOUT_MS=14000
```

### 3) DB 초기화

Supabase SQL Editor에서 `supabase_schema.sql` 실행

### 4) 로컬 실행

```bash
npm run dev:net
```

> `dev:net`은 Vite + Netlify Function을 같이 실행하기 위해 권장됩니다.

---

## 설정 메모

- 기본 히스토리 윈도우: `GEMINI_HISTORY_MESSAGES` (기본 8)
- 클라이언트에서 service role key 감지 시 Supabase를 비활성화하고 placeholder client로 대체
- API 실패/파싱 실패 시 캐릭터별 fallback 대사 출력

---

## 주의사항 (현재 상태)

- CORS는 요청 `Origin`을 반사하거나, origin이 없으면 `*`를 사용합니다.
- README/포폴 문서에서 말하는 “항상 20턴 고정”과 달리, 실제 기본값은 8이며 환경변수로 조정합니다.

---

## 디렉터리

```bash
├── netlify/functions/chat.js
├── src/components/
├── src/lib/
├── supabase_schema.sql
├── netlify.toml
└── README.md
```
