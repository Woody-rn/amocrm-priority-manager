import type { Client, ClientStatus } from '../shared/types';
import { STATUS_CONFIG } from '../shared/statuses';

// ====HIGHLIGHTER=============================================

export class Highlighter {
    private readonly BASE_CLASS = 'priority-client';
    private readonly BADGE_CLASS = 'priority-badge';
    private readonly BADGE_FIXED_CLASS = 'priority-badge-fixed';
    private readonly COUNT_BADGE_CLASS = 'priority-deal-count';
    private readonly BADGES_WRAPPER_CLASS = 'priority-badges-wrapper';

    apply(
        element: HTMLElement,
        status: ClientStatus,
        client: Client | null,
        clientName: string,
        otherDealsCount: number = 0
    ): void {
        this.clear(element);

        const config = STATUS_CONFIG[status];
        element.classList.add(this.BASE_CLASS, config.className);

        const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';

        if (isTextarea) {
            this.addFixedBadgeWithCount(element, status, client, otherDealsCount);
        } else {
            this.addInlineBadge(element, status, client);
            if (otherDealsCount > 0) {
                this.addInlineCountBadge(element, otherDealsCount);
            }
        }

        element.dataset.clientName = clientName;
        element.dataset.status = status;
    }

    clear(element: HTMLElement): void {
        element.classList.forEach((cls) => {
            if (cls.startsWith('priority-')) {
                element.classList.remove(cls);
            }
        });

        this.removeBadges(element);

        delete element.dataset.clientName;
        delete element.dataset.status;
    }

    clearAll(): void {
        document.querySelectorAll(`.${this.BASE_CLASS}`).forEach((el) => {
            this.clear(el as HTMLElement);
        });

        document.querySelectorAll(`.${this.BADGE_CLASS}`).forEach((b) => b.remove());
        document.querySelectorAll(`.${this.BADGE_FIXED_CLASS}`).forEach((b) => b.remove());
        document.querySelectorAll(`.${this.COUNT_BADGE_CLASS}`).forEach((b) => b.remove());
        document.querySelectorAll(`.${this.BADGES_WRAPPER_CLASS}`).forEach((b) => b.remove());
    }

    // ====BADGES===============================================

    private addFixedBadgeWithCount(element: HTMLElement, status: ClientStatus, client: Client | null, count: number): void {
        const config = STATUS_CONFIG[status];
        const parent = element.parentElement;
        if (!parent) return;

        const wrapper = document.createElement('span');
        wrapper.className = this.BADGES_WRAPPER_CLASS;

        const statusBadge = document.createElement('span');
        statusBadge.className = `${this.BADGE_FIXED_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        statusBadge.textContent = `${config.icon} ${config.fullLabel}`;
        if (this.isLightColor(status)) {
            statusBadge.classList.add('priority-badge-light');
        }
        wrapper.appendChild(statusBadge);

        if (count > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = this.COUNT_BADGE_CLASS;
            countBadge.textContent = `+${count}`;
            countBadge.title = `У этой компании есть ещё ${count} сделок(и) по другому продукту`;
            wrapper.appendChild(countBadge);
        }

        this.appendAiBadge(wrapper, status, client);

        element.insertAdjacentElement('afterend', wrapper);
    }

    private addInlineBadge(element: HTMLElement, status: ClientStatus, client: Client | null): void {
        const config = STATUS_CONFIG[status];
        const badge = document.createElement('span');

        badge.className = `${this.BADGE_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        badge.textContent = `${config.icon} ${config.fullLabel}`;

        if (this.isLightColor(status)) {
            badge.classList.add('priority-badge-light');
        }

        element.appendChild(badge);
        this.appendAiBadge(element, status, client);
    }

    private appendAiBadge(container: HTMLElement, currentStatus: ClientStatus, client: Client | null): void {
        if (!client || !client.aiRecommendedStatus) return;
        if (client.aiRecommendedStatus === currentStatus) return;

        const aiConfig = STATUS_CONFIG[client.aiRecommendedStatus];

        const separator = document.createElement('span');
        separator.className = 'priority-badge-ai-separator';
        separator.textContent = '➔';
        container.appendChild(separator);

        const aiBadge = document.createElement('span');
        aiBadge.className = `${this.BADGE_CLASS} priority-badge-ai priority-badge-${this.getBadgeSuffix(client.aiRecommendedStatus)}`;
        aiBadge.textContent = `🤖 ${aiConfig.icon} ${aiConfig.label}`;
        aiBadge.title = client.description || 'Рекомендация ИИ';

        if (this.isLightColor(client.aiRecommendedStatus)) {
            aiBadge.classList.add('priority-badge-light');
        }

        container.appendChild(aiBadge);
    }

    private addInlineCountBadge(element: HTMLElement, count: number): void {
        const badge = document.createElement('span');
        badge.className = this.COUNT_BADGE_CLASS;
        badge.textContent = `+${count}`;
        badge.title = `У этой компании есть ещё ${count} сделок(и) по другому продукту`;
        element.appendChild(badge);
    }

    private removeBadges(element: HTMLElement): void {
        element.querySelector(`.${this.BADGE_CLASS}`)?.remove();
        element.querySelector(`.${this.COUNT_BADGE_CLASS}`)?.remove();
        element.querySelector('.priority-badge-ai')?.remove();
        element.querySelector('.priority-badge-ai-separator')?.remove();

        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            const next = element.nextElementSibling;
            if (next && next.classList.contains(this.BADGES_WRAPPER_CLASS)) {
                next.remove();
            }
        }
    }

    // ====HELPERS==============================================

    private getBadgeSuffix(status: ClientStatus): string {
        const config = STATUS_CONFIG[status];
        return config.className.replace('priority-', '');
    }

    private isLightColor(status: ClientStatus): boolean {
        return (
            status === 'warm' ||
            status === 'unclear'
        );
    }
}