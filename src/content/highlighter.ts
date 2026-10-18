import type { ClientStatus } from '../shared/types';
import { STATUS_CONFIG } from '../shared/statuses';

// ====HIGHLIGHTER=============================================

/**
 * Применяет визуальный статус к элементам сделок.
 *
 * Отвечает только за:
 * - CSS-классы подсветки
 * - Бейдж статуса
 * - data-атрибуты
 *
 * Не знает про:
 * - Поиск элементов
 * - StorageService
 * - Обработку событий
 */
export class Highlighter {
    private readonly BASE_CLASS = 'priority-client';
    private readonly BADGE_CLASS = 'priority-badge';
    private readonly BADGE_FIXED_CLASS = 'priority-badge-fixed';

    /**
     * Применяет статус к элементу.
     */
    apply(element: HTMLElement, status: ClientStatus, clientName: string): void {
        this.clear(element);

        const config = STATUS_CONFIG[status];

        // Классы подсветки
        element.classList.add(this.BASE_CLASS, config.className);

        // Бейдж
        this.addBadge(element, status);

        // Data-атрибуты
        element.dataset.clientName = clientName;
        element.dataset.status = status;
    }

    /**
     * Снимает подсветку с элемента.
     */
    clear(element: HTMLElement): void {
        // Убираем все классы priority-*
        element.classList.forEach((cls) => {
            if (cls.startsWith('priority-')) {
                element.classList.remove(cls);
            }
        });

        // Убираем бейдж
        this.removeBadge(element);

        // Убираем data-атрибуты
        delete element.dataset.clientName;
        delete element.dataset.status;
    }

    /**
     * Снимает подсветку со всех элементов на странице.
     */
    clearAll(): void {
        document.querySelectorAll(`.${this.BASE_CLASS}`).forEach((el) => {
            this.clear(el as HTMLElement);
        });

        // Убираем все бейджи, которые могли остаться
        document.querySelectorAll(`.${this.BADGE_CLASS}`).forEach((b) => b.remove());
        document.querySelectorAll(`.${this.BADGE_FIXED_CLASS}`).forEach((b) => b.remove());
    }

    // ====BADGE================================================

    private addBadge(element: HTMLElement, status: ClientStatus): void {
        const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';

        if (isTextarea) {
            this.addFixedBadge(element, status);
        } else {
            this.addInlineBadge(element, status);
        }
    }

    /**
     * Бейдж внутрь ссылки.
     */
    private addInlineBadge(element: HTMLElement, status: ClientStatus): void {
        const config = STATUS_CONFIG[status];
        const badge = document.createElement('span');

        badge.className = `${this.BADGE_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        badge.textContent = `${config.icon} ${config.fullLabel}`;

        if (this.isLightColor(status)) {
            badge.style.color = '#333';
        }

        element.appendChild(badge);
    }

    /**
     * Бейдж после textarea (нельзя вставить внутрь).
     */
    private addFixedBadge(element: HTMLElement, status: ClientStatus): void {
        const config = STATUS_CONFIG[status];

        const parent = element.parentElement;
        if (!parent) return;

        const badge = document.createElement('span');
        badge.className = `${this.BADGE_FIXED_CLASS} priority-badge-${this.getBadgeSuffix(status)}`;
        badge.textContent = `${config.icon} ${config.fullLabel}`;

        if (this.isLightColor(status)) {
            badge.style.color = '#333';
        }

        // --- ВЫРАВНИВАНИЕ ВПРАВО ---
        badge.style.display = 'block';
        badge.style.width = 'fit-content';
        badge.style.marginLeft = 'auto';
        badge.style.marginTop = '8px';
        badge.style.marginRight = '16px'; // чтобы не прилипал к самому краю

        element.insertAdjacentElement('afterend', badge);
    }

    /**
     * Удаляет бейдж, связанный с элементом.
     */
    private removeBadge(element: HTMLElement): void {
        // Бейдж внутри ссылки
        const inlineBadge = element.querySelector(`.${this.BADGE_CLASS}`);
        if (inlineBadge) inlineBadge.remove();

        // Бейдж после textarea
        const nextSibling = element.nextElementSibling;
        if (nextSibling?.classList.contains(this.BADGE_FIXED_CLASS)) {
            nextSibling.remove();
        }
    }

    // ====HELPERS==============================================

    /**
     * Возвращает суффикс для класса бейджа.
     * Для всех холодных — 'cold'.
     */
    private getBadgeSuffix(status: ClientStatus): string {
        const config = STATUS_CONFIG[status];
        // Берём часть className после "priority-"
        return config.className.replace('priority-', '');
    }

    /**
     * Светлые цвета — для них нужен тёмный текст.
     */
    private isLightColor(status: ClientStatus): boolean {
        return status === 'warm' || status === 'unclear';
    }
}