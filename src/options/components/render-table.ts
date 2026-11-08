import type { Client, TableColumn, TableSettings } from '../../shared/types';
import { STATUS_CONFIG } from '../../shared/statuses';
import { STORAGE_KEYS } from '../../shared/constants';
import { StorageService } from '../../shared/storage';
import { SettingsService } from '../../shared/settings';

const storage = new StorageService();
const settingsService = new SettingsService();

// Глобальная переменная для хранения ссылки на обработчике клика вне меню,
// чтобы предотвратить утечку памяти при повторных вызовах renderTable.
let globalOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

// ====КОНФИГУРАЦИЯ КОЛОНОК===================================

const COLUMNS: TableColumn[] = [
    // Основные
    { key: 'name', label: 'Название', visible: true, sortable: true },
    { key: 'status', label: 'Статус', visible: true, sortable: true,
        formatter: (c) => `${STATUS_CONFIG[c.status]?.icon || '❓'} ${STATUS_CONFIG[c.status]?.label || c.status}`
    },
    { key: 'directionAndFunnel', label: 'Воронка', visible: true, sortable: true },

    // Компания
    { key: 'companyUrl', label: 'Компания', visible: true, sortable: false },
    { key: 'parserCompanyName', label: 'Компания (парс.)', visible: true, sortable: true },
    { key: 'originalCompanyName', label: 'Компания (ориг.)', visible: false, sortable: true },
    { key: 'originalCompanyINN', label: 'ИНН', visible: true, sortable: true },

    // Ссылки и ИИ
    { key: 'leadUrl', label: 'Сделка', visible: true, sortable: false },
    { key: 'aiScore', label: 'Оценка ИИ', visible: false, sortable: true,
        formatter: (c) => c.aiScore != null ? String(c.aiScore) : ''
    },
    { key: 'aiRecommendedStatus', label: 'Рекомендуемый. статус', visible: false, sortable: true,
        formatter: (c) => c.aiRecommendedStatus ? `${STATUS_CONFIG[c.aiRecommendedStatus]?.icon || ''} ${STATUS_CONFIG[c.aiRecommendedStatus]?.label}` : ''
    },
    { key: 'description', label: 'Описание (ИИ)', visible: false, sortable: false },

    // Служебные
    { key: 'leadId', label: 'leadId', visible: false, sortable: true },
    { key: 'createdAt', label: 'Создана', visible: false, sortable: true,
        formatter: (c) => new Date(c.createdAt).toLocaleDateString('ru-RU')
    },
    { key: 'updatedAt', label: 'Обновлена', visible: false, sortable: true,
        formatter: (c) => new Date(c.updatedAt).toLocaleDateString('ru-RU')
    }
];

// ====RENDER=================================================

export function renderTable(container: HTMLElement): void {
    container.innerHTML = '';

    let baseUrl = '';

    // 1. Панель управления (Поиск, Статус, Кнопка колонок)
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

    // Кнопка "Настройка колонок" и выпадающее меню
    const columnsBtn = document.createElement('button');
    columnsBtn.className = 'table-columns-btn';
    columnsBtn.textContent = '⚙️ Колонки';

    const columnsDropdown = document.createElement('div');
    columnsDropdown.className = 'table-columns-dropdown';
    columnsDropdown.style.display = 'none'; // Скрыто по умолчанию

    // Группировка колонок
    const groups = [
        { title: 'Основные', keys: ['name', 'status', 'directionAndFunnel'] },
        { title: 'Компания', keys: ['companyUrl', 'parserCompanyName', 'originalCompanyName', 'originalCompanyINN'] },
        { title: 'Ссылки и ИИ', keys: ['leadUrl', 'aiScore', 'aiRecommendedStatus', 'description'] },
        { title: 'Служебные', keys: ['leadId', 'createdAt', 'updatedAt'] }
    ];

    groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'table-columns-group';

        const title = document.createElement('div');
        title.className = 'table-columns-group-title';
        title.textContent = group.title;
        groupDiv.appendChild(title);

        group.keys.forEach(key => {
            const col = COLUMNS.find(c => c.key === key);
            if (!col) return;

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
            groupDiv.appendChild(label);
        });

        columnsDropdown.appendChild(groupDiv);
    });

    // Обработчик клика по кнопке (показать/скрыть)
    columnsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        columnsDropdown.style.display = columnsDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // ЗАЩИТА ОТ УТЕЧКИ ПАМЯТИ: удаляем старый обработчик перед добавлением нового
    if (globalOutsideClickHandler) {
        document.removeEventListener('click', globalOutsideClickHandler);
    }

    globalOutsideClickHandler = (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest('.table-columns-btn') &&
            !(e.target as HTMLElement).closest('.table-columns-dropdown')) {
            columnsDropdown.style.display = 'none';
        }
    };

    document.addEventListener('click', globalOutsideClickHandler);

    controls.appendChild(searchInput);
    controls.appendChild(statusFilter);
    controls.appendChild(columnsBtn);
    controls.appendChild(columnsDropdown);
    container.appendChild(controls);

    // 2. Таблица
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    const table = document.createElement('table');
    table.className = 'data-table';
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    // 3. Данные
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
                const fields = [
                    c.name, c.parserCompanyName, c.originalCompanyName,
                    c.leadId, c.originalCompanyINN, c.directionAndFunnel, c.description
                ].filter(Boolean).map(String);
                if (!fields.some((f) => f.toLowerCase().includes(query))) return false;
            }
            return true;
        });

        if (sortKey !== null) {
            const key = sortKey;
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

                if (col.key === 'leadUrl' && client.leadUrl) {
                    const a = document.createElement('a');
                    const cleanBase = baseUrl.replace(/\/+$/, '');
                    const cleanPath = client.leadUrl.replace(/^\/+/, '');
                    a.href = client.leadUrl.startsWith('http') ? client.leadUrl : `${cleanBase}/${cleanPath}`;
                    a.target = '_blank';
                    a.textContent = '🔗';
                    a.title = 'Открыть сделку';
                    a.className = 'table-link-icon';
                    td.appendChild(a);
                }
                else if (col.key === 'companyUrl' && client.companyUrl) {
                    const a = document.createElement('a');
                    const cleanBase = baseUrl.replace(/\/+$/, '');
                    const cleanPath = client.companyUrl.replace(/^\/+/, '');
                    a.href = client.companyUrl.startsWith('http') ? client.companyUrl : `${cleanBase}/${cleanPath}`;
                    a.target = '_blank';
                    a.textContent = '🏢';
                    a.title = 'Открыть компанию';
                    a.className = 'table-link-icon';
                    td.appendChild(a);
                }
                else if (col.formatter) {
                    const result = col.formatter(client);
                    if (result instanceof HTMLElement) {
                        td.appendChild(result);
                    } else {
                        td.textContent = result;
                    }
                } else {
                    const value = client[col.key as keyof Client];
                    td.textContent = value == null ? '' : String(value);
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
    };

    // 4. Загрузка данных
    const load = async () => {
        const settings = await settingsService.getSettings();
        baseUrl = settings.baseUrl || '';
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
        const key = c.key as string;
        if (visible.has(key)) {
            c.visible = true;
        } else if (settings.visibleColumns.includes(key)) {
            c.visible = false;
        }
    });
}