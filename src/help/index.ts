import type { ChangelogData } from '../shared/types';
import { renderFeatures } from './render-features';
import { renderHistory } from './render-history';

// ====HELP APP===============================================

class HelpApp {
    private changelog: ChangelogData | null = null;
    private currentTab: 'features' | 'history' = 'features';

    async init(): Promise<void> {
        await this.loadChangelog();
        this.renderVersion();
        this.renderTab();
        this.addEventListeners();
    }

    // ====LOAD=================================================

    private async loadChangelog(): Promise<void> {
        try {
            const url = chrome.runtime.getURL('changelog.json');
            const response = await fetch(url);
            this.changelog = await response.json();
        } catch (error) {
            console.error('[HelpApp] Ошибка загрузки changelog:', error);
        }
    }

    // ====RENDER===============================================

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('helpVersion');
        if (el) el.textContent = `v${version}`;
    }

    private renderTab(): void {
        const container = document.getElementById('tabContent');
        if (!container) return;

        if (this.currentTab === 'features') {
            renderFeatures(container);
        } else if (this.changelog) {
            renderHistory(container, this.changelog);
        }

        // Активная вкладка
        document.querySelectorAll('.help-tab').forEach((tab) => {
            tab.classList.toggle(
                'help-tab--active',
                (tab as HTMLElement).dataset.tab === this.currentTab
            );
        });
    }

    // ====EVENTS===============================================

    private addEventListeners(): void {
        document.querySelectorAll('.help-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabName = (tab as HTMLElement).dataset.tab as 'features' | 'history';
                if (tabName === this.currentTab) return;
                this.currentTab = tabName;
                this.renderTab();
            });
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new HelpApp();
    void app.init();
});