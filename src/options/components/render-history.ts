import type { ChangelogData } from '../../shared/types';

export function renderHistory(container: HTMLElement, changelog: ChangelogData): void {
    container.innerHTML = '';

    const section = document.createElement('section');
    section.className = 'help-section';

    const title = document.createElement('h2');
    title.textContent = '📜 История версий';
    section.appendChild(title);

    changelog.versions.forEach((v) => {
        const item = document.createElement('div');
        item.className = 'help-version-item';

        item.innerHTML = `
            <div class="help-version-header">
                <span class="help-version-number">v${v.version}</span>
                <span class="help-version-date">${v.date}</span>
            </div>
            <ul class="help-version-changes">
                ${v.changes.map(c => `<li>${c}</li>`).join('')}
            </ul>
        `;

        section.appendChild(item);
    });

    container.appendChild(section);
}