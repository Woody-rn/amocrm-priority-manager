import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../shared/constants';

// ====SIDEBAR HANDLE=========================================

/**
 * Плавающая ручка "Панель" справа.
 * При клике открывает/закрывает iframe с Sidebar поверх страницы.
 * Поддерживает изменение ширины панели.
 */

export class SidebarHandle {
    private container: HTMLElement | null = null;
    private iframeContainer: HTMLElement | null = null;
    private isDragging = false;
    private startY = 0;
    private currentY = 0;

    constructor(
        private getSavedPosition: () => Promise<number>,
        private savePosition: (top: number) => Promise<void>,
        private getSavedWidth: () => Promise<number>,
        private saveWidth: (width: number) => Promise<void>,
        private onAiClick: () => void
    ) {}

    async create(): Promise<void> {
        if (document.getElementById('amo-tools-handle')) return;

        const savedPosition = await this.getSavedPosition();
        const top = savedPosition || 200;
        this.currentY = top;

        this.container = this.buildElement(top);
        document.body.appendChild(this.container);
    }

    private buildElement(top: number): HTMLElement {
        const container = document.createElement('div');
        container.id = 'amo-tools-handle';
        container.className = 'amo-tools-handle';
        container.style.top = `${top}px`;

        // Кнопка Панель (с текстом)
        const sidebarBtn = document.createElement('div');
        sidebarBtn.className = 'amo-tools-btn amo-tools-btn--sidebar';
        sidebarBtn.innerHTML = `
            <span>📊</span>
            <span class="amo-tools-btn__text">Панель</span>
        `;
        sidebarBtn.title = 'Открыть панель';
        sidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isDragging) void this.toggleSidebar();
        });

        // Кнопка ИИ (только иконка)
        const aiBtn = document.createElement('div');
        aiBtn.className = 'amo-tools-btn amo-tools-btn--ai';
        aiBtn.innerHTML = `🤖`;
        aiBtn.title = 'ИИ-Анализ';
        aiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isDragging) this.onAiClick();
        });

        container.appendChild(sidebarBtn);
        container.appendChild(aiBtn);

        // Drag-and-drop для всего контейнера
        container.addEventListener('mousedown', (e) => this.startDrag(e, container));

        return container;
    }

    private startDrag(e: MouseEvent, container: HTMLElement): void {
        this.isDragging = false;
        this.startY = e.clientY;
        this.currentY = container.getBoundingClientRect().top;

        const onDrag = (ev: MouseEvent) => {
            this.isDragging = true;
            const deltaY = ev.clientY - this.startY;
            let newY = this.currentY + deltaY;

            const maxY = window.innerHeight - container.offsetHeight - 10;
            newY = Math.max(10, Math.min(newY, maxY));

            container.style.top = `${newY}px`;
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

    // ====SIDEBAR IFRAME=======================================

    private async toggleSidebar(): Promise<void> {
        if (this.iframeContainer) {
            this.closeSidebar();
        } else {
            await this.openSidebar();
        }
    }

    private async openSidebar(): Promise<void> {
        if (this.iframeContainer) return;

        const savedWidth = await this.getSavedWidth();

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
        resizeHandle.addEventListener('pointerdown', (e) => this.startResize(e, container));

        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => this.closeSidebar());

        container.appendChild(resizeHandle);
        container.appendChild(closeBtn);
        container.appendChild(iframe);
        document.body.appendChild(container);
        this.iframeContainer = container;

        requestAnimationFrame(() => {
            container.style.transform = 'translateX(0)';
        });
    }

    private startResize(e: PointerEvent, container: HTMLElement): void {
        e.preventDefault();

        const startX = e.clientX;
        const startWidth = container.getBoundingClientRect().width;
        let isResizing = true;

        const handle = e.target as HTMLElement;
        handle.setPointerCapture(e.pointerId);

        const onResize = (ev: PointerEvent) => {
            if (!isResizing) return;

            const deltaX = startX - ev.clientX;
            let newWidth = startWidth + deltaX;

            newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(newWidth, SIDEBAR_MAX_WIDTH));

            container.style.width = `${newWidth}px`;
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;

            try {
                handle.releasePointerCapture(e.pointerId);
            } catch {
                // ignore
            }

            document.removeEventListener('pointermove', onResize);
            document.removeEventListener('pointerup', stopResize);
            document.removeEventListener('pointercancel', stopResize);

            const finalWidth = container.getBoundingClientRect().width;
            void this.saveWidth(Math.round(finalWidth));
        };

        document.addEventListener('pointermove', onResize);
        document.addEventListener('pointerup', stopResize);
        document.addEventListener('pointercancel', stopResize);
    }

    private closeSidebar(): void {
        if (!this.iframeContainer) return;

        const container = this.iframeContainer;

        container.style.transform = 'translateX(100%)';

        setTimeout(() => {
            container.remove();
            this.iframeContainer = null;
        }, 300);
    }
}