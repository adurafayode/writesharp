console.log('[TextRephraser] Content script loaded');

function handleTextSelection() {
    console.log('[TextRephraser] Text selection event triggered in content.js');
    const selectedText = window.getSelection().toString().trim();
    console.log('[TextRephraser] Selected text:', selectedText);
    if (selectedText) {
        chrome.storage.local.set({selectedText: selectedText}, function() {
            console.log('Selected text stored locally.');
            chrome.runtime.sendMessage({action: 'showRephraseButton', text: selectedText}, response => {
                console.log('[TextRephraser] Response from background:', response);
            });
        });
    }
}

function initializeContentScript() {
    console.log('[TextRephraser] Initializing content script');
    if (window.location.hostname.includes('mail.google.com')) {
        console.log('[TextRephraser] Gmail detected');
        // Add any additional Gmail-specific logic here
    } else if (window.location.hostname.includes('zendesk.com')) {
        console.log('[TextRephraser] Zendesk detected');
        // Add any additional Zendesk-specific logic here
    }

    document.addEventListener('mouseup', handleTextSelection);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[TextRephraser] Message received in content script:', request);
    if (request.action === 'applyRephrasedText') {
        console.log('[TextRephraser] Applying rephrased text:', request.text);
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(request.text));
            console.log('[TextRephraser] Rephrased text applied');
            sendResponse({ status: 'Rephrased text applied' });
        } else {
            console.log('[TextRephraser] No selection range found');
            sendResponse({ error: 'No selection range found' });
        }
    }
    return true; // Keeps the message channel open for asynchronous responses
});