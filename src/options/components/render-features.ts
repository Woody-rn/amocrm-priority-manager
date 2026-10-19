import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../../shared/statuses';
import { SELECTORS } from '../../shared/constants';

// Хелпер для получения перевода
const t = (key: string) => chrome.i18n.getMessage(key);

export function renderFeatures(container: HTMLElement): void {
    container.innerHTML = '';

    // 1. ОПИСАНИЕ СТАТУСОВ
    const statusesSection = document.createElement('section');
    statusesSection.className = 'help-section';

    const statusesTitle = document.createElement('h2');
    statusesTitle.textContent = `📊 ${t('statusesTitle')}`;
    statusesSection.appendChild(statusesTitle);

    GROUP_ORDER.forEach((group) => {
        const groupStatuses = STATUS_ORDER.filter((s) => STATUS_CONFIG[s].group === group);
        if (groupStatuses.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'help-group';
        groupDiv.innerHTML = `<h3>${GROUP_LABELS[group]}</h3>`;

        groupStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];
            groupDiv.innerHTML += `
                <div class="help-status-item">
                    <span class="help-status-icon">${config.icon}</span>
                    <span class="help-status-name" style="color: ${config.color}">${config.fullLabel}</span>
                    <span class="help-status-desc">${config.description}</span>
                </div>
            `;
        });
        statusesSection.appendChild(groupDiv);
    });
    container.appendChild(statusesSection);

    // 2. КАК ПОЛЬЗОВАТЬСЯ
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

    // 3. ЛОГИКА СИНХРОНИЗАЦИИ
    const logicSection = document.createElement('section');
    logicSection.className = 'help-section';

    logicSection.innerHTML = `
        <h2>🔄 ${t('helpLogic')}</h2>
        <div class="help-logic">
            <p><strong>При открытии страницы «Задачи» (/todo):</strong></p>
            <ul>
                <li>${t('logicTodoNew')}</li>
                <li>${t('logicTodoExisting')}</li>
            </ul>
            <p><strong>На странице карточки сделки (/leads/detail):</strong></p>
            <ul>
                <li>${t('logicDetailInDb')}</li>
                <li>${t('logicDetailWild')}</li>
            </ul>
        </div>
    `;
    container.appendChild(logicSection);

    // 4. ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ
    // 4. ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ
    const techSection = document.createElement('section');
    techSection.className = 'help-section';

    let selectorsHtml = '';
    Object.entries(SELECTORS).forEach(([page, selector]) => {
        let pageName = '';
        let description = '';

        if (page === 'todo') {
            pageName = t('helpTechTodo');
            description = t('helpTechTodoDesc');
        } else if (page === 'leadsList') {
            pageName = t('helpTechLeadsList');
            description = t('helpTechTodoDesc'); // Описание такое же
        } else if (page === 'leadsDetail') {
            pageName = t('helpTechDetail');
            description = t('helpTechDetailDesc');
        }

        selectorsHtml += `
            <li>
                <strong>${pageName}</strong> <code>${selector}</code>
                <p class="help-tech-desc">${description}</p>
            </li>
        `;
    });

    techSection.innerHTML = `
        <h2>🛠 ${t('helpTechTitle')}</h2>
        <p>${t('helpTechIntro')}</p>
        <ul class="help-tech-list">
            ${selectorsHtml}
        </ul>
        <p><strong>${t('helpTechLeadId')}</strong></p>
    `;
    container.appendChild(techSection);
}