import type { Client, ClientStatus } from '../shared/types';
import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';

// ====RENDER CLIENTS=========================================

export interface ClientCallbacks {
    onStatusChange: (id: string, status: ClientStatus) => void;
    onDelete: (id: string) => void;
}

export function renderClients(
    container: HTMLElement,
    clients: Client[],
    searchQuery: string,
    baseUrl: string,
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
    baseUrl: string,
    callbacks: ClientCallbacks): HTMLElement {

    const config = STATUS_CONFIG[client.status];

    const item = document.createElement('div');
    item.className = 'client-item';
    item.style.borderLeftColor = config.color;

    // 1. Слой удаления (прогресс-бар)
    const deleteOverlay = document.createElement('div');
    deleteOverlay.className = 'client-item__delete-overlay';

    const deleteText = document.createElement('span');
    deleteText.className = 'client-item__delete-text';
    deleteText.textContent = 'Удаление...';

    const deleteProgress = document.createElement('div');
    deleteProgress.className = 'client-item__delete-progress';

    deleteOverlay.appendChild(deleteProgress);
    deleteOverlay.appendChild(deleteText);
    item.appendChild(deleteOverlay);

    // 2. Имя + ссылка (контент)
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'client-name-wrapper';

    if (client.leadId) {
        const link = document.createElement('a');
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

    // 3. Селект статуса
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

    // ==== ЛОГИКА УДЕРЖАНИЯ ДЛЯ УДАЛЕНИЯ ====

    let isHolding = false;
    let holdTimeout: ReturnType<typeof setTimeout>;
    let startX = 0;
    let startY = 0;

    const cancelHold = () => {
        isHolding = false;
        item.classList.remove('client-item--deleting');
        clearTimeout(holdTimeout);
    };

    const startHold = (e: MouseEvent) => {
        // Игнорируем клики по интерактивным элементам и правую кнопку мыши
        const target = e.target as HTMLElement;
        if (e.button !== 0 || target.closest('select') || target.closest('a')) {
            return;
        }

        isHolding = true;
        startX = e.clientX;
        startY = e.clientY;

        // Добавляем класс, который запускает CSS-анимацию
        item.classList.add('client-item--deleting');

        // По завершении анимации (2 сек) удаляем
        holdTimeout = setTimeout(() => {
            if (isHolding) {
                isHolding = false;
                callbacks.onDelete(client.id);
            }
        }, 1200);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isHolding) return;
        // Если пользователь сдвинул мышь больше чем на 10px (например, скроллит) - отменяем
        const distance = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
        if (distance > 10) {
            cancelHold();
        }
    };

    item.addEventListener('mousedown', startHold);
    item.addEventListener('mouseup', cancelHold);
    item.addEventListener('mouseleave', cancelHold);
    item.addEventListener('mousemove', onMouseMove);

    return item;
}

// ====HIGHLIGHT==============================================

function highlightText(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}