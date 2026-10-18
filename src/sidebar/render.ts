import type { Client, ClientStatus } from '../shared/types';
import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../shared/statuses';

// ====RENDER STATS===========================================

export function renderStats(container: HTMLElement, clients: Client[]): void {
    container.innerHTML = '';

    const total = document.createElement('div');
    total.className = 'stats-total';
    total.innerHTML = `<span class="stats-total-label">Всего клиентов</span><span class="stats-total-count">${clients.length}</span>`;
    container.appendChild(total);

    GROUP_ORDER.forEach((group) => {
        const groupStatuses = STATUS_ORDER.filter(
            (s) => STATUS_CONFIG[s].group === group
        );
        if (groupStatuses.length === 0) return;

        const groupCount = clients.filter((c) =>
            groupStatuses.includes(c.status)
        ).length;

        if (groupCount === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'stats-group';

        const header = document.createElement('div');
        header.className = 'stats-group-header';
        header.innerHTML = `
            <span class="stats-group-label">${GROUP_LABELS[group]}</span>
            <span class="stats-group-count">${groupCount}</span>
        `;
        groupDiv.appendChild(header);

        if (groupStatuses.length > 1) {
            const details = document.createElement('div');
            details.className = 'stats-group-details';

            groupStatuses.forEach((status) => {
                const config = STATUS_CONFIG[status];
                const count = clients.filter((c) => c.status === status).length;
                if (count === 0) return;

                const row = document.createElement('div');
                row.className = 'stats-group-row';
                row.innerHTML = `
                    <span class="stats-icon">${config.icon}</span>
                    <span class="stats-status-name" style="color: ${config.color}">${config.label}</span>
                    <span class="stats-count">${count}</span>
                `;
                details.appendChild(row);
            });

            groupDiv.appendChild(details);
        }

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