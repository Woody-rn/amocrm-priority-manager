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
    settings: 'settings'
} as const;

// ====SIDEBAR HANDLE (ручка "Панель")========================

export const HANDLE_DEFAULT_POSITION = 200;
export const HANDLE_MIN_TOP = 10;

// ====UI======================================================

export const NOTIFICATION_DURATION = 2000;
export const PANEL_HIDE_DELAY = 100;

// ====CHANGELOG===============================================

export const CHANGELOG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа