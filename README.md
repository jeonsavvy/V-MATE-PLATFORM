# V-MATE Platform: AI Character Immersion Service

<div align="center">
  <img src="./assets/screenshots/sample_start.png" alt="V-MATE Platform Banner" width="100%" />

  <br />

  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
  ![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
  ![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)

</div>

<br />

> **"단순한 텍스트 챗봇을 넘어, 캐릭터의 '속마음'까지 읽는 입체적 대화 경험"**
>
> **V-MATE**는 LLM의 단순 응답 한계를 극복하기 위해 **이중 심리 시스템(Dual Psychology System)**을 도입한 AI 캐릭터 플랫폼입니다.

---

## 🧐 기획 배경 (Problem & Solution)

### The Problem: "AI 챗봇은 왜 금방 지루해질까?"
기존 LLM 기반 챗봇 서비스들은 텍스트의 논리적 완결성은 높지만, **"캐릭터로서의 깊이"**는 부족했습니다.
- 모든 대답이 너무 **정제되고 친절함** (Generic Politeness)
- 캐릭터의 **속내를 알 수 없는 평면적인 상호작용**
- 텍스트와 이미지의 **괴리감**

### The Solution: "속마음과 표정을 보여주자"
V-MATE는 **LLM의 출력을 구조화(JSON Mode)**하여 캐릭터의 입체감을 부여했습니다.
1.  **이중 심리 분리:** 겉으로 하는 말(`Response`)과 속에 감춘 생각(`Inner Heart`)을 분리하여 제공합니다.
2.  **동적 비주얼 피드백:** 대화 맥락에서 `emotion` 값을 추출, 캐릭터의 표정 일러스트를 실시간으로 변경합니다.
3.  **무중단 몰입 경험:** Serverless 아키텍처로 초기 로딩 없는 빠른 반응 속도를 구현했습니다.

---

## 🏗 시스템 아키텍처 (System Architecture)

전체 시스템은 **Serverless Function**을 중심으로 데이터 흐름이 제어되며, 보안을 위해 모든 AI 요청은 프록시 처리됩니다.

```mermaid
graph TD
    User[👤 User Interaction] -->|Message Input| Client[🖥️ Frontend Client (React)]
    Client -->|AUTH / RLS| DB[(🗄️ Supabase)]
    
    subgraph Secure Serverless Layer
        Client -->|POST /api/chat| Proxy[☁️ Netlify Function]
        Proxy -- API Key Injection --> AI[🧠 Google Gemini Flash]
    end

    AI -- JSON {heart, talk, emotion} --> Proxy
    Proxy -- Sanitized Response --> Client
    
    Client -->|Update UI| Render[🎨 View Update]
    Render -->|Show Text| Msg[💬 Chat Bubble]
    Render -->|Change Image| Face[🖼️ Dynamic Character Portrait]
```

---

## ✨ 핵심 기능 (Key Features)

### 🎭 1. 이중 심리 엔진 (Dual Psychology Engine)
- **Inner Heart vs Response:** 유저에게 보여지는 말풍선 외에, 캐릭터의 숨겨진 의도를 별도 UI(초록색 박스)로 렌더링합니다.
- **Context Awareness:** Sliding Window 기법을 적용, 최근 20턴의 대화 맥락을 유지하며 일관된 페르소나를 연기합니다.

### ⚡ 2. 하이브리드 데이터 동기화 (Hybrid Sync)
- **Guest Mode:** 별도 가입 절차 없이 `localStorage`를 활용해 즉시 대화 가능 (접근성 극대화).
- **User Mode:** Supabase Auth 로그인 시, 대화 내역이 클라우드 DB(`chat_messages`)에 영구 저장 및 기기 간 동기화.

### 🛡️ 3. 제로 트러스트 보안 (Security)
- **API Key Protection:** Google Gemini API Key는 Netlify Serverless Function 환경 변수로 격리되어 클라이언트에 절대 노출되지 않습니다.
- **Supabase RLS:** Row Level Security 정책을 통해 본인의 대화 데이터만 접근 가능하도록 엄격히 제어됩니다.

---

## 🛠 기술 스택 (Tech Stack)

| Category | Technology | Reason for Selection |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript | 컴포넌트 기반의 유지보수성 및 엄격한 타입 안정성 확보 |
| **Styling** | Tailwind CSS, Shadcn/UI | 신속한 UI 프로토타이핑 및 일관된 디자인 시스템 적용 |
| **Backend** | Netlify Functions | 별도 백엔드 서버 구축 없이 API Proxy 역할 수행 (Serverless) |
| **Database** | Supabase (PostgreSQL) | 인증(Auth)과 데이터베이스(DB)를 통합 관리하여 개발 생산성 향상 |
| **AI Model** | Google Gemini Flash | 빠른 응답 속도 및 대화 길이에 따른 Dynamic Model Switching 적용 |

---

## 🚀 설치 및 실행 (Getting Started)

### 사전 요구사항 (Prerequisites)
- Node.js v18 이상
- Google Gemini API Key
- Supabase Project & URL/Key
- Netlify CLI (`npm i -g netlify-cli`)

### 1. 프로젝트 설정
```bash
# Clone Repository
git clone https://github.com/jeonsavvy/V-MATE-PLATFORM.git
cd V-MATE-PLATFORM

# Install Dependencies
npm install
```

### 2. 환경 변수 설정 (.env)
루트 디렉토리에 `.env` 파일을 생성합니다.
```env
# Client Side (Vite)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Serverless Function Side (Netlify Dev용)
GOOGLE_API_KEY=your_gemini_api_key
```

### 3. 데이터베이스 스키마 적용
Supabase SQL Editor에서 [`supabase_schema.sql`](./supabase_schema.sql) 내용을 실행하여 테이블 및 RLS 정책을 생성합니다.

### 4. 로컬 개발 서버 실행
이 프로젝트는 Serverless Function을 사용하므로 **Netlify Dev** 환경에서 실행해야 채팅 API가 정상 작동합니다.

```bash
# 🔥 권장: UI + Serverless Functions 통합 실행
npm run dev:net
```
> `npm run dev` 실행 시 UI 개발은 가능하지만, AI 응답 기능은 작동하지 않습니다.

---

## � 폴더 구조 (Directory Structure)

```
📂 src
 ┣ 📂 components  # Atomic Design 기반 UI 컴포넌트
 ┣ 📂 lib         # Supabase Client, Utils, Types
 ┣ 📂 assets      # Static Assets (Images)
 ┗ 📜 App.tsx     # Main Entry Point

📂 netlify
 ┗ 📂 functions   # Serverless API Handlers (Chat Logic)
```

---

## � Contact
- **Developer:** jeonsavvy@gmail.com
