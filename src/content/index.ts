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
import { AiPanel } from './ai-panel'; // <-- ИМПОРТ

class ContentApp {
    private storage = new StorageService();
    private highlighter = new Highlighter();
    private quickPanel = new QuickPanel((clientName, status) =>
        this.handleStatusSelect(clientName, status)
    );
    private diag = new DiagnosticsService('content');
    private enrichmentExtractor = new EnrichmentExtractor();

    // Экземпляр панели ИИ
    private aiPanel = new AiPanel();

    private extractor: IClientExtractor | null = null;
    private resolver: StatusResolver | null = null;
    private domObserver: MutationObserver | null = null;
    private pageLoaderObserver: MutationObserver | null = null;

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
                this.highlightedStatuses = changes[STORAGE_KEYS.highlightedStatuses].newValue || [];
                this.quickFilterStatuses = [...this.highlightedStatuses];
                this.render();
            }

            if (changes[STORAGE_KEYS.quickFilterStatuses]) {
                this.quickFilterStatuses = changes[STORAGE_KEYS.quickFilterStatuses].newValue || [];
                this.render();
            }

            if (changes[STORAGE_KEYS.groupTasksByDate]) {
                this.groupTasksByDate = changes[STORAGE_KEYS.groupTasksByDate].newValue === true;
                this.render();
            }
        });
    }

    // ====REFRESH==============================================

    private async refresh(): Promise<void> {
        // Управление кнопкой ИИ (только в карточке сделки)
        const textarea = document.querySelector('textarea#person_n') as HTMLTextAreaElement | null;
        if (textarea) {
            const leadId = extractLeadIdFromElement(textarea);
            if (leadId) {
                this.aiPanel.createHandle(leadId);
            }
        } else {
            this.aiPanel.destroy();
        }

        if (this.isRefreshing) {
            this.pendingRefresh = true;
            return;
        }

        this.isRefreshing = true;
        try {
            let pageType = this.detectPage();

            if (document.querySelector('textarea#person_n') && pageType !== 'leadsDetail') {
                pageType = 'leadsDetail';
            }

            if (!pageType) return;

            this.extractor = ExtractorFactory.create(pageType);

            if (pageType === 'todo') {
                await this.collectNewClients();
            } else if (pageType === 'leadsList') {
                await this.enrichFromLeadsList();
            }

            const clients = await this.storage.getAllClients();
            const indexes = buildClientIndexes(clients);
            this.resolver = new StatusResolver(indexes, pageType);

            this.render();
        } catch (e) {
            this.diag.error('REFRESH failed', e);
        } finally {
            this.isRefreshing = false;
            if (this.pendingRefresh) {
                this.pendingRefresh = false;
                await this.refresh();
            }
        }
    }

    private render(attempt = 0): void {
        if (!this.extractor || !this.resolver) return;

        this.domObserver?.disconnect();
        try {
            this.highlighter.clearAll();
            const elements = this.extractor.findElements();

            if (elements.length === 0) {
                if (attempt < 3) {
                    setTimeout(() => this.render(attempt + 1), 300);
                }
                return;
            }

            for (const element of elements) {
                const clientName = extractNameFromElement(element);
                if (!clientName) continue;

                const leadId = extractLeadIdFromElement(element);
                const status = this.resolver.resolve(clientName, leadId);
                const client = this.resolver.getClient(leadId, clientName);

                if (this.quickFilterStatuses.includes(status)) {
                    const otherDealsCount = client
                        ? this.resolver.getOtherDealsCount(client.parserCompanyName, client.directionAndFunnel)
                        : 0;

                    this.highlighter.apply(element, status, client, clientName, otherDealsCount);
                } else {
                    this.highlighter.clear(element);
                }
            }

            if (this.groupTasksByDate && this.detectPage() === 'todo') {
                groupListRowsByDate();
            } else {
                document.querySelectorAll('.custom-date-separator').forEach(el => el.classList.remove('custom-date-separator'));
            }

            const firstEl = elements[0];
            if (!firstEl.dataset.clientName && attempt < 3) {
                const hasVisible = elements.some(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
                if (hasVisible) {
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
        if (!document.querySelector(SELECTORS.todoPageMarker)) return;

        const elements = this.extractor.findElements();
        const newClients: Client[] = [];

        for (const element of elements) {
            if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;

            const container = element.closest('.content-table, #list_table');
            if (container && !container.contains(element)) continue;

            const leadId = extractLeadIdFromElement(element);
            if (leadId && newClients.some(c => c.leadId === leadId)) continue;

            const client = this.extractor.extractClient(element);
            if (client) newClients.push(client);
        }

        if (newClients.length > 0) {
            await this.storage.saveNewClients(newClients);
        }
    }

    private async enrichFromLeadsList(): Promise<void> {
        const elements = this.enrichmentExtractor.findElements();
        const data = elements
            .map((el) => this.enrichmentExtractor.extractData(el))
            .filter((d): d is NonNullable<typeof d> => d !== null);

        if (data.length > 0) {
            await this.storage.enrichClients(data);
        }
    }

    // ====OBSERVERS============================================

    private startPageLoaderObserver(): void {
        if (this.pageLoaderObserver) this.pageLoaderObserver.disconnect();

        const loader = document.getElementById('page_change_progress');
        if (!loader) {
            setTimeout(() => this.startPageLoaderObserver(), 1000);
            return;
        }

        this.pageLoaderObserver = new MutationObserver(() => {
            const isStopped = loader.classList.contains('stopped');

            if (!isStopped) {
                this.wasLoading = true;
                if (this.loaderDebounceTimer) {
                    clearTimeout(this.loaderDebounceTimer);
                    this.loaderDebounceTimer = null;
                }
                return;
            }

            if (!this.wasLoading) return;

            this.wasLoading = false;
            if (this.loaderDebounceTimer) clearTimeout(this.loaderDebounceTimer);
            this.loaderDebounceTimer = setTimeout(() => {
                this.loaderDebounceTimer = null;
                void this.refresh();
            }, 300);
        });

        this.pageLoaderObserver.observe(loader, { attributes: true, attributeFilter: ['class'] });
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
                void this.refresh();
            } else {
                const elements = this.extractor.findElements();
                if (elements.length > 0 && !elements[0].dataset.clientName) {
                    this.render();
                }
            }
        });

        const container = document.querySelector('.content-table') || document.getElementById('list_table') || document.body;
        this.domObserver.observe(container, { childList: true, subtree: true });
    }

    // ====EVENTS===============================================

    private addEventListeners(): void {
        document.addEventListener('mouseover', (e) => {
            const element = (e.target as HTMLElement).closest('a.js-navigate-link, textarea#person_n') as HTMLElement | null;
            if (element && element.dataset.clientName && element.dataset.status) {
                this.quickPanel.show(element, element.dataset.clientName, element.dataset.status as ClientStatus, this.quickFilterStatuses);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = (e.target as HTMLElement).closest('a.js-navigate-link, textarea#person_n');
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
                void this.handleUrlChange(message.url);
            }
        });
    }

    private async handleUrlChange(url: string): Promise<void> {
        if (url === this.lastUrl) return;
        this.lastUrl = url;

        const newPageType = this.detectPageByUrl(url);
        if (newPageType === null) return;

        this.domObserver?.disconnect();
        this.highlighter.clearAll();

        setTimeout(() => {
            void this.refresh();
        }, 800);
    }

    private async handleStatusSelect(clientName: string, status: ClientStatus): Promise<void> {
        if (!this.quickFilterStatuses.includes(status)) return;

        const element = Array.from(document.querySelectorAll('a.js-navigate-link, textarea#person_n'))
            .find(el => (el as HTMLElement).dataset.clientName === clientName) as HTMLElement | null;

        if (!element) return;

        const leadId = extractLeadIdFromElement(element);
        if (!leadId) return;

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
        if (document.querySelector(SELECTORS.todoPageMarker)) return 'todo';
        if (document.querySelector('textarea#person_n')) return 'leadsDetail';
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
            (width) => this.saveSidebarWidth(width),
            () => {
                // Колбэк для кнопки ИИ
                if (this.aiPanel) {
                    this.aiPanel.openFromHandle();
                }
            }
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