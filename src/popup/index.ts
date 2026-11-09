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
        // Технические статусы (wild, unknown) должны быть всегда включены,
        // чтобы расширение могло их подсвечивать, даже если пользователь нажал "Ничего"
        const toSave = Array.from(new Set([...this.highlightedStatuses, 'wild', 'unknown']));
        await chrome.storage.local.set({ [STORAGE_KEYS.highlightedStatuses]: toSave });
    }

    private async renderStats(): Promise<void> {
        const container = document.getElementById('popupStats');
        if (!container) return;

        const clients = await this.storage.getAllClients();
        container.innerHTML = '';

        // Общий счетчик
        const total = document.createElement('div');
        total.className = 'popup-stat-total';
        total.innerHTML = `<span>Всего клиентов</span><strong>${clients.length}</strong>`;
        container.appendChild(total);

        // Конфигурация групп (без заголовков и без технических статусов)
        const groups: { statuses: ClientStatus[]; isCold?: boolean }[] = [
            { statuses: ['new'] },
            { statuses: ['hot', 'warm'] },
            { statuses: ['active', 'renewal'] },
            {
                statuses: ['cold_competitor_software', 'cold_competitor_dealer', 'cold_refusal_demo', 'cold_refusal_start', 'passive'],
                isCold: true
            },
            { statuses: ['unclear', 'dead', 'not_target'] } // Оставили только пользовательские
        ];

        groups.forEach(group => {
            // Создаем контейнер группы
            const groupEl = document.createElement('div');
            groupEl.className = 'popup-status-group';
            if (group.isCold) {
                groupEl.classList.add('popup-status-group--cold');
            }

            // Сетка для чекбоксов
            const gridEl = document.createElement('div');
            gridEl.className = 'popup-status-group-grid';

            // Рендерим каждый статус
            group.statuses.forEach((status) => {
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

                gridEl.appendChild(row);
            });

            groupEl.appendChild(gridEl);
            container.appendChild(groupEl);
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

        // Выбрать все (включая технические)
        document.getElementById('selectAllBtn')?.addEventListener('click', () => {
            this.highlightedStatuses = [...STATUS_ORDER, 'wild', 'unknown'];
            void this.saveSettings();
            void this.renderStats();
        });

        // Снять все (оставляем только технические для работы)
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
            this.highlightedStatuses = []; // saveSettings сам добавит wild и unknown
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