import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../shared/statuses';

// ====RENDER FEATURES========================================

/**
 * Рендерит вкладку "Функционал":
 * - описание статусов (сгруппировано)
 * - как пользоваться
 */
export function renderFeatures(container: HTMLElement): void {
    container.innerHTML = '';

    // ====ОПИСАНИЕ СТАТУСОВ==================================

    const statusesSection = document.createElement('section');
    statusesSection.className = 'help-section';

    const statusesTitle = document.createElement('h2');
    statusesTitle.textContent = '📊 Статусы клиентов';
    statusesSection.appendChild(statusesTitle);

    GROUP_ORDER.forEach((group) => {
        const groupStatuses = STATUS_ORDER.filter(
            (s) => STATUS_CONFIG[s].group === group
        );
        if (groupStatuses.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'help-group';

        const groupTitle = document.createElement('h3');
        groupTitle.textContent = GROUP_LABELS[group];
        groupDiv.appendChild(groupTitle);

        groupStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];
            const item = document.createElement('div');
            item.className = 'help-status-item';
            item.innerHTML = `
                <span class="help-status-icon">${config.icon}</span>
                <span class="help-status-name" style="color: ${config.color}">${config.fullLabel}</span>
                <span class="help-status-desc">${config.description}</span>
            `;
            groupDiv.appendChild(item);
        });

        statusesSection.appendChild(groupDiv);
    });

    container.appendChild(statusesSection);

    // ====КАК ПОЛЬЗОВАТЬСЯ===================================

    const instructionsSection = document.createElement('section');
    instructionsSection.className = 'help-section';

    const instructionsTitle = document.createElement('h2');
    instructionsTitle.textContent = '🚀 Как пользоваться';
    instructionsSection.appendChild(instructionsTitle);

    const instructions = [
        'Откройте amoCRM на странице «Задачи» (/todo) — расширение автоматически соберёт сделки',
        'Наведите на название сделки — появится панель со статусами',
        'Выберите нужный статус — сделка сохранится в локальной базе',
        'Откройте боковую панель (кнопка «Панель» справа) — там статистика, поиск и фильтры',
        'Если компании нет в базе, но вы её видите на других страницах — она подсвечивается как Wild (🍒)',
        'Для экспорта/импорта данных используйте popup (иконка расширения)'
    ];

    const list = document.createElement('ol');
    list.className = 'help-instructions';
    instructions.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
    });

    instructionsSection.appendChild(list);
    container.appendChild(instructionsSection);
}