import type { ClientStatus, StatusGroup, StatusConfig } from './types';

// ====КОНФИГ СТАТУСОВ========================================

export const STATUS_CONFIG: Record<ClientStatus, StatusConfig> = {
    // --- Активные ---
    new: {
        label: 'Новый',
        fullLabel: 'Новый',
        icon: '🆕',
        color: '#2196f3',
        className: 'priority-new',
        group: 'active',
        description: 'Свежий лид',
        savable: true
    },
    hot: {
        label: 'Горячий',
        fullLabel: 'Горячий',
        icon: '🔥',
        color: '#4caf50',
        className: 'priority-hot',
        group: 'active',
        description: 'Высокая вероятность покупки',
        savable: true
    },
    warm: {
        label: 'Тёплый',
        fullLabel: 'Тёплый',
        icon: '🤔',
        color: '#ffeb3b',
        className: 'priority-warm',
        group: 'active',
        description: 'Интересуется, но не готов покупать сейчас',
        savable: true
    },

    // --- Действующие ---
    active: {
        label: 'Действующий',
        fullLabel: 'Действующий',
        icon: '⭐',
        color: '#9c27b0',
        className: 'priority-active',
        group: 'current',
        description: 'Постоянные клиенты',
        savable: true
    },
    renewal: {
        label: 'Продление',
        fullLabel: 'Продление',
        icon: '🔄',
        color: '#009688',
        className: 'priority-renewal',
        group: 'current',
        description: 'Действующие, подошёл срок продления',
        savable: true
    },

    // --- Холодные ---
    cold_competitor_software: {
        label: 'Конкурент ПО',
        fullLabel: 'Холодный: Конкурент ПО',
        icon: '⚔️',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Пользуется аналогичным ПО (Гарант / КонсультантПлюс)',
        savable: true
    },
    cold_competitor_dealer: {
        label: 'Конкурент-дилер',
        fullLabel: 'Холодный: Конкурент-дилер',
        icon: '🏷️',
        color: '#ff9800',
        className: 'priority-cold-dealer',
        group: 'cold',
        description: 'nanoCAD есть, но куплен у другого дилера',
        savable: true
    },
    cold_refusal_demo: {
        label: 'После демо',
        fullLabel: 'Холодный: Отказ после демо',
        icon: '📉',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Провели презентацию, но клиент осознанно сказал «нет»',
        savable: true
    },
    cold_refusal_start: {
        label: 'На старте',
        fullLabel: 'Холодный: Отказ на старте',
        icon: '🥶',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Позвонили первый раз, сразу отказался',
        savable: true
    },

    // --- Архив ---
    unclear: {
        label: 'На уточнении',
        fullLabel: 'На уточнении',
        icon: '❓',
        color: '#e0e0e0',
        className: 'priority-unclear',
        group: 'archive',
        description: 'Пока непонятно, куда отнести',
        savable: true
    },
    dead: {
        label: 'Мёртвый',
        fullLabel: 'Мёртвый',
        icon: '💀',
        color: '#b71c1c',
        className: 'priority-dead',
        group: 'archive',
        description: 'Недозвон. Технический архив',
        savable: true
    },
    not_target: {
        label: 'Нецелевой',
        fullLabel: 'Нецелевой',
        icon: '🚫',
        color: '#b71c1c',
        className: 'priority-not-target',
        group: 'archive',
        description: 'Нецелевой клиент. Вывод из воронки навсегда',
        savable: true
    },

    // --- Специальные ---
    wild: {
        label: 'Wild',
        fullLabel: 'Wild',
        icon: '🍒',
        color: '#81d4fa',
        className: 'priority-wild',
        group: 'wild',
        description: 'Компания не из нашей БД',
        savable: false
    },
    unknown: {
        label: 'Неизвестно',
        fullLabel: 'Неизвестный статус',
        icon: '❓',
        color: '#9e9e9e',
        className: 'priority-unknown',
        group: 'wild',
        description: 'Статус не распознан (требует проверки)',
        savable: false
    }
};

export const STATUS_ORDER: ClientStatus[] = [
    'new', 'hot', 'warm',
    'active', 'renewal',
    'cold_competitor_software', 'cold_competitor_dealer', 'cold_refusal_demo', 'cold_refusal_start',
    'unclear', 'dead', 'not_target'
    // wild и unknown не включаем, они не для выбора
];

export const GROUP_ORDER: StatusGroup[] = [
    'active',
    'current',
    'cold',
    'archive'
];

export const GROUP_LABELS: Record<StatusGroup, string> = {
    active: 'Активные',
    current: 'Действующие',
    cold: 'Холодные',
    archive: 'Архив',
    wild: 'Wild'
};