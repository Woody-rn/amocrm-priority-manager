// ============ Плавающая ручка для открытия sidebar ============
class SidebarHandle {
    constructor() {
        this.handle = null;
        this.isDragging = false;
        this.startY = 0;
        this.currentY = 0;
        this.init();
    }

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createHandle());
        } else {
            await this.createHandle();
        }
    }

    async createHandle() {
        if (document.getElementById('amocrm-handle')) return;

        const handle = document.createElement('div');
        handle.id = 'amocrm-handle';

        chrome.storage.local.get(['handlePosition'], (result) => {
            const savedPosition = result.handlePosition || 200;
            handle.style.top = savedPosition + 'px';
            this.currentY = savedPosition;
        });

        handle.innerHTML = `
            <div class="handle-icon">📊</div>
            <div class="handle-text">Панель</div>
        `;

        Object.assign(handle.style, {
            position: 'fixed',
            right: '0',
            top: '200px',
            zIndex: '999998',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            color: 'white',
            padding: '14px 6px',
            borderRadius: '8px 0 0 8px',
            boxShadow: '-2px 2px 10px rgba(108, 92, 231, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            userSelect: 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRight: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: '500',
            minWidth: '28px',
        });

        // Вертикальный текст
        const textEl = handle.querySelector('.handle-text');
        textEl.style.writingMode = 'vertical-rl';
        textEl.style.textOrientation = 'mixed';
        textEl.style.letterSpacing = '1px';

        handle.addEventListener('mousedown', (e) => this.startDrag(e));
        handle.addEventListener('click', () => {
            if (!this.isDragging) {
                this.toggleSidebar();
            }
        });

        handle.addEventListener('mouseenter', () => {
            handle.style.transform = 'translateX(-4px)';
            handle.style.boxShadow = '-4px 2px 15px rgba(108, 92, 231, 0.4)';
        });

        handle.addEventListener('mouseleave', () => {
            handle.style.transform = 'translateX(0)';
            handle.style.boxShadow = '-2px 2px 10px rgba(108, 92, 231, 0.3)';
        });

        document.body.appendChild(handle);
        this.handle = handle;
    }

    startDrag(e) {
        this.isDragging = false;
        if (!this.handle) return;

        this.startY = e.clientY;
        const handleRect = this.handle.getBoundingClientRect();
        this.currentY = handleRect.top;

        const onDrag = (e) => {
            this.isDragging = true;
            const deltaY = e.clientY - this.startY;
            let newY = this.currentY + deltaY;

            const maxY = window.innerHeight - this.handle.offsetHeight - 10;
            newY = Math.max(10, Math.min(newY, maxY));

            this.handle.style.top = newY + 'px';
            chrome.storage.local.set({handlePosition: newY});
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            setTimeout(() => {
                this.isDragging = false;
            }, 10);
        };

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }

    toggleSidebar() {
        chrome.runtime.sendMessage({action: 'openSidebar'});
    }
}

// Запускаем создание ручки
new SidebarHandle();

// ============ Конфигурация страниц ============
const PAGE_CONFIG = {
    todo: {
        urlPattern: /\/todo/,
        selectors: ['a.js-navigate-link[href*="/leads/detail/"]'],
        titleCleanup: (title) => {
            return title
                .replace(/^[+-]\s*\d+\s*/, '')
                .trim()
                .replace(/\s+/g, ' ');
        },
        autoCollect: true
    },
    leadsList: {
        urlPattern: /\/leads\/list\//,
        selectors: ['a.js-navigate-link[href*="/leads/detail/"]'],
        titleCleanup: (title) => {
            return title
                .replace(/^[+-]\s*\d+\s*/, '')
                .trim()
                .replace(/\s+/g, ' ');
        },
        autoCollect: false
    },
    detail: {
        urlPattern: /\/leads\/detail/,
        selectors: ['textarea#person_n'],
        titleCleanup: (title) => {
            return title
                .replace(/^[+-]\s*\d+\s*/, '')
                .trim()
                .replace(/\s+/g, ' ');
        },
        autoCollect: false
    }
};

// ============ Модели ============
class Client {
    constructor(name, status = 'blue') {
        this.name = name;
        this.status = status;
        this.updatedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            status: this.status,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        const client = new Client(data.name, data.status);
        client.updatedAt = data.updatedAt;
        return client;
    }
}

// ============ Сервисы ============
class StorageService {
    constructor() {
        this.storage = chrome.storage.local;
        this.KEY = 'clients';
    }

    async getAllClients() {
        return new Promise((resolve) => {
            this.storage.get(this.KEY, (result) => {
                const clients = result[this.KEY] || [];
                resolve(clients.map(c => Client.fromJSON(c)));
            });
        });
    }

    async getClient(name) {
        const clients = await this.getAllClients();
        return clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    }

    async saveClient(client) {
        const clients = await this.getAllClients();
        const index = clients.findIndex(c => c.name.toLowerCase() === client.name.toLowerCase());

        if (index !== -1) {
            clients[index] = client;
        } else {
            clients.push(client);
        }

        await this.saveAllClients(clients);
    }

    async saveAllClients(clients) {
        return new Promise((resolve) => {
            this.storage.set({[this.KEY]: clients.map(c => c.toJSON())}, resolve);
        });
    }

    async saveNewClients(newClients) {
        const existingClients = await this.getAllClients();
        const existingNames = new Set(existingClients.map(c => c.name.toLowerCase()));

        // Дедупликация внутри newClients + фильтр по existing
        const uniqueToAdd = [];
        const seenInBatch = new Set();

        newClients.forEach(client => {
            const key = client.name.toLowerCase();

            // Пропускаем, если уже есть в БД
            if (existingNames.has(key)) return;

            // Пропускаем, если уже добавили в этой партии
            if (seenInBatch.has(key)) return;

            seenInBatch.add(key);
            uniqueToAdd.push(client);
        });

        if (uniqueToAdd.length > 0) {
            const allClients = [...existingClients, ...uniqueToAdd];
            await this.saveAllClients(allClients);
            console.log(`Добавлено новых клиентов: ${uniqueToAdd.length}`);
            return uniqueToAdd.length;
        }

        return 0;
    }
}

// ============ Конфигурация статусов ============
const STATUS_CONFIG = {
    green: {
        label: 'Горячий',
        icon: '🔥',
        color: '#4caf50',
        className: 'priority-green'
    },
    purple: {
        label: 'Действующий',
        icon: '⭐',
        color: '#9c27b0',
        className: 'priority-purple'
    },
    teal: {
        label: 'Продление',
        icon: '🔄',
        color: '#009688',
        className: 'priority-teal'
    },
    blue: {
        label: 'Новый',
        icon: '🆕',
        color: '#2196f3',
        className: 'priority-blue'
    },
    yellow: {
        label: 'Тёплый',
        icon: '🤔',
        color: '#ffeb3b',
        className: 'priority-yellow'
    },
    orange: {
        label: 'Холодный',
        icon: '🥶',
        color: '#ff9800',
        className: 'priority-orange'
    },
    red: {
        label: 'Мёртвый',
        icon: '💀',
        color: '#f44336',
        className: 'priority-red'
    },
    // Wild — только для content.js, НЕ сохраняется в БД
    wild: {
        label: 'Wild',
        icon: '🍒',
        color: '#81d4fa',
        className: 'priority-wild'
    }
};

// Статусы, которые НЕ сохраняются в БД
const NON_SAVABLE_STATUSES = ['wild'];

// ============ Основной класс ============
class PriorityManager {
    constructor() {
        this.storageService = new StorageService();
        this.observer = null;
        this.urlObserver = null;
        this.currentPage = this.detectPage();
        this.lastUrl = location.href;
        this.init();
    }

    detectPage() {
        const url = window.location.href;

        if (PAGE_CONFIG.todo.urlPattern.test(url)) {
            return 'todo';
        }
        if (PAGE_CONFIG.detail.urlPattern.test(url)) {
            return 'detail';
        }
        if (PAGE_CONFIG.leadsList.urlPattern.test(url)) {
            return 'leadsList';
        }
        return null;
    }

    async init() {
        if (!this.currentPage) {
            console.log('Priority Manager: страница не поддерживается');
            return;
        }

        console.log(`Priority Manager: работаем на странице ${this.currentPage}`);

        if (PAGE_CONFIG[this.currentPage].autoCollect) {
            await this.collectNewClients();
        }

        await this.scanPage();
        this.startObserver();
        this.startUrlWatcher();
        this.addEventListeners();
    }

    // ============ Отслеживание изменений URL ============
    startUrlWatcher() {
        this.urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== this.lastUrl) {
                this.lastUrl = url;
                this.handleUrlChange();
            }
        });

        this.urlObserver.observe(document, {
            subtree: true,
            childList: true
        });
    }

    async handleUrlChange() {
        const newPage = this.detectPage();

        console.log(`🔗 URL изменился. Страница: ${this.currentPage} → ${newPage}`);

        // Если страница та же — выходим
        if (newPage === this.currentPage) {
            return;
        }

        // Очищаем старые бейджи и классы
        this.cleanup();

        // Обновляем текущую страницу
        this.currentPage = newPage;

        // Если страница не поддерживается — выходим
        if (!this.currentPage) {
            console.log('Priority Manager: новая страница не поддерживается');
            return;
        }

        console.log(`Priority Manager: переключились на ${this.currentPage}`);

        // Запускаем логику для новой страницы сразу
        if (PAGE_CONFIG[this.currentPage].autoCollect) {
            await this.collectNewClients();
        }

        await this.scanPage();
    }

    cleanup() {
        // Убираем бейджи
        document.querySelectorAll('.priority-badge').forEach(b => b.remove());
        document.querySelectorAll('.priority-badge-fixed').forEach(b => b.remove());

        // Убираем панели
        this.hideQuickPanel();

        // Убираем классы подсветки
        document.querySelectorAll('.priority-client').forEach(el => {
            el.classList.remove('priority-client');
            Object.values(STATUS_CONFIG).forEach(s => {
                el.classList.remove(s.className);
            });
        });

        console.log('🧹 Очистка завершена');
    }

    // ============ Автосбор ============
    async collectNewClients() {
        const elements = this.findClientElements();
        const newClients = [];

        for (const element of elements) {
            const clientName = this.extractCompanyName(element);
            if (!clientName) continue;

            const existingClient = await this.storageService.getClient(clientName);

            if (!existingClient) {
                const newClient = new Client(clientName, 'blue');
                newClients.push(newClient);
            }
        }

        if (newClients.length > 0) {
            await this.storageService.saveNewClients(newClients);
            console.log(`Автоматически добавлено клиентов: ${newClients.length}`);
        }
    }

    findClientElements() {
        const pageConfig = PAGE_CONFIG[this.currentPage];
        if (!pageConfig) return [];

        const elements = [];

        pageConfig.selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                elements.push(element);
            });
        });

        return elements;
    }

    extractCompanyName(element) {
        const pageConfig = PAGE_CONFIG[this.currentPage];

        // Защита: если pageConfig нет — возвращаем пустую строку
        if (!pageConfig || !pageConfig.titleCleanup) {
            return '';
        }

        let title;
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            title = element.value || element.getAttribute('placeholder') || element.textContent;
        } else {
            title = element.getAttribute('title') || element.textContent;
        }

        if (!title) return '';

        const cleaned = pageConfig.titleCleanup(title);
        return cleaned;
    }

    async getClientStatus(clientName) {
        const client = await this.storageService.getClient(clientName);
        if (client) {
            return client.status;
        }
        return 'blue';
    }

    async highlightElement(element) {
        const clientName = this.extractCompanyName(element);
        if (!clientName) return;

        // Проверяем, есть ли клиент в БД
        const client = await this.storageService.getClient(clientName);

        let status;

        if (!client) {
            if (this.currentPage === 'todo') {
                status = 'blue';
            } else {
                // На других страницах — показываем 'wild'
                status = 'wild';
            }
        } else {
            status = client.status;
        }

        const config = STATUS_CONFIG[status];

        Object.values(STATUS_CONFIG).forEach(s => {
            element.classList.remove(s.className);
        });

        element.classList.add('priority-client', config.className);

        this.addBadge(element, config);

        element.dataset.clientName = clientName;
        element.dataset.status = status;
    }

    addBadge(element, config) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            const parent = element.parentElement;
            if (!parent) return;

            const oldBadge = parent.querySelector('.priority-badge-fixed');
            if (oldBadge) oldBadge.remove();

            const badge = document.createElement('span');
            badge.className = `priority-badge-fixed priority-badge-${config.className.replace('priority-', '')}`;
            // Для wild — только текст, для остальных — иконка + текст
            badge.textContent = config.icon ? `${config.icon} ${config.label}` : config.label;

            badge.style.position = 'absolute';
            badge.style.bottom = '-20px';
            badge.style.right = '0px';
            badge.style.zIndex = '99999';
            badge.style.fontSize = '11px';
            badge.style.padding = '4px 8px';
            badge.style.backgroundColor = config.color;
            badge.style.color = 'white';
            badge.style.borderRadius = '12px';
            badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            badge.style.pointerEvents = 'none';
            badge.style.display = 'inline-block';
            badge.style.whiteSpace = 'nowrap';

            // Для светлых цветов (жёлтый, wild) — тёмный текст
            if (config.className === 'priority-yellow' || config.className === 'priority-wild') {
                badge.style.color = '#333';
            }

            parent.style.position = 'relative';
            parent.style.overflow = 'visible';

            parent.appendChild(badge);

        } else {
            const oldBadge = element.querySelector('.priority-badge');
            if (oldBadge) oldBadge.remove();

            const badge = document.createElement('span');
            badge.className = `priority-badge priority-badge-${config.className.replace('priority-', '')}`;
            // Для wild — только текст, для остальных — иконка + текст
            badge.textContent = config.icon ? `${config.icon} ${config.label}` : config.label;
            element.appendChild(badge);
        }
    }

    async scanPage() {
        // Защита: если страница не поддерживается — выходим
        if (!this.currentPage || !PAGE_CONFIG[this.currentPage]) {
            return;
        }

        const elements = this.findClientElements();
        console.log(`Найдено элементов: ${elements.length}`);

        for (const element of elements) {
            await this.highlightElement(element);
        }
    }

    showQuickPanel(element, event) {
        this.hideQuickPanel();

        const panel = document.createElement('div');
        panel.className = 'quick-panel';
        panel.dataset.panelFor = element.dataset.clientName;

        Object.entries(STATUS_CONFIG).forEach(([status, config]) => {
            // Пропускаем 'wild' — его нет в панели
            if (status === 'wild') return;

            const button = document.createElement('button');
            button.style.backgroundColor = config.color;
            button.textContent = `${config.icon} ${config.label}`;

            // Выделяем текущий статус ТОЛЬКО если это не 'wild'
            if (element.dataset.status !== 'wild' && status === element.dataset.status) {
                button.style.border = '3px solid #333';
                button.style.transform = 'scale(1.1)';
            }

            button.addEventListener('click', async () => {
                await this.setClientStatus(element.dataset.clientName, status);
                this.hideQuickPanel();
            });

            panel.appendChild(button);
        });

        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        panel.style.position = 'absolute';
        panel.style.left = (rect.right + scrollX + 10) + 'px';
        panel.style.top = (rect.top + scrollY) + 'px';
        panel.style.zIndex = '99999';

        document.body.appendChild(panel);
    }

    hideQuickPanel() {
        const panels = document.querySelectorAll('.quick-panel');
        panels.forEach(p => p.remove());
    }

    async setClientStatus(clientName, status) {
        // Защита: 'wild' не должен сохраняться в БД
        if (NON_SAVABLE_STATUSES.includes(status)) {
            console.warn(`Статус "${status}" не сохраняется в БД`);
            return;
        }

        const client = new Client(clientName, status);
        await this.storageService.saveClient(client);
        await this.scanPage();
    }

    addEventListeners() {
        document.addEventListener('mouseover', (e) => {
            const element = e.target.closest('a.js-navigate-link, textarea#person_n');
            if (element && element.dataset.clientName) {
                this.showQuickPanel(element, e);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = e.target.closest('a.js-navigate-link, textarea#person_n');
            if (element && !e.relatedTarget?.closest('.quick-panel')) {
                setTimeout(() => {
                    if (!document.querySelector('.quick-panel:hover')) {
                        this.hideQuickPanel();
                    }
                }, 100);
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.quick-panel') &&
                !e.target.closest('a.js-navigate-link') &&
                !e.target.closest('textarea#person_n')) {
                this.hideQuickPanel();
            }
        });
    }

    startObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    const hasNewElements = Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType === 1) {
                            return node.querySelector?.('a.js-navigate-link, textarea#person_n') ||
                                node.classList?.contains('js-navigate-link');
                        }
                        return false;
                    });

                    if (hasNewElements && this.currentPage) {
                        if (PAGE_CONFIG[this.currentPage]?.autoCollect) {
                            this.collectNewClients().then(() => this.scanPage());
                        } else {
                            this.scanPage();
                        }
                    }
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Запускаем когда страница готова
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const manager = new PriorityManager();
    });
} else {
    const manager = new PriorityManager();
}