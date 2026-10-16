import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses.js';
import { StorageService } from '../shared/storage.js';

class SidebarManager {
    constructor() {
        this.storage = new StorageService();
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.changelog = null;
        this.helpOpen = false;
        this.init();
    }

    async init() {
        await this.loadClients();
        await this.loadChangelog();
        await this.loadHelpState();
        this.addEventListeners();
        this.startStorageListener();
        this.addHelpListeners();
    }

    // Слушаем изменения в хранилище
    startStorageListener() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.clients) {
                console.log('Данные изменились, обновляем sidebar...');
                this.loadClients();
            }
        });
    }

    async loadClients() {
        const clients = await this.storage.getAllClients();
        this.renderStats(clients);
        this.renderClients(clients);
    }

    // Поиск по всем полям
    searchClients(clients, query) {
        if (!query.trim()) return clients;

        query = query.toLowerCase().trim();

        return clients.filter(client => {
            return Object.values(client.toJSON()).some(value => {
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(query);
            });
        });
    }

    renderStats(clients) {
        const statsList = document.getElementById('statsList');
        statsList.innerHTML = '';

        // Общее количество
        const totalItem = document.createElement('div');
        totalItem.className = 'stat-item total-stat';
        totalItem.innerHTML = `<span class="stat-label">Всего клиентов: ${clients.length}</span>`;
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
                <span class="stat-description">${config.description}</span>
                <span class="stat-count">${count}</span>
            `;
            statsList.appendChild(item);
        });
    }

    renderClients(clients) {
        const clientsList = document.getElementById('clientsList');
        clientsList.innerHTML = '';

        // Фильтр по статусу
        let filteredClients = this.currentFilter === 'all'
            ? clients
            : clients.filter(c => c.status === this.currentFilter);

        // Поиск
        filteredClients = this.searchClients(filteredClients, this.searchQuery);

        if (filteredClients.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = this.searchQuery
                ? `По запросу "${this.searchQuery}" ничего не найдено`
                : 'Нет клиентов';
            clientsList.appendChild(emptyMessage);
            return;
        }

        // Сортировка по дате
        filteredClients.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        filteredClients.forEach(client => {
            const item = document.createElement('div');
            item.className = 'client-item';

            // Имя с подсветкой
            const name = document.createElement('span');
            name.className = 'client-name';
            name.title = client.name;

            if (this.searchQuery.trim()) {
                name.innerHTML = this.highlightText(client.name, this.searchQuery);
            } else {
                name.textContent = client.name;
            }

            // Select статуса
            const select = document.createElement('select');
            select.className = 'status-select';
            select.dataset.clientName = client.name;

            STATUS_ORDER.forEach(status => {
                const conf = STATUS_CONFIG[status];
                const option = document.createElement('option');
                option.value = status;
                option.textContent = `${conf.icon} ${conf.label}`;
                if (status === client.status) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            // Дата
            const date = document.createElement('span');
            date.className = 'client-date';
            date.textContent = new Date(client.updatedAt).toLocaleDateString('ru-RU');

            // Кнопка удаления
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Удалить клиента';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Удалить "${client.name}"?`)) {
                    await this.storage.deleteClient(client.name);
                    await this.loadClients();
                    this.showNotification(`"${client.name}" удалён`);
                }
            });

            item.appendChild(name);
            item.appendChild(select);
            item.appendChild(date);
            item.appendChild(deleteBtn);

            clientsList.appendChild(item);
        });
    }

    // Подсветка текста
    highlightText(text, query) {
        if (!query.trim()) return text;

        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    addEventListeners() {
        // Поиск
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        searchInput.addEventListener('input', () => {
            this.searchQuery = searchInput.value;

            if (searchInput.value) {
                clearSearchBtn.style.display = 'flex';
            } else {
                clearSearchBtn.style.display = 'none';
            }

            this.loadClients();
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            clearSearchBtn.style.display = 'none';
            this.loadClients();
            searchInput.focus();
        });

        // Фильтры
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.filter;
                document.querySelectorAll('[data-filter]').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.loadClients();
            });
        });

        // Изменение статуса
        document.addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-select')) {
                const clientName = e.target.dataset.clientName;
                const newStatus = e.target.value;

                const clients = await this.storage.getAllClients();
                const client = clients.find(c => c.name === clientName);

                if (client) {
                    client.status = newStatus;
                    client.updatedAt = new Date().toISOString();
                    await this.storage.saveClient(client);
                    await this.loadClients();
                    this.showNotification(`Статус "${clientName}" обновлён`);
                }
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

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // ============ Справка ============

    async loadChangelog() {
        try {
            // Проверяем кеш
            const cached = await this.getCachedChangelog();
            if (cached) {
                this.changelog = cached;
                this.renderChangelog();
                return;
            }

            // Загружаем из файла
            const url = chrome.runtime.getURL('changelog.json');
            const response = await fetch(url);
            const data = await response.json();

            this.changelog = data;

            // Сохраняем в кеш
            await this.cacheChangelog(data);

            this.renderChangelog();
        } catch (error) {
            console.error('Ошибка загрузки changelog:', error);
        }
    }

    async getCachedChangelog() {
        return new Promise((resolve) => {
            chrome.storage.local.get('changelogCache', (result) => {
                const cache = result.changelogCache;
                if (!cache) {
                    resolve(null);
                    return;
                }

                // Проверяем версию — если изменилась, сбрасываем кеш
                const currentVersion = chrome.runtime.getManifest().version;
                if (cache.version !== currentVersion) {
                    console.log(`Версия изменилась: ${cache.version} → ${currentVersion}. Сбрасываем кеш.`);
                    chrome.storage.local.remove('changelogCache');
                    resolve(null);
                    return;
                }

                // Проверяем срок жизни кеша (24 часа)
                const cacheAge = Date.now() - cache.timestamp;
                const maxAge = 24 * 60 * 60 * 1000;

                if (cacheAge > maxAge) {
                    console.log('Кеш устарел. Сбрасываем.');
                    chrome.storage.local.remove('changelogCache');
                    resolve(null);
                    return;
                }

                resolve(cache.data);
            });
        });
    }

    async cacheChangelog(data) {
        const currentVersion = chrome.runtime.getManifest().version;
        
        return new Promise((resolve) => {
            chrome.storage.local.set({
                changelogCache: {
                    data,
                    version: currentVersion,
                    timestamp: Date.now()
                }
            }, resolve);
        });
    }

    async loadHelpState() {
        return new Promise((resolve) => {
            chrome.storage.local.get('helpOpen', (result) => {
                this.helpOpen = result.helpOpen || false;

                if (this.helpOpen) {
                    this.openHelp();
                }

                resolve();
            });
        });
    }

    renderChangelog() {
        if (!this.changelog) return;

        // Функционал
        const featuresList = document.getElementById('featuresList');
        if (featuresList) {
            featuresList.innerHTML = '';
            this.changelog.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                featuresList.appendChild(li);
            });
        }

        // История версий
        const versionsList = document.getElementById('versionsList');
        if (versionsList) {
            versionsList.innerHTML = '';
            const currentVersion = this.changelog.currentVersion;

            this.changelog.versions.forEach(v => {
                const item = document.createElement('div');
                item.className = 'version-item';

                const isCurrent = v.version === currentVersion;

                item.innerHTML = `
                <div class="version-header">
                    <span class="version-number ${isCurrent ? 'current' : ''}">
                        v${v.version}${isCurrent ? ' ⬅️ текущая' : ''}
                    </span>
                    <span class="version-date">${v.date}</span>
                </div>
                <ul class="version-changes">
                    ${v.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            `;

                versionsList.appendChild(item);
            });
        }
    }

    addHelpListeners() {
        const toggle = document.getElementById('helpToggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.toggleHelp();
            });
        }
    }

    toggleHelp() {
        this.helpOpen = !this.helpOpen;

        if (this.helpOpen) {
            this.openHelp();
        } else {
            this.closeHelp();
        }

        // Сохраняем состояние
        chrome.storage.local.set({ helpOpen: this.helpOpen });
    }

    openHelp() {
        const content = document.getElementById('helpContent');
        const arrow = document.getElementById('helpArrow');

        if (content) {
            content.style.display = 'block';
            content.style.animation = 'slideDown 0.3s ease-out';
        }
        if (arrow) {
            arrow.classList.add('open');
        }
    }

    closeHelp() {
        const content = document.getElementById('helpContent');
        const arrow = document.getElementById('helpArrow');

        if (content) {
            content.style.display = 'none';
        }
        if (arrow) {
            arrow.classList.remove('open');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});