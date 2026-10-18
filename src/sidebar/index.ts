import type { Client, ClientStatus, StatusGroup } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import { StorageService } from '../shared/storage';
import { STATUS_ORDER } from '../shared/statuses';
import { SettingsService } from '../shared/settings';
import { renderStats, renderClients } from './render';
import {
    FiltersController,
    applyFilters,
    createDefaultFilterState,
    type FilterState
} from './filters';
import { applyTheme } from '../shared/utils/theme';

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
    private allClients: Client[] = [];
    private filterState: FilterState = createDefaultFilterState();
    private filtersController: FiltersController | null = null;
    private baseUrl: string = '';

    async init(): Promise<void> {
        await applyTheme();
        const settings = await this.settingsService.getSettings();
        this.baseUrl = settings.baseUrl;

        this.filterState = await loadFilterState();
        await this.refresh();
        this.setupFilters();
        this.addEventListeners();
        this.setupStorageListener();
    }

    // ====REFRESH==============================================

    private async refresh(): Promise<void> {
        this.allClients = await this.storage.getAllClients();
        this.render();
    }

    private render(): void {
        // Статистика
        const statsContainer = document.getElementById('statsList');
        if (statsContainer) {
            renderStats(statsContainer, this.allClients);
        }

        // Список клиентов
        const clientsContainer = document.getElementById('clientsList');
        if (clientsContainer) {
            const filtered = applyFilters(this.allClients, this.filterState);
            renderClients(
                clientsContainer,
                filtered,
                this.filterState.searchQuery,
                this.baseUrl, // Передаем домен
                {
                    onStatusChange: (id, status) => this.handleStatusChange(id, status),
                    onDelete: (id) => this.handleDelete(id)
                }
            );
        }

        // Фильтры
        if (this.filtersController) {
            this.filtersController.render(this.allClients);
        }
    }

    // ====FILTERS==============================================

    private setupFilters(): void {
        const filtersContainer = document.getElementById('filtersContainer');
        if (!filtersContainer) return;

        this.filtersController = new FiltersController(
            filtersContainer,
            this.filterState,
            {
                onChange: async (state) => {
                    this.filterState = state;
                    await saveFilterState(state);
                    this.render();
                }
            }
        );

        this.filtersController.render(this.allClients);
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

    private addEventListeners(): void {
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                void chrome.runtime.sendMessage({ action: 'openHelp' });
            });
        }
    }

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;

            // 1. Обновление списка клиентов
            if (changes[STORAGE_KEYS.clients]) {
                void this.refresh();
            }

            // 2. Обновление темы (на лету)
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