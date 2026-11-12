import type { Client, ClientStatus } from '../shared/types';
import { AiMockServer } from '../shared/ai/mock-server';
import { StorageService } from '../shared/storage';
import { STATUS_CONFIG } from '../shared/statuses';

export class AiPanel {
    private aiServer = new AiMockServer();
    private storage = new StorageService();

    private handleElement: HTMLElement | null = null;
    private panelElement: HTMLElement | null = null;
    private currentLeadId: string | null = null;
    private currentClient: Client | null = null;

    public createHandle(leadId: string): void {
        if (this.handleElement) {
            this.currentLeadId = leadId;
            return;
        }

        this.currentLeadId = leadId;

        const handle = document.createElement('div');
        handle.className = 'ai-handle';
        handle.innerHTML = `🤖`;
        handle.title = 'Открыть ИИ-Анализ';

        handle.addEventListener('click', () => {
            void this.openPanel();
        });

        document.body.appendChild(handle);
        this.handleElement = handle;
    }

    public destroy(): void {
        this.handleElement?.remove();
        this.handleElement = null;
        this.closePanel();
    }

    public openFromHandle(): void {
        if (this.currentLeadId) {
            void this.openPanel();
        } else {
            alert('ИИ-анализ доступен только в карточке сделки.');
        }
    }

    private async openPanel(): Promise<void> {
        if (!this.currentLeadId) return;
        if (this.panelElement) return;

        // 1. Создаем каркас панели
        this.panelElement = document.createElement('div');
        this.panelElement.className = 'ai-panel';
        this.panelElement.innerHTML = `
            <div class="ai-panel__resizer"></div>
            <div class="ai-panel__header">
                <span>🤖 ИИ-Анализ</span>
                <button class="ai-panel__close">✕</button>
            </div>
            <div class="ai-panel__content"></div>
        `;
        document.body.appendChild(this.panelElement);

        // Обработчик ресайза
        const resizer = this.panelElement.querySelector('.ai-panel__resizer') as HTMLElement;
        resizer.addEventListener('pointerdown', (e) => this.startResize(e, this.panelElement!));

        // Обработчик закрытия
        this.panelElement.querySelector('.ai-panel__close')?.addEventListener('click', () => this.closePanel());

        // 2. Проверяем БД
        this.currentClient = await this.storage.getClientByLeadId(this.currentLeadId);

        if (this.currentClient && this.currentClient.aiLastAnalyzedAt) {
            // Если данные уже есть — показываем их
            this.renderResult(this.currentClient);
        } else {
            // Если данных нет — показываем кнопку запроса
            this.renderRequestButton();
        }
    }

    private renderRequestButton(): void {
        const content = this.panelElement?.querySelector('.ai-panel__content');
        if (!content) return;

        content.innerHTML = `
            <div class="ai-panel__empty">
                <p>Для этой сделки еще нет ИИ-анализа.</p>
                <button class="btn btn-primary ai-request-btn">✨ Запросить ИИ-анализ</button>
            </div>
        `;

        content.querySelector('.ai-request-btn')?.addEventListener('click', () => {
            void this.requestAnalysis();
        });
    }

    private async requestAnalysis(): Promise<void> {
        if (!this.panelElement || !this.currentLeadId) return;
        const content = this.panelElement.querySelector('.ai-panel__content');
        if (!content) return;

        // Показываем загрузку
        content.innerHTML = `
            <div class="ai-panel__loading">
                ⏳ ИИ изучает историю звонков и задачи...
            </div>
        `;

        // Делаем запрос
        const response = await this.aiServer.analyze({
            leadId: this.currentLeadId,
            domain: location.hostname
        });

        if (response.success && response.data) {
            // СОХРАНЯЕМ В БД СРАЗУ
            const updatedCount = await this.storage.updateAiFields([{
                leadId: this.currentLeadId,
                description: response.data.description,
                aiRecommendedStatus: response.data.aiRecommendedStatus as ClientStatus,
                aiScore: response.data.aiScore,
                aiLastAnalyzedAt: response.data.aiLastAnalyzedAt
            }]);

            if (updatedCount > 0) {
                // Обновляем локальный объект
                this.currentClient = await this.storage.getClientByLeadId(this.currentLeadId);
                if (this.currentClient) {
                    this.renderResult(this.currentClient);
                }
            }
        } else {
            content.innerHTML = `<span style="color: red;">Ошибка: ${response.error || 'Неизвестная ошибка'}</span>`;
        }
    }

    private renderResult(client: Client): void {
        const content = this.panelElement?.querySelector('.ai-panel__content');
        if (!content || !client.aiRecommendedStatus) return;

        const statusConfig = STATUS_CONFIG[client.aiRecommendedStatus];
        const date = client.aiLastAnalyzedAt ? new Date(client.aiLastAnalyzedAt).toLocaleString('ru-RU') : '';

        content.innerHTML = `
            <div class="ai-result">
                <div class="ai-result__score">Оценка: <b>${client.aiScore}</b> / 100</div>
                <div class="ai-result__status">
                    Рекомендация: <span class="ai-badge ${statusConfig?.className || ''}">${statusConfig?.icon || ''} ${statusConfig?.label || client.aiRecommendedStatus}</span>
                </div>
                <p class="ai-result__desc">${client.description}</p>
                <div class="ai-result__date">Анализ от: ${date}</div>
                <button class="btn btn-primary ai-apply-btn">✅ Применить рекомендуемый статус</button>
            </div>
        `;

        content.querySelector('.ai-apply-btn')?.addEventListener('click', async () => {
            if (!client.aiRecommendedStatus) return;
            await this.applyRecommendation(client.aiRecommendedStatus);
        });
    }

    private async applyRecommendation(status: ClientStatus): Promise<void> {
        if (!this.currentClient) return;

        this.currentClient.status = status;
        await this.storage.saveClient(this.currentClient);

        this.closePanel();
        location.reload();
    }

    private startResize(e: PointerEvent, container: HTMLElement): void {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = container.getBoundingClientRect().width;
        let isResizing = true;

        const handle = e.target as HTMLElement;
        handle.setPointerCapture(e.pointerId);

        const onResize = (ev: PointerEvent) => {
            if (!isResizing) return;
            const deltaX = startX - ev.clientX;
            let newWidth = startWidth + deltaX;

            // Ограничиваем ширину (например, от 300 до 800px)
            newWidth = Math.max(300, Math.min(newWidth, 800));
            container.style.width = `${newWidth}px`;
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            try { handle.releasePointerCapture(e.pointerId); } catch {}
            document.removeEventListener('pointermove', onResize);
            document.removeEventListener('pointerup', stopResize);
            document.removeEventListener('pointercancel', stopResize);
        };

        document.addEventListener('pointermove', onResize);
        document.addEventListener('pointerup', stopResize);
        document.addEventListener('pointercancel', stopResize);
    }

    private closePanel(): void {
        this.panelElement?.remove();
        this.panelElement = null;
    }
}