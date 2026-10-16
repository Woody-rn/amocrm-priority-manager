import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses.js';
import { StorageService } from '../shared/storage.js';

class PopupManager {
    constructor() {
        this.storage = new StorageService();
        this.init();
    }

    async init() {
        this.updateVersion();
        await this.loadStats();
        this.addEventListeners();
    }

    // Автоподстановка версии из manifest.json
    updateVersion() {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('versionText');
        if (el) {
            el.textContent = `v${version}`;
        }
    }

    async loadStats() {
        const clients = await this.storage.getAllClients();
        this.renderStats(clients);
    }

    renderStats(clients) {
        const statsList = document.getElementById('statsList');
        statsList.innerHTML = '';

        // Общее количество
        const totalItem = document.createElement('div');
        totalItem.className = 'stat-item total-stat';
        totalItem.innerHTML = `<span class="stat-label">Всего клиентов</span><span class="stat-count">${clients.length}</span>`;
        statsList.appendChild(totalItem);

        // По статусам
        STATUS_ORDER.forEach(status => {
            const config = STATUS_CONFIG[status];
            const count = clients.filter(c => c.status === status).length;

            const item = document.createElement('div');
            item.className = 'stat-item';
            item.innerHTML = `
                <span class="stat-icon">${config.icon}</span>
                <span class="stat-label">${config.label}</span>
                <span class="stat-count">${count}</span>
            `;
            statsList.appendChild(item);
        });
    }

    addEventListeners() {
        // Открыть боковую панель
        document.getElementById('openSidebarBtn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openSidebar' });
            window.close();
        });

        // Экспорт
        document.getElementById('exportBtn').addEventListener('click', async () => {
            try {
                const clients = await this.storage.getAllClients();
                const data = clients.map(c => c.toJSON());
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `amo-clients-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                this.showNotification(`Экспортировано: ${clients.length} клиентов`);
            } catch (error) {
                console.error('Export error:', error);
                this.showNotification('Ошибка экспорта', 'error');
            }
        });

        // Импорт
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const importedData = JSON.parse(text);

                    if (!Array.isArray(importedData)) {
                        throw new Error('Неверный формат файла');
                    }

                    await this.storage.saveAllClients(importedData);
                    await this.loadStats();

                    this.showNotification(`Импортировано: ${importedData.length} клиентов`);
                } catch (error) {
                    console.error('Import error:', error);
                    this.showNotification('Ошибка импорта', 'error');
                }

                e.target.value = '';
            }
        });

        // Очистить всё
        document.getElementById('clearAllBtn').addEventListener('click', async () => {
            const clients = await this.storage.getAllClients();
            
            if (clients.length === 0) {
                this.showNotification('Хранилище уже пусто', 'error');
                return;
            }

            const confirmed = confirm(
                `Удалить всех клиентов?\n\n` +
                `Будет удалено: ${clients.length} записей\n\n` +
                `Это действие нельзя отменить!`
            );

            if (confirmed) {
                await this.storage.saveAllClients([]);
                await this.loadStats();
                this.showNotification(`Удалено: ${clients.length} клиентов`);
            }
        });
    }

    showNotification(message, type = 'success') {
        const oldNotification = document.querySelector('.notification');
        if (oldNotification) oldNotification.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});