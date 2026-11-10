import type { Client, ClientStatus } from '../shared/types';
import type { StatusGroup } from '../shared/types';
import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../shared/statuses';

// ====TYPES==================================================

export interface FilterState {
    selectedStatuses: Set<ClientStatus>;
    expandedGroups: Set<StatusGroup>;
    searchQuery: string;
}

export interface FilterCallbacks {
    // Второй параметр указывает, нужно ли перерисовывать сами фильтры
    onChange: (state: FilterState, needsRerender: boolean) => void;
}

// ====FILTERS CONTROLLER=====================================

export class FiltersController {
    private readonly state: FilterState;
    private readonly callbacks: FilterCallbacks;
    private readonly allowedStatuses: string[];

    constructor(
        private readonly container: HTMLElement,
        initialState: FilterState,
        callbacks: FilterCallbacks,
        allowedStatuses: string[] = [] // <-- 4-й аргумент
    ) {
        this.state = initialState;
        this.callbacks = callbacks;
        this.allowedStatuses = allowedStatuses;
    }

    render(allClients: Client[]): void {
        this.container.innerHTML = '';

        // ====ПОИСК==========================================
        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'filters-search';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'filters-search__input';
        searchInput.placeholder = 'Поиск по всем полям...';
        searchInput.value = this.state.searchQuery;

        const clearBtn = document.createElement('button');
        clearBtn.className = 'filters-search__clear';
        clearBtn.textContent = '✕';
        clearBtn.style.display = this.state.searchQuery ? 'flex' : 'none';

        searchInput.addEventListener('input', () => {
            this.state.searchQuery = searchInput.value;
            clearBtn.style.display = searchInput.value ? 'flex' : 'none';
            // false — не перерисовывать фильтры (сохраняем фокус)
            this.callbacks.onChange(this.state, false);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.state.searchQuery = '';
            clearBtn.style.display = 'none';
            // true — перерисовываем, чтобы скрыть крестик
            this.callbacks.onChange(this.state, true);
            searchInput.focus();
        });

        searchWrapper.appendChild(searchInput);
        searchWrapper.appendChild(clearBtn);
        this.container.appendChild(searchWrapper);

        // ====ГРУППЫ=========================================
        const groupsWrapper = document.createElement('div');
        groupsWrapper.className = 'filters-groups';

        GROUP_ORDER.forEach((group) => {
            // ФИЛЬТРУЕМ статусы: только те, что в группе И разрешены профилем
            const groupStatuses = STATUS_ORDER.filter(
                (s) => STATUS_CONFIG[s].group === group && this.allowedStatuses.includes(s)
            );

            // Если в группе не осталось доступных статусов, не рисуем ее вовсе
            if (groupStatuses.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'filters-group';

            const header = document.createElement('div');
            header.className = 'filters-group__header';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'filters-group__checkbox';

            checkbox.checked = groupStatuses.every((s) =>
                this.state.selectedStatuses.has(s)
            );

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    groupStatuses.forEach((s) => this.state.selectedStatuses.add(s));
                } else {
                    groupStatuses.forEach((s) => this.state.selectedStatuses.delete(s));
                }
                this.callbacks.onChange(this.state, true);
            });

            const label = document.createElement('span');
            label.className = 'filters-group__label';

            const groupCount = allClients.filter((c) =>
                groupStatuses.includes(c.status)
            ).length;

            label.textContent = `${GROUP_LABELS[group]} (${groupCount})`;

            const expandBtn = document.createElement('button');
            expandBtn.className = 'filters-group__expand';
            const isExpanded = this.state.expandedGroups.has(group);
            expandBtn.textContent = isExpanded ? '▼' : '▶';

            header.appendChild(checkbox);
            header.appendChild(label);
            header.appendChild(expandBtn);
            groupDiv.appendChild(header);

            // СОЗДАЕМ КОНТЕЙНЕР ДЛЯ ВЛОЖЕННЫХ ЭЛЕМЕНТОВ ЗАРАНЕЕ
            const items = document.createElement('div');
            items.className = 'filters-group__items';
            items.style.display = isExpanded ? 'block' : 'none'; // Управляем видимостью

            // Заполняем items статусами
            groupStatuses.forEach((status) => {
                const config = STATUS_CONFIG[status];
                const row = document.createElement('label');
                row.className = 'filters-group__item';

                const itemCheckbox = document.createElement('input');
                itemCheckbox.type = 'checkbox';
                itemCheckbox.className = 'filters-group__item-checkbox';
                itemCheckbox.checked = this.state.selectedStatuses.has(status);

                itemCheckbox.addEventListener('change', () => {
                    if (itemCheckbox.checked) {
                        this.state.selectedStatuses.add(status);
                    } else {
                        this.state.selectedStatuses.delete(status);
                    }
                    this.callbacks.onChange(this.state, true);
                });

                const icon = document.createElement('span');
                icon.className = 'filters-group__item-icon';
                icon.textContent = config.icon;

                const name = document.createElement('span');
                name.className = 'filters-group__item-name';
                name.textContent = config.label;

                const count = document.createElement('span');
                count.className = 'filters-group__item-count';
                count.textContent = String(
                    allClients.filter((c) => c.status === status).length
                );

                row.appendChild(itemCheckbox);
                row.appendChild(icon);
                row.appendChild(name);
                row.appendChild(count);
                items.appendChild(row);
            });

            // ОБРАБОТЧИК КЛИКА НА СТРЕЛОЧКУ
            expandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const currentlyExpanded = this.state.expandedGroups.has(group);
                if (currentlyExpanded) {
                    this.state.expandedGroups.delete(group);
                } else {
                    this.state.expandedGroups.add(group);
                }

                // Меняем визуал без перерисовки всего UI
                expandBtn.textContent = currentlyExpanded ? '▶' : '▼';
                items.style.display = currentlyExpanded ? 'none' : 'block';

                // Сохраняем состояние в БД (но фильтры не перерисовываем)
                this.callbacks.onChange(this.state, false);
            });

            groupDiv.appendChild(items);
            groupsWrapper.appendChild(groupDiv);
        });

        this.container.appendChild(groupsWrapper);

        // ====СБРОС=========================================
        const resetBtn = document.createElement('button');
        resetBtn.className = 'filters-reset';
        resetBtn.textContent = 'Сбросить фильтры';
        resetBtn.addEventListener('click', () => {
            this.state.selectedStatuses = new Set(this.allowedStatuses as ClientStatus[]);
            this.state.expandedGroups = new Set();
            this.state.searchQuery = '';
            this.callbacks.onChange(this.state, true);
        });
        this.container.appendChild(resetBtn);
    }
}

// ====FILTER LOGIC===========================================

export function applyFilters(clients: Client[], state: FilterState, allowedStatuses: string[]): Client[] {
    return clients.filter((client) => {
        // 1. Если статус клиента скрыт в профиле — не показываем его вообще
        if (!allowedStatuses.includes(client.status)) {
            return false;
        }

        // 2. Если в фильтре снята галочка с этого статуса — скрываем
        if (!state.selectedStatuses.has(client.status)) {
            return false;
        }

        // 3. Поиск по тексту
        if (state.searchQuery.trim()) {
            const query = state.searchQuery.toLowerCase().trim();
            const fields = [
                client.name,
                client.parserCompanyName,
                client.originalCompanyName,
                client.leadId,
                client.originalCompanyINN
            ].filter(Boolean) as string[];

            const matches = fields.some((f) =>
                f.toLowerCase().includes(query)
            );
            if (!matches) return false;
        }

        return true;
    });
}

// ====DEFAULT STATE==========================================

export function createDefaultFilterState(allowedStatuses: ClientStatus[] = STATUS_ORDER): FilterState {
    return {
        selectedStatuses: new Set(allowedStatuses),
        expandedGroups: new Set<StatusGroup>(),
        searchQuery: ''
    };
}