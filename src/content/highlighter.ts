import type { ClientStatus } from '../shared/types';
import { STATUS_CONFIG } from '../shared/statuses';

// ====HIGHLIGHTER=============================================

export class Highlighter {
    private readonly BASE_CLASS = 'priority-client';
    private readonly BADGE_CLASS = 'priority-badge';
    private readonly BADGE_FIXED_CLASS = 'priority-badge-fixed';
    private readonly COUNT_BADGE_CLASS = 'priority-deal-count';
    private readonly BADGES_WRAPPER_CLASS = 'priority-badges-wrapper'; // <-- Новый класс

    apply(
        element: HTMLElement,
        status: ClientStatus,
        clientName: string,
        otherDealsCount: number = 0
    ): void {
        this.clear(element);

        const config = STATUS_CONFIG[status];
        element.classList.add(this.BASE_CLASS, config.className);

        const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';

        if (isTextarea) {
            this.addFixedBadgeWithCount(element, status, otherDealsCount);
        } else {
            this.addInlineBadge(element, status);
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

    /**
     * Рендер бейджей для textarea (карточка сделки).
     * Оборачивает статус и цифру в единый контейнер, чтобы Flexbox не раскидывал их.
     */
    private addFixedBadgeWithCount(element: HTMLElement, status: ClientStatus, count: number): void {
        const config = STATUS_CONFIG[status];
        const parent = element.parentElement;
        if (!parent) return;

        // Создаем контейнер для бейджей
        const wrapper = document.createElement('span');
        wrapper.className = this.BADGES_WRAPPER_CLASS;

        // 1. Бейдж статуса
        const statusBadge = document.createElement('span');
        statusBadge.className = `${this.BADGE_FIXED_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        statusBadge.textContent = `${config.icon} ${config.fullLabel}`;
        if (this.isLightColor(status)) {
            statusBadge.classList.add('priority-badge-light');
        }
        wrapper.appendChild(statusBadge);

        // 2. Бейдж количества (если есть)
        if (count > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = this.COUNT_BADGE_CLASS;
            countBadge.textContent = String(count);
            countBadge.title = `У этой компании есть ещё ${count} сделок(и) по другому продукту`;
            wrapper.appendChild(countBadge);
        }

        // Вставляем общий контейнер после textarea
        element.insertAdjacentElement('afterend', wrapper);
    }

    /**
     * Рендер бейджа статуса для ссылок (список задач).
     */
    private addInlineBadge(element: HTMLElement, status: ClientStatus): void {
        const config = STATUS_CONFIG[status];
        const badge = document.createElement('span');

        badge.className = `${this.BADGE_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        badge.textContent = `${config.icon} ${config.fullLabel}`;

        if (this.isLightColor(status)) {
            badge.classList.add('priority-badge-light');
        }

        element.appendChild(badge);
    }

    /**
     * Рендер бейджа количества для ссылок (вставляется внутрь ссылки).
     */
    private addInlineCountBadge(element: HTMLElement, count: number): void {
        const badge = document.createElement('span');
        badge.className = this.COUNT_BADGE_CLASS;
        badge.textContent = String(count);
        badge.title = `У этой компании есть ещё ${count} сделок(и) по другому продукту`;
        element.appendChild(badge);
    }

    private removeBadges(element: HTMLElement): void {
        element.querySelector(`.${this.BADGE_CLASS}`)?.remove();
        element.querySelector(`.${this.COUNT_BADGE_CLASS}`)?.remove();

        // Удаляем контейнер с фиксированными бейджами (для textarea)
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            const next = element.nextElementSibling;
            if (next && next.classList.contains(this.BADGES_WRAPPER_CLASS)) {
                next.remove();
            }
            // На всякий случай чистим старые версии бейджей, если остались
            if (next && (next.classList.contains(this.BADGE_FIXED_CLASS) || next.classList.contains(this.COUNT_BADGE_CLASS))) {
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
            status === 'unclear' ||
            status === 'cold_competitor_software' ||
            status === 'cold_competitor_dealer' ||
            status === 'cold_refusal_demo' ||
            status === 'cold_refusal_start'
        );
    }
}