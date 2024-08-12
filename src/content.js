// WriteSharp Content Script

const DEBUG = false;  // Set to true to enable debug logging

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp] ${message}`, ...args);
    }
}

log('Content script loaded');

/**
 * Handles text selection events on the page.
 * When text is selected, it stores the selection locally.
 */
function handleTextSelection() {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        chrome.storage.local.set({selectedText: selectedText}, function() {
            log('Selected text stored locally');
        });
    }
}

/**
 * Initializes the content script by adding event listeners.
 */
function initializeContentScript() {
    log('Initializing content script');
    document.addEventListener('mouseup', handleTextSelection);
}

// Check if the DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

/**
 * Listens for messages from the background script.
 * Handles the 'applyRephrasedText' action to replace selected text with rephrased text.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Message received in content script:', request);
    
    if (request.action === 'applyRephrasedText') {
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(request.text));
            log('Rephrased text applied');
            sendResponse({ status: 'Rephrased text applied' });
        } else {
            console.warn('[WriteSharp] No selection range found');
            sendResponse({ error: 'No selection range found' });
        }
    } else {
        console.warn('[WriteSharp] Unrecognized action:', request.action);
    }
    
    return true;
});
