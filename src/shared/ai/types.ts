// То, что фронт отправляет на сервер
export interface AiAnalyzeRequest {
    leadId: string;
    domain: string;
}

// То, что сервер возвращает фронту
export interface AiAnalyzeResponse {
    success: boolean;
    data?: {
        leadId: string;
        aiScore: number;
        aiRecommendedStatus: string; // 'hot', 'warm', 'dead' и т.д.
        description: string;
        aiLastAnalyzedAt: string;
    };
    error?: string;
}