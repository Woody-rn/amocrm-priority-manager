import type { ClientStatus, StatusGroup, StatusConfig } from './types';

/**
 * Конфиг всех статусов клиента.
 *
 * Ключ — ClientStatus, значение — StatusConfig.
 * Порядок ключей соответствует порядку отображения в панели.
 */
export const STATUS_CONFIG: Record<ClientStatus, StatusConfig> = {
    unclear: {
        label: 'На уточнении',
        fullLabel: 'На уточнении',
        icon: '❓',
        color: '#e0e0e0',
        className: 'priority-unclear',
        group: 'neutral',
        description: 'Пока непонятно, куда отнести',
        savable: true
    },
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
        description: 'Интересуется, но не готов покупать',
        savable: true
    },
    active: {
        label: 'Действующий',
        fullLabel: 'Действующий',
        icon: '⭐️',
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
    cold_competitor: {
        label: 'Конкурент',
        fullLabel: 'Холодный: Конкурент',
        icon: '⚔️',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Пользуется аналогичным ПО или у другого дилера',
        savable: true
    },
    cold_refusal_demo: {
        label: 'Отказ после демо',
        fullLabel: 'Холодный: Отказ после демо',
        icon: '📉',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Провели презентацию, но клиент осознанно сказал «нет»',
        savable: true
    },
    cold_refusal_start: {
        label: 'Отказ на старте',
        fullLabel: 'Холодный: Отказ на старте',
        icon: '🥶',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Позвонили первый раз, сразу отказался',
        savable: true
    },
    cold_price: {
        label: 'Дорого',
        fullLabel: 'Холодный: Дорого',
        icon: '💰',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: 'Отказ из-за цены',
        savable: true
    },
    cold_later: {
        label: 'Не сейчас',
        fullLabel: 'Холодный: Не сейчас',
        icon: '🕐',
        color: '#ff9800',
        className: 'priority-cold',
        group: 'cold',
        description: '«Вернитесь через полгода-год»',
        savable: true
    },
    dead: {
        label: 'Мёртвый',
        fullLabel: 'Мёртвый',
        icon: '💀',
        color: '#f44336',
        className: 'priority-dead',
        group: 'archive',
        description: 'Недозвон. Технический архив',
        savable: true
    },
    not_target: {
        label: 'Нецелевой',
        fullLabel: 'Нецелевой',
        icon: '🚫',
        color: '#f44336',
        className: 'priority-not-target',
        group: 'archive',
        description: 'Нецелевой клиент',
        savable: true
    },
    wild: {
        label: 'Wild',
        fullLabel: 'Wild',
        icon: '🍒',
        color: '#81d4fa',
        className: 'priority-wild',
        group: 'wild',
        description: 'Компания не из нашей БД',
        savable: false
    }
};

/**
 * Порядок статусов для отображения в панели, фильтрах и статистике.
 * wild не включён — он не отображается в UI.
 */
export const STATUS_ORDER: ClientStatus[] = [
    'unclear',
    'new',
    'hot',
    'warm',
    'active',
    'renewal',
    'cold_competitor',
    'cold_refusal_demo',
    'cold_refusal_start',
    'cold_price',
    'cold_later',
    'dead',
    'not_target'
];

/**
 * Порядок групп для отображения в фильтрах и статистике.
 */
export const GROUP_ORDER: StatusGroup[] = [
    'neutral',
    'active',
    'current',
    'cold',
    'archive'
];

/**
 * Человекочитаемые названия групп.
 */
export const GROUP_LABELS: Record<StatusGroup, string> = {
    neutral: 'На уточнении',
    active: 'Активные',
    current: 'Действующие',
    cold: 'Холодные',
    archive: 'Архив',
    wild: 'Wild'
};