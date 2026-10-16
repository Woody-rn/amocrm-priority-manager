// ============ Конфигурация статусов ============
export const STATUS_CONFIG = {
    green: {
        label: 'Горячий',
        icon: '🔥',
        color: '#4caf50',
        description: 'Высокая вероятность покупки'
    },
    purple: {
        label: 'Действующий',
        icon: '⭐',
        color: '#9c27b0',
        description: 'Постоянный клиент'
    },
    teal: {
        label: 'Продление',
        icon: '🔄',
        color: '#009688',
        description: 'Действующий, подошёл срок продления'
    },
    blue: {
        label: 'Новый',
        icon: '🆕',
        color: '#2196f3',
        description: 'Новый клиент'
    },
    yellow: {
        label: 'Тёплый',
        icon: '🤔',
        color: '#ffeb3b',
        description: 'Интересуется, но не готов покупать сразу'
    },
    orange: {
        label: 'Холодный',
        icon: '🥶',
        color: '#ff9800',
        description: 'ПО не интересует'
    },
    red: {
        label: 'Мёртвый',
        icon: '💀',
        color: '#f44336',
        description: 'Невозможно дозвониться'
    }
};

// Порядок статусов для отображения
export const STATUS_ORDER = ['green', 'purple', 'teal', 'blue', 'yellow', 'orange', 'red'];