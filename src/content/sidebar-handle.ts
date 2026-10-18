import { HANDLE_DEFAULT_POSITION, HANDLE_MIN_TOP } from '../shared/constants';

// ====SIDEBAR HANDLE=========================================

/**
 * Плавающая ручка "Панель" справа.
 *
 * Отвечает за:
 * - Создание DOM
 * - Drag & drop
 * - Вызов callback при клике
 *
 * Не знает про:
 * - chrome.storage (через callback'и)
 * - sidebar (через callback)
 */
export class SidebarHandle {
    private element: HTMLElement | null = null;
    private isDragging = false;
    private startY = 0;
    private currentY = 0;

    constructor(
        private onOpenSidebar: () => void,
        private getSavedPosition: () => Promise<number>,
        private savePosition: (top: number) => Promise<void>
    ) {}

    async create(): Promise<void> {
        if (document.getElementById('amocrm-handle')) return;

        const savedPosition = await this.getSavedPosition();
        const top = savedPosition || HANDLE_DEFAULT_POSITION;
        this.currentY = top;

        const handle = this.buildElement(top);
        document.body.appendChild(handle);

        this.element = handle;
    }

    // ====BUILD================================================

    private buildElement(top: number): HTMLElement {
        const handle = document.createElement('div');
        handle.id = 'amocrm-handle';
        handle.className = 'sidebar-handle';
        handle.style.top = `${top}px`;

        handle.innerHTML = `
            <div class="sidebar-handle__icon">📊</div>
            <div class="sidebar-handle__text">Панель</div>
        `;

        handle.addEventListener('mousedown', (e) => this.startDrag(e));
        handle.addEventListener('click', () => {
            if (!this.isDragging) this.onOpenSidebar();
        });

        return handle;
    }

    // ====DRAG=================================================

    private startDrag(e: MouseEvent): void {
        if (!this.element) return;

        this.isDragging = false;
        this.startY = e.clientY;
        this.currentY = this.element.getBoundingClientRect().top;

        const onDrag = (ev: MouseEvent) => {
            if (!this.element) return;
            this.isDragging = true;

            const deltaY = ev.clientY - this.startY;
            let newY = this.currentY + deltaY;

            const maxY = window.innerHeight - this.element.offsetHeight - 10;
            newY = Math.max(HANDLE_MIN_TOP, Math.min(newY, maxY));

            this.element.style.top = `${newY}px`;
            void this.savePosition(newY);
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            setTimeout(() => {
                this.isDragging = false;
            }, 10);
        };

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }
}