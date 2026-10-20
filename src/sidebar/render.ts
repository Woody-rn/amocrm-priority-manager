import type { Client, ClientStatus } from '../shared/types';
import { STATUS_CONFIG, STATUS_ORDER, GROUP_ORDER, GROUP_LABELS } from '../shared/statuses';

// ====RENDER STATS===========================================

export function renderStats(container: HTMLElement, clients: Client[]): void {
    container.innerHTML = '';

    // 1. Всего клиентов
    const total = document.createElement('div');
    total.className = 'stats-total';
    total.innerHTML = `<span class="stats-total-label">Всего клиентов</span><span class="stats-total-count">${clients.length}</span>`;
    container.appendChild(total);

    // 2. Группы статусов
    GROUP_ORDER.forEach((group) => {
        const groupStatuses = STATUS_ORDER.filter((s) => STATUS_CONFIG[s].group === group);
        if (groupStatuses.length === 0) return;

        const groupCount = clients.filter((c) => groupStatuses.includes(c.status)).length;

        // Показываем только непустые группы
        if (groupCount === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'stats-group';

        // Заголовок группы
        const header = document.createElement('div');
        header.className = 'stats-group__header';
        header.innerHTML = `
            <span class="stats-group__title">${GROUP_LABELS[group]}</span>
            <span class="stats-group__count">${groupCount}</span>
            <button class="stats-group__toggle">▼</button>
        `;
        groupDiv.appendChild(header);

        // Детализация по статусам
        const details = document.createElement('div');
        details.className = 'stats-group__details';

        groupStatuses.forEach((status) => {
            const count = clients.filter((c) => c.status === status).length;
            if (count === 0) return;

            const config = STATUS_CONFIG[status];
            const row = document.createElement('div');
            row.className = 'stat-item';
            row.innerHTML = `
                <span class="stat-icon">${config.icon}</span>
                <span class="stat-label">${config.label}</span>
                <span class="stat-count">${count}</span>
            `;
            details.appendChild(row);
        });

        groupDiv.appendChild(details);

        // Логика сворачивания
        header.addEventListener('click', () => {
            const isHidden = details.style.display === 'none';
            details.style.display = isHidden ? 'block' : 'none';
            const btn = header.querySelector('.stats-group__toggle');
            if (btn) btn.textContent = isHidden ? '▼' : '▶';
        });

        container.appendChild(groupDiv);
    });
}

// ====RENDER CLIENTS=========================================

export interface ClientCallbacks {
    onStatusChange: (id: string, status: ClientStatus) => void;
    onDelete: (id: string) => void;
}

export function renderClients(
    container: HTMLElement,
    clients: Client[],
    searchQuery: string,
    baseUrl: string, // Добавлен аргумент
    callbacks: ClientCallbacks
): void {
    container.innerHTML = '';

    if (clients.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'clients-empty';
        empty.textContent = searchQuery
            ? `По запросу "${searchQuery}" ничего не найдено`
            : 'Нет клиентов';
        container.appendChild(empty);
        return;
    }

    const sorted = [...clients].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    sorted.forEach((client) => {
        container.appendChild(renderClientItem(client, searchQuery, baseUrl, callbacks));
    });
}

// ====RENDER CLIENT ITEM=====================================

function renderClientItem(
    client: Client,
    searchQuery: string,
    baseUrl: string, // Добавлен аргумент
    callbacks: ClientCallbacks
): HTMLElement {
    const config = STATUS_CONFIG[client.status];

    const item = document.createElement('div');
    item.className = 'client-item';

    // Имя + ссылка
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'client-name-wrapper';

    if (client.leadId) {
        const link = document.createElement('a');
        // Используем переданный baseUrl, fallback на пустую строку (относительный путь)
        link.href = baseUrl ? `${baseUrl}/leads/detail/${client.leadId}` : `/leads/detail/${client.leadId}`;
        link.className = 'client-link';
        link.title = 'Открыть сделку в amoCRM';
        link.target = '_blank';
        link.textContent = '🔗';
        nameWrapper.appendChild(link);
    }

    const name = document.createElement('span');
    name.className = 'client-name';
    name.title = client.name;

    if (searchQuery.trim()) {
        name.innerHTML = highlightText(client.name, searchQuery);
    } else {
        name.textContent = client.name;
    }

    nameWrapper.appendChild(name);
    item.appendChild(nameWrapper);

    // Селект статуса
    const select = document.createElement('select');
    select.className = 'client-status-select';
    select.dataset.clientId = client.id;

    STATUS_ORDER.forEach((status) => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = `${STATUS_CONFIG[status].icon} ${STATUS_CONFIG[status].fullLabel}`;
        if (status === client.status) option.selected = true;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        callbacks.onStatusChange(
            client.id,
            (e.target as HTMLSelectElement).value as ClientStatus
        );
    });

    item.appendChild(select);

    // Дата
    const date = document.createElement('span');
    date.className = 'client-date';
    date.textContent = new Date(client.updatedAt).toLocaleDateString('ru-RU');
    item.appendChild(date);

    // Удалить
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'client-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Удалить клиента';
    deleteBtn.addEventListener('click', () => {
        if (confirm(`Удалить "${client.name}"?`)) {
            callbacks.onDelete(client.id);
        }
    });
    item.appendChild(deleteBtn);

    item.style.borderLeftColor = config.color;

    return item;
}

// ====HIGHLIGHT==============================================

function highlightText(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}