// ====URL WATCHER============================================

/**
 * Следит за изменениями URL (SPA-переходы в amoCRM).
 * Перехватывает pushState, replaceState и popstate.
 */
export class UrlWatcher {
    private lastUrl = location.href;
    private originalPushState: typeof history.pushState;
    private originalReplaceState: typeof history.replaceState;

    constructor(private onChange: (url: string) => void) {
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;
    }

    start(): void {
        const handleUrlChange = () => {
            const currentUrl = location.href;
            if (currentUrl !== this.lastUrl) {
                this.lastUrl = currentUrl;
                this.onChange(currentUrl);
            }
        };

        history.pushState = (...args) => {
            this.originalPushState.apply(history, args);
            handleUrlChange();
        };

        history.replaceState = (...args) => {
            this.originalReplaceState.apply(history, args);
            handleUrlChange();
        };

        window.addEventListener('popstate', handleUrlChange);
    }

    stop(): void {
        history.pushState = this.originalPushState;
        history.replaceState = this.originalReplaceState;
        window.removeEventListener('popstate', () => {});
    }
}