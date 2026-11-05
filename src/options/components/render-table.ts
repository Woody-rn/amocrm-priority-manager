import type { Client, TableColumn, TableSettings } from '../../shared/types';
import { STATUS_CONFIG } from '../../shared/statuses';
import { STORAGE_KEYS } from '../../shared/constants';
import { StorageService } from '../../shared/storage';

const storage = new StorageService();

// ====КОНФИГУРАЦИЯ КОЛОНОК===================================

const COLUMNS: TableColumn[] = [
    { key: 'name', label: 'Название сделки', visible: true, sortable: true },
    { key: 'companyName', label: 'Компания', visible: true, sortable: true },
    {
        key: 'status',
        label: 'Статус',
        visible: true,
        sortable: true,
        formatter: (c) => `${STATUS_CONFIG[c.status]?.icon || '❓'} ${STATUS_CONFIG[c.status]?.label || c.status}`
    },
    { key: 'directionAndFunnel', label: 'Воронка', visible: true, sortable: true },
    { key: 'companyINN', label: 'ИНН', visible: false, sortable: true },
    { key: 'leadId', label: 'leadId', visible: false, sortable: true },
    {
        key: 'createdAt',
        label: 'Создана',
        visible: false,
        sortable: true,
        formatter: (c) => new Date(c.createdAt).toLocaleDateString('ru-RU')
    },
    {
        key: 'updatedAt',
        label: 'Обновлена',
        visible: false,
        sortable: true,
        formatter: (c) => new Date(c.updatedAt).toLocaleDateString('ru-RU')
    }
];

// ====RENDER=================================================

export function renderTable(container: HTMLElement): void {
    container.innerHTML = '';

    // 1. Панель управления
    const controls = document.createElement('div');
    controls.className = 'table-controls';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Поиск по всем полям...';
    searchInput.className = 'table-search';

    const statusFilter = document.createElement('select');
    statusFilter.className = 'table-filter';
    statusFilter.innerHTML = '<option value="">Все статусы</option>' +
        Object.entries(STATUS_CONFIG).map(([key, cfg]) =>
            `<option value="${key}">${cfg.icon} ${cfg.label}</option>`
        ).join('');

    controls.appendChild(searchInput);
    controls.appendChild(statusFilter);
    container.appendChild(controls);

    // 2. Панель колонок
    const columnsPanel = document.createElement('div');
    columnsPanel.className = 'table-columns';

    COLUMNS.forEach((col) => {
        const label = document.createElement('label');
        label.className = 'table-column-toggle';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = col.visible;
        checkbox.dataset.key = col.key;

        checkbox.addEventListener('change', () => {
            col.visible = checkbox.checked;
            void saveTableSettings();
            updateTable();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${col.label}`));
        columnsPanel.appendChild(label);
    });
    container.appendChild(columnsPanel);

    // 3. Таблица
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    const table = document.createElement('table');
    table.className = 'data-table';
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    // 4. Данные
    let allClients: Client[] = [];
    let filteredClients: Client[] = [];
    let sortKey: keyof Client | null = null;
    let sortAsc = true;

    const updateTable = () => {
        const query = searchInput.value.toLowerCase().trim();
        const status = statusFilter.value;

        filteredClients = allClients.filter((c) => {
            if (status && c.status !== status) return false;
            if (query) {
                const fields = [c.name, c.companyName, c.leadId, c.companyINN, c.directionAndFunnel]
                    .filter(Boolean).map(String);
                if (!fields.some((f) => f.toLowerCase().includes(query))) return false;
            }
            return true;
        });

        // Сортировка
        if (sortKey !== null) {
            const key = sortKey; // локальная копия с суженным типом
            filteredClients.sort((a, b) => {
                const aVal = String(a[key] ?? '');
                const bVal = String(b[key] ?? '');
                return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        table.innerHTML = '';

        const visibleCols = COLUMNS.filter((c) => c.visible);

        // Заголовок
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        visibleCols.forEach((col) => {
            const th = document.createElement('th');
            th.textContent = col.label;
            if (col.sortable) {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => {
                    if (sortKey === col.key) {
                        sortAsc = !sortAsc;
                    } else {
                        sortKey = col.key as keyof Client;
                        sortAsc = true;
                    }
                    updateTable();
                });
                if (sortKey === col.key) {
                    th.textContent += sortAsc ? ' ▲' : ' ▼';
                }
            }
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        // Тело
        const tbody = document.createElement('tbody');
        filteredClients.forEach((client) => {
            const row = document.createElement('tr');
            visibleCols.forEach((col) => {
                const td = document.createElement('td');
                if (col.formatter) {
                    td.textContent = col.formatter(client);
                } else {
                    const value = client[col.key as keyof Client];
                    td.textContent = value == null ? '—' : String(value);
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
    };

    // 5. Загрузка данных
    const load = async () => {
        allClients = await storage.getAllClients();
        updateTable();
    };

    searchInput.addEventListener('input', updateTable);
    statusFilter.addEventListener('change', updateTable);

    void load();
}

// ====НАСТРОЙКИ===============================================

async function saveTableSettings(): Promise<void> {
    const settings: TableSettings = {
        visibleColumns: COLUMNS.filter((c) => c.visible).map((c) => c.key as string)
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.tableSettings]: settings });
}

export async function loadTableSettings(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.tableSettings);
    const settings = result[STORAGE_KEYS.tableSettings] as TableSettings | undefined;
    if (!settings) return;

    const visible = new Set(settings.visibleColumns);
    COLUMNS.forEach((c) => {
        c.visible = visible.has(c.key as string);
    });
}