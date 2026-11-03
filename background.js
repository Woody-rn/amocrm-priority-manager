import { DiagnosticsService } from './shared/diagnostics';

const diag = new DiagnosticsService('background');

// ====MESSAGES===============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'openHelp') {
        void chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#features') });
        sendResponse({ success: true });
        return true;
    }
    return false;
});

// ====WEB NAVIGATION=========================================

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;
    if (!details.url.includes('amocrm.ru')) return;

    diag.log('URL changed', { url: details.url, tabId: details.tabId });

    chrome.tabs.sendMessage(details.tabId, {
        action: 'urlChanged',
        url: details.url
    }).catch((e) => {
        diag.warn('Failed to send urlChanged (content script not ready?)', String(e));
    });
});