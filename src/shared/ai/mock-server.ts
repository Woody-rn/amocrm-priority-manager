import type { AiAnalyzeRequest, AiAnalyzeResponse } from './types';

export class AiMockServer {
    async analyze(request: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
        console.log(`[AI MOCK] Запрос на анализ для сделки ${request.leadId}...`);

        // Имитируем задержку сети (1.5 секунды)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // В реальности мы бы делали запрос, а тут просто отдаем фейк
        return {
            success: true,
            data: {
                leadId: request.leadId,
                aiScore: 85,
                aiRecommendedStatus: 'hot',
                description: 'Клиент запросил КП, была демонстрация. Рекомендую перевести в Горячий и отправить счет. (Это тестовое описание от Mock-сервера)',
                aiLastAnalyzedAt: new Date().toISOString()
            }
        };
    }
}