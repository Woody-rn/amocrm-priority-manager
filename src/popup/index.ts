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

        const total = document.createElement('div');
        total.className = 'popup-stat-total';
        total.innerHTML = `<span>Всего клиентов</span><strong>${clients.length}</strong>`;
        container.appendChild(total);

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
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.sidePanel.open({ tabId: tabs[0].id })
                        .then(() => window.close())
                        .catch((err) => console.error('[Popup] Ошибка открытия панели:', err));
                }
            });
        });

        // Настройки (открываем с хэшем #settings)
        document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#settings') });
            window.close();
        });

        // Аналитика (открываем с хэшем #analytics)
        document.getElementById('openAnalyticsBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#analytics') });
            window.close();
        });

        // Справка (открываем с хэшем #features)
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#features') });
            window.close();
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new PopupApp();
    void app.init();
});