import { STORAGE_KEYS } from './constants';

export type DiagLevel = 'log' | 'warn' | 'error';

export interface DiagEntry {
    timestamp: string;
    level: DiagLevel;
    source: string;
    message: string;
    data?: unknown;
}

export class DiagnosticsService {
    private static readonly MAX_ENTRIES = 500;
    private storage = chrome.storage.local;
    private enabled = false;
    private source: string;

    constructor(source: string) {
        this.source = source;
        void this.loadEnabled();
    }

    private async loadEnabled(): Promise<void> {
        try {
            const result = await this.storage.get(STORAGE_KEYS.diagnosticsEnabled);
            this.enabled = result[STORAGE_KEYS.diagnosticsEnabled] === true;
        } catch {
            this.enabled = false;
        }
    }

    setEnabled(value: boolean): void {
        this.enabled = value;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    log(message: string, data?: unknown): void {
        void this.write('log', message, data);
    }

    warn(message: string, data?: unknown): void {
        void this.write('warn', message, data);
    }

    error(message: string, error?: unknown): void {
        void this.write('error', message, error);
    }

    /**
     * Специальный метод для трассировки поведения страницы.
     * Пишет в лог с уровнем 'log' и префиксом [TRACE].
     */
    trace(message: string, data?: unknown): void {
        void this.write('log', `[TRACE] ${message}`, data);
    }

    private async write(level: DiagLevel, message: string, data?: unknown): Promise<void> {
        const prefix = `[DIAG:${this.source}]`;
        const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        method(prefix, message, data ?? '');

        if (!this.enabled) return;

        try {
            const entry: DiagEntry = {
                timestamp: new Date().toISOString(),
                level,
                source: this.source,
                message,
                data: this.safeSerialize(data)
            };

            const result = await this.storage.get(STORAGE_KEYS.diagnosticsLog);
            const log: DiagEntry[] = (result[STORAGE_KEYS.diagnosticsLog] as DiagEntry[]) || [];

            log.push(entry);

            const trimmed = log.length > DiagnosticsService.MAX_ENTRIES
                ? log.slice(log.length - DiagnosticsService.MAX_ENTRIES)
                : log;

            await this.storage.set({ [STORAGE_KEYS.diagnosticsLog]: trimmed });
        } catch (e) {
            console.error('[DiagnosticsService] Failed to write log:', e);
        }
    }

    private safeSerialize(data: unknown): unknown {
        if (data === undefined || data === null) return undefined;
        try {
            const str = JSON.stringify(data);
            if (str.length > 1000) return str.substring(0, 1000) + '... (truncated)';
            return data;
        } catch {
            return String(data);
        }
    }

    static async getLog(): Promise<DiagEntry[]> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.diagnosticsLog);
        return (result[STORAGE_KEYS.diagnosticsLog] as DiagEntry[]) || [];
    }

    static async clearLog(): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.diagnosticsLog]: [] });
    }
}