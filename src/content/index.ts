import type { ClientStatus } from '../shared/types';
import type { PageType } from '../shared/constants';
import { STORAGE_KEYS, URL_PATTERNS, SIDEBAR_DEFAULT_WIDTH } from '../shared/constants';
import { StorageService } from '../shared/storage';
import { buildClientIndexes } from '../shared/utils/build-client-indexes';
import { extractLeadIdFromElement, extractNameFromElement } from '../shared/utils/parsers';
import { StatusResolver } from './status-resolver';
import { Highlighter } from './highlighter';
import { QuickPanel } from './quick-panel';
import { SidebarHandle } from './sidebar-handle';
import { UrlWatcher } from './url-watcher';
import { ExtractorFactory } from './extractors/ExtractorFactory';
import type { IClientExtractor } from './extractors/IClientExtractor';

class ContentApp {
    private storage = new StorageService();
    private highlighter = new Highlighter();
    private urlWatcher = new UrlWatcher((url) => this.handleUrlChange(url));
    private quickPanel = new QuickPanel((clientName, status) =>
        this.handleStatusSelect(clientName, status)
    );

    private extractor: IClientExtractor | null = null;
    private resolver: StatusResolver | null = null;
    private pageType: PageType | null = null;
    private domObserver: MutationObserver | null = null;

    async init(): Promise<void> {
        await this.createHandle();
        await this.refresh();
        this.urlWatcher.start();
        this.startDomObserver();
        this.addEventListeners();
        this.setupBackgroundListener(); // <-- Слушаем фон
    }

    private async refresh(): Promise<void> {
        let pageType = this.detectPage();

        if (document.querySelector('textarea#person_n') && pageType !== 'leadsDetail') {
            pageType = 'leadsDetail';
        }

        if (!pageType) {
            console.log('[ContentApp] Страница не поддерживается');
            return;
        }

        this.pageType = pageType;
        this.extractor = ExtractorFactory.create(pageType);

        if (pageType === 'todo') {
            await this.collectNewClients();
        }

        const clients = await this.storage.getAllClients();
        const indexes = buildClientIndexes(clients);
        this.resolver = new StatusResolver(indexes, pageType);

        this.render();
    }

    private render(): void {
        if (!this.extractor || !this.resolver) return;

        this.highlighter.clearAll();
        const elements = this.extractor.findElements();

        for (const element of elements) {
            const clientName = extractNameFromElement(element);
            if (!clientName) continue;

            const leadId = extractLeadIdFromElement(element);
            const status = this.resolver.resolve(clientName, leadId);
            this.highlighter.apply(element, status, clientName);
        }
    }

    private async collectNewClients(): Promise<void> {
        if (!this.extractor) return;

        const elements = this.extractor.findElements();
        const newClients = [];

        for (const element of elements) {
            const client = this.extractor.extractClient(element);
            if (client) newClients.push(client);
        }

        if (newClients.length > 0) {
            await this.storage.saveNewClients(newClients);
        }
    }

    // ====OBSERVERS============================================

    private startDomObserver(): void {
        if (this.domObserver) this.domObserver.disconnect();

        this.domObserver = new MutationObserver(() => {
            if (!this.extractor) return;
            const elements = this.extractor.findElements();
            if (elements.length > 0) {
                const firstEl = elements[0];
                // Если у первого элемента нет нашего маркера, значит DOM перерисовался (например, модалка)
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
            if (element) this.quickPanel.hideWithDelay();
        });

        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.quick-panel')) {
                this.quickPanel.hide();
            }
        });
    }

    // ====BACKGROUND MESSAGES==================================

    private setupBackgroundListener(): void {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'urlChanged') {
                console.log('[ContentApp] URL changed via background, updating...');
                void this.handleUrlChange(message.url);
            }
        });
    }

    private async handleStatusSelect(clientName: string, status: ClientStatus): Promise<void> {
        const element = Array.from(
            document.querySelectorAll('a.js-navigate-link, textarea#person_n')
        ).find(el => (el as HTMLElement).dataset.clientName === clientName) as HTMLElement | null;

        if (!element) return;

        const leadId = extractLeadIdFromElement(element);
        if (!leadId) {
            console.error(`[ContentApp] Нет leadId для "${clientName}"`);
            return;
        }

        let client = await this.storage.getClientByLeadId(leadId);

        if (client) {
            client.status = status;
            await this.storage.saveClient(client);
        } else {
            if (this.extractor) {
                const newClient = this.extractor.extractClient(element);
                if (newClient) {
                    newClient.status = status;
                    await this.storage.saveClient(newClient);
                }
            }
        }

        await this.refresh();
    }

    // ====URL==================================================

    private async handleUrlChange(url: string): Promise<void> {
        const newPageType = this.detectPageByUrl(url);

        // Если URL изменился (например, пагинация), но тип страницы тот же
        // или тип страницы изменился (переход в карточку) - обновляем всё
        if (newPageType === this.pageType || newPageType !== null) {
            this.highlighter.clearAll();
            // Небольшая задержка, чтобы DOM успел обновиться после смены URL
            setTimeout(async () => {
                await this.refresh();
            }, 100);
        }
    }

    private detectPage(): PageType | null {
        return this.detectPageByUrl(location.href);
    }

    private detectPageByUrl(url: string): PageType | null {
        if (URL_PATTERNS.todo.test(url)) return 'todo';
        if (URL_PATTERNS.leadsDetail.test(url)) return 'leadsDetail';
        if (URL_PATTERNS.leadsList.test(url)) return 'leadsList';
        return null;
    }

    // ====HANDLE===============================================

    private async createHandle(): Promise<void> {
        const handle = new SidebarHandle(
            () => this.getSavedHandlePosition(),
            (top) => this.saveHandlePosition(top),
            () => this.getSavedSidebarWidth(),
            (width) => this.saveSidebarWidth(width)
        );
        await handle.create();
    }

    private async getSavedHandlePosition(): Promise<number> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.handlePosition);
        return (result[STORAGE_KEYS.handlePosition] as number) || 200;
    }

    private async saveHandlePosition(top: number): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.handlePosition]: top });
    }

    private async getSavedSidebarWidth(): Promise<number> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.sidebarWidth);
        return (result[STORAGE_KEYS.sidebarWidth] as number) || SIDEBAR_DEFAULT_WIDTH;
    }

    private async saveSidebarWidth(width: number): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.sidebarWidth]: width });
    }
}

// ====BOOTSTRAP===============================================

const app = new ContentApp();
void app.init();