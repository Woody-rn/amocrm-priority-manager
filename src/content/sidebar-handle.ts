import {SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../shared/constants';

// ====SIDEBAR HANDLE=========================================

/**
 * Плавающая ручка "Панель" справа.
 * При клике открывает/закрывает iframe с Sidebar поверх страницы.
 * Поддерживает изменение ширины панели.
 */
export class SidebarHandle {
    private element: HTMLElement | null = null;
    private iframeContainer: HTMLElement | null = null;
    private isDragging = false;
    private startY = 0;
    private currentY = 0;
    private isOpen = false;

    constructor(
        private getSavedPosition: () => Promise<number>,
        private savePosition: (top: number) => Promise<void>,
        private getSavedWidth: () => Promise<number>,
        private saveWidth: (width: number) => Promise<void>
    ) {}

    async create(): Promise<void> {
        if (document.getElementById('amocrm-handle')) return;

        const savedPosition = await this.getSavedPosition();
        const top = savedPosition || 200;
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
            if (!this.isDragging) void this.toggleSidebar();
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
            newY = Math.max(10, Math.min(newY, maxY));

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

    // ====TOGGLE===============================================

    private async toggleSidebar(): Promise<void> {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            await this.openSidebar();
        }
    }

    private async openSidebar(): Promise<void> {
        if (this.iframeContainer) return;

        this.isOpen = true;
        const savedWidth = await this.getSavedWidth();

        // 1. Создаем контейнер
        const container = document.createElement('div');
        container.id = 'amocrm-sidebar-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            right: '0',
            width: `${savedWidth}px`,
            height: '100vh',
            zIndex: '2147483647',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
            transition: 'transform 0.3s ease',
            transform: 'translateX(100%)',
            background: 'var(--bg-body, #f5f5f5)',
            borderLeft: '1px solid var(--border-color, #ddd)'
        });

        // 2. Создаем РЕСАЙЗЕР (полоска слева)
        const resizeHandle = document.createElement('div');
        Object.assign(resizeHandle.style, {
            position: 'absolute',
            top: '0',
            left: '-4px',
            width: '8px',
            height: '100%',
            cursor: 'ew-resize',
            zIndex: '10'
        });
        resizeHandle.addEventListener('mousedown', (e) => this.startResize(e, container));

        // 3. Создаем iframe
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
        });

        // 4. Кнопка закрытия (стили через CSS-класс)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => this.closeSidebar());

        container.appendChild(resizeHandle);
        container.appendChild(closeBtn);
        container.appendChild(iframe);
        document.body.appendChild(container);
        this.iframeContainer = container;

        // 5. Анимация появления
        requestAnimationFrame(() => {
            container.style.transform = 'translateX(0)';
        });
    }

    // ====RESIZE LOGIC=========================================

    private startResize(e: MouseEvent, container: HTMLElement): void {
        e.preventDefault();

        const startX = e.clientX;
        const startWidth = container.getBoundingClientRect().width;

        const onResize = (ev: MouseEvent) => {
            // Считаем новую ширину: если мышь движется влево, ширина растет
            const deltaX = startX - ev.clientX;
            let newWidth = startWidth + deltaX;

            // Ограничиваем минимальной и максимальной шириной
            newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(newWidth, SIDEBAR_MAX_WIDTH));

            container.style.width = `${newWidth}px`;
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', onResize);
            document.removeEventListener('mouseup', stopResize);

            // Сохраняем итоговую ширину
            const finalWidth = container.getBoundingClientRect().width;
            void this.saveWidth(Math.round(finalWidth));
        };

        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', stopResize);
    }

    private closeSidebar(): void {
        if (!this.iframeContainer) return;

        this.isOpen = false;
        const container = this.iframeContainer;

        container.style.transform = 'translateX(100%)';

        setTimeout(() => {
            container.remove();
            this.iframeContainer = null;
        }, 300);
    }
}