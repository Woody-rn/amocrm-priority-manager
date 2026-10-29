// ====BACKGROUND SERVICE WORKER===============================

// Обработка сообщений от других частей расширения (например, Popup)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'openHelp') {
        void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#features') });
        sendResponse({ success: true });
        return true;
    }
    return false;
});

// ====WEB NAVIGATION (SPA ROUTING)===========================

/**
 * Ловит изменения URL внутри SPA (пагинация, переходы по вкладкам)
 * и сообщает об этом content script.
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // Реагируем только на основной фрейм (не на iframe внутри страницы)
    if (details.frameId !== 0) return;

    // Проверяем, что это действительно наш домен (хотя host_permissions это и так гарантирует)
    if (!details.url.includes('amocrm.ru')) return;

    console.log('[Background] URL changed:', details.url);

    // Отправляем сообщение в content script на этой вкладке
    chrome.tabs.sendMessage(details.tabId, {
        action: 'urlChanged',
        url: details.url
    }).catch(() => {
        // Игнорируем ошибку, если content script еще не загрузился (например, при F5)
    });
});