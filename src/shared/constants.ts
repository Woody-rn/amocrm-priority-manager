/**
 * Константы проекта: URL, ключи хранилища, селекторы, настройки.
 */

// ====URL / СТРАНИЦЫ==========================================

export const URL_PATTERNS = {
    todo: /\/todo/,
    leadsList: /\/leads\/list\//,
    leadsDetail: /\/leads\/detail/
} as const;

export type PageType = 'todo' | 'leadsList' | 'leadsDetail';

export const SELECTORS = {
    todo: 'a.js-navigate-link[href*="/leads/detail/"]',
    leadsList: 'a.js-navigate-link[href*="/leads/detail/"]',
    leadsDetail: 'textarea#person_n'
} as const;

// ====CHROME STORAGE==========================================

export const STORAGE_KEYS = {
    clients: 'clients',
    handlePosition: 'handlePosition',
    changelogCache: 'changelogCache',
    helpOpen: 'helpOpen',
    filterState: 'filterState',
    settings: 'settings',
    sidebarCollapsedState: 'sidebarCollapsedState',
    sidebarWidth: 'sidebarWidth',
    diagnosticsEnabled: 'diagnosticsEnabled',
    diagnosticsLog: 'diagnosticsLog',
    tableSettings: 'tableSettings',
    highlightedStatuses: 'highlightedStatuses',
    groupTasksByDate: 'groupTasksByDate',
} as const;

// ====SIDEBAR HANDLE (ручка "Панель")========================

export const SIDEBAR_DEFAULT_WIDTH = 400;
export const SIDEBAR_MIN_WIDTH = 320;
export const SIDEBAR_MAX_WIDTH = 800;

// ====UI======================================================

export const PANEL_HIDE_DELAY = 100;