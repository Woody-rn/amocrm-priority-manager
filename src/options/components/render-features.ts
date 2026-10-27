import { STATUS_CONFIG, STATUS_ORDER, GROUP_LABELS, GROUP_ORDER } from '../../shared/statuses';
import { SELECTORS } from '../../shared/constants';

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

        const groupTitle = document.createElement('h3');
        groupTitle.textContent = GROUP_LABELS[group];
        groupDiv.appendChild(groupTitle);

        const list = document.createElement('div');
        list.className = 'help-status-list';

        groupStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];

            const item = document.createElement('div');
            item.className = 'help-status-item';

            item.innerHTML = `
                <div class="help-status-header">
                    <span class="help-status-icon">${config.icon}</span>
                    <span class="help-status-name">${config.fullLabel}</span>
                </div>
                <div class="help-status-desc">${config.description}</div>
            `;
            list.appendChild(item);
        });

        groupDiv.appendChild(list);
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
        </div>
    `;
    container.appendChild(logicSection);

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
            description = t('helpTechTodoDesc');
        } else if (page === 'leadsDetail') {
            pageName = t('helpTechDetail');
            description = t('helpTechDetailDesc');
        }

        selectorsHtml += `
            <div class="help-tech-item">
                <div class="help-tech-header">${pageName}</div>
                <code class="help-tech-code">${selector}</code>
                <div class="help-tech-desc">${description}</div>
            </div>
        `;
    });

    techSection.innerHTML = `
        <h2>🛠 ${t('helpTechTitle')}</h2>
        <p class="help-tech-intro">${t('helpTechIntro')}</p>
        <div class="help-tech-list">
            ${selectorsHtml}
        </div>
        <div class="help-tech-note">
            <strong>${t('helpTechLeadId')}</strong>
        </div>
    `;
    container.appendChild(techSection);
}