/**
 * Netlify Serverless Function: Gemini API 중계 서버
 * 
 * 이 함수는 클라이언트와 Google Gemini API 사이의 프록시 역할을 합니다.
 * 
 * 보안 아키텍처:
 * - API 키는 환경 변수(process.env.GOOGLE_API_KEY)에서만 가져옵니다
 * - 클라이언트는 API 키를 직접 알 수 없습니다
 * - 모든 Gemini API 호출은 이 서버 사이드 함수를 통해 이루어집니다
 * 
 * 동작 흐름:
 * 1. 클라이언트로부터 POST 요청 수신 (시스템 프롬프트, 사용자 메시지, 대화 히스토리)
 * 2. 환경 변수에서 API 키 로드
 * 3. Gemini API에 요청 전송 (대화 맥락 포함)
 * 4. Gemini 응답을 클라이언트에 반환
 */
export const handler = async (event, context) => {
    // CORS 보안 강화: 허용된 도메인만 접근 가능하도록 제한
    // * 대신 특정 도메인만 허용하여 CSRF 및 무단 접근 방지
    // 환경 변수에서 허용된 Origin을 가져오거나, 현재 요청의 호스트를 사용
    const prodOrigin = process.env.ALLOWED_ORIGIN || (event.headers.host ? `https://${event.headers.host}` : null);
    const allowedOrigins = [
        prodOrigin,                     // 프로덕션 환경 (환경 변수 또는 동적 감지)
        'http://localhost:8888'         // 로컬 개발 환경
    ].filter(Boolean); // null/undefined 제거

    // 요청 Origin 확인
    const origin = event.headers.origin || event.headers.Origin;
    const allowedOrigin = allowedOrigins.includes(origin) ? origin : null;

    // CORS 헤더 설정 (보안을 위해 허용된 도메인만 설정)
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin || prodOrigin || '*', // 동적으로 현재 도메인 사용
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // 환경 변수에서 API 키 가져오기
        // Netlify 대시보드의 Environment variables에서 설정한 값 사용
        const apiKey = process.env.GOOGLE_API_KEY;

        // 최소 운영 로그만 남기고 요청/환경 민감 데이터는 로그에서 제외
        console.log('[V-MATE] Function started');
        console.log('[V-MATE] Request method:', event.httpMethod);

        if (!apiKey) {
            console.error('[V-MATE] ERROR: GOOGLE_API_KEY is not set');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'API key not configured. Please set GOOGLE_API_KEY in Netlify environment variables.'
                })
            };
        }

        // 요청 본문 파싱 및 검증
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            console.error('[V-MATE] Parse error:', parseError.message);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid request body. Expected JSON format.',
                    details: parseError.message
                })
            };
        }

        const { systemPrompt, userMessage, messageHistory } = requestData;

        // 필수 파라미터 검증
        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'userMessage is required and must be a non-empty string.'
                })
            };
        }

        // Gemini API 요청 구성
        // 
        // [기획 의도: 이중 심리 시스템 구현을 위한 프롬프트 구조]
        // Gemini API는 대화 맥락을 유지하기 위해 전체 대화 히스토리를 배열 형태로 받습니다.
        // 각 메시지는 role(user/model)과 parts(텍스트 내용)로 구성됩니다.
        // 
        // 구조:
        // 1. 시스템 프롬프트 (캐릭터 설정) - 첫 메시지로 전달하여 AI의 역할을 정의
        //    - 이중 심리 시스템(INNER_HEART와 RESPONSE 분리)을 설명하는 핵심 프롬프트 포함
        //    - 각 캐릭터의 성격, 말투, 감정 트리거 등을 정의
        // 2. 대화 히스토리 (이전 대화들) - 컨텍스트 유지를 위해 순서대로 추가
        // 3. 현재 사용자 메시지 - 가장 마지막에 추가
        const contents = [];

        // 시스템 프롬프트를 첫 메시지로 추가
        // 이렇게 하면 AI가 캐릭터의 성격, 말투, 이중 심리 시스템(속마음/실제 말 분리)을 이해합니다
        if (systemPrompt) {
            contents.push({
                role: "user",
                parts: [{ text: systemPrompt }]
            });
            // AI가 프롬프트를 이해했다는 확인 응답 (Gemini API 형식 요구사항)
            contents.push({
                role: "model",
                parts: [{ text: "Understood. I will respond in the specified JSON format." }]
            });
        }

        // 대화 히스토리 추가 (Sliding Window 방식 적용)
        // 운영 비용 최적화: 오래된 대화는 버려서 Context Window를 절약합니다
        // 최근 20개 메시지(10턴: 사용자 10개 + AI 응답 10개)만 포함하여 토큰 비용을 일정 수준으로 유지
        if (messageHistory && Array.isArray(messageHistory)) {
            // 가장 최근 20개 메시지만 추출 (Sliding Window)
            const recentHistory = messageHistory.slice(-20);

            recentHistory.forEach(msg => {
                if (msg.role === 'user') {
                    // 사용자 메시지는 그대로 추가
                    contents.push({
                        role: "user",
                        parts: [{ text: msg.content }]
                    });
                } else if (msg.role === 'assistant') {
                    // AI 응답은 객체 형태로 저장되어 있으므로 response 필드만 추출
                    // [이중 심리 시스템 구현] inner_heart는 UI에서만 표시되므로 API에는 전달하지 않음
                    // API에는 실제 말(response)만 전달하여 대화 맥락을 자연스럽게 유지
                    const assistantText = typeof msg.content === 'object'
                        ? msg.content.response
                        : msg.content;
                    contents.push({
                        role: "model",
                        parts: [{ text: assistantText }]
                    });
                }
            });
        }

        // 현재 사용자 메시지 추가
        // 가장 마지막에 추가하여 AI가 최신 메시지를 처리하도록 합니다
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        // 모델 선택 로직: messageHistory.length >= 2일 때부터 고성능 모델 사용
        // messageHistory는 이전 대화들을 담고 있으므로, 길이가 2 이상이면 최소 2번째 질문부터 고성능 모델 사용
        // 모델 선택 로직 (Dynamic Model Switching):
        // 1. 초기 대화 (History < 2): 빠른 응답을 위해 'gemini-flash-latest' (1.5 Flash) 사용
        // 2. 심층 대화 (History >= 2): 고성능 추론을 위해 'gemini-3-flash-preview' 사용
        const messageHistoryLength = messageHistory ? messageHistory.length : 0;
        const candidateModels = messageHistoryLength >= 2
            ? ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash']
            : ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

        // Gemini API 호출
        // 타임아웃 설정: 25초 (Netlify Function 최대 실행 시간 고려)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        let geminiResponse;
        let geminiData;
        let lastModelError = null;

        for (const modelName of candidateModels) {
            // 서버 로그에만 기록 (클라이언트에는 노출하지 않음)
            console.log(`[V-MATE] Trying model: ${modelName}, Message History Length: ${messageHistoryLength}`);

            try {
                geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: contents,
                            // 운영 안정성(Stability) 확보를 위한 Native JSON Mode 적용
                            // Gemini API가 확정적으로 JSON 형식으로 응답하도록 강제
                            // 이중 심리 시스템 구현을 위해 {emotion, inner_heart, response} 구조를 일관되게 받기 위함
                            generationConfig: {
                                responseMimeType: "application/json"
                            }
                        }),
                        signal: controller.signal
                    }
                );

                try {
                    geminiData = await geminiResponse.json();
                } catch (jsonError) {
                    lastModelError = {
                        status: 502,
                        message: 'Invalid response from Gemini API.'
                    };
                    continue;
                }

                if (geminiResponse.ok && !geminiData.error) {
                    lastModelError = null;
                    break;
                }

                const modelErrorMessage = geminiData?.error?.message || 'Model call failed';
                const isModelNotFoundError =
                    geminiResponse.status === 404 ||
                    modelErrorMessage.includes('not found') ||
                    modelErrorMessage.includes('is not supported') ||
                    modelErrorMessage.includes('is not available');

                if (isModelNotFoundError) {
                    lastModelError = {
                        status: geminiResponse.status || 500,
                        message: modelErrorMessage
                    };
                    continue;
                }

                // 인증/쿼터/기타 오류는 fallback해도 동일할 가능성이 높아 즉시 종료
                break;
            } catch (fetchError) {
                // 타임아웃은 즉시 반환
                if (fetchError.name === 'AbortError') {
                    clearTimeout(timeoutId);
                    return {
                        statusCode: 504,
                        headers,
                        body: JSON.stringify({
                            error: 'Request timeout. Gemini API did not respond in time.'
                        })
                    };
                }

                lastModelError = {
                    status: 503,
                    message: 'Failed to connect to Gemini API. Please try again later.'
                };
                // 네트워크 오류는 동일하게 반복될 가능성이 높아 즉시 중단
                break;
            }
        }
        clearTimeout(timeoutId);

        if (!geminiResponse || !geminiData) {
            return {
                statusCode: lastModelError?.status || 503,
                headers,
                body: JSON.stringify({
                    error: lastModelError?.message || 'Failed to connect to Gemini API. Please try again later.'
                })
            };
        }

        // Gemini API 에러 처리
        if (!geminiResponse.ok || geminiData.error) {
            let errorMessage = 'Failed to get response from Gemini API';

            if (geminiData.error) {
                // API 키 관련 오류
                if (geminiData.error.message?.includes('API_KEY') || geminiData.error.message?.includes('API key')) {
                    errorMessage = 'Invalid or expired API key. Please check your GOOGLE_API_KEY in Netlify environment variables.';
                } else if (geminiData.error.message?.includes('quota') || geminiData.error.message?.includes('Quota')) {
                    errorMessage = 'API quota exceeded. Please check your Google Cloud billing.';
                } else {
                    errorMessage = geminiData.error.message || errorMessage;
                }
            }

            return {
                statusCode: geminiResponse.status || 500,
                headers,
                body: JSON.stringify({
                    error: errorMessage
                })
            };
        }

        // 응답 데이터 검증
        if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content?.parts?.[0]?.text) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({
                    error: 'Invalid response format from Gemini API.'
                })
            };
        }

        // 성공 응답 반환
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                text: geminiData.candidates[0].content.parts[0].text
            })
        };

    } catch (error) {
        // 예상치 못한 서버 오류 처리
        // 민감 이벤트 전체 덤프는 금지하고 최소 정보만 출력
        console.error('[V-MATE] Unexpected error:', error?.message || error);

        // 프로덕션 환경에서는 상세한 에러 정보를 클라이언트에 노출하지 않음
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error. Please try again later.',
                // 디버깅을 위해 개발 환경에서는 에러 메시지 포함
                ...(process.env.NETLIFY_DEV && { details: error.message })
            })
        };
    }
};
