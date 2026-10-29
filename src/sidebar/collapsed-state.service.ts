import { STORAGE_KEYS } from '../shared/constants';

export interface CollapsedState {
    sections: Record<string, boolean>;
}

/**
 * Сервис для хранения состояния сворачивания секций в Sidebar.
 * Отвечает только за персистентность (SRP).
 */
export class CollapsedStateService {
    private storage = chrome.storage.local;
    private readonly defaultState: CollapsedState = { sections: {} };

    async getState(): Promise<CollapsedState> {
        const result = await this.storage.get(STORAGE_KEYS.sidebarCollapsedState);
        return (result[STORAGE_KEYS.sidebarCollapsedState] as CollapsedState) || this.defaultState;
    }

    async saveState(state: CollapsedState): Promise<void> {
        await this.storage.set({ [STORAGE_KEYS.sidebarCollapsedState]: state });
    }
}