// WriteSharp Content Script

const DEBUG = false;  // Set to true to enable debug logging

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp:CS] ${message}`, ...args);
    }
}

log('Content script loaded');

// Store the active element when text is selected
let activeElement = null;
let storedSelection = null;

// For tracking pending responses from message passing
let pendingResponses = {};

// Current selection data (kept in memory only)
let currentSelection = {
    text: null,
    html: null,
    editorType: null,
    timestamp: null
};

/**
 * Clears all selection state locally
 */
function clearLocalSelectionState() {
    log('Clearing local selection state');
    activeElement = null;
    storedSelection = null;
    currentSelection = {
        text: null,
        html: null,
        editorType: null,
        timestamp: null
    };
}

/**
 * Gets the HTML content of the current selection
 * @returns {string} HTML content of selection
 */
function getSelectionHtml() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return '';
    
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        container.appendChild(range.cloneContents());
    }
    
    return container.innerHTML;
}

/**
 * Analyzes the HTML content to extract formatting information
 * 
 * Note: Based on our testing, we found that we don't actually need to pass explicit 
 * formatting instructions to the LLM as it can intelligently apply formatting on its own.
 * However, we're keeping this function for:
 * 1. Backward compatibility
 * 2. Potential future use cases
 * 3. Debugging purposes
 * 
 * @param {string} html - The HTML content to analyze
 * @returns {Object} Formatting information
 */
function analyzeHtmlFormatting(html) {
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Extract formatting information
        const formatting = {
            boldElements: [],
            italicElements: [],
            listItems: [],
            bulletPoints: [],
            hasNumberedList: false,
            hasBulletedList: false,
            termDefinitions: []
        };
        
        // Find bold elements
        const boldElements = tempDiv.querySelectorAll('b, strong');
        boldElements.forEach(el => {
            formatting.boldElements.push(el.textContent.trim());
        });
        
        // Find italic elements
        const italicElements = tempDiv.querySelectorAll('i, em');
        italicElements.forEach(el => {
            formatting.italicElements.push(el.textContent.trim());
        });
        
        // Find list items and their types
        const listItems = tempDiv.querySelectorAll('li');
        listItems.forEach(el => {
            formatting.listItems.push(el.textContent.trim());
            const parentList = el.closest('ul, ol');
            if (parentList) {
                if (parentList.tagName === 'UL') {
                    formatting.hasBulletedList = true;
                } else if (parentList.tagName === 'OL') {
                    formatting.hasNumberedList = true;
                }
            }
        });
        
        // Find term-definition patterns (e.g., "Term: Definition")
        const paragraphs = tempDiv.querySelectorAll('p, div, span');
        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text.match(/^([^:]+):\s(.+)$/)) {
                const matches = text.match(/^([^:]+):\s(.+)$/);
                formatting.termDefinitions.push({
                    term: matches[1].trim(),
                    definition: matches[2].trim()
                });
            }
        });
        
        // Check for Unicode bullet points in the text content
        const allText = tempDiv.textContent;
        const bulletMatches = allText.match(/•\s*([^\n•]+)/g);
        if (bulletMatches) {
            bulletMatches.forEach(match => {
                const bulletText = match.replace(/^•\s*/, '').trim();
                formatting.bulletPoints.push(bulletText);
                formatting.hasBulletedList = true;
            });
        }
        
        return formatting;
    } catch (e) {
        console.error('Error analyzing HTML formatting:', e);
        return {
            boldElements: [],
            italicElements: [],
            listItems: [],
            bulletPoints: [],
            hasNumberedList: false,
            hasBulletedList: false,
            termDefinitions: []
        };
    }
}

/**
 * Handles text selection events on the page.
 * When text is selected, it stores the selection in memory.
 */
function handleTextSelection() {
    try {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
    
    if (selectedText) {
            // Debug logging for selection
            console.log("=== CAPTURE STAGE ===");
            console.log("Selection HTML:", getSelectionHtml());
            console.log("Selection Plain Text:", selection.toString());
            // Check for Unicode bullets
            if (selectedText.includes('•')) {
                console.log("CONTAINS BULLET POINTS:", selectedText.match(/•[^\n]*/g));
            }
            
            // Clear local selection variables
            clearLocalSelectionState();
            
            // Store the active element when text is selected
            activeElement = document.activeElement;
            storedSelection = saveSelection();
            
            // Get the HTML content of the selection
            const htmlContent = getSelectionHtml();
            
            // Analyze the HTML for formatting
            const formattingInfo = analyzeHtmlFormatting(htmlContent);
            console.log("Formatting analysis:", formattingInfo);
            
            // Store selection data in memory only
            const editorType = detectEditorType();
            currentSelection = {
                text: selectedText,
                html: htmlContent,
                editorType: editorType,
                url: window.location.href,
                timestamp: Date.now(),
                formatting: formattingInfo
            };
            
            // Debug: Log what's being stored
            console.log("Storage: Editor type:", editorType);
            console.log("Storage: HTML stored:", currentSelection.html);
            console.log("Storage: Formatting info:", currentSelection.formatting);
            
            log('Selection stored in memory:', selectedText.substring(0, 20) + '...');
            
            // If this is a Zendesk page, notify the Zendesk handler
            if (editorType === 'zendesk') {
                chrome.runtime.sendMessage({
                    action: 'zendeskHandleSelection',
                    selection: storedSelection,
                    activeElement: activeElement
                });
            }
        }
    } catch (e) {
        log('Error in handleTextSelection:', e);
    }
}

/**
 * Saves the current selection state
 * @returns {Object} Selection information
 */
function saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        return {
            range: selection.getRangeAt(0),
            parentElement: selection.anchorNode?.parentElement || null
        };
    }
    return null;
}

/**
 * Initializes the content script by adding event listeners.
 */
function initializeContentScript() {
    log('Initializing content script');
    
    // Add event listeners for text selection
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleTextSelection();
        }
    });
}

// Check if the DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

/**
 * Detects the type of editor based on URL or DOM structure
 * @returns {string} Editor type
 */
function detectEditorType() {
    try {
        const url = window.location.href;
        
        if (url.includes('zendesk.com') || url.includes('zendesk.')) {
            return 'zendesk';
        } else if (url.includes('gmail.com')) {
            return 'gmail';
        } else if (document.querySelector('[contenteditable="true"]')) {
            return 'contenteditable';
        } else if (document.querySelector('textarea')) {
            return 'textarea';
        }
        
        return 'unknown';
    } catch (e) {
        log('Error detecting editor type:', e);
        return 'unknown';
    }
}

/**
 * Inserts text into a textarea or input
 * @param {Element} element - The textarea or input element
 * @param {string} text - The text to insert
 * @returns {boolean} Success status
 */
function insertIntoTextArea(element, text) {
    try {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const value = element.value;
        
        element.value = value.substring(0, start) + text + value.substring(end);
        element.selectionStart = element.selectionEnd = start + text.length;
        element.focus();
        return true;
    } catch (e) {
        log('Error inserting into textarea:', e);
        return false;
    }
}

/**
 * Tries to insert text using standard selection methods
 * @param {string} text - The text to insert
 * @returns {boolean} Success status
 */
function insertUsingSelection(text) {
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        try {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            return true;
        } catch (e) {
            log('Error inserting using selection:', e);
        }
    }
    
    return false;
}

/**
 * Inserts HTML into a contenteditable element
 * @param {Element} element - The contenteditable element
 * @param {string} html - The HTML to insert
 * @returns {boolean} Success status
 */
function insertHtmlIntoContentEditable(element, html) {
    try {
        // Focus the element to ensure it's active
        element.focus();
        
        // Use execCommand for better cross-browser compatibility
        document.execCommand('insertHTML', false, html);
        return true;
    } catch (e) {
        log('Error inserting HTML into contenteditable:', e);
        
        // Fallback method if execCommand fails
        try {
            // Create a range and insert the HTML
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false); // Collapse to end
            
            // Create a fragment to insert
            const fragment = range.createContextualFragment(html);
            range.insertNode(fragment);
            
            // Create a new range for cursor position
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            return true;
        } catch (fallbackError) {
            log('Fallback insertion also failed:', fallbackError);
            return false;
        }
    }
}

/**
 * Gmail-specific HTML insertion
 * @param {Element} element - The Gmail editor element
 * @param {string} html - The HTML to insert
 * @returns {boolean} Success status
 */
function insertHtmlIntoGmail(element, html) {
    try {
        // Ensure we're targeting the correct element in Gmail's structure
        let targetElement = element;
        
        // Gmail's editor can have a complex structure - navigate to the actual editable div
        // This might need adjustment based on Gmail's current DOM structure
        if (element.closest('[role="textbox"]')) {
            targetElement = element.closest('[role="textbox"]');
        } else if (element.querySelector('[contenteditable="true"]')) {
            targetElement = element.querySelector('[contenteditable="true"]');
        }
        
        // Gmail specific cleanup - remove any potentially problematic attributes
        const cleanedHtml = html
            // Remove any class attributes (Gmail will add its own)
            .replace(/ class="[^"]*"/g, '')
            // Make sure links open in new tabs for security
            .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
        
        // Focus and insert
        targetElement.focus();
        document.execCommand('insertHTML', false, cleanedHtml);
        
        return true;
    } catch (e) {
        log('Error inserting into Gmail:', e);
        return false;
    }
}

// Additional listeners for direct communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Message received in content script:', request);
    
    // Debug logging for message handling
    if (request.action === 'getCurrentSelection') {
        console.log("=== CONTENT SCRIPT SELECTION REQUEST ===");
        console.log("Current selection data:", currentSelection);
    }
    
    // Handle ping to check if content script is loaded
    if (request.action === 'ping') {
        log('Ping received, responding to confirm content script is active');
        sendResponse({ status: 'content_script_active' });
        return true;
    }
    
    // Handle request for current selection from popup
    if (request.action === 'getCurrentSelection') {
        log('Returning current selection to popup');
        sendResponse(currentSelection);
        return true;
    }
    
    // Handle clear selection request
    if (request.action === 'clearSelection') {
        log('Clearing selection state');
        clearLocalSelectionState();
        sendResponse({ status: 'Selection cleared' });
        return false;
    }
    
    if (request.action === 'applyRephrasedText') {
        console.log("=== INSERTION STAGE ===");
        console.log("Text to insert:", request.text);
        console.log("HTML to insert:", request.html);
        console.log("Editor type:", detectEditorType());
        console.log("Active element:", activeElement ? activeElement.tagName : 'none');
        console.log("Stored selection:", storedSelection ? 'exists' : 'none');
        
        // Handle the message asynchronously
        (async function() {
            const text = request.text;
            const html = request.html || text; // Use HTML if provided, otherwise use plain text
            let success = false;
            const editorType = detectEditorType();
            
            log('Detected editor type:', editorType);
            log('Active element:', activeElement);
            log('Stored selection:', storedSelection);
            
            // Special handling for Zendesk
            if (editorType === 'zendesk') {
                log('Zendesk editor detected, but using copy-to-clipboard approach instead of direct insertion');
                sendResponse({ 
                    success: false, 
                    error: 'For Zendesk, please use the Copy to Clipboard button and paste manually',
                    showCopyButton: true
                });
                return;
            }
            
            // Gmail specific handling
            if (editorType === 'gmail') {
                log('Gmail editor detected, attempting specialized HTML insertion');
                if (activeElement) {
                    success = insertHtmlIntoGmail(activeElement, html);
                    if (success) {
                        log('HTML successfully inserted into Gmail editor');
                        clearLocalSelectionState();
                        sendResponse({ status: 'Rephrased text applied to Gmail' });
                        return;
                    }
                }
            }
            
            // Handle other editor types
            if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                // For plain textareas/inputs, we can only use plain text
                success = insertIntoTextArea(activeElement, text);
            } else if (activeElement && activeElement.isContentEditable) {
                // For contenteditable elements, try HTML insertion
                success = insertHtmlIntoContentEditable(activeElement, html);
            } else if (storedSelection) {
                try {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(storedSelection.range);
                    
                    // Try to determine if we can use HTML here
                    const parentIsContentEditable = storedSelection.range.commonAncestorContainer.parentElement?.isContentEditable || 
                        storedSelection.range.commonAncestorContainer.isContentEditable;
                    
                    if (parentIsContentEditable) {
                        // Can use HTML
                        document.execCommand('insertHTML', false, html);
                    } else {
                        // Use plain text as fallback
                        storedSelection.range.deleteContents();
                        storedSelection.range.insertNode(document.createTextNode(text));
                    }
                    success = true;
                } catch (e) {
                    log('Error using stored selection:', e);
                }
            }
            
            // Fallback to standard methods if specific methods failed
            if (!success) {
                success = insertUsingSelection(text);
            }
            
            if (success) {
            log('Rephrased text applied');
                
                // Clear selection state after successful insertion
                clearLocalSelectionState();
                
            sendResponse({ status: 'Rephrased text applied' });
        } else {
                console.warn('[WriteSharp] Failed to apply rephrased text');
                sendResponse({ error: 'Failed to apply rephrased text. Please try selecting the text again.' });
            }
        })();
        
        return true; // Keep the message channel open for the async response
    } else if (request.action === 'zendeskInsertResult') {
        // Handle results from zendesk-handler.js
        log('Received result from Zendesk handler:', request);
        if (request.messageId && pendingResponses[request.messageId]) {
            const callback = pendingResponses[request.messageId];
            callback(request.result);
            delete pendingResponses[request.messageId];
        }
        return false;
    } else {
        log('Unrecognized action:', request.action);
    }
    
    return true;
});
