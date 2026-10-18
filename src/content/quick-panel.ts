import type { ClientStatus } from '../shared/types';
import { STATUS_CONFIG, GROUP_LABELS } from '../shared/statuses';
import { PANEL_HIDE_DELAY } from '../shared/constants';

// ====QUICK PANEL=============================================

/**
 * Панель выбора статуса, появляющаяся при наведении на сделку.
 * Группа "Холодные" сворачивается по клику.
 */
export class QuickPanel {
    private element: HTMLElement | null = null;
    private currentClientName: string | null = null;
    private currentStatus: ClientStatus | null = null;
    private coldGroupOpen = false;
    private hideTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private onStatusSelect: (clientName: string, status: ClientStatus) => void
    ) {}

    /**
     * Показывает панель рядом с элементом.
     */
    show(anchor: HTMLElement, clientName: string, currentStatus: ClientStatus): void {
        this.hide();

        this.currentClientName = clientName;
        this.currentStatus = currentStatus;
        this.coldGroupOpen = false;

        this.element = this.render();

        // Позиционирование
        const rect = anchor.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Примерная ширина панели для проверки
        const panelWidth = 350;

        let leftPosition = rect.right + scrollX + 10; // По умолчанию справа

        // Если панель не влезает по правому краю — показываем слева
        if (rect.right + panelWidth > window.innerWidth) {
            leftPosition = rect.left + scrollX - panelWidth - 10;
        }

        this.element.style.position = 'absolute';
        this.element.style.left = `${leftPosition}px`;
        this.element.style.top = `${rect.top + scrollY}px`;

        document.body.appendChild(this.element);
    }

    /**
     * Скрывает панель с задержкой.
     */
    hideWithDelay(): void {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            if (!this.element?.matches(':hover')) {
                this.hide();
            }
        }, PANEL_HIDE_DELAY);
    }

    /**
     * Скрывает панель немедленно.
     */
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

        panel.appendChild(this.renderRow(['unclear']));
        panel.appendChild(this.renderRow(['new', 'hot', 'warm']));
        panel.appendChild(this.renderRow(['active', 'renewal']));
        panel.appendChild(this.renderColdGroup());
        panel.appendChild(this.renderRow(['dead', 'not_target']));

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
        button.style.backgroundColor = config.color;
        button.textContent = `${config.icon} ${config.fullLabel}`;

        if (status === 'warm' || status === 'unclear') {
            button.style.color = '#333';
        }

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

    private renderColdGroup(): HTMLElement {
        const group = document.createElement('div');
        group.className = 'quick-panel__group';

        const header = document.createElement('button');
        header.className = 'quick-panel__group-header';
        header.style.backgroundColor = STATUS_CONFIG.cold_competitor.color;
        header.style.color = '#fff';

        const coldStatuses: ClientStatus[] = [
            'cold_competitor',
            'cold_refusal_demo',
            'cold_refusal_start',
            'cold_price',
            'cold_later'
        ];

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
            items.appendChild(this.renderButton(status));
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