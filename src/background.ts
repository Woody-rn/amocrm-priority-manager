// ====BACKGROUND SERVICE WORKER===============================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'openHelp') {
        void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#features') });
        sendResponse({ success: true });
        return true;
    }
    return false;
});