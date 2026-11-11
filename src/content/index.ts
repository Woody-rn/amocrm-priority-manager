import type { Client, ClientStatus } from '../shared/types';
import type { PageType } from '../shared/constants';
import { STORAGE_KEYS, URL_PATTERNS, SIDEBAR_DEFAULT_WIDTH, SELECTORS } from '../shared/constants';
import { STATUS_ORDER } from '../shared/statuses';
import { StorageService } from '../shared/storage';
import { buildClientIndexes } from '../shared/utils/build-client-indexes';
import { extractLeadIdFromElement, extractNameFromElement } from '../shared/utils/parsers';
import { StatusResolver } from './status-resolver';
import { Highlighter } from './highlighter';
import { QuickPanel } from './quick-panel';
import { SidebarHandle } from './sidebar-handle';
import { ExtractorFactory } from './extractors/ExtractorFactory';
import type { IClientExtractor } from './extractors/IClientExtractor';
import { EnrichmentExtractor } from './extractors/EnrichmentExtractor';
import { DiagnosticsService } from '../shared/diagnostics';
import { groupListRowsByDate } from './date-grouper';

class ContentApp {
    private storage = new StorageService();
    private highlighter = new Highlighter();
    private quickPanel = new QuickPanel((clientName, status) =>
        this.handleStatusSelect(clientName, status)
    );
    private diag = new DiagnosticsService('content');
    private enrichmentExtractor = new EnrichmentExtractor();

    private extractor: IClientExtractor | null = null;
    private resolver: StatusResolver | null = null;
    private domObserver: MutationObserver | null = null;
    private traceObserver: MutationObserver | null = null;
    private pageLoaderObserver: MutationObserver | null = null;
    private traceStartTime = 0;

    // Настройки
    private highlightedStatuses: string[] = [];
    private quickFilterStatuses: string[] = [];
    private groupTasksByDate = false;

    // Защита от гонок
    private isRefreshing = false;
    private pendingRefresh = false;
    private lastUrl = location.href;

    // Защита от двойного срабатывания спиннера
    private loaderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private wasLoading = false;

    async init(): Promise<void> {
        this.diag.log('INIT started');
        await this.loadVisibilitySettings();
        await this.createHandle();
        this.diag.log('Handle created');
        await this.refresh();
        this.diag.log('Initial refresh done');
        this.startDomObserver();
        this.startPageLoaderObserver();

        if (this.diag.isEnabled()) {
            this.startAmoTrace();
        }

        this.addEventListeners();
        this.setupBackgroundListener();
        this.setupStorageListener();
        this.diag.log('INIT complete');
    }

    // ====SETTINGS=============================================

    private async loadVisibilitySettings(): Promise<void> {
        const res = await chrome.storage.local.get([
            STORAGE_KEYS.highlightedStatuses,
            STORAGE_KEYS.quickFilterStatuses,
            STORAGE_KEYS.groupTasksByDate
        ]);

        this.highlightedStatuses = (res[STORAGE_KEYS.highlightedStatuses] as string[]) || [...STATUS_ORDER, 'wild', 'unknown'];
        this.quickFilterStatuses = (res[STORAGE_KEYS.quickFilterStatuses] as string[]) || [...this.highlightedStatuses];
        this.groupTasksByDate = res[STORAGE_KEYS.groupTasksByDate] === true;
    }

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;

            if (changes[STORAGE_KEYS.highlightedStatuses]) {
                this.diag.log('SETTINGS: highlightedStatuses changed');
                this.highlightedStatuses = changes[STORAGE_KEYS.highlightedStatuses].newValue || [];
                this.quickFilterStatuses = [...this.highlightedStatuses];
                this.render();
            }

            if (changes[STORAGE_KEYS.quickFilterStatuses]) {
                this.diag.log('SETTINGS: quickFilterStatuses changed');
                this.quickFilterStatuses = changes[STORAGE_KEYS.quickFilterStatuses].newValue || [];
                this.render();
            }

            if (changes[STORAGE_KEYS.groupTasksByDate]) {
                this.diag.log('SETTINGS: groupTasksByDate changed');
                this.groupTasksByDate = changes[STORAGE_KEYS.groupTasksByDate].newValue === true;
                this.render();
            }
        });
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
            } else if (pageType === 'leadsList') {
                await this.enrichFromLeadsList();
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

                if (this.quickFilterStatuses.includes(status)) {
                    const client = this.resolver.getClient(leadId, clientName);
                    const otherDealsCount = client
                        ? this.resolver.getOtherDealsCount(client.parserCompanyName, client.directionAndFunnel)
                        : 0;

                    this.highlighter.apply(element, status, clientName, otherDealsCount);
                    applied++;
                } else {
                    this.highlighter.clear(element);
                }
            }
            this.diag.log(`RENDER: applied badges to ${applied} / ${elements.length}`);

            // ГРУППИРОВКА ПО ДАТАМ
            if (this.groupTasksByDate && this.detectPage() === 'todo') {
                groupListRowsByDate();
            } else {
                document.querySelectorAll('.custom-date-separator').forEach(el => el.classList.remove('custom-date-separator'));
            }

            const firstEl = elements[0];
            if (!firstEl.dataset.clientName && attempt < 3) {
                const hasVisible = elements.some(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
                if (hasVisible) {
                    this.diag.log(`RENDER: first element missing badge, retry (attempt ${attempt})`);
                    setTimeout(() => this.render(attempt + 1), 300);
                }
            }
        } finally {
            setTimeout(() => {
                this.startDomObserver();
            }, 50);
        }
    }

    private async collectNewClients(): Promise<void> {
        if (!this.extractor) return;

        // Дополнительная защита: если активной ссылки на
        if (!document.querySelector(SELECTORS.todoPageMarker)) {
            this.diag.log('COLLECT: todo page marker not found, aborting collection');
            return;
        }

        const elements = this.extractor.findElements();
        this.diag.log(`COLLECT: ${elements.length} raw elements`);

        const newClients: Client[] = [];
        let skippedHidden = 0;
        let skippedNoName = 0;
        let skippedPhantom = 0;

        for (const element of elements) {
            // 1. Защита от невидимых элементов
            if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
                skippedHidden++;
                continue;
            }

            // 2. Защита от фантомных элементов (когда DOM еще не перерисовался)
            const container = element.closest('.content-table, #list_table');
            if (container && !container.contains(element)) {
                skippedPhantom++;
                continue;
            }

            // 3. Защита от дубликатов в текущей партии
            const leadId = extractLeadIdFromElement(element);
            if (leadId && newClients.some(c => c.leadId === leadId)) {
                continue;
            }

            const client = this.extractor.extractClient(element);
            if (client) newClients.push(client);
            else skippedNoName++;
        }

        this.diag.log(`COLLECT: ${newClients.length} valid | skipped hidden: ${skippedHidden}, phantom: ${skippedPhantom}, no-name: ${skippedNoName}`);

        if (newClients.length > 0) {
            await this.storage.saveNewClients(newClients);
        }
    }

    private async enrichFromLeadsList(): Promise<void> {
        const elements = this.enrichmentExtractor.findElements();
        const data = elements
            .map((el) => this.enrichmentExtractor.extractData(el))
            .filter((d): d is NonNullable<typeof d> => d !== null);

        this.diag.log(`ENRICH: found ${data.length} deals to enrich`);

        if (data.length > 0) {
            const enrichedCount = await this.storage.enrichClients(data);
            this.diag.log(`ENRICH: ${enrichedCount} records enriched`);
        }
    }

    // ====OBSERVERS============================================

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
                this.wasLoading = true;
                this.diag.log('PAGE_LOADER: loading started');

                if (this.loaderDebounceTimer) {
                    clearTimeout(this.loaderDebounceTimer);
                    this.loaderDebounceTimer = null;
                }
                return;
            }

            if (!this.wasLoading) {
                return;
            }

            this.wasLoading = false;
            this.diag.log('PAGE_LOADER: loading finished, scheduling refresh');

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
                    element.dataset.status as ClientStatus,
                    this.quickFilterStatuses
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

        // ВАЖНО: При смене страницы сразу очищаем старые бейджи, чтобы не собирать мусор
        this.domObserver?.disconnect();
        this.highlighter.clearAll();

        this.traceStartTime = Date.now();
        this.diag.trace('URL changed, trace timer reset', { url });

        // Ждем 800 мс, чтобы amoCRM успела отрисовать новый список и удалить старые элементы
        setTimeout(() => {
            this.diag.log('URL_CHANGE: DOM should be ready, starting refresh');
            void this.refresh();
        }, 800);
    }

    private async handleStatusSelect(clientName: string, status: ClientStatus): Promise<void> {
        // ЗАЩИТА: Если статус скрыт в профиле, игнорируем клик
        if (!this.quickFilterStatuses.includes(status)) {
            this.diag.warn(`STATUS_SELECT: status "${status}" is hidden in profile, ignoring`);
            return;
        }

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
        // 1. Приоритетная проверка через DOM (самая надежная)
        if (document.querySelector(SELECTORS.todoPageMarker)) {
            return 'todo';
        }

        if (document.querySelector('textarea#person_n')) {
            return 'leadsDetail';
        }

        // 2. Если DOM еще не отрисовался, используем URL как fallback
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