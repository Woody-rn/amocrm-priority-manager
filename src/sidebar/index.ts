import type { Client, ClientStatus, StatusGroup } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import { StorageService } from '../shared/storage';
import { STATUS_ORDER } from '../shared/statuses';
import { SettingsService } from '../shared/settings';
import { renderClients } from './render';
import {
    FiltersController,
    applyFilters,
    createDefaultFilterState,
    type FilterState
} from './filters';
import { applyTheme } from '../shared/utils/theme';
import { CollapsedStateService, type CollapsedState } from './collapsed-state.service';
import { DiagnosticsService } from '../shared/diagnostics';

// ====STORAGE FOR FILTERS====================================

interface SerializedFilterState {
    selectedStatuses: ClientStatus[];
    expandedGroups: string[];
    searchQuery: string;
}

async function loadFilterState(): Promise<FilterState> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.filterState);
    const saved = result[STORAGE_KEYS.filterState] as SerializedFilterState | undefined;

    if (!saved) return createDefaultFilterState();

    return {
        selectedStatuses: new Set(saved.selectedStatuses || STATUS_ORDER),
        expandedGroups: new Set((saved.expandedGroups || []) as StatusGroup[]),
        searchQuery: saved.searchQuery || ''
    };
}

async function saveFilterState(state: FilterState): Promise<void> {
    const serialized: SerializedFilterState = {
        selectedStatuses: Array.from(state.selectedStatuses),
        expandedGroups: Array.from(state.expandedGroups),
        searchQuery: state.searchQuery
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.filterState]: serialized });
}

// ====SIDEBAR APP============================================

class SidebarApp {
    private storage = new StorageService();
    private settingsService = new SettingsService();
    private collapsedStateService = new CollapsedStateService();
    private diag = new DiagnosticsService('sidebar');
    private allClients: Client[] = [];
    private filterState: FilterState = createDefaultFilterState();
    private collapsedState: CollapsedState = { sections: {} };
    private filtersController: FiltersController | null = null;
    private baseUrl: string = '';

    async init(): Promise<void> {
        this.diag.log('Sidebar init started');
        await applyTheme();
        const settings = await this.settingsService.getSettings();
        this.baseUrl = settings.baseUrl;
        this.diag.setEnabled(settings.diagnosticsEnabled);

        this.filterState = await loadFilterState();
        this.collapsedState = await this.collapsedStateService.getState();

        await this.refresh();
        this.setupFilters();
        this.setupToggles();
        this.setupStorageListener();
        this.diag.log('Sidebar init complete');
    }

    private async refresh(): Promise<void> {
        this.allClients = await this.storage.getAllClients();
        this.diag.log('Sidebar refresh', { clientsCount: this.allClients.length });
        this.render();
    }

    private render(): void {
        this.renderClientsList();

        if (this.filtersController) {
            this.filtersController.render(this.allClients);
        }
    }

    private renderClientsList(): void {
        const clientsContainer = document.getElementById('clientsList');
        if (!clientsContainer) return;

        const filtered = applyFilters(this.allClients, this.filterState);
        renderClients(
            clientsContainer,
            filtered,
            this.filterState.searchQuery,
            this.baseUrl,
            {
                onStatusChange: (id, status) => this.handleStatusChange(id, status),
                onDelete: (id) => this.handleDelete(id)
            }
        );
    }

    private setupFilters(): void {
        const filtersContainer = document.getElementById('filtersContainer');
        if (!filtersContainer) return;

        this.filtersController = new FiltersController(
            filtersContainer,
            this.filterState,
            {
                onChange: async (state, needsRerender) => {
                    this.filterState = state;
                    await saveFilterState(state);

                    this.renderClientsList();

                    if (needsRerender && this.filtersController) {
                        this.filtersController.render(this.allClients);
                    }
                }
            }
        );

        this.filtersController.render(this.allClients);
    }

    private setupToggles(): void {
        const headers = document.querySelectorAll('.sidebar-section__header');

        headers.forEach(header => {
            const targetId = (header as HTMLElement).dataset.target;
            if (!targetId) return;

            const content = document.getElementById(targetId);
            const button = header.querySelector('.sidebar-section__toggle');
            if (!content || !button) return;

            const isCollapsed = this.collapsedState.sections[targetId] || false;
            content.style.display = isCollapsed ? 'none' : 'block';
            button.textContent = isCollapsed ? '▶' : '▼';

            header.addEventListener('click', () => {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                button.textContent = isHidden ? '▼' : '▶';

                this.collapsedState.sections[targetId] = !isHidden;
                void this.collapsedStateService.saveState(this.collapsedState);
            });
        });
    }

    private async handleStatusChange(id: string, status: ClientStatus): Promise<void> {
        this.diag.log('Status change', { id, status });
        const client = await this.storage.getClientById(id);
        if (!client) return;

        client.status = status;
        await this.storage.saveClient(client);
    }

    private async handleDelete(id: string): Promise<void> {
        this.diag.log('Delete client', { id });
        await this.storage.deleteClient(id);
    }

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;

            if (changes[STORAGE_KEYS.clients]) {
                void this.refresh();
            }

            if (changes[STORAGE_KEYS.settings]) {
                void applyTheme();
                // Перечитываем настройки, чтобы подхватить diagnosticsEnabled
                void this.settingsService.getSettings().then(settings => {
                    this.diag.setEnabled(settings.diagnosticsEnabled);
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new SidebarApp();
    void app.init();
});