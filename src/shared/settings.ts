import { STORAGE_KEYS } from './constants';

// ====TYPES==================================================

export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
    baseUrl: string;
    theme: Theme;
    diagnosticsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    baseUrl: '',
    theme: 'system',
    diagnosticsEnabled: false
};

// ====SETTINGS SERVICE=======================================

export class SettingsService {
    private storage = chrome.storage.local;

    async getSettings(): Promise<AppSettings> {
        const result = await this.storage.get(STORAGE_KEYS.settings);
        const saved = result[STORAGE_KEYS.settings] as Partial<AppSettings> | undefined;

        return { ...DEFAULT_SETTINGS, ...saved };
    }

    async saveSettings(patch: Partial<AppSettings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...patch };

        // Нормализуем baseUrl: убираем все слэши на конце
        if (updated.baseUrl) {
            updated.baseUrl = updated.baseUrl.replace(/\/+$/, '');
        }

        await this.storage.set({ [STORAGE_KEYS.settings]: updated });

        // Синхронизируем флаг отладки для DiagnosticsService
        if (patch.diagnosticsEnabled !== undefined) {
            await this.storage.set({
                [STORAGE_KEYS.diagnosticsEnabled]: patch.diagnosticsEnabled
            });
        }
    }

    async ensureBaseUrl(origin: string): Promise<void> {
        const settings = await this.getSettings();
        if (!settings.baseUrl) {
            await this.saveSettings({ baseUrl: origin });
        }
    }
}