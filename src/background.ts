// ====BACKGROUND SERVICE WORKER===============================

/**
 * Фоновый скрипт расширения.
 *
 * Отвечает за:
 * - Открытие боковой панели (по запросу от content/popup)
 * - Настройку поведения иконки расширения
 */

// ====SETUP==================================================

// Отключаем автоматическое открытие панели при клике на иконку.
// Иконка должна открывать popup (быстрые действия), а не панель.
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error('[Background] Ошибка настройки sidePanel:', error));

// ====MESSAGES===============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSidebar') {
        void handleOpenSidebar(sender)
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
                console.error('[Background] Ошибка открытия sidebar:', error);
                sendResponse({ success: false, error: String(error) });
            });

        return true; // Возвращаем true для асинхронного ответа
    }

    if (message.action === 'openHelp') {
        void chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
        sendResponse({ success: true });
        return true;
    }

    // Если действие неизвестно — не отвечаем, пусть обрабатывают другие
    return false;
});

// ====HANDLERS===============================================

/**
 * Открывает боковую панель в контексте текущей вкладки.
 */
async function handleOpenSidebar(sender: chrome.runtime.MessageSender): Promise<void> {
    // Если сообщение пришло из content script (есть sender.tab)
    if (sender.tab?.id) {
        await chrome.sidePanel.open({ tabId: sender.tab.id });
        return;
    }

    // Если сообщение пришло из popup (нет sender.tab)
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
        await chrome.sidePanel.open({ tabId: activeTab.id });
    } else {
        throw new Error('Активная вкладка не найдена');
    }
}