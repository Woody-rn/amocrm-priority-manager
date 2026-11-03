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
import { ExtractorFactory } from './extractors/ExtractorFactory';
import type { IClientExtractor } from './extractors/IClientExtractor';
import { DiagnosticsService } from '../shared/diagnostics';

class ContentApp {
    private storage = new StorageService();
    private highlighter = new Highlighter();
    private quickPanel = new QuickPanel((clientName, status) =>
        this.handleStatusSelect(clientName, status)
    );
    private diag = new DiagnosticsService('content');

    private extractor: IClientExtractor | null = null;
    private resolver: StatusResolver | null = null;
    private domObserver: MutationObserver | null = null;
    private traceObserver: MutationObserver | null = null;
    private pageLoaderObserver: MutationObserver | null = null;
    private traceStartTime = 0;

    // Защита от гонок
    private isRefreshing = false;
    private pendingRefresh = false;
    private lastUrl = location.href;

    // Защита от двойного срабатывания спиннера
    private loaderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private wasLoading = false;

    async init(): Promise<void> {
        this.diag.log('INIT started');
        await this.createHandle();
        this.diag.log('Handle created');
        await this.refresh();
        this.diag.log('Initial refresh done');
        this.startDomObserver();
        this.startPageLoaderObserver();
        this.startAmoTrace();
        this.addEventListeners();
        this.setupBackgroundListener();
        this.diag.log('INIT complete');
    }

    // ====REFRESH==============================================

    private async refresh(): Promise<void> {
        if (this.isRefreshing) {
            this.diag.log('REFRESH skipped (already refreshing), pendingRefresh = true');
            this.pendingRefresh = true;
            return;
        }

        this.diag.log('REFRESH started');
        this.isRefreshing = true;
        try {
            let pageType = this.detectPage();

            if (document.querySelector('textarea#person_n') && pageType !== 'leadsDetail') {
                pageType = 'leadsDetail';
            }

            if (!pageType) {
                this.diag.log('REFRESH: unsupported page, abort');
                return;
            }

            this.extractor = ExtractorFactory.create(pageType);
            this.diag.log(`REFRESH: pageType = ${pageType}`);

            if (pageType === 'todo') {
                const elements = this.extractor.findElements();
                this.diag.log(`REFRESH: found ${elements.length} elements for collect`);
                await this.collectNewClients();
            }

            const clients = await this.storage.getAllClients();
            this.diag.log(`REFRESH: total clients in storage = ${clients.length}`);

            const indexes = buildClientIndexes(clients);
            this.resolver = new StatusResolver(indexes, pageType);

            this.render();
            this.diag.log('REFRESH: render done');
        } catch (e) {
            this.diag.error('REFRESH failed', e);
        } finally {
            this.isRefreshing = false;
            this.diag.log(`REFRESH ended, pendingRefresh = ${this.pendingRefresh}`);
            if (this.pendingRefresh) {
                this.pendingRefresh = false;
                this.diag.log('REFRESH: executing pending refresh');
                await this.refresh();
            }
        }
    }

    private render(attempt = 0): void {
        if (!this.extractor || !this.resolver) {
            this.diag.error('RENDER: extractor or resolver is null, abort');
            return;
        }

        this.domObserver?.disconnect();
        try {
            this.highlighter.clearAll();
            const elements = this.extractor.findElements();
            this.diag.log(`RENDER (attempt ${attempt}): ${elements.length} elements`);

            if (elements.length === 0) {
                this.diag.log(`RENDER: no elements, will retry (attempt ${attempt})`);
                if (attempt < 3) {
                    setTimeout(() => this.render(attempt + 1), 300);
                }
                return;
            }

            let applied = 0;
            for (const element of elements) {
                const clientName = extractNameFromElement(element);
                if (!clientName) continue;

                const leadId = extractLeadIdFromElement(element);
                const status = this.resolver.resolve(clientName, leadId);

                const client = this.resolver.getClient(leadId, clientName);
                const otherDealsCount = client
                    ? this.resolver.getOtherDealsCount(client.companyName, client.directionAndFunnel)
                    : 0;

                this.highlighter.apply(element, status, clientName, otherDealsCount);
                applied++;
            }
            this.diag.log(`RENDER: applied badges to ${applied} / ${elements.length}`);

            const firstEl = elements[0];
            if (!firstEl.dataset.clientName && attempt < 3) {
                this.diag.log(`RENDER: first element missing badge, retry (attempt ${attempt})`);
                setTimeout(() => this.render(attempt + 1), 300);
            }
        } finally {
            setTimeout(() => {
                this.startDomObserver();
            }, 50);
        }
    }

    private async collectNewClients(): Promise<void> {
        if (!this.extractor) return;

        const elements = this.extractor.findElements();
        this.diag.log(`COLLECT: ${elements.length} raw elements`);

        const newClients = [];
        let skippedHidden = 0;
        let skippedNoName = 0;

        for (const element of elements) {
            if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
                skippedHidden++;
                continue;
            }

            const client = this.extractor.extractClient(element);
            if (client) newClients.push(client);
            else skippedNoName++;
        }

        this.diag.log(`COLLECT: ${newClients.length} valid, skipped hidden = ${skippedHidden}, skipped no-name = ${skippedNoName}`);

        if (newClients.length > 0) {
            await this.storage.saveNewClients(newClients);
        }
    }

    // ====OBSERVERS============================================

    /**
     * Наблюдает за спиннером #page_change_progress.
     * Когда он исчезает (класс "stopped") — загрузка закончилась, вызываем refresh().
     */
    private startPageLoaderObserver(): void {
        if (this.pageLoaderObserver) this.pageLoaderObserver.disconnect();

        const loader = document.getElementById('page_change_progress');
        if (!loader) {
            this.diag.log('PAGE_LOADER: not found, will retry in 1s');
            setTimeout(() => this.startPageLoaderObserver(), 1000);
            return;
        }

        this.diag.log('PAGE_LOADER: attached');

        this.pageLoaderObserver = new MutationObserver(() => {
            const isStopped = loader.classList.contains('stopped');

            if (!isStopped) {
                // Загрузка началась
                this.wasLoading = true;
                this.diag.log('PAGE_LOADER: loading started');

                // Отменяем отложенный refresh, если он был
                if (this.loaderDebounceTimer) {
                    clearTimeout(this.loaderDebounceTimer);
                    this.loaderDebounceTimer = null;
                }
                return;
            }

            // Загрузка завершилась
            if (!this.wasLoading) {
                // Спиннер был "stopped" изначально, не реагируем
                return;
            }

            this.wasLoading = false;
            this.diag.log('PAGE_LOADER: loading finished, scheduling refresh');

            // Небольшая задержка, чтобы amoCRM успела отрисовать все строки
            if (this.loaderDebounceTimer) clearTimeout(this.loaderDebounceTimer);
            this.loaderDebounceTimer = setTimeout(() => {
                this.loaderDebounceTimer = null;
                this.diag.log('PAGE_LOADER: executing refresh');
                void this.refresh();
            }, 300);
        });

        this.pageLoaderObserver.observe(loader, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    private startDomObserver(): void {
        if (this.domObserver) this.domObserver.disconnect();

        this.domObserver = new MutationObserver((mutations) => {
            if (this.isRefreshing) return;
            if (!this.extractor) return;

            const hasNewRows = mutations.some(m =>
                Array.from(m.addedNodes).some(node =>
                    node.nodeType === 1 &&
                    (node as HTMLElement).querySelector?.('a.js-navigate-link, textarea#person_n')
                )
            );

            if (hasNewRows) {
                this.diag.log('OBSERVER: new rows detected, refreshing');
                void this.refresh();
            } else {
                const elements = this.extractor.findElements();
                if (elements.length > 0 && !elements[0].dataset.clientName) {
                    this.diag.log('OBSERVER: first element missing badge, rendering');
                    this.render();
                }
            }
        });

        const container = document.querySelector('.content-table')
            || document.getElementById('list_table')
            || document.body;

        this.diag.log(`OBSERVER: attached to ${container.id || container.className || 'body'}`);

        this.domObserver.observe(container, {
            childList: true,
            subtree: true
        });
    }

    private startAmoTrace(): void {
        if (this.traceObserver) this.traceObserver.disconnect();
        this.traceStartTime = Date.now();

        const container = document.querySelector('.content-table')
            || document.getElementById('list_table')
            || document.body;

        this.traceObserver = new MutationObserver((mutations) => {
            const elapsed = Date.now() - this.traceStartTime;

            mutations.forEach((m) => {
                if (m.type !== 'childList') return;

                const added = Array.from(m.addedNodes).filter(n => n.nodeType === 1) as HTMLElement[];
                const removed = Array.from(m.removedNodes).filter(n => n.nodeType === 1) as HTMLElement[];

                const addedDeals = added.filter(n =>
                    n.matches('a.js-navigate-link') ||
                    n.querySelector?.('a.js-navigate-link')
                );
                const removedDeals = removed.filter(n =>
                    n.matches('a.js-navigate-link') ||
                    n.querySelector?.('a.js-navigate-link')
                );

                if (addedDeals.length === 0 && removedDeals.length === 0) return;

                this.diag.trace(`Mutation at +${elapsed}ms`, {
                    addedDeals: addedDeals.length,
                    removedDeals: removedDeals.length,
                    visibleAdded: addedDeals.filter(n => (n as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length
                });
            });
        });

        this.traceObserver.observe(container, {
            childList: true,
            subtree: true
        });

        this.diag.trace('Amo trace started');
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

    private setupBackgroundListener(): void {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'urlChanged') {
                this.diag.log(`MESSAGE: urlChanged from background: ${message.url}`);
                void this.handleUrlChange(message.url);
            }
        });
    }

    private async handleUrlChange(url: string): Promise<void> {
        this.diag.log(`URL_CHANGE: ${url}`);
        if (url === this.lastUrl) {
            this.diag.log('URL_CHANGE: same URL, skip');
            return;
        }
        this.lastUrl = url;

        const newPageType = this.detectPageByUrl(url);
        if (newPageType === null) {
            this.diag.log('URL_CHANGE: unsupported page');
            return;
        }

        this.diag.log(`URL_CHANGE: pageType = ${newPageType}`);
        this.traceStartTime = Date.now();
        this.diag.trace('URL changed, trace timer reset', { url });

        // Даём спиннеру шанс появиться (он может появиться чуть позже)
        // и даём amoCRM время начать загрузку
        setTimeout(() => {
            if (this.loaderDebounceTimer) return; // Уже запланирован refresh
            this.diag.log('URL_CHANGE: no spinner activity, forcing refresh');
            void this.refresh();
        }, 1000);
    }

    private async handleStatusSelect(clientName: string, status: ClientStatus): Promise<void> {
        this.diag.log(`STATUS_SELECT: ${clientName} -> ${status}`);
        const element = Array.from(
            document.querySelectorAll('a.js-navigate-link, textarea#person_n')
        ).find(el => (el as HTMLElement).dataset.clientName === clientName) as HTMLElement | null;

        if (!element) {
            this.diag.error(`STATUS_SELECT: element not found for "${clientName}"`);
            return;
        }

        const leadId = extractLeadIdFromElement(element);
        if (!leadId) {
            this.diag.error(`STATUS_SELECT: no leadId for "${clientName}"`);
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