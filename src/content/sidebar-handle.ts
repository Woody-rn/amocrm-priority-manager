// ====SIDEBAR HANDLE=========================================

/**
 * Плавающая ручка "Панель" справа.
 * При клике открывает/закрывает iframe с Sidebar поверх страницы.
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
        private savePosition: (top: number) => Promise<void>
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
            if (!this.isDragging) this.toggleSidebar();
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

    private toggleSidebar(): void {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    private openSidebar(): void {
        if (this.iframeContainer) return;

        this.isOpen = true;

        // 1. Создаем контейнер
        const container = document.createElement('div');
        container.id = 'amocrm-sidebar-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            right: '0',
            width: '400px',
            height: '100vh',
            zIndex: '2147483647',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
            transition: 'transform 0.3s ease',
            transform: 'translateX(100%)',
            background: 'var(--bg-body, #f5f5f5)',
            borderLeft: '1px solid var(--border-color, #ddd)'
        });

        // 2. Создаем iframe
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
        });

        // 3. Кнопка закрытия (стили через CSS-класс)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => this.closeSidebar());

        container.appendChild(closeBtn);
        container.appendChild(iframe);
        document.body.appendChild(container);
        this.iframeContainer = container;

        // 4. Анимация появления
        requestAnimationFrame(() => {
            container.style.transform = 'translateX(0)';
        });
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