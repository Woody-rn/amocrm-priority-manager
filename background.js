// Открытие боковой панели по клику на иконку (опционально)
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));

// Слушаем сообщения от popup и content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSidebar') {
        if (sender.tab) {
            chrome.sidePanel.open({ tabId: sender.tab.id })
                .then(() => sendResponse({ success: true }))
                .catch((error) => {
                    console.error('Ошибка открытия панели:', error);
                    sendResponse({ success: false, error: error.message });
                });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.sidePanel.open({ tabId: tabs[0].id })
                        .then(() => sendResponse({ success: true }))
                        .catch((error) => {
                            console.error('Ошибка открытия панели:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                }
            });
        }
        return true;
    }
});