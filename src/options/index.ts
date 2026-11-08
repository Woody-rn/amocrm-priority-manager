import { Chart } from 'chart.js/auto';
import { StorageService } from '../shared/storage';
import { SettingsService, type Theme } from '../shared/settings';
import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';
import { applyTheme } from '../shared/utils/theme';
import type { ChangelogData, Client } from '../shared/types';
import { renderFeatures } from './components/render-features';
import { renderIntegration } from './components/render-integration';
import { renderHistory } from './components/render-history';
import { YandexDiskStorage } from '../shared/cloud/YandexDiskStorage';
import { DiagnosticsService } from '../shared/diagnostics';
import { loadTableSettings, renderTable } from './components/render-table';

class OptionsApp {
    private storage = new StorageService();
    private settingsService = new SettingsService();
    private cloudStorage = new YandexDiskStorage();
    private chart: Chart | null = null;
    private diag = new DiagnosticsService('options');

    async init(): Promise<void> {
        this.diag.log('Options init started');
        await applyTheme();
        this.renderVersion();
        await this.loadSettings();
        this.setupTabs();
        this.checkHash();
        this.addEventListeners();
        await this.renderChart();
        await this.renderTableTab();
        this.renderFeaturesAndHistory();
        this.renderIntegrationTab();
        await this.setupCloud();
        this.diag.log('Options init complete');
    }

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('appVersion');
        if (el) el.textContent = `v${version}`;
    }

    private checkHash(): void {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            const tab = document.querySelector(`[data-tab="${hash}"]`);
            if (tab) (tab as HTMLElement).click();
        }
    }

    private async loadSettings(): Promise<void> {
        const settings = await this.settingsService.getSettings();

        const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement;
        if (baseUrlInput) baseUrlInput.value = settings.baseUrl || window.location.origin;

        const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
        if (themeSelect) themeSelect.value = settings.theme;

        const diagCheckbox = document.getElementById('diagnosticsEnabled') as HTMLInputElement;
        if (diagCheckbox) diagCheckbox.checked = settings.diagnosticsEnabled;

        this.diag.setEnabled(settings.diagnosticsEnabled);
    }

    private setupTabs(): void {
        const tabs = document.querySelectorAll('.options-tab');
        const panels = document.querySelectorAll('.options-panel');

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabName = (tab as HTMLElement).dataset.tab;
                if (!tabName) return;

                tabs.forEach((t) => t.classList.remove('options-tab--active'));
                tab.classList.add('options-tab--active');

                panels.forEach((panel) => {
                    if (panel.id === `tab-${tabName}`) {
                        (panel as HTMLElement).style.display = 'block';
                    } else {
                        (panel as HTMLElement).style.display = 'none';
                    }
                });
            });
        });
    }

    private async renderChart(): Promise<void> {
        const container = document.getElementById('statsChartContainer');
        if (!container) return;

        const clients = await this.storage.getAllClients();
        const labels: string[] = [];
        const data: number[] = [];
        const colors: string[] = [];

        STATUS_ORDER.forEach((status) => {
            const count = clients.filter((c) => c.status === status).length;
            if (count === 0) return;
            const config = STATUS_CONFIG[status];
            labels.push(`${config.icon} ${config.label}`);
            data.push(count);
            colors.push(config.color);
        });

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding-top: 100px;">Нет данных для отображения</p>';
            return;
        }

        container.innerHTML = '<canvas id="statsChart"></canvas>';
        const canvas = document.getElementById('statsChart') as HTMLCanvasElement;

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Количество клиентов',
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { ticks: { maxRotation: 45, minRotation: 45 } }
                }
            }
        });
    }

    private renderFeaturesAndHistory(): void {
        const featuresContainer = document.getElementById('featuresContainer');
        if (featuresContainer) {
            renderFeatures(featuresContainer);
        }

        const historyContainer = document.getElementById('historyContainer');
        if (historyContainer) {
            void this.loadChangelog().then((changelog) => {
                if (changelog) {
                    renderHistory(historyContainer, changelog);
                } else {
                    historyContainer.innerHTML = '<p>Не удалось загрузить историю версий.</p>';
                }
            });
        }
    }

    private async loadChangelog(): Promise<ChangelogData | null> {
        try {
            const url = chrome.runtime.getURL('changelog.json');
            const response = await fetch(url);
            return await response.json() as ChangelogData;
        } catch (e) {
            console.error('Ошибка загрузки changelog:', e);
            return null;
        }
    }

    private renderIntegrationTab(): void {
        const container = document.getElementById('integrationContainer');
        if (container) {
            renderIntegration(container);
        }
    }

    private async saveSettings(): Promise<void> {
        const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement;
        const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
        const diagCheckbox = document.getElementById('diagnosticsEnabled') as HTMLInputElement;

        await this.settingsService.saveSettings({
            baseUrl: baseUrlInput.value.trim(),
            theme: themeSelect.value as Theme,
            diagnosticsEnabled: diagCheckbox.checked
        });

        this.diag.setEnabled(diagCheckbox.checked);

        await applyTheme();
    }

    // ====CLOUD SYNC (YANDEX.DISK)============================

    private async setupCloud(): Promise<void> {
        const connectBtn = document.getElementById('cloudConnectBtn') as HTMLButtonElement;
        const uploadBtn = document.getElementById('cloudUploadBtn') as HTMLButtonElement;
        const openCloudBtn = document.getElementById('cloudOpenBtn') as HTMLAnchorElement;
        const disconnectBtn = document.getElementById('cloudDisconnectBtn') as HTMLButtonElement;
        const statusEl = document.getElementById('cloudStatus');
        const backupsEl = document.getElementById('cloudBackups');

        if (!connectBtn || !uploadBtn || !statusEl || !backupsEl) return;

        const renderBackups = async () => {
            try {
                backupsEl.innerHTML = '<div class="cloud-loading">⏳ Загрузка списка...</div>';

                const files = await this.cloudStorage.listBackups();

                if (files.length === 0) {
                    backupsEl.innerHTML = '<div class="cloud-empty">Бэкапов пока нет. Нажмите «Сохранить в облако», чтобы создать первый.</div>';
                    return;
                }

                backupsEl.innerHTML = files.map(f => `
                    <div class="cloud-backup-item">
                        <span class="cloud-backup-name">${f.name}</span>
                        <span class="cloud-backup-date">${new Date(f.modified).toLocaleString('ru-RU')}</span>
                        <button data-path="${f.path}" class="btn-small restore-btn">📥 Восстановить</button>
                        <button data-path="${f.path}" class="btn-small delete-btn" title="Удалить бэкап">🗑</button>
                    </div>
                `).join('');

                backupsEl.querySelectorAll('.restore-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const path = (e.target as HTMLElement).dataset.path;
                        if (path) await this.restoreBackup(path);
                    });
                });

                backupsEl.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const path = (e.target as HTMLElement).dataset.path;
                        if (path && confirm('Удалить этот бэкап?')) {
                            try {
                                await this.cloudStorage.delete(path);
                                await renderBackups();
                            } catch (err) {
                                alert('Ошибка удаления: ' + (err as Error).message);
                            }
                        }
                    });
                });
            } catch (e) {
                this.diag.error('Cloud render backups failed', e);
                backupsEl.innerHTML = '<div class="cloud-error">⚠️ Ошибка загрузки списка бэкапов. Проверьте подключение.</div>';
            }
        };

        const updateUI = async () => {
            const connected = await this.cloudStorage.isConnected();

            if (connected) {
                statusEl.textContent = '🟢 Подключено';
                statusEl.style.color = 'var(--success-color, #4caf50)';
                uploadBtn.disabled = false;

                // Скрываем "Подключить", показываем "Открыть" и "Отключить"
                connectBtn.style.display = 'none';
                if (openCloudBtn) openCloudBtn.style.display = 'inline-flex';
                if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
            } else {
                statusEl.textContent = '⚪ Не подключено';
                statusEl.style.color = 'var(--text-muted, #666)';
                uploadBtn.disabled = true;

                // Показываем "Подключить", скрываем остальные
                connectBtn.style.display = 'inline-flex';
                if (openCloudBtn) openCloudBtn.style.display = 'none';
                if (disconnectBtn) disconnectBtn.style.display = 'none';

                backupsEl.innerHTML = '<div class="cloud-empty">Подключитесь к Яндекс.Диску, чтобы увидеть бэкапы.</div>';
                return;
            }

            await renderBackups();
        };

        connectBtn.addEventListener('click', async () => {
            try {
                statusEl.textContent = '⏳ Подключение...';
                await this.cloudStorage.connect();
                await updateUI();
            } catch (e) {
                this.diag.error('Cloud connect failed', e);
                statusEl.textContent = '🔴 Ошибка авторизации';
                statusEl.style.color = 'var(--danger-color, #f44336)';
                backupsEl.innerHTML = '<div class="cloud-error">⚠️ Не удалось авторизоваться. Проверьте настройки приложения в Яндекс OAuth.</div>';
            }
        });

        // Обработчик кнопки "Отключить"
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', async () => {
                if (!confirm('Отключить синхронизацию с Яндекс.Диском?')) return;
                await this.cloudStorage.disconnect();
                await updateUI();
            });
        }

        uploadBtn.addEventListener('click', async () => {
            try {
                uploadBtn.disabled = true;
                uploadBtn.textContent = '⏳ Сохранение...';
                const clients = await this.storage.getAllClients();
                const json = JSON.stringify(clients, null, 2);
                const filename = `amo-clients-${new Date().toISOString().split('T')[0]}.json`;
                await this.cloudStorage.upload(json, filename);
                await renderBackups();
                alert('Бэкап сохранен в Яндекс.Диск!');
            } catch (e) {
                this.diag.error('Cloud upload failed', e);
                alert('Ошибка сохранения: ' + (e as Error).message);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = '💾 Сохранить в облако';
            }
        });

        await updateUI();
    }

    private async restoreBackup(path: string): Promise<void> {
        if (!confirm('Восстановить базу из этого бэкапа? Текущие данные будут перезаписаны!')) return;

        try {
            const data = await this.cloudStorage.download(path);
            if (!data) throw new Error('Пустой файл');

            const imported = JSON.parse(data);
            await this.storage.saveAllClients(imported);
            await this.renderChart();
            alert(`База восстановлена! Записей: ${imported.length}`);
        } catch (e) {
            this.diag.error('Cloud restore failed', e);
            alert('Ошибка восстановления: ' + (e as Error).message);
        }
    }

    // ====ACTIONS (Экспорт/Импорт/Очистка)====================

    private async handleExport(): Promise<void> {
        const clients = await this.storage.getAllClients();
        if (clients.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        const json = JSON.stringify(clients, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amo-clients-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    private async handleImport(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const imported = JSON.parse(text) as Client[];

            if (!Array.isArray(imported)) {
                alert('Неверный формат файла');
                return;
            }

            await this.storage.saveAllClients(imported);
            await this.renderChart();
            alert(`Импортировано: ${imported.length} клиентов`);
        } catch (error) {
            this.diag.error('Import failed', error);
            alert('Ошибка импорта');
        } finally {
            input.value = '';
        }
    }

    private async handleClearAll(): Promise<void> {
        const clients = await this.storage.getAllClients();
        if (clients.length === 0) {
            alert('Хранилище уже пусто');
            return;
        }
        if (!confirm(`Удалить всех клиентов?\n\nБудет удалено: ${clients.length} записей\n\nЭто действие нельзя отменить!`)) {
            return;
        }
        await this.storage.clearAll();
        await this.renderChart();
        alert(`Удалено: ${clients.length} клиентов`);
    }

    // ====DIAGNOSTICS==========================================

    private async downloadDiagLog(): Promise<void> {
        const log = await DiagnosticsService.getLog();
        if (log.length === 0) {
            alert('Лог пуст');
            return;
        }

        const text = log.map(entry =>
            `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}` +
            (entry.data ? `\n  DATA: ${JSON.stringify(entry.data, null, 2)}` : '')
        ).join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amo-priority-manager-log-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    private async clearDiagLog(): Promise<void> {
        if (!confirm('Очистить диагностический лог?')) return;
        await DiagnosticsService.clearLog();
        alert('Лог очищен');
    }

    private addEventListeners(): void {
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => void this.saveSettings());

        document.querySelector('[data-tab="analytics"]')?.addEventListener('click', () => {
            void this.renderChart();
        });

        document.getElementById('exportBtn')?.addEventListener('click', () => void this.handleExport());
        document.getElementById('importBtn')?.addEventListener('click', () => {
            document.getElementById('importFile')?.click();
        });
        document.getElementById('importFile')?.addEventListener('change', (e) => void this.handleImport(e));
        document.getElementById('clearAllBtn')?.addEventListener('click', () => void this.handleClearAll());

        document.getElementById('downloadDiagLogBtn')?.addEventListener('click', () => {
            void this.downloadDiagLog();
        });
        document.getElementById('clearDiagLogBtn')?.addEventListener('click', () => {
            void this.clearDiagLog();
        });
    }

    private async renderTableTab(): Promise<void> {
        const container = document.getElementById('tableContainer');
        if (!container) return;

        await loadTableSettings();
        renderTable(container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new OptionsApp();
    void app.init();
});