import { SELECTORS } from '../../shared/constants';

const t = (key: string) => chrome.i18n.getMessage(key);

export function renderIntegration(container: HTMLElement): void {
    container.innerHTML = '';

    // ====1. КАРТА СТРАНИЦ=====================================
    const pagesSection = document.createElement('section');
    pagesSection.className = 'help-section';

    pagesSection.innerHTML = `
        <h2>🗺 ${t('integrationPagesTitle')}</h2>
        <p class="help-tech-intro">${t('integrationPagesIntro')}</p>

        <div class="help-tech-item" style="border-left-color: #4caf50;">
            <div class="help-tech-header">${t('integrationPageTodo')}</div>
            <div class="help-tech-desc">
                ${t('integrationPageTodoDesc')}
                <br><br>
                <strong>Селектор:</strong>
                <code class="help-tech-code">${SELECTORS.todo}</code>
                <br>
                <span style="font-size: 12px; color: #888;">
                    ${t('integrationSelectorTodoDesc')}
                </span>
                <br><br>
                <strong>Что парсим:</strong> name, leadId, parserCompanyName, directionAndFunnel
            </div>
        </div>

        <div class="help-tech-item" style="border-left-color: #2196f3;">
            <div class="help-tech-header">${t('integrationPageDetail')}</div>
            <div class="help-tech-desc">
                ${t('integrationPageDetailDesc')}
                <br><br>
                <strong>Селектор:</strong>
                <code class="help-tech-code">${SELECTORS.leadsDetail}</code>
                <br>
                <span style="font-size: 12px; color: #888;">
                    ${t('integrationSelectorDetailDesc')}
                </span>
                <br><br>
                <strong>Что парсим:</strong> name, leadId (из span.tag), originalCompanyName, originalCompanyINN
            </div>
        </div>

        <div class="help-tech-item" style="border-left-color: #ff9800;">
            <div class="help-tech-header">${t('integrationPageLeadsList')}</div>
            <div class="help-tech-desc">
                ${t('integrationPageLeadsListDesc')}
                <br><br>
                <strong>Селектор:</strong>
                <code class="help-tech-code">${SELECTORS.leadsList}</code>
                <br>
                <span style="font-size: 12px; color: #888;">
                    ${t('integrationSelectorTodoDesc')}
                </span>
                <br><br>
                <strong>Что парсим:</strong> только обогащение (originalCompanyName, originalCompanyINN) для существующих сделок. Новые сделки не создаются.
            </div>
        </div>

        <div class="help-tech-note" style="margin-top: 16px; background: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196f3;">
            <strong>${t('integrationLeadIdNote')}</strong>
        </div>
    `;
    container.appendChild(pagesSection);

    // ====2. ТРЕБОВАНИЯ К НАСТРОЙКЕ AMOCRM====================
    const requirementsSection = document.createElement('section');
    requirementsSection.className = 'help-section';

    requirementsSection.innerHTML = `
        <h2>⚙️ ${t('integrationRequirementsTitle')}</h2>
        <p class="help-tech-intro">${t('integrationRequirementsIntro')}</p>

        <div class="help-tech-item" style="border-left-color: #4caf50;">
            <div class="help-tech-header">${t('integrationReqTodoTitle')}</div>
            <div class="help-tech-desc">
                <ul style="margin: 8px 0; padding-left: 20px;">
                    <li>${t('integrationReqTodoObject')}</li>
                    <li>${t('integrationReqTodoFunnel')}</li>
                </ul>
            </div>
        </div>

        <div class="help-tech-item" style="border-left-color: #ff9800;">
            <div class="help-tech-header">${t('integrationReqListTitle')}</div>
            <div class="help-tech-desc">
                <ul style="margin: 8px 0; padding-left: 20px;">
                    <li>${t('integrationReqListName')}</li>
                    <li>${t('integrationReqListCompany')}</li>
                    <li>${t('integrationReqListINN')}</li>
                </ul>
            </div>
        </div>
    `;
    container.appendChild(requirementsSection);

    // ====3. МЕХАНИЗМ ОБНОВЛЕНИЯ===============================
    const lifecycleSection = document.createElement('section');
    lifecycleSection.className = 'help-section';

    lifecycleSection.innerHTML = `
        <h2>🔄 ${t('integrationLifecycleTitle')}</h2>
        <p class="help-tech-intro">${t('integrationLifecycleIntro')}</p>
        <div class="help-logic">
            <div class="help-logic-block">
                <ol style="margin: 0; padding-left: 20px;">
                    <li>${t('integrationStep1')}</li>
                    <li>${t('integrationStep2')}</li>
                    <li>${t('integrationStep3')}</li>
                    <li>${t('integrationStep4')}</li>
                    <li>${t('integrationStep5')}</li>
                </ol>
            </div>
        </div>
    `;
    container.appendChild(lifecycleSection);

    // ====4. ТОЧКИ ОТКАЗА======================================
    const failuresSection = document.createElement('section');
    failuresSection.className = 'help-section';

    failuresSection.innerHTML = `
        <h2>⚠️ ${t('integrationFailuresTitle')}</h2>
        <div class="help-tech-list">
            <div class="help-tech-item" style="border-left-color: #f44336;">
                <div class="help-tech-header">${t('integrationFailSpinner')}</div>
                <div class="help-tech-desc">${t('integrationFailSpinnerDesc')}</div>
            </div>
            <div class="help-tech-item" style="border-left-color: #f44336;">
                <div class="help-tech-header">${t('integrationFailSelectors')}</div>
                <div class="help-tech-desc">${t('integrationFailSelectorsDesc')}</div>
            </div>
            <div class="help-tech-item" style="border-left-color: #f44336;">
                <div class="help-tech-header">${t('integrationFailContainer')}</div>
                <div class="help-tech-desc">${t('integrationFailContainerDesc')}</div>
            </div>
            <div class="help-tech-item" style="border-left-color: #f44336;">
                <div class="help-tech-header">${t('integrationFailTitle')}</div>
                <div class="help-tech-desc">${t('integrationFailTitleDesc')}</div>
            </div>
        </div>
    `;
    container.appendChild(failuresSection);

    // ====5. ДИАГНОСТИКА=======================================
    const diagSection = document.createElement('section');
    diagSection.className = 'help-section';

    diagSection.innerHTML = `
        <h2>🛠 ${t('integrationDiagTitle')}</h2>
        <div class="help-tech-item" style="border-left-color: #9c27b0;">
            <div class="help-tech-desc">
                ${t('integrationDiagDesc')}
            </div>
        </div>
    `;
    container.appendChild(diagSection);
}