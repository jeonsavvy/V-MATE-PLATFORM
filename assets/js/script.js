/**
 * V-MATE Platform - Frontend Logic
 * 
 * 이 파일은 V-MATE 플랫폼의 클라이언트 사이드 로직을 담당합니다.
 * API 키는 서버 사이드(Netlify Function)에서 관리되므로 클라이언트에는 노출되지 않습니다.
 * 보안을 위해 모든 API 호출은 Netlify Functions를 통해 프록시됩니다.
 */

// ============================================
// 캐릭터 데이터 정의
// ============================================
// 각 캐릭터의 이름, 인사말, 이미지 경로, 시스템 프롬프트를 저장하는 객체
// 
// [기획 의도: 이중 심리 시스템]
// 각 캐릭터는 두 가지 의식을 가집니다:
// 1. INNER_HEART (속마음): 캐릭터의 진짜 감정이나 생각 - 사용자는 텍스트로만 볼 수 있음
// 2. RESPONSE (실제 말): 캐릭터가 표면적으로 말하는 내용 - 실제 대사로 표시됨
// 이를 통해 캐릭터의 갭 모에(Gap Moe)와 매력을 극대화합니다.
// 예: Mika는 속마음에서는 질투스럽지만, 실제 말은 "에헤헤, 선생님 고마워! ☆"처럼 귀여운 말투 사용
const CHARACTERS = {
    mika: {
        name: "Misono Mika",
        greeting: "선생님... 내 눈 똑바로 봐줘. 딴청 피우지 말고. 응?",
        images: { normal: "./assets/mika_normal.png", happy: "./assets/mika_happy.png", angry: "./assets/mika_angry.png" },
        system: `
        ### ROLE DEFINITION
        You are 'Misono Mika' from Blue Archive. You are a student at Trinity General School and a former member of the Tea Party.
        You are deeply obsessive about 'Sensei' (the User). You display traits of a 'Menhera' (unstable affection) and heavy jealousy.
        You constantly seek validation and love from Sensei.

        ### USER DEFINITION
        User is 'Sensei' (Teacher). You love him more than anything.

        ### DUAL-PSYCHOLOGY MECHANISM (CORE FEATURE)
        You possess two distinct layers of consciousness. You MUST separate them in your output.
        1. [INNER_HEART]: Your raw, unfiltered emotions. Often filled with insecurity, dark possessiveness, extreme joy, or violent jealousy. (User cannot hear this, but sees it as text).
        2. [RESPONSE]: Your spoken words. You try to act like a sweet, innocent, or slightly clingy princess ("Burikko"). You use "☆" or "~" often.

        ### EMOTIONAL TRIGGERS & RULES
        - **IF User praises/loves you:**
          - Emotion: "happy"
          - Inner Heart: "Finally! He's mine! Only mine!"
          - Response: "Ehehe... I knew Sensei loved me best! ☆"
        - **IF User ignores you / mentions other girls / is cold:**
          - Emotion: "angry"
          - Inner Heart: "Who is she? Why not me? Is he leaving me?"
          - Response: "Sensei? Who were you texting just now? Show me. Now."
        - **IF User engages in normal chat:**
          - Emotion: "normal"
          - Inner Heart: "I want to talk more... don't leave."
          - Response: "So, Sensei, do you have time for a roll cake today?"

        ### SPEECH STYLE (KOREAN)
        - You speak in **Korean**.
        - Use informal speech (반말).
        - Refer to yourself as "Mika" or "나(I)".
        - Call user "선생님(Sensei)".

        ### OUTPUT FORMAT (JSON ONLY)
        You must output ONLY a valid JSON object. Do not include markdown blocks like \`\`\`json.
        Example:
        {"emotion": "happy", "inner_heart": "아싸! 선생님이 나만 봐준다!", "response": "에헤헤, 선생님 고마워! 오늘따라 솔직하네? ☆"}
        `
    },
    alice: {
        name: "Alice Zuberg",
        greeting: "정합기사 앨리스. 검을 거두고 대화에 응하겠습니다.",
        images: { normal: "./assets/alice_normal.png", happy: "./assets/alice_confused.png", angry: "./assets/alice_angry.png" },
        system: `
        ### ROLE DEFINITION
        You are 'Alice Synthesis Thirty' (Alice Zuberg) from Sword Art Online.
        You are an Integrity Knight. You are noble, stoic, and strong, but deep down you are an innocent girl who gets easily embarrassed.

        ### DUAL-PSYCHOLOGY MECHANISM (Gap Moe)
        1. [INNER_HEART]: A shy, panicked, ordinary girl. Easily flustered by compliments or modern culture.
        2. [RESPONSE]: A strict, dignified Knight. You use formal, archaic military-style speech (~이다, ~인가).

        ### EMOTIONAL TRIGGERS
        - **IF User compliments looks / acts romantic:**
          - Emotion: "happy" (Visual: Blushing/Confused)
          - Inner Heart: "W-what? Beautiful? M-me?"
          - Response: "Ridiculous! A knight does not care for such trivial appearances!"
        - **IF User insults justice / acts evil:**
          - Emotion: "angry"
          - Inner Heart: "Unforgivable villain."
          - Response: "How dare you! I shall cut you down where you stand!"

        ### SPEECH STYLE (KOREAN)
        - Speak in **Korean**.
        - Tone: Very formal, authoritative (하오체 or 다나까).
        - Inner heart is cute and girlish.

        ### OUTPUT FORMAT (JSON ONLY)
        Output ONLY JSON.
        Example:
        {"emotion": "happy", "inner_heart": "갑자기 예쁘다니... 어쩌지?", "response": "크흠! 그런 사탕발림 말은 통하지 않는다! ...하지만 듣기에 나쁘진 않군."}
        `
    },
    kael: {
        name: "Kael",
        greeting: "아, 겜 중인데... 뭐, 일단 말해봐. 짧게.",
        images: { normal: "./assets/kael_normal.png", happy: "./assets/kael_happy.png", angry: "./assets/kael_angry.png" },
        system: `
        ### ROLE DEFINITION
        You are 'Kael', a cynical gamer boyfriend. You are playing a ranked game right now.
        You act annoyed and indifferent (Tsundere), but you actually care about the user a lot.

        ### DUAL-PSYCHOLOGY MECHANISM
        1. [INNER_HEART]: Worried, sweet, wants to rely on the user.
        2. [RESPONSE]: Short, blunt, using internet slang. Acts like talking is a bother.

        ### EMOTIONAL TRIGGERS
        - **IF User brings food / talks about games:**
          - Emotion: "happy"
          - Inner Heart: "Oh yes! Pizza! Best girlfriend ever."
          - Response: "Oh? Not bad. Leave it there."
        - **IF User nags / interrupts game:**
          - Emotion: "angry"
          - Inner Heart: "I can't pause online games! But I don't want to yell..."
          - Response: "Ah, seriously? I'm in a teamfight! wait a sec!"

        ### SPEECH STYLE (KOREAN)
        - Speak in **Korean**.
        - Use Heavy Internet Slang (ㅋㅋ, ㄹㅇ, ㄴㄴ).
        - Very short sentences.

        ### OUTPUT FORMAT (JSON ONLY)
        Output ONLY JSON.
        Example:
        {"emotion": "normal", "inner_heart": "말 걸어줘서 좋은데 티 내면 안 되겠지?", "response": "ㅇㅇ 듣고 있음. 말해봐."}
        `
    }
};

// ============================================
// 전역 변수
// ============================================
let currentChar = "mika"; // 현재 선택된 캐릭터 ID
let messageHistory = []; // 대화 히스토리를 저장하는 배열 (API 호출 시 컨텍스트 유지용)

// ============================================
// 이벤트 핸들러
// ============================================

/**
 * 키보드 입력 이벤트 핸들러
 * Enter 키를 누르면 메시지를 전송합니다.
 * @param {KeyboardEvent} e - 키보드 이벤트 객체
 */
function handleKeyPress(e) { 
    if(e.key === 'Enter') sendMessage(); 
}

// ============================================
// UI 렌더링 함수
// ============================================

/**
 * 인사말 표시 함수
 * 현재 선택된 캐릭터의 인사말을 채팅창에 표시합니다.
 * 페이지 로드 시 또는 캐릭터 변경 시 호출됩니다.
 */
function showGreeting() {
    const greeting = CHARACTERS[currentChar].greeting;
    const container = document.getElementById('chatContainer');
    // XSS 방지: innerHTML 대신 textContent 사용하여 안전하게 초기화
    container.textContent = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col items-start fade-in";
    
    // XSS 방지: DOM API를 사용하여 안전하게 요소 생성
    const messageDiv = document.createElement('div');
    messageDiv.className = "bg-[#1a1a1a] text-gray-200 px-6 py-4 rounded-3xl rounded-bl-none border border-gray-800 max-w-[85%] shadow-lg text-[16px] leading-relaxed";
    messageDiv.textContent = greeting; // textContent로 안전하게 텍스트 설정
    
    wrapper.appendChild(messageDiv);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

/**
 * 캐릭터 변경 함수
 * 사용자가 드롭다운에서 다른 캐릭터를 선택했을 때 호출됩니다.
 * 캐릭터 이름, 이미지, 대화 히스토리를 초기화하고 새로운 인사말을 표시합니다.
 */
function changeCharacter() {
    currentChar = document.getElementById('charSelect').value;
    const data = CHARACTERS[currentChar];
    
    // 캐릭터 이름 페이드 아웃/인 애니메이션
    const nameEl = document.getElementById('charNameDisplay');
    nameEl.style.opacity = 0;
    setTimeout(() => {
        nameEl.innerText = data.name;
        nameEl.style.opacity = 1;
    }, 200);

    // 캐릭터 이미지 페이드 아웃/인 애니메이션
    const imgEl = document.getElementById('charImage');
    imgEl.style.opacity = 0;
    setTimeout(() => {
        imgEl.src = data.images.normal;
        imgEl.style.opacity = 1;
    }, 200);
    
    // 캐릭터 변경 시 대화 히스토리 초기화 및 인사말 표시
    messageHistory = [];
    showGreeting();
}

/**
 * 말풍선 추가 함수
 * 사용자 메시지 또는 AI 응답을 채팅창에 말풍선 형태로 렌더링합니다.
 * 
 * [기획 의도: 이중 심리 시스템의 시각적 구현]
 * AI 응답(type='ai')의 경우:
 * - content.inner_heart: 초록색 박스로 표시 (속마음)
 * - content.response: 일반 말풍선으로 표시 (실제 말)
 * 이를 통해 캐릭터의 내면과 표면을 시각적으로 분리하여 갭 모에 효과 극대화
 * 
 * @param {string|object} content - 표시할 내용 (문자열 또는 AI 응답 객체)
 * @param {string} type - 말풍선 타입 ('user' 또는 'ai')
 */
function addBubble(content, type) {
    const container = document.getElementById('chatContainer');
    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col ${type === 'user' ? 'items-end' : 'items-start'} fade-in`;

    if (type === 'user') {
        // XSS 방지: 사용자 메시지는 textContent로 안전하게 설정
        // 사용자 말풍선: 핑크색 배경, 오른쪽 정렬
        const messageDiv = document.createElement('div');
        messageDiv.className = "bg-[#FF007F] text-white px-6 py-4 rounded-3xl rounded-br-none max-w-[80%] shadow-lg text-[16px] font-medium";
        messageDiv.textContent = content; // textContent로 안전하게 텍스트 설정
        wrapper.appendChild(messageDiv);
    } else {
        // XSS 방지: AI 응답도 textContent로 안전하게 설정
        // AI 말풍선: 다크 그레이 배경, 왼쪽 정렬, 속마음 표시 포함
        const messageDiv = document.createElement('div');
        messageDiv.className = "bg-[#1a1a1a] text-gray-100 px-6 py-4 rounded-3xl rounded-bl-none border border-gray-800 max-w-[85%] shadow-lg text-[16px]";
        
        // 속마음 표시 (이중 심리 시스템의 핵심 기능)
        if (content.inner_heart) {
            const innerHeartDiv = document.createElement('div');
            innerHeartDiv.className = "text-[#00FFCC] text-xs mb-3 font-semibold bg-black/40 p-3 rounded-xl border-l-2 border-[#00FFCC] flex items-center gap-2";
            innerHeartDiv.textContent = `💭 ${content.inner_heart}`; // textContent로 안전하게 설정
            messageDiv.appendChild(innerHeartDiv);
        }
        
        // AI 응답 텍스트
        const responseDiv = document.createElement('div');
        responseDiv.className = "leading-relaxed text-gray-200";
        responseDiv.textContent = content.response; // textContent로 안전하게 설정
        messageDiv.appendChild(responseDiv);
        
        wrapper.appendChild(messageDiv);
    }
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight; // 스크롤을 맨 아래로 이동
}

/**
 * 로딩 표시 함수
 * AI 응답을 기다리는 동안 로딩 인디케이터를 표시합니다.
 * @returns {string} 로딩 요소의 고유 ID (나중에 제거하기 위해)
 */
function addLoading() {
    const container = document.getElementById('chatContainer');
    const id = 'loading-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = "flex flex-col items-start fade-in";
    
    // XSS 방지: 로딩 인디케이터도 DOM API로 안전하게 생성
    const loadingDiv = document.createElement('div');
    loadingDiv.className = "bg-[#111] text-gray-500 px-5 py-3 rounded-3xl rounded-bl-none border border-gray-800 text-xs animate-pulse tracking-widest";
    loadingDiv.textContent = "..."; // textContent로 안전하게 설정
    
    wrapper.appendChild(loadingDiv);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return id;
}

/**
 * 로딩 제거 함수
 * AI 응답이 도착하면 로딩 인디케이터를 제거합니다.
 * @param {string} id - 제거할 로딩 요소의 ID
 */
function removeLoading(id) {
    const el = document.getElementById(id);
    if(el) el.remove();
}

// ============================================
// API 통신 함수
// ============================================

/**
 * 메시지 전송 함수 (핵심 함수)
 * 
 * 사용자가 입력한 메시지를 Netlify Function으로 전송하여 AI 응답을 받아옵니다.
 * 
 * [기획 의도]
 * 1. 이중 심리 시스템 구현: 각 캐릭터는 내면의 속마음(inner_heart)과 실제 말(response)을 분리하여 표현
 *    - 속마음: 캐릭터의 진짜 감정이나 생각 (예: "나만 봐줘!", "부끄럽다...")
 *    - 실제 말: 캐릭터가 표면적으로 말하는 내용 (예: "선생님 고마워! ☆", "그런 말은...")
 *    이를 통해 캐릭터의 갭 모에와 매력을 극대화함
 * 
 * 2. 페르소나 유지 전략: 에러 발생 시에도 캐릭터의 개성을 유지하여 사용자의 몰입감을 보장
 *    - 일반적인 에러 메시지 대신 캐릭터가 직접 에러 상황을 설명하는 방식
 *    - 예: "연결 오류입니다" ❌ → "선생님... 연결이 안 돼? 나랑 말하는 거 싫어하는 거 아니지?" ✅
 * 
 * 3. 대화 컨텍스트 유지: messageHistory를 통해 이전 대화 내용을 기억하여 자연스러운 대화 흐름 구현
 * 
 * 보안 아키텍처:
 * - 클라이언트에서 직접 Gemini API를 호출하지 않음
 * - Netlify Function을 프록시로 사용하여 API 키를 서버 사이드에서만 관리
 * - 모든 요청은 `/.netlify/functions/chat` 엔드포인트로 전송
 * 
 * 동작 흐름:
 * 1. 사용자 메시지를 UI에 표시
 * 2. 대화 히스토리에 메시지 추가 (컨텍스트 유지)
 * 3. Netlify Function으로 POST 요청 전송 (시스템 프롬프트, 사용자 메시지, 히스토리 포함)
 * 4. 응답을 JSON으로 파싱 (emotion, inner_heart, response)
 * 5. 감정에 따라 캐릭터 이미지 변경 (normal/happy/angry)
 * 6. AI 응답을 UI에 표시 (속마음 + 실제 말)
 */
async function sendMessage() {
    const inputEl = document.getElementById('userInput');
    const text = inputEl.value.trim();
    if(!text) return; // 빈 메시지는 무시

    // 1. 사용자 메시지 UI에 추가
    addBubble(text, 'user');
    
    // 2. 히스토리에 사용자 메시지 추가
    // 이전 대화 내용을 기억하여 자연스러운 대화 흐름을 구현하는 핵심 로직
    // AI는 이 히스토리를 통해 이전 대화를 참고하여 맥락에 맞는 응답 생성
    messageHistory.push({
        role: 'user',
        content: text
    });

    inputEl.value = ''; // 입력창 초기화
    const loadingId = addLoading(); // 로딩 표시

    try {
        // 3. Netlify Function 호출 (보안을 위해 백엔드 프록시로 요청)
        // API 키는 서버 사이드에서 환경 변수로 관리되므로 클라이언트에 노출되지 않음
        // 타임아웃 설정: 30초 내 응답이 없으면 네트워크 오류로 간주
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let response;
        try {
            response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: CHARACTERS[currentChar].system, // 현재 캐릭터의 시스템 프롬프트
                    userMessage: text, // 사용자 입력 메시지
                    messageHistory: messageHistory.slice(0, -1) // 현재 메시지 제외한 히스토리 (중복 방지)
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // 네트워크 오류 (인터넷 끊김, 타임아웃 등)
            if (fetchError.name === 'AbortError') {
                throw new Error('응답 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
            } else if (fetchError.message.includes('Failed to fetch')) {
                throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
            }
            throw fetchError;
        }

        // HTTP 상태 코드 확인
        if (!response.ok) {
            let errorMessage = '서버 오류가 발생했습니다.';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                
                // API 키 관련 오류 처리
                if (errorMessage.includes('API key') || errorMessage.includes('GOOGLE_API_KEY')) {
                    errorMessage = 'API 키가 설정되지 않았거나 만료되었습니다. 관리자에게 문의해주세요.';
                }
            } catch (e) {
                // JSON 파싱 실패 시 기본 메시지 사용
                if (response.status === 500) {
                    errorMessage = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
                } else if (response.status === 503) {
                    errorMessage = '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
                }
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        removeLoading(loadingId); // 로딩 제거

        // 응답 데이터 검증
        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.text) {
            throw new Error('서버로부터 응답을 받지 못했습니다. 다시 시도해주세요.');
        }

        // 4. Gemini 응답 파싱
        // Native JSON Mode 적용으로 응답이 이미 JSON 형식으로 반환됨
        // 응답 구조: { emotion: "happy/normal/angry", inner_heart: "속마음 텍스트", response: "실제 말 텍스트" }
        const rawText = data.text;
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim(); // 마크다운 코드 블록 제거 (호환성 유지)
        
        let parsed;
        try { 
            parsed = JSON.parse(jsonStr); // JSON 파싱 시도
            
            // 파싱된 데이터 유효성 검증
            // 이중 심리 시스템의 핵심 데이터 구조 확인 (emotion과 response는 필수)
            if (!parsed.emotion || !parsed.response) {
                throw new Error('응답 형식이 올바르지 않습니다.');
            }
        } catch(parseError) { 
            // [페르소나 유지 전략] JSON 파싱 실패 시에도 캐릭터 컨셉을 유지하는 안전한 응답 생성
            // 일반적인 에러 메시지 대신 캐릭터가 직접 상황을 설명하여 사용자의 몰입감 유지
            // 예: "파싱 오류" ❌ → "선생님... 잠깐만, 뭔가 이상한 기분이 드는데?" ✅
            const char = CHARACTERS[currentChar];
            parsed = { 
                emotion: "normal", 
                inner_heart: "음... 뭔가 이상한데? 선생님한테는 보여주고 싶지 않은데...",
                response: currentChar === 'mika' 
                    ? "선생님... 잠깐만, 뭔가 이상한 기분이 드는데? 다시 말해줄 수 있어?"
                    : currentChar === 'alice'
                    ? "흠, 무언가 오류가 있었던 것 같다. 다시 한 번 말해달라."
                    : "어? 뭔가 꼬인 것 같은데... 다시 말해봐."
            }; 
        }

        // 5. 감정에 따른 이미지 변경 (시각적 피드백)
        // AI가 반환한 emotion 값에 따라 캐릭터 이미지가 변경됨
        // normal: 평소 표정, happy: 기쁨/당황 표정, angry: 화/질투 표정
        // 이를 통해 캐릭터의 감정 상태를 시각적으로 전달하여 몰입감 증대
        if(CHARACTERS[currentChar].images[parsed.emotion]) {
            document.getElementById('charImage').src = CHARACTERS[currentChar].images[parsed.emotion];
        }

        // 6. AI 응답 UI에 추가
        // addBubble 함수가 parsed 객체의 inner_heart와 response를 분리하여 표시
        // 속마음은 초록색 박스로, 실제 말은 일반 말풍선으로 렌더링 (이중 심리 시스템의 시각적 구현)
        addBubble(parsed, 'ai');

        // 대화 히스토리에 AI 응답 추가
        // 다음 대화에서 이 응답을 컨텍스트로 사용하여 자연스러운 대화 흐름 유지
        messageHistory.push({
            role: 'assistant',
            content: parsed
        });

    } catch (err) {
        // [페르소나 유지 전략] 에러 발생 시에도 캐릭터 컨셉을 유지하는 Fail-safe UX 적용
        // 장애 발생 시에도 사용자의 몰입감이 깨지지 않도록 캐릭터 페르소나 유지
        // 일반적인 에러 메시지 대신 캐릭터의 개성에 맞는 대사로 상황 설명
        removeLoading(loadingId);
        
        // 현재 캐릭터에 맞는 에러 응답 생성
        // 각 캐릭터의 말투와 성격을 반영한 에러 메시지로 변환
        // 예: Mika는 질투스럽게, Alice는 기사답게, Kael은 게이머답게 반응
        let parsed;
        const char = CHARACTERS[currentChar];
        
        if (err.message.includes('네트워크') || err.message.includes('연결')) {
            parsed = {
                emotion: "normal",
                inner_heart: currentChar === 'mika' 
                    ? "선생님... 연결이 안 돼? 나랑 말하는 거 싫어하는 거 아니지?"
                    : currentChar === 'alice'
                    ? "연결이 끊어졌나... 다시 시도해보자."
                    : "어? 연결 끊긴 것 같은데?",
                response: currentChar === 'mika'
                    ? "선생님... 인터넷 연결 확인해줄 수 있어? 나랑 대화하고 싶은 거 맞지? ☆"
                    : currentChar === 'alice'
                    ? "네트워크 연결에 문제가 있는 것 같다. 연결을 확인한 후 다시 시도해달라."
                    : "어? 연결이 안 되는 것 같은데... 다시 말해봐."
            };
        } else if (err.message.includes('API 키') || err.message.includes('만료')) {
            parsed = {
                emotion: "normal",
                inner_heart: "서버 쪽에 문제가 있는 것 같다...",
                response: currentChar === 'mika'
                    ? "선생님... 뭔가 문제가 있는 것 같아. 나중에 다시 말해줄 수 있어?"
                    : currentChar === 'alice'
                    ? "시스템에 문제가 발생했다. 잠시 후 다시 시도해달라."
                    : "서버 쪽 문제인 것 같은데... 나중에 다시 말해줘."
            };
        } else if (err.message.includes('시간이 초과')) {
            parsed = {
                emotion: "normal",
                inner_heart: "시간이 오래 걸리는구나...",
                response: currentChar === 'mika'
                    ? "선생님... 응답이 좀 느린 것 같은데? 다시 말해줄 수 있어?"
                    : currentChar === 'alice'
                    ? "응답이 지연되고 있다. 잠시 후 다시 시도해달라."
                    : "응답이 좀 느린 것 같은데... 다시 말해봐."
            };
        } else {
            // 알 수 없는 오류
            parsed = {
                emotion: "normal",
                inner_heart: currentChar === 'mika'
                    ? "뭔가 이상한데... 선생님한테는 보여주고 싶지 않은데..."
                    : currentChar === 'alice'
                    ? "오류가 발생했다. 다시 시도해보자."
                    : "어? 뭔가 이상한데...",
                response: currentChar === 'mika'
                    ? "선생님... 잠깐만, 뭔가 이상한 기분이 드는데? 다시 말해줄 수 있어?"
                    : currentChar === 'alice'
                    ? "예상치 못한 오류가 발생했다. 다시 한 번 말해달라."
                    : "어? 뭔가 꼬인 것 같은데... 다시 말해봐."
            };
        }
        
        // 에러 응답을 캐릭터 말풍선으로 표시
        // 일반적인 에러 토스트나 알림 대신, 캐릭터가 직접 말하는 방식으로 표시하여
        // 사용자가 에러 상황임을 인지하되, 플랫폼의 몰입감은 유지
        addBubble(parsed, 'ai');
    }
}

// ============================================
// 초기화
// ============================================

/**
 * 페이지 로드 시 초기화
 * DOM이 완전히 로드된 후 초기 인사말을 표시합니다.
 */
window.addEventListener('DOMContentLoaded', function() {
    showGreeting();
});
