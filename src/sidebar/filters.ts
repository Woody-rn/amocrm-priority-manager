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
    onChange: (state: FilterState) => void;
}

// ====FILTERS CONTROLLER=====================================

/**
 * Управляет фильтрами и поиском.
 */
export class FiltersController {
    private readonly state: FilterState;
    private readonly callbacks: FilterCallbacks;

    constructor(
        private readonly container: HTMLElement,
        initialState: FilterState,
        callbacks: FilterCallbacks
    ) {
        this.state = initialState;
        this.callbacks = callbacks;
    }

    /**
     * Рендерит панель фильтров.
     */
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
            this.callbacks.onChange(this.state);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.state.searchQuery = '';
            clearBtn.style.display = 'none';
            this.callbacks.onChange(this.state);
            searchInput.focus();
        });

        searchWrapper.appendChild(searchInput);
        searchWrapper.appendChild(clearBtn);
        this.container.appendChild(searchWrapper);

        // ====ГРУППЫ=========================================
        const groupsWrapper = document.createElement('div');
        groupsWrapper.className = 'filters-groups';

        GROUP_ORDER.forEach((group) => {
            const groupStatuses = STATUS_ORDER.filter(
                (s) => STATUS_CONFIG[s].group === group
            );
            if (groupStatuses.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'filters-group';

            // Заголовок группы
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
                this.callbacks.onChange(this.state);
            });

            const label = document.createElement('span');
            label.className = 'filters-group__label';

            // Счётчик в скобках
            const groupCount = allClients.filter((c) =>
                groupStatuses.includes(c.status)
            ).length;

            label.textContent = `${GROUP_LABELS[group]} (${groupCount})`;

            const expandBtn = document.createElement('button');
            expandBtn.className = 'filters-group__expand';
            const isExpanded = this.state.expandedGroups.has(group);
            expandBtn.textContent = isExpanded ? '▼' : '▶';

            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isExpanded) {
                    this.state.expandedGroups.delete(group);
                } else {
                    this.state.expandedGroups.add(group);
                }
                this.callbacks.onChange(this.state);
            });

            header.appendChild(checkbox);
            header.appendChild(label);
            header.appendChild(expandBtn);

            groupDiv.appendChild(header);

            // Статусы внутри группы
            if (isExpanded && groupStatuses.length > 1) {
                const items = document.createElement('div');
                items.className = 'filters-group__items';

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
                        this.callbacks.onChange(this.state);
                    });

                    const icon = document.createElement('span');
                    icon.className = 'filters-group__item-icon';
                    icon.textContent = config.icon;

                    const name = document.createElement('span');
                    name.className = 'filters-group__item-name';
                    name.textContent = config.label;
                    name.style.color = config.color;

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

                groupDiv.appendChild(items);
            }

            groupsWrapper.appendChild(groupDiv);
        });

        this.container.appendChild(groupsWrapper);

        // ====КНОПКА "СБРОСИТЬ"==============================
        const resetBtn = document.createElement('button');
        resetBtn.className = 'filters-reset';
        resetBtn.textContent = 'Сбросить фильтры';
        resetBtn.addEventListener('click', () => {
            this.state.selectedStatuses = new Set(STATUS_ORDER);
            this.state.expandedGroups = new Set();
            this.state.searchQuery = '';
            this.callbacks.onChange(this.state);
        });
        this.container.appendChild(resetBtn);
    }
}

// ====FILTER LOGIC===========================================

/**
 * Применяет фильтры и поиск к списку клиентов.
 */
export function applyFilters(clients: Client[], state: FilterState): Client[] {
    return clients.filter((client) => {
        // Фильтр по статусу
        if (!state.selectedStatuses.has(client.status)) {
            return false;
        }

        // Поиск
        if (state.searchQuery.trim()) {
            const query = state.searchQuery.toLowerCase().trim();
            const fields = [
                client.name,
                client.companyName,
                client.leadId,
                client.companyINN
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

/**
 * Возвращает состояние фильтров по умолчанию (все статусы выбраны).
 */
export function createDefaultFilterState(): FilterState {
    return {
        selectedStatuses: new Set(STATUS_ORDER),
        expandedGroups: new Set<StatusGroup>(),
        searchQuery: ''
    };
}