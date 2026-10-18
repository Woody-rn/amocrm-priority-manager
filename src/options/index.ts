import { Chart } from 'chart.js/auto';
import { StorageService } from '../shared/storage';
import { SettingsService, type Theme } from '../shared/settings';
import { STATUS_CONFIG, STATUS_ORDER } from '../shared/statuses';
import { applyTheme } from '../shared/utils/theme';

// ====OPTIONS APP============================================

class OptionsApp {
    private storage = new StorageService();
    private settingsService = new SettingsService();
    private chart: Chart | null = null;

    async init(): Promise<void> {
        await applyTheme();
        this.renderVersion();
        await this.loadSettings();
        this.setupTabs();
        this.addEventListeners();

        await this.renderChart();
    }

    private renderVersion(): void {
        const version = chrome.runtime.getManifest().version;
        const el = document.getElementById('appVersion');
        if (el) el.textContent = `v${version}`;
    }

    private async loadSettings(): Promise<void> {
        const settings = await this.settingsService.getSettings();

        const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement;
        if (baseUrlInput) baseUrlInput.value = settings.baseUrl || window.location.origin;

        const autoCollectInput = document.getElementById('autoCollectInput') as HTMLInputElement;
        if (autoCollectInput) autoCollectInput.checked = settings.autoCollect;

        const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
        if (themeSelect) themeSelect.value = settings.theme;
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

        if (this.chart) {
            this.chart.destroy();
        }

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
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    x: {
                        ticks: { maxRotation: 45, minRotation: 45 }
                    }
                }
            }
        });
    }

    private async saveSettings(): Promise<void> {
        const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement;
        const autoCollectInput = document.getElementById('autoCollectInput') as HTMLInputElement;
        const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;

        await this.settingsService.saveSettings({
            baseUrl: baseUrlInput.value.trim(),
            autoCollect: autoCollectInput.checked,
            theme: themeSelect.value as Theme
        });

        // Применяем тему сразу, без перезагрузки страницы
        const { applyTheme } = await import('../shared/utils/theme');
        await applyTheme();

        alert('Настройки сохранены!');
    }

    private addEventListeners(): void {
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
            void this.saveSettings();
        });

        document.getElementById('helpBtn')?.addEventListener('click', () => {
            void chrome.runtime.sendMessage({ action: 'openHelp' });
        });

        // При переключении на вкладку "Аналитика" перерисовываем график
        document.querySelector('[data-tab="analytics"]')?.addEventListener('click', () => {
            void this.renderChart();
        });
    }
}

// ====BOOTSTRAP===============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new OptionsApp();
    void app.init();
});