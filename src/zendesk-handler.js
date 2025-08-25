// WriteSharp Zendesk Handler Script v2.0
// Handles all Zendesk-specific editor interactions

const ZENDESK_DEBUG = false; // Set to true to enable debug logging
const HANDLER_VERSION = '2.0.0'; // Version number to track script changes

function log(message, ...args) {
    if (ZENDESK_DEBUG) {
        console.log(`[WriteSharp:ZendeskHandler] ${message}`, ...args);
    }
}

function logError(message, error) {
    console.error(`[WriteSharp:ZendeskHandler] ${message}`, error);
}

log('Zendesk handler v2.0 loading');

// Keep track of operation state to prevent duplicate processing
const pendingOperations = new Map(); // operationId -> timestamp

/**
 * Check if current page is a Zendesk context
 * @returns {boolean} True if this appears to be a Zendesk page
 */
function isZendeskContext() {
    const url = window.location.href;
    return url.includes('zendesk.com') || url.includes('zendesk.');
}

// Only proceed with initialization if we're in a Zendesk context
if (!isZendeskContext()) {
    log('Not in a Zendesk context, handler will be inactive');
} else {
    log('Zendesk context detected, initializing handler');
}

// Generate a unique operation ID with timestamp and random component
function generateOperationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `writesharp_${timestamp}_${random}`;
}

// Insert text into Zendesk using the helper script
async function insertIntoZendeskEditor(text, html) {
    // Confirm we're in Zendesk before proceeding
    if (!isZendeskContext()) {
        log('Skipping insertion - not in a Zendesk context');
        return { 
            success: false, 
            error: 'Not in a Zendesk context' 
        };
    }
    
    try {
        log('Starting text insertion process');
        
        // Generate a unique ID for this operation
        const operationId = generateOperationId();
        log('Generated operation ID:', operationId);
        
        // Add to pending operations
        pendingOperations.set(operationId, Date.now());
        
        // Make sure the helper script is loaded before proceeding
        await ensureHelperScriptLoaded();
        
        // Create a hidden div to hold our data
        log('Creating data div element');
        const dataDiv = document.createElement('div');
        dataDiv.id = operationId;
        dataDiv.style.display = 'none';
        dataDiv.setAttribute('data-writesharp-operation', 'insert-text');
        dataDiv.setAttribute('data-text', text);
        if (html) {
            dataDiv.setAttribute('data-html', html);
        }
        dataDiv.setAttribute('data-operation', 'insert-text');
        dataDiv.setAttribute('data-source', 'zendesk-handler-v2');
        
        // Append to body
        document.body.appendChild(dataDiv);
        log('Data div added to document');
        
        // Wait for the result using Promise
        const result = await waitForOperationResult(operationId, dataDiv);
        
        // Clean up
        pendingOperations.delete(operationId);
        
        return result;
    } catch (error) {
        logError('Error in insertIntoZendeskEditor', error);
        return { 
            success: false, 
            error: error.message || 'Error processing Zendesk insertion'
        };
    }
}

// Wait for the operation result
async function waitForOperationResult(operationId, dataDiv) {
    log('Waiting for operation result:', operationId);
    
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        let isResolved = false;
        
        // Create observer to watch for attribute changes on our div
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'data-result' && 
                    !isResolved) {
                    
                    const result = dataDiv.getAttribute('data-result');
                    log('Received operation result:', result);
                    
                    if (result === 'success') {
                        cleanupAndResolve({ success: true });
                    } else if (result === 'error') {
                        const errorMessage = dataDiv.getAttribute('data-error') || 'Unknown error';
                        cleanupAndResolve({ 
                            success: false, 
                            error: errorMessage
                        });
                    } else if (result === 'duplicate') {
                        cleanupAndResolve({ 
                            success: false, 
                            error: 'Duplicate operation detected'
                        });
                    }
                }
            }
        });
        
        // Setup observation for result attribute changes
        observer.observe(dataDiv, { attributes: true });
        
        // Set timeout in case we don't get a response
        timeoutId = setTimeout(() => {
            if (!isResolved) {
                log('Operation timed out:', operationId);
                cleanupAndResolve({ 
                    success: false, 
                    error: 'Operation timed out'
                });
            }
        }, 5000); // 5 second timeout
        
        // Helper function to clean up and resolve
        function cleanupAndResolve(result) {
            if (isResolved) return;
            isResolved = true;
            
            // Clean up
            clearTimeout(timeoutId);
            observer.disconnect();
            
            // Remove the div after a short delay
            setTimeout(() => {
                if (document.body.contains(dataDiv)) {
                    dataDiv.remove();
                }
            }, 100);
            
            resolve(result);
        }
    });
}

// Make sure the helper script is loaded
async function ensureHelperScriptLoaded() {
    // Don't attempt to load helper script in non-Zendesk contexts
    if (!isZendeskContext()) {
        throw new Error('Cannot load helper script in non-Zendesk context');
    }
    
    log('Ensuring helper script is loaded');
    
    // Check if our helper script is already loaded by looking for flag
    if (window._writeSharpHelperLoaded) {
        log('Helper script already loaded with ID:', window._writeSharpHelperLoaded);
        return;
    }
    
    // Load the helper script
    log('Loading helper script');
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/zendesk-helper.js');
        
        script.onload = () => {
            log('Helper script loaded successfully');
            resolve();
        };
        
        script.onerror = (error) => {
            logError('Failed to load helper script', error);
            reject(new Error('Failed to load helper script'));
        };
        
        // Add to document
        (document.head || document.documentElement).appendChild(script);
    });
}

/**
 * Main entry point for handling text insertion into Zendesk editors
 */
async function handleZendeskInsertion(text, html, messageId) {
    // Don't proceed if not in a Zendesk context
    if (!isZendeskContext()) {
        log('Rejecting insertion request - not in a Zendesk context');
        return {
            success: false,
            status: false,
            error: 'Not in a Zendesk context'
        };
    }
    
    log('Handling Zendesk insertion request');
    
    try {
        const result = await insertIntoZendeskEditor(text, html);
        return {
            ...result,
            messageId: messageId
        };
    } catch (error) {
        logError('Error in handleZendeskInsertion', error);
        return {
            success: false,
            status: false,
            error: error.message || 'Unknown error in Zendesk insertion',
            messageId: messageId
        };
    }
}

// Listen for messages from content script and background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Received message:', request?.action || 'unknown');
    
    // Handle selection notification from content script
    if (request?.action === 'zendeskHandleSelection') {
        log('Received selection notification');
        // Just acknowledge receipt - no further action needed
        sendResponse({ status: 'selection_received' });
        return false; // No async response needed
    }
    
    // Handle text insertion request
    if (request?.action === 'zendeskInsertText' || request?.action === 'applyRephrasedText') {
        // Check if we're in Zendesk before proceeding
        if (!isZendeskContext()) {
            log('Ignoring insertion request - not in a Zendesk context');
            sendResponse({ 
                success: false, 
                status: false,
                error: 'Not in a Zendesk context' 
            });
            return false;
        }
        
        log('Processing text insertion request');
        
        // Extract data from request
        const { text, html, messageId } = request;
        
        // Ensure we have text to insert
        if (!text) {
            log('No text provided for insertion');
            sendResponse({ success: false, error: 'No text provided for insertion' });
            return false;
        }
        
        // Process the insertion
        handleZendeskInsertion(text, html, messageId)
            .then(result => {
                log('Sending response:', result);
                sendResponse(result);
                
                // Also send message to background script for async handling if needed
                if (messageId) {
                    chrome.runtime.sendMessage({
                        action: 'zendeskInsertResult',
                        messageId: messageId,
                        result: result
                    }).catch(e => {
                        log('Error sending result to background:', e);
                    });
                }
            })
            .catch(error => {
                logError('Error handling insertion:', error);
                const errorResult = { 
                    success: false, 
                    error: error.message || 'Unknown error occurred'
                };
                
                sendResponse(errorResult);
                
                // Also send error via message for async handling if needed
                if (messageId) {
                    chrome.runtime.sendMessage({
                        action: 'zendeskInsertResult',
                        messageId: messageId,
                        result: errorResult
                    }).catch(e => {
                        log('Error sending error result to background:', e);
                    });
                }
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
    
    // No action for other message types
    return false;
});

// Initialize handler
log('Zendesk handler v2.0 initialized'); 