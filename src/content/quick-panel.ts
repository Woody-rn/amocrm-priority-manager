import type { ClientStatus } from '../shared/types';
import { STATUS_CONFIG, GROUP_LABELS } from '../shared/statuses';
import { PANEL_HIDE_DELAY } from '../shared/constants';

// ====QUICK PANEL=============================================

export class QuickPanel {
    private element: HTMLElement | null = null;
    private currentClientName: string | null = null;
    private currentStatus: ClientStatus | null = null;
    private coldGroupOpen = false;
    private hideTimeout: ReturnType<typeof setTimeout> | null = null;

    // Массив разрешенных статусов
    private allowedStatuses: string[] = [];

    constructor(
        private onStatusSelect: (clientName: string, status: ClientStatus) => void
    ) {}

    // Обновляем список доступных статусов при каждом показе
    show(anchor: HTMLElement, clientName: string, currentStatus: ClientStatus, allowedStatuses: string[]): void {
        this.hide();
        this.allowedStatuses = allowedStatuses;

        this.currentClientName = clientName;
        this.currentStatus = currentStatus;
        this.coldGroupOpen = false;

        this.element = this.render();

        const rect = anchor.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        const panelWidth = 350;
        let leftPosition = rect.right + scrollX + 10;

        if (rect.right + panelWidth > window.innerWidth) {
            leftPosition = rect.left + scrollX - panelWidth - 10;
        }

        this.element.style.position = 'absolute';
        this.element.style.left = `${leftPosition}px`;
        this.element.style.top = `${rect.top + scrollY}px`;

        document.body.appendChild(this.element);
    }

    hideWithDelay(): void {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            if (!this.element?.matches(':hover')) {
                this.hide();
            }
        }, PANEL_HIDE_DELAY);
    }

    hide(): void {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        this.element?.remove();
        this.element = null;
        this.currentClientName = null;
        this.currentStatus = null;
    }

    // ====RENDER===============================================

    private render(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'quick-panel';

        panel.addEventListener('mouseleave', () => {
            this.hide();
        });

        // Фильтруем статусы перед рендером
        const filter = (statuses: ClientStatus[]) => statuses.filter(s => this.allowedStatuses.includes(s));

        const activeRow = filter(['new', 'hot', 'warm']);
        const currentRow = filter(['active', 'renewal']);
        const archiveRow = filter(['dead', 'not_target']);
        const unclearRow = filter(['unclear']);

        if (activeRow.length > 0) panel.appendChild(this.renderRow(activeRow));
        if (currentRow.length > 0) panel.appendChild(this.renderRow(currentRow));

        // Для холодных отдельная логика (там группа)
        const coldGroup = this.renderColdGroup();
        if (coldGroup) panel.appendChild(coldGroup);

        if (archiveRow.length > 0) panel.appendChild(this.renderRow(archiveRow));
        if (unclearRow.length > 0) panel.appendChild(this.renderRow(unclearRow));

        // Если вообще ничего не доступно, показываем заглушку
        if (panel.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.fontSize = '12px';
            msg.style.color = '#666';
            msg.style.padding = '8px';
            msg.textContent = 'Все статусы скрыты в вашем профиле.';
            panel.appendChild(msg);
        }

        return panel;
    }

    private renderRow(statuses: ClientStatus[]): HTMLElement {
        const row = document.createElement('div');
        row.className = 'quick-panel__row';
        statuses.forEach((status) => {
            row.appendChild(this.renderButton(status));
        });
        return row;
    }

    private renderButton(status: ClientStatus): HTMLElement {
        const config = STATUS_CONFIG[status];
        const button = document.createElement('button');
        button.className = 'quick-panel__button';

        button.style.borderColor = config.color;
        button.textContent = `${config.icon} ${config.fullLabel}`;

        if (status === this.currentStatus) {
            button.classList.add('quick-panel__button--current');
        }

        button.addEventListener('click', () => {
            if (this.currentClientName) {
                this.onStatusSelect(this.currentClientName, status);
                this.hide();
            }
        });

        return button;
    }

    private renderColdGroup(): HTMLElement | null {
        // Все возможные холодные статусы
        const allColdStatuses: ClientStatus[] = [
            'cold_competitor_software',
            'cold_competitor_dealer',
            'cold_refusal_demo',
            'cold_refusal_start',
            'passive'
        ];

        // Оставляем только те, что разрешены в профиле
        const coldStatuses = allColdStatuses.filter(s => this.allowedStatuses.includes(s));

        // Если ни одного холодного статуса не разрешено, не рисуем группу
        if (coldStatuses.length === 0) return null;

        const group = document.createElement('div');
        group.className = 'quick-panel__group';

        const header = document.createElement('button');
        header.className = 'quick-panel__group-header';

        // Берем цвет первого доступного статуса для рамки
        header.style.borderColor = STATUS_CONFIG[coldStatuses[0]].color;
        header.style.border = '2px solid';

        const updateHeader = () => {
            if (this.coldGroupOpen) {
                header.textContent = `🟠 ${GROUP_LABELS.cold} (${coldStatuses.length}) ▼`;
            } else {
                header.textContent = `🟠 ${GROUP_LABELS.cold} (${coldStatuses.length}) ▶`;
            }
        };
        updateHeader();

        const items = document.createElement('div');
        items.className = 'quick-panel__group-items';

        coldStatuses.forEach((status) => {
            const config = STATUS_CONFIG[status];
            const button = document.createElement('button');
            button.className = 'quick-panel__button';

            button.style.borderColor = config.color;
            button.style.textAlign = 'left';
            button.style.width = '100%';

            button.textContent = `${config.icon} ${config.label}`;

            if (status === this.currentStatus) {
                button.classList.add('quick-panel__button--current');
            }

            button.addEventListener('click', () => {
                if (this.currentClientName) {
                    this.onStatusSelect(this.currentClientName, status);
                    this.hide();
                }
            });

            items.appendChild(button);
        });

        header.addEventListener('click', (e) => {
            e.stopPropagation();
            this.coldGroupOpen = !this.coldGroupOpen;
            items.style.display = this.coldGroupOpen ? 'flex' : 'none';
            updateHeader();
        });

        items.style.display = this.coldGroupOpen ? 'flex' : 'none';

        group.appendChild(header);
        group.appendChild(items);

        return group;
    }
}