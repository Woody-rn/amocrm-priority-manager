import type { ClientStatus } from '../shared/types';
import type { PageType } from '../shared/constants';
import { URL_PATTERNS, STORAGE_KEYS } from '../shared/constants';
import { StorageService } from '../shared/storage';
import { buildClientIndexes } from '../shared/utils/build-client-indexes';
import { extractNameFromElement, extractLeadIdFromElement } from '../shared/utils/parsers';
import { StatusResolver } from './status-resolver';
import { Highlighter } from './highlighter';
import { QuickPanel } from './quick-panel';
import { Collector } from './collectors';
import { SidebarHandle } from './sidebar-handle';
import { UrlWatcher } from './url-watcher';
import { SettingsService } from '../shared/settings';

// ====CONTENT APP=============================================

/**
 * Точка входа content script.
 * Координирует все модули.
 */
class ContentApp {
    private storage = new StorageService();
    private highlighter = new Highlighter();
    private urlWatcher = new UrlWatcher((url) => this.handleUrlChange(url));
    private quickPanel = new QuickPanel((clientName, status) =>
        this.handleStatusSelect(clientName, status)
    );
    private settings = new SettingsService();
    private collector: Collector | null = null;
    private resolver: StatusResolver | null = null;
    private pageType: PageType | null = null;
    private domObserver: MutationObserver | null = null;

    async init(): Promise<void> {
        await this.settings.ensureBaseUrl(window.location.origin);
        await this.createHandle();
        await this.refresh();
        this.urlWatcher.start();
        this.startDomObserver();
        this.addEventListeners();
    }

    // ====RENDER===============================================

    private async refresh(): Promise<void> {
        const pageType = this.detectPage();
        if (!pageType) return;

        this.pageType = pageType;
        this.collector = new Collector(pageType);

        if (pageType === 'todo') {
            const settings = await this.settings.getSettings();
            if (settings.autoCollect) {
                await this.collectNewClients();
            }
        }

        const clients = await this.storage.getAllClients();
        const indexes = buildClientIndexes(clients);
        this.resolver = new StatusResolver(indexes, pageType);

        this.render();
    }

    private render(): void {
        if (!this.collector || !this.resolver) return;

        this.highlighter.clearAll();
        const elements = this.collector.findElements();

        for (const element of elements) {
            const clientName = extractNameFromElement(element);
            if (!clientName) continue;

            const leadId = extractLeadIdFromElement(element);
            const status = this.resolver.resolve(clientName, leadId);
            this.highlighter.apply(element, status, clientName);
        }
    }

    // ====DOM OBSERVER=========================================

    private startDomObserver(): void {
        if (this.domObserver) this.domObserver.disconnect();

        this.domObserver = new MutationObserver(() => {
            if (!this.collector) return;

            const elements = this.collector.findElements();
            if (elements.length > 0) {
                const firstEl = elements[0];
                if (!firstEl.dataset.clientName) {
                    this.render();
                }
            }
        });

        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ====COLLECT==============================================

    private async collectNewClients(): Promise<void> {
        if (!this.collector) return;

        const elements = this.collector.findElements();
        const newClients = [];

        for (const element of elements) {
            const client = this.collector.extractClient(element);
            if (client) newClients.push(client);
        }

        if (newClients.length > 0) {
            await this.storage.saveNewClients(newClients);
        }
    }

    // ====EVENTS===============================================

    private addEventListeners(): void {
        document.addEventListener('mouseover', (e) => {
            const element = (e.target as HTMLElement).closest(
                'a.js-navigate-link, textarea#person_n'
            ) as HTMLElement | null;

            if (element && element.dataset.clientName && element.dataset.status) {
                this.quickPanel.show(
                    element,
                    element.dataset.clientName,
                    element.dataset.status as ClientStatus
                );
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = (e.target as HTMLElement).closest(
                'a.js-navigate-link, textarea#person_n'
            );
            if (element) {
                this.quickPanel.hideWithDelay();
            }
        });

        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.quick-panel')) {
                this.quickPanel.hide();
            }
        });
    }

    private async handleStatusSelect(
        clientName: string,
        status: ClientStatus
    ): Promise<void> {
        const element = Array.from(
            document.querySelectorAll('a.js-navigate-link, textarea#person_n')
        ).find(
            (el) => (el as HTMLElement).dataset.clientName === clientName
        ) as HTMLElement | null;

        if (!element) return;

        const leadId = extractLeadIdFromElement(element);
        if (!leadId) {
            console.error(`[ContentApp] Нет leadId для "${clientName}"`);
            return;
        }

        const client = await this.storage.getClientByLeadId(leadId);
        if (client) {
            client.status = status;
            await this.storage.saveClient(client);
        }

        await this.refresh();
    }

    private async handleUrlChange(url: string): Promise<void> {
        const newPageType = this.detectPageByUrl(url);
        if (newPageType === this.pageType) return;

        this.highlighter.clearAll();
        await this.refresh();
    }

    // ====HELPERS==============================================

    private detectPage(): PageType | null {
        return this.detectPageByUrl(location.href);
    }

    private detectPageByUrl(url: string): PageType | null {
        if (URL_PATTERNS.todo.test(url)) return 'todo';
        if (URL_PATTERNS.leadsDetail.test(url)) return 'leadsDetail';
        if (URL_PATTERNS.leadsList.test(url)) return 'leadsList';
        return null;
    }

    private async createHandle(): Promise<void> {
        const handle = new SidebarHandle(
            () => this.openSidebar(),
            () => this.getSavedHandlePosition(),
            (top) => this.saveHandlePosition(top)
        );
        await handle.create();
    }

    private openSidebar(): void {
        void chrome.runtime.sendMessage({ action: 'openSidebar' });
    }

    private async getSavedHandlePosition(): Promise<number> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.handlePosition);
        return (result[STORAGE_KEYS.handlePosition] as number) || 200;
    }

    private async saveHandlePosition(top: number): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.handlePosition]: top });
    }
}

// ====BOOTSTRAP===============================================

const app = new ContentApp();
void app.init();