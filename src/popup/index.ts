import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';
import { STORAGE_KEYS } from '../shared/constants';
import type { ClientStatus } from '../shared/types';
import { StorageService } from '../shared/storage';
import { applyTheme } from '../shared/utils/theme';

// ====POPUP APP==============================================

class PopupApp {
    private storage = new StorageService();
    private highlightedStatuses: string[] = [];

    async init(): Promise<void> {
        await applyTheme();
        this.renderVersion();
        await this.loadSettings();
        await this.renderStats();
        this.addEventListeners();
    }

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('popupVersion');
        if (el) el.textContent = `v${version}`;
    }

    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.highlightedStatuses);
        const saved = result[STORAGE_KEYS.highlightedStatuses] as string[] | undefined;

        // Если настроек нет (первый запуск), включаем все статусы
        if (saved) {
            this.highlightedStatuses = saved;
        } else {
            this.highlightedStatuses = [...STATUS_ORDER, 'wild', 'unknown'];
        }
    }

    private async saveSettings(): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.highlightedStatuses]: this.highlightedStatuses });
    }

    private async renderStats(): Promise<void> {
        const container = document.getElementById('popupStats');
        if (!container) return;

        const clients = await this.storage.getAllClients();
        container.innerHTML = '';

        const total = document.createElement('div');
        total.className = 'popup-stat-total';
        total.innerHTML = `<span>Всего клиентов</span><strong>${clients.length}</strong>`;
        container.appendChild(total);

        // Добавляем wild и unknown в конец списка для настройки
        const allStatuses = [...STATUS_ORDER, 'wild', 'unknown'] as ClientStatus[];

        allStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];
            const count = clients.filter((c) => c.status === status).length;

            const isChecked = this.highlightedStatuses.includes(status);

            const row = document.createElement('label');
            row.className = 'popup-stat-row';
            row.innerHTML = `
                <input type="checkbox" class="popup-stat-checkbox" value="${status}" ${isChecked ? 'checked' : ''}>
                <span class="popup-stat-icon">${config.icon}</span>
                <span class="popup-stat-label" title="${config.label}">${config.label}</span>
                <span class="popup-stat-count">${count}</span>
            `;

            const checkbox = row.querySelector('input') as HTMLInputElement;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!this.highlightedStatuses.includes(status)) {
                        this.highlightedStatuses.push(status);
                    }
                } else {
                    this.highlightedStatuses = this.highlightedStatuses.filter(s => s !== status);
                }
                void this.saveSettings();
            });

            container.appendChild(row);
        });
    }

    private addEventListeners(): void {
        document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#settings') });
            window.close();
        });

        document.getElementById('openAnalyticsBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#analytics') });
            window.close();
        });

        document.getElementById('helpBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#features') });
            window.close();
        });

        // Выбрать все
        document.getElementById('selectAllBtn')?.addEventListener('click', () => {
            this.highlightedStatuses = [...STATUS_ORDER, 'wild', 'unknown'];
            void this.saveSettings();
            void this.renderStats();
        });

        // Снять все
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
            this.highlightedStatuses = [];
            void this.saveSettings();
            void this.renderStats();
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new PopupApp();
    void app.init();
});