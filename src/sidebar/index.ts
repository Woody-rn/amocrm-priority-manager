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
    private allClients: Client[] = [];
    private filterState: FilterState = createDefaultFilterState();
    private collapsedState: CollapsedState = { sections: {} };
    private filtersController: FiltersController | null = null;
    private baseUrl: string = '';

    async init(): Promise<void> {
        await applyTheme();
        const settings = await this.settingsService.getSettings();
        this.baseUrl = settings.baseUrl;

        this.filterState = await loadFilterState();
        this.collapsedState = await this.collapsedStateService.getState();

        await this.refresh();
        this.setupFilters();
        this.setupToggles();
        this.setupStorageListener();
    }

    // ====REFRESH==============================================

    private async refresh(): Promise<void> {
        this.allClients = await this.storage.getAllClients();
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

    // ====FILTERS==============================================

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

                    // Всегда обновляем список
                    this.renderClientsList();

                    // Перерисовываем фильтры только если нужно
                    if (needsRerender && this.filtersController) {
                        this.filtersController.render(this.allClients);
                    }
                }
            }
        );

        this.filtersController.render(this.allClients);
    }

    // ====TOGGLES==============================================

    private setupToggles(): void {
        const headers = document.querySelectorAll('.sidebar-section__header');

        headers.forEach(header => {
            const targetId = (header as HTMLElement).dataset.target;
            if (!targetId) return;

            const content = document.getElementById(targetId);
            const button = header.querySelector('.sidebar-section__toggle');
            if (!content || !button) return;

            // Применяем сохраненное состояние
            const isCollapsed = this.collapsedState.sections[targetId] || false;
            content.style.display = isCollapsed ? 'none' : 'block';
            button.textContent = isCollapsed ? '▶' : '▼';

            header.addEventListener('click', () => {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                button.textContent = isHidden ? '▼' : '▶';

                // Сохраняем состояние
                this.collapsedState.sections[targetId] = !isHidden;
                void this.collapsedStateService.saveState(this.collapsedState);
            });
        });
    }

    // ====HANDLERS=============================================

    private async handleStatusChange(id: string, status: ClientStatus): Promise<void> {
        const client = await this.storage.getClientById(id);
        if (!client) return;

        client.status = status;
        await this.storage.saveClient(client);
    }

    private async handleDelete(id: string): Promise<void> {
        await this.storage.deleteClient(id);
    }

    // ====EVENTS===============================================

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;

            if (changes[STORAGE_KEYS.clients]) {
                void this.refresh();
            }

            if (changes[STORAGE_KEYS.settings]) {
                void applyTheme();
            }
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new SidebarApp();
    void app.init();
});