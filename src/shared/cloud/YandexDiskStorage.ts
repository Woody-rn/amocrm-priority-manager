import type { CloudFile, ICloudStorage } from './types';

const CLIENT_ID = '2a0b62c1ea5a4d1099d1be7d4d194c30';
const AUTH_URL = 'https://oauth.yandex.ru/authorize';
const API_URL = 'https://cloud-api.yandex.net/v1/disk';
const BACKUP_FOLDER = '/amo-backups';

export class YandexDiskStorage implements ICloudStorage {
    readonly id = 'yandex';
    readonly name = 'Яндекс.Диск';

    private tokenKey = 'yandexToken';
    private token: string | null = null;

    constructor() {
        void this.loadToken();
    }

    private async loadToken(): Promise<void> {
        const result = await chrome.storage.local.get(this.tokenKey);
        this.token = result[this.tokenKey] || null;
    }

    private async saveToken(token: string): Promise<void> {
        this.token = token;
        await chrome.storage.local.set({ [this.tokenKey]: token });
    }

    async connect(): Promise<void> {
        const redirectUri = chrome.identity.getRedirectURL();
        const authUrl = `${AUTH_URL}?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                { url: authUrl, interactive: true },
                (responseUrl) => {
                    if (chrome.runtime.lastError || !responseUrl) {
                        reject(new Error(chrome.runtime.lastError?.message || 'Ошибка авторизации'));
                        return;
                    }

                    const urlParams = new URLSearchParams(responseUrl.split('#')[1]);
                    const accessToken = urlParams.get('access_token');

                    if (accessToken) {
                        this.saveToken(accessToken).then(resolve).catch(reject);
                    } else {
                        reject(new Error('Токен не получен'));
                    }
                }
            );
        });
    }

    async disconnect(): Promise<void> {
        this.token = null;
        await chrome.storage.local.remove(this.tokenKey);
    }

    async isConnected(): Promise<boolean> {
        return !!this.token;
    }

    private async ensureFolder(): Promise<void> {
        const response = await fetch(`${API_URL}/resources?path=${encodeURIComponent(BACKUP_FOLDER)}`, {
            headers: { Authorization: `OAuth ${this.token}` }
        });

        if (response.status === 404) {
            await fetch(`${API_URL}/resources?path=${encodeURIComponent(BACKUP_FOLDER)}`, {
                method: 'PUT',
                headers: { Authorization: `OAuth ${this.token}` }
            });
        }
    }

    async upload(data: string, filename: string): Promise<void> {
        if (!this.token) throw new Error('Нет авторизации');
        await this.ensureFolder();

        const fullPath = `${BACKUP_FOLDER}/${filename}`;

        // 1. Получаем URL для загрузки
        const uploadUrlResponse = await fetch(
            `${API_URL}/resources/upload?path=${encodeURIComponent(fullPath)}&overwrite=true`,
            { headers: { Authorization: `OAuth ${this.token}` } }
        );

        if (!uploadUrlResponse.ok) {
            throw new Error('Не удалось получить URL для загрузки');
        }

        const { href } = await uploadUrlResponse.json();

        // 2. Загружаем файл
        const uploadResponse = await fetch(href, {
            method: 'PUT',
            body: data
        });

        if (!uploadResponse.ok) {
            throw new Error('Не удалось загрузить файл');
        }
    }

    async listBackups(): Promise<CloudFile[]> {
        if (!this.token) throw new Error('Нет авторизации');
        await this.ensureFolder();

        const response = await fetch(
            `${API_URL}/resources?path=${encodeURIComponent(BACKUP_FOLDER)}&sort=-modified&limit=20`,
            { headers: { Authorization: `OAuth ${this.token}` } }
        );

        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error('Не удалось получить список файлов');
        }

        const data = await response.json();
        const items = data._embedded?.items || [];

        return items
            .filter((item: any) => item.name.endsWith('.json'))
            .map((item: any) => ({
                name: item.name,
                path: item.path,
                size: item.size,
                modified: item.modified
            }));
    }

    async download(path: string): Promise<string | null> {
        if (!this.token) throw new Error('Нет авторизации');

        // 1. Получаем URL для скачивания
        const downloadUrlResponse = await fetch(
            `${API_URL}/resources/download?path=${encodeURIComponent(path)}`,
            { headers: { Authorization: `OAuth ${this.token}` } }
        );

        if (!downloadUrlResponse.ok) {
            throw new Error('Не удалось получить URL для скачивания');
        }

        const { href } = await downloadUrlResponse.json();

        // 2. Скачиваем файл
        const downloadResponse = await fetch(href);
        if (!downloadResponse.ok) {
            throw new Error('Не удалось скачать файл');
        }

        return await downloadResponse.text();
    }
}