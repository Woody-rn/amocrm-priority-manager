import type { Client } from '../shared/types';
import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';
import { StorageService } from '../shared/storage';
import { applyTheme } from '../shared/utils/theme';

// ====POPUP APP==============================================

class PopupApp {
    private storage = new StorageService();

    async init(): Promise<void> {
        await applyTheme();
        this.renderVersion();
        await this.renderStats();
        this.addEventListeners();
    }

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('popupVersion');
        if (el) el.textContent = `v${version}`;
    }

    private async renderStats(): Promise<void> {
        const container = document.getElementById('popupStats');
        if (!container) return;

        const clients = await this.storage.getAllClients();
        container.innerHTML = '';

        // Всего
        const total = document.createElement('div');
        total.className = 'popup-stat-total';
        total.innerHTML = `<span>Всего клиентов</span><strong>${clients.length}</strong>`;
        container.appendChild(total);

        // По статусам (только те, где есть клиенты)
        STATUS_ORDER.forEach((status) => {
            const count = clients.filter((c) => c.status === status).length;
            if (count === 0) return;

            const config = STATUS_CONFIG[status];
            const row = document.createElement('div');
            row.className = 'popup-stat-row';
            row.innerHTML = `
                <span class="popup-stat-icon">${config.icon}</span>
                <span class="popup-stat-label">${config.label}</span>
                <span class="popup-stat-count">${count}</span>
            `;
            container.appendChild(row);
        });
    }

    private addEventListeners(): void {
        // Открыть панель
        document.getElementById('openSidebarBtn')?.addEventListener('click', () => {
            // Получаем текущую активную вкладку
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    // Вызываем напрямую из popup (это разрешено)
                    chrome.sidePanel.open({ tabId: tabs[0].id })
                        .then(() => window.close())
                        .catch((err) => console.error('Ошибка:', err));
                }
            });
        });

        // Справка
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('help/help.html'), '_blank');
        });

        // Экспорт
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            void this.handleExport();
        });

        // Импорт
        document.getElementById('importBtn')?.addEventListener('click', () => {
            document.getElementById('importFile')?.click();
        });

        document.getElementById('importFile')?.addEventListener('change', (e) => {
            void this.handleImport(e);
        });

        // Очистка
        document.getElementById('clearAllBtn')?.addEventListener('click', () => {
            void this.handleClearAll();
        });
    }

    // ====ACTIONS==============================================

    private async handleExport(): Promise<void> {
        const clients = await this.storage.getAllClients();
        if (clients.length === 0) {
            this.notify('Нет данных для экспорта', 'error');
            return;
        }

        const json = JSON.stringify(clients, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `amo-clients-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 100);
        this.notify(`Экспортировано: ${clients.length} клиентов`);
    }

    private async handleImport(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const imported = JSON.parse(text) as Client[];

            if (!Array.isArray(imported)) {
                this.notify('Неверный формат файла', 'error');
                return;
            }

            await this.storage.saveAllClients(imported);
            await this.renderStats();
            this.notify(`Импортировано: ${imported.length} клиентов`);
        } catch (error) {
            console.error('[Popup] Ошибка импорта:', error);
            this.notify('Ошибка импорта', 'error');
        } finally {
            input.value = '';
        }
    }

    private async handleClearAll(): Promise<void> {
        const clients = await this.storage.getAllClients();
        if (clients.length === 0) {
            this.notify('Хранилище уже пусто', 'error');
            return;
        }

        const confirmed = confirm(
            `Удалить всех клиентов?\n\nБудет удалено: ${clients.length} записей\n\nЭто действие нельзя отменить!`
        );

        if (!confirmed) return;

        await this.storage.clearAll();
        await this.renderStats();
        this.notify(`Удалено: ${clients.length} клиентов`);
    }

    // ====NOTIFY===============================================

    private notify(message: string, type: 'success' | 'error' = 'success'): void {
        const old = document.querySelector('.popup-notification');
        if (old) old.remove();

        const notification = document.createElement('div');
        notification.className = `popup-notification popup-notification--${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('popup-notification--show'), 10);
        setTimeout(() => {
            notification.classList.remove('popup-notification--show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// ====BOOTSTRAP==============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new PopupApp();
    void app.init();
});