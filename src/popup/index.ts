import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';
import { STORAGE_KEYS } from '../shared/constants';
import type { ClientStatus } from '../shared/types';
import { StorageService } from '../shared/storage';
import { applyTheme } from '../shared/utils/theme';

// ====POPUP APP==============================================

class PopupApp {
    private storage = new StorageService();

    // Глобальный профиль (из настроек)
    private profileStatuses: string[] = [];

    // Локальные галочки (только для быстрого скрытия)
    private visibleStatuses: string[] = [];

    async init(): Promise<void> {
        await applyTheme();
        this.renderVersion();
        await this.loadSettings();
        await this.renderDateGrouping();
        await this.renderStats();
        this.addEventListeners();
        this.setupStorageListener();
    }

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('popupVersion');
        if (el) el.textContent = `v${version}`;
    }

    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.highlightedStatuses);
        const saved = result[STORAGE_KEYS.highlightedStatuses] as string[] | undefined;

        // Это наш профиль из настроек
        this.profileStatuses = saved || [...STATUS_ORDER, 'wild', 'unknown'];

        // По умолчанию в Popup показываем всё, что есть в профиле
        this.visibleStatuses = [...this.profileStatuses];
    }

    private async renderDateGrouping(): Promise<void> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.groupTasksByDate);
        const groupTasksByDate = result[STORAGE_KEYS.groupTasksByDate] === true;

        const toggle = document.getElementById('groupTasksByDateToggle') as HTMLInputElement;
        if (toggle) {
            toggle.checked = groupTasksByDate;
            toggle.addEventListener('change', async () => {
                await chrome.storage.local.set({ [STORAGE_KEYS.groupTasksByDate]: toggle.checked });
            });
        }
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

        // Конфигурация групп
        const groups: { statuses: ClientStatus[]; isCold?: boolean }[] = [
            { statuses: ['new'] },
            { statuses: ['hot', 'warm'] },
            { statuses: ['active', 'renewal'] },
            {
                statuses: ['cold_competitor_software', 'cold_competitor_dealer', 'cold_refusal_demo', 'cold_refusal_start', 'passive'],
                isCold: true
            },
            { statuses: ['unclear', 'dead', 'not_target'] }
        ];

        groups.forEach(group => {
            // Показываем только те, что есть в ГЛОБАЛЬНОМ профиле
            const allowedGroupStatuses = group.statuses.filter(s => this.profileStatuses.includes(s));

            if (allowedGroupStatuses.length === 0) return;

            const groupEl = document.createElement('div');
            groupEl.className = 'popup-status-group';
            if (group.isCold) {
                groupEl.classList.add('popup-status-group--cold');
            }

            const gridEl = document.createElement('div');
            gridEl.className = 'popup-status-group-grid';

            allowedGroupStatuses.forEach((status) => {
                const config = STATUS_CONFIG[status];
                const count = clients.filter((c) => c.status === status).length;

                // Проверяем, стоит ли галочка в ЛОКАЛЬНОМ фильтре
                const isChecked = this.visibleStatuses.includes(status);

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
                        if (!this.visibleStatuses.includes(status)) {
                            this.visibleStatuses.push(status);
                        }
                    } else {
                        this.visibleStatuses = this.visibleStatuses.filter(s => s !== status);
                    }
                    // Сохраняем локальный фильтр в отдельное хранилище
                    void this.saveQuickFilter();
                });

                gridEl.appendChild(row);
            });

            groupEl.appendChild(gridEl);
            container.appendChild(groupEl);
        });
    }

    private async saveQuickFilter(): Promise<void> {
        // Сохраняем локальные галочки в отдельный ключ (quickFilterStatuses)
        // Технические статусы (wild, unknown) всегда должны быть включены в подсветку,
        // но в Popup мы их не показываем.
        const toSave = Array.from(new Set([...this.visibleStatuses, 'wild', 'unknown']));
        await chrome.storage.local.set({ 'quickFilterStatuses': toSave });
    }

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes[STORAGE_KEYS.highlightedStatuses]) {
                // Если профиль изменился в настройках — обновляем Popup
                this.profileStatuses = changes[STORAGE_KEYS.highlightedStatuses].newValue || [];
                // Сбрасываем локальный фильтр, чтобы он соответствовал новому профилю
                this.visibleStatuses = [...this.profileStatuses];
                void this.renderStats();
            }
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

        // Выбрать все (включает все, что есть в ПРОФИЛЕ)
        document.getElementById('selectAllBtn')?.addEventListener('click', () => {
            this.visibleStatuses = [...this.profileStatuses];
            void this.saveQuickFilter();
            void this.renderStats();
        });

        // Снять все
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
            this.visibleStatuses = [];
            void this.saveQuickFilter();
            void this.renderStats();
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new PopupApp();
    void app.init();
});