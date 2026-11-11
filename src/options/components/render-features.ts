import type { ClientStatus } from '../../shared/types';
import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../../shared/statuses';

const t = (key: string) => chrome.i18n.getMessage(key);

export function renderFeatures(container: HTMLElement): void {
    container.innerHTML = '';

    // ====1. КАК ПОЛЬЗОВАТЬСЯ================================
    const instructionsSection = document.createElement('section');
    instructionsSection.className = 'help-section';

    const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
    const instructionsList = steps.map(step => `<li>${t(step)}</li>`).join('');
    instructionsSection.innerHTML = `
        <h2>🚀 ${t('helpInstructions')}</h2>
        <ol class="help-instructions">
            ${instructionsList}
        </ol>
    `;
    container.appendChild(instructionsSection);

    // ====2. ЛОГИКА СИНХРОНИЗАЦИИ============================
    const logicSection = document.createElement('section');
    logicSection.className = 'help-section';

    logicSection.innerHTML = `
        <h2>🔄 ${t('helpLogic')}</h2>
        <div class="help-logic">
            <div class="help-logic-block">
                <h4>При открытии страницы «Задачи» (/todo):</h4>
                <ul>
                    <li>${t('logicTodoNew')}</li>
                    <li>${t('logicTodoExisting')}</li>
                </ul>
            </div>
            <div class="help-logic-block">
                <h4>На странице карточки сделки (/leads/detail):</h4>
                <ul>
                    <li>${t('logicDetailInDb')}</li>
                    <li>${t('logicDetailWild')}</li>
                </ul>
            </div>
            <div class="help-logic-block">
                <h4>Работа со статусами:</h4>
                <ul>
                    <li>${t('logicProfiles')}</li>
                </ul>
            </div>
        </div>
    `;
    container.appendChild(logicSection);

    // ====3. ОПИСАНИЕ СТАТУСОВ===============================
    const statusesSection = document.createElement('section');
    statusesSection.className = 'help-section';

    const statusesTitle = document.createElement('h2');
    statusesTitle.textContent = `📊 ${t('statusesTitle')}`;
    statusesSection.appendChild(statusesTitle);

    // 3.1. Пользовательские статусы (по группам)
    GROUP_ORDER.forEach((group) => {
        const groupStatuses = STATUS_ORDER.filter((s) => STATUS_CONFIG[s].group === group);
        if (groupStatuses.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'help-group';

        const groupTitle = document.createElement('h3');
        groupTitle.textContent = GROUP_LABELS[group];
        groupDiv.appendChild(groupTitle);

        const list = document.createElement('div');
        list.className = 'help-status-list';

        groupStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];

            const item = document.createElement('div');
            item.className = 'help-status-row';

            item.innerHTML = `
                <div class="help-status-row__left">
                    <span class="help-status-icon">${config.icon}</span>
                    <span class="help-status-name">${config.label}</span>
                </div>
                <div class="help-status-row__right">
                    <span class="help-status-desc">— ${config.description}</span>
                </div>
            `;
            list.appendChild(item);
        });

        groupDiv.appendChild(list);
        statusesSection.appendChild(groupDiv);
    });

    // 3.2. Технические статусы
    const techGroupDiv = document.createElement('div');
    techGroupDiv.className = 'help-group';

    const techGroupTitle = document.createElement('h3');
    techGroupTitle.textContent = 'Специальные (технические)';
    techGroupDiv.appendChild(techGroupTitle);

    const techList = document.createElement('div');
    techList.className = 'help-status-list';

    (['wild', 'unknown'] as ClientStatus[]).forEach((status) => {
        const config = STATUS_CONFIG[status];

        const item = document.createElement('div');
        item.className = 'help-status-row help-status-row--tech';

        item.innerHTML = `
            <div class="help-status-row__left">
                <span class="help-status-icon">${config.icon}</span>
                <span class="help-status-name">${config.label}</span>
            </div>
            <div class="help-status-row__right">
                <span class="help-status-desc">— ${config.description}</span>
            </div>
        `;
        techList.appendChild(item);
    });

    techGroupDiv.appendChild(techList);
    statusesSection.appendChild(techGroupDiv);

    container.appendChild(statusesSection);
}