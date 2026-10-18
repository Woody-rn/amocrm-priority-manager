// ====URL WATCHER============================================

/**
 * Следит за изменениями URL (SPA-переходы в amoCRM).
 *
 * При изменении URL вызывает callback с новым URL.
 * Не знает про DOM, подсветку, storage.
 */
export class UrlWatcher {
    private lastUrl = location.href;
    private observer: MutationObserver | null = null;

    constructor(private onChange: (url: string) => void) {}

    /**
     * Запускает наблюдение за URL.
     */
    start(): void {
        this.observer = new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== this.lastUrl) {
                this.lastUrl = currentUrl;
                this.onChange(currentUrl);
            }
        });

        this.observer.observe(document, {
            subtree: true,
            childList: true
        });
    }

    /**
     * Останавливает наблюдение.
     */
    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
    }
}