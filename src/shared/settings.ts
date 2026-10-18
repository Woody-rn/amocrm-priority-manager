import { STORAGE_KEYS } from './constants';

// ====TYPES==================================================

export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
    baseUrl: string;
    autoCollect: boolean;
    theme: Theme;
}

const DEFAULT_SETTINGS: AppSettings = {
    baseUrl: '',
    autoCollect: true,
    theme: 'system'
};

// ====SETTINGS SERVICE=======================================

export class SettingsService {
    private storage = chrome.storage.local;

    /**
     * Получает все настройки.
     */
    async getSettings(): Promise<AppSettings> {
        const result = await this.storage.get(STORAGE_KEYS.settings);
        const saved = result[STORAGE_KEYS.settings] as Partial<AppSettings> | undefined;

        return { ...DEFAULT_SETTINGS, ...saved };
    }

    /**
     * Сохраняет часть настроек (частичное обновление).
     */
    async saveSettings(patch: Partial<AppSettings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...patch };
        await this.storage.set({ [STORAGE_KEYS.settings]: updated });
    }

    /**
     * Автоматически сохраняет домен, если его еще нет в базе.
     */
    async ensureBaseUrl(origin: string): Promise<void> {
        const settings = await this.getSettings();
        if (!settings.baseUrl) {
            await this.saveSettings({ baseUrl: origin });
        }
    }
}