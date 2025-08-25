/**
 * WriteSharp Zendesk Helper Script v2.0
 * This script runs in the page context and handles text insertion into CKEditor
 */

(function() {
    // Version number to track script changes and force-reset window variables
    const SCRIPT_VERSION = '2.0.0';
    
    // Track which operations are in progress
    const activeOperations = new Set();
    
    // Track the last timestamp when an operation was received
    let lastOperationTimestamp = 0;
    
    // Force a minimum delay between operations (milliseconds)
    const MIN_OPERATION_DELAY = 300;
    
    // Track already completed operation IDs to prevent double-processing
    const processedOperationIds = new Set();
    
    // A unique ID for this instance of the helper
    const helperId = 'writesharp_helper_' + Date.now();
    console.log('[WriteSharp:ZendeskHelper] Helper loading, ID:', helperId, 'Version:', SCRIPT_VERSION);
    
    // If there's a version mismatch, force clear previous state
    if (window._writeSharpHelperVersion !== SCRIPT_VERSION) {
        console.log('[WriteSharp:ZendeskHelper] Version change detected, clearing previous state');
        window._writeSharpHelperLoaded = null;
        window._writeSharpHelperVersion = SCRIPT_VERSION;
    }
    
    // Exit if already loaded
    if (window._writeSharpHelperLoaded) {
        console.log('[WriteSharp:ZendeskHelper] Helper already loaded with ID:', window._writeSharpHelperLoaded);
        return;
    }
    
    // Mark as loaded
    window._writeSharpHelperLoaded = helperId;
    window._writeSharpHelperVersion = SCRIPT_VERSION;
    
    // Listen for our custom operation events
    function handleWriteSharpOperation(event) {
        try {
            console.log('[WriteSharp:ZendeskHelper] Received operation event');
            
            const operationId = event.detail.operationId;
            console.log('[WriteSharp:ZendeskHelper] Operation ID:', operationId);
            
            // Check if we already processed this exact operation ID
            if (processedOperationIds.has(operationId)) {
                console.log('[WriteSharp:ZendeskHelper] Already processed this operation ID, ignoring');
                return;
            }
            
            // Find the data div
            const dataDiv = document.getElementById(operationId);
            if (!dataDiv) {
                console.log('[WriteSharp:ZendeskHelper] Data div not found for operation:', operationId);
                return;
            }
            
            // Check if operation is already in progress (by ID)
            if (activeOperations.has(operationId)) {
                console.log('[WriteSharp:ZendeskHelper] Operation already in progress, ignoring duplicate event');
                return;
            }
            
            // Get the operation type
            const operation = dataDiv.getAttribute('data-operation');
            if (operation !== 'insert-text') {
                console.log('[WriteSharp:ZendeskHelper] Unknown operation type:', operation);
                dataDiv.setAttribute('data-result', 'error');
                dataDiv.setAttribute('data-error', 'Unknown operation type');
                return;
            }
            
            // Apply rate limiting - ensure minimum time between operations
            const now = Date.now();
            const timeSinceLastOperation = now - lastOperationTimestamp;
            
            if (timeSinceLastOperation < MIN_OPERATION_DELAY) {
                console.log('[WriteSharp:ZendeskHelper] Operation too soon after previous one, delaying');
                
                // Rather than reject as duplicate, just delay processing
                setTimeout(() => {
                    // Re-dispatch after delay
                    console.log('[WriteSharp:ZendeskHelper] Re-dispatching delayed operation');
                    const delayedEvent = new CustomEvent('writesharp-operation', {
                        detail: { operationId, isRetry: true }
                    });
                    document.dispatchEvent(delayedEvent);
                }, MIN_OPERATION_DELAY - timeSinceLastOperation + 50);
                
                return;
            }
            
            // Mark as in progress and update timestamp
            activeOperations.add(operationId);
            lastOperationTimestamp = now;
            
            // Get the text and HTML
            const { text, html } = getTextFromDataElement(dataDiv);
            
            // Record this operation ID as processed to prevent future duplicates
            processedOperationIds.add(operationId);
            
            // Only keep the 20 most recent operation IDs
            if (processedOperationIds.size > 20) {
                const oldestId = Array.from(processedOperationIds)[0];
                processedOperationIds.delete(oldestId);
            }
            
            // Process the operation
            console.log('[WriteSharp:ZendeskHelper] Processing insert-text operation');
            
            // Use Promise to handle async operations properly
            insertTextIntoZendesk(text, html)
                .then(success => {
                    console.log('[WriteSharp:ZendeskHelper] Insertion result:', success);
                    
                    // Only set the result if the div still exists
                    if (document.body.contains(dataDiv)) {
                        dataDiv.setAttribute('data-result', success ? 'success' : 'error');
                    }
                    
                    // Remove from active operations
                    activeOperations.delete(operationId);
                    
                    // Clean up the div after a delay
                    setTimeout(() => {
                        if (document.body.contains(dataDiv)) {
                            dataDiv.remove();
                        }
                    }, 500);
                })
                .catch(error => {
                    console.error('[WriteSharp:ZendeskHelper] Error during insertion:', error);
                    
                    if (document.body.contains(dataDiv)) {
                        dataDiv.setAttribute('data-result', 'error');
                        dataDiv.setAttribute('data-error', error.message || 'Unknown error');
                    }
                    
                    // Remove from active operations
                    activeOperations.delete(operationId);
                    
                    // Clean up the div after a delay
                    setTimeout(() => {
                        if (document.body.contains(dataDiv)) {
                            dataDiv.remove();
                        }
                    }, 500);
                });
        } catch (e) {
            console.error('[WriteSharp:ZendeskHelper] Fatal error in event handler:', e);
            // Try to clean up and continue
            activeOperations.delete(operationId);
        }
    }
    
    // Add event listener for custom operations
    document.addEventListener('writesharp-operation', handleWriteSharpOperation);
    console.log('[WriteSharp:ZendeskHelper] Event listener added');
    
    /**
     * Gets text from a data element
     */
    function getTextFromDataElement(dataElement) {
        return {
            text: dataElement.getAttribute('data-text'),
            html: dataElement.getAttribute('data-html'),
            operation: dataElement.getAttribute('data-operation')
        };
    }

    /**
     * Inserts text into the active CKEditor instance
     * @param {string} text - The text to insert
     * @param {string} html - Optional HTML version of the text to insert
     * @returns {Promise<boolean>} Whether the text was successfully inserted
     */
    async function insertTextIntoZendesk(text, html) {
        try {
            console.log('[WriteSharp:ZendeskHelper] Inserting text into Zendesk');
            
            // Try to find the active CKEditor instance - CKEditor 5 first
            let ckEditor5Instance = null;
            let success = false;
            
            // Method 1: Try CKEditor 5
            try {
                // Find the editable area - could be several selectors depending on Zendesk version
                const editorElement = document.querySelector('.ck-editor__editable') || 
                                      document.querySelector('[data-test-id="omnicomposer-rich-text-ckeditor"]') ||
                                      document.querySelector('.zendesk-editor--rich-text-container');
                
                if (editorElement) {
                    // Focus the editor element to ensure it's active
                    editorElement.focus();
                    
                    // If this is a CKEditor 5 instance
                    if (editorElement.ckeditorInstance) {
                        console.log('[WriteSharp:ZendeskHelper] Found CKEditor 5 instance');
                        ckEditor5Instance = editorElement.ckeditorInstance;
                        
                        try {
                            // IMPORTANT: Instead of replacing all content, we need to
                            // only replace the selected text or insert at cursor position
                            
                            // Check if there's a selection
                            const selection = ckEditor5Instance.model.document.selection;
                            const hasSelection = !selection.isCollapsed;
                            
                            console.log('[WriteSharp:ZendeskHelper] Has selection:', hasSelection);
                            
                            if (hasSelection) {
                                // There is text selected - replace only that text
                                ckEditor5Instance.model.change(writer => {
                                    // Delete the selected content first
                                    ckEditor5Instance.model.deleteContent(selection);
                                    
                                    // Then insert the new content at the selection position
                                    if (html) {
                                        try {
                                            const viewFragment = ckEditor5Instance.data.processor.toView(html);
                                            const modelFragment = ckEditor5Instance.data.toModel(viewFragment);
                                            ckEditor5Instance.model.insertContent(modelFragment);
                                        } catch (e) {
                                            console.error('[WriteSharp:ZendeskHelper] Error inserting HTML in CKEditor5:', e);
                                            // Fall back to plain text
                                            ckEditor5Instance.model.insertContent(text);
                                        }
                                    } else {
                                        ckEditor5Instance.model.insertContent(text);
                                    }
                                });
                            } else {
                                // No selection - just insert at cursor position
                                if (html) {
                                    try {
                                        ckEditor5Instance.model.change(writer => {
                                            const viewFragment = ckEditor5Instance.data.processor.toView(html);
                                            const modelFragment = ckEditor5Instance.data.toModel(viewFragment);
                                            ckEditor5Instance.model.insertContent(modelFragment);
                                        });
                                    } catch (e) {
                                        console.error('[WriteSharp:ZendeskHelper] Error inserting HTML at cursor:', e);
                                        // Fall back to plain text
                                        ckEditor5Instance.execute('insertText', { text });
                                    }
                                } else {
                                    ckEditor5Instance.execute('insertText', { text });
                                }
                            }
                            
                            return true;
                        } catch (e) {
                            console.error('[WriteSharp:ZendeskHelper] Error using CKEditor 5 API:', e);
                            // Continue to other methods
                        }
                    }
                }
            } catch (e) {
                console.error('[WriteSharp:ZendeskHelper] Error finding CKEditor 5:', e);
                // Continue to other methods
            }
            
            // Method 2: Try CKEditor 4 (older Zendesk versions)
            if (typeof CKEDITOR !== 'undefined') {
                console.log('[WriteSharp:ZendeskHelper] Trying CKEditor 4');
                let editor = null;
                
                if (CKEDITOR.currentInstance) {
                    editor = CKEDITOR.currentInstance;
                } else {
                    // Try to find any available instance
                    for (let name in CKEDITOR.instances) {
                        editor = CKEDITOR.instances[name];
                        if (editor.focusManager && editor.focusManager.hasFocus) {
                            break;
                        }
                    }
                    
                    // If no focused instance found, just use the first one
                    if (!editor && Object.keys(CKEDITOR.instances).length > 0) {
                        editor = CKEDITOR.instances[Object.keys(CKEDITOR.instances)[0]];
                    }
                }
                
                if (editor) {
                    // Make sure the editor is focused
                    editor.focus();
                    
                    // IMPORTANT: Don't clear existing content - only replace selection or insert at cursor
                    console.log('[WriteSharp:ZendeskHelper] Inserting with CKEditor 4');
                    
                    // Check if there's a selection
                    const selection = editor.getSelection();
                    const hasSelection = selection && !selection.isCollapsed;
                    
                    console.log('[WriteSharp:ZendeskHelper] CK4 Has selection:', hasSelection);
                    
                    // Insert content - CKEditor 4 will automatically replace selection if exists
                    if (html) {
                        editor.insertHtml(html);
                    } else {
                        editor.insertText(text);
                    }
                    
                    return true;
                }
            }
            
            // Method 3: Try Zendesk's specific CKEDITOR access
            try {
                if (window.Zendesk && window.Zendesk.CKEDITOR) {
                    console.log('[WriteSharp:ZendeskHelper] Using Zendesk CKEDITOR global');
                    const editorObj = window.Zendesk.CKEDITOR;
                    const instanceNames = Object.keys(editorObj.instances || {});
                    
                    if (instanceNames.length > 0) {
                        const zendeskEditor = editorObj.instances[instanceNames[0]];
                        
                        if (zendeskEditor) {
                            // Focus the editor
                            zendeskEditor.focus();
                            
                            // IMPORTANT: Don't clear content - just insert at current position
                            // Insert new content (will replace selection if there is one)
                            if (html) {
                                zendeskEditor.insertHtml(html);
                            } else {
                                zendeskEditor.insertText(text);
                            }
                            return true;
                        }
                    }
                }
            } catch (e) {
                console.error('[WriteSharp:ZendeskHelper] Error with Zendesk CKEDITOR:', e);
            }
            
            // Method 4: Try direct DOM manipulation
            // This is a last resort when we can't find a proper CKEditor instance
            try {
                const editorArea = document.querySelector('.ck-editor__editable') || 
                                  document.querySelector('[data-test-id="omnicomposer-rich-text-ckeditor"]') ||
                                  document.querySelector('.zendesk-editor--rich-text-container');
                                  
                if (editorArea) {
                    console.log('[WriteSharp:ZendeskHelper] Using direct DOM manipulation');
                    
                    // IMPORTANT: Preserve existing content by working with the selection
                    editorArea.focus();
                    
                    // Check if there's a selection
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed;
                    
                    // If there's a selection, replace just that selected text
                    if (hasSelection) {
                        console.log('[WriteSharp:ZendeskHelper] Replacing selected text in DOM');
                        const range = selection.getRangeAt(0);
                        
                        // Delete the selection
                        range.deleteContents();
                        
                        // Create a fragment with new content
                        if (html) {
                            // Create temporary container
                            const temp = document.createElement('div');
                            temp.innerHTML = html;
                            
                            // Create a DocumentFragment to hold the nodes
                            const fragment = document.createDocumentFragment();
                            
                            // Move nodes from temp to fragment
                            while (temp.firstChild) {
                                fragment.appendChild(temp.firstChild);
                            }
                            
                            // Insert the fragment
                            range.insertNode(fragment);
                        } else {
                            // Insert text node
                            range.insertNode(document.createTextNode(text));
                        }
                    } else {
                        // No selection - try clipboard insertion at cursor position
                        return await new Promise((resolve) => {
                            try {
                                // Create a new clipboard item with HTML and text versions
                                const clipboardItem = new ClipboardItem({
                                    'text/html': new Blob([html || text], { type: 'text/html' }),
                                    'text/plain': new Blob([text], { type: 'text/plain' })
                                });
                                
                                // Write to clipboard and then trigger paste
                                navigator.clipboard.write([clipboardItem])
                                    .then(() => {
                                        // Attempt to paste
                                        const pasteSuccess = document.execCommand('paste');
                                        console.log('[WriteSharp:ZendeskHelper] Paste command result:', pasteSuccess);
                                        
                                        // Double-check that content was actually inserted
                                        setTimeout(() => {
                                            resolve(pasteSuccess);
                                        }, 100);
                                    })
                                    .catch(error => {
                                        console.error('[WriteSharp:ZendeskHelper] Clipboard API failed:', error);
                                        // Try execCommand directly as last resort
                                        try {
                                            if (html) {
                                                success = document.execCommand('insertHTML', false, html);
                                            } else {
                                                success = document.execCommand('insertText', false, text);
                                            }
                                            resolve(success);
                                        } catch (e) {
                                            console.error('[WriteSharp:ZendeskHelper] execCommand failed:', e);
                                            resolve(false);
                                        }
                                    });
                            } catch (e) {
                                console.error('[WriteSharp:ZendeskHelper] DOM insertion error:', e);
                                resolve(false);
                            }
                        });
                    }
                    
                    return true;
                }
            } catch (e) {
                console.error('[WriteSharp:ZendeskHelper] Error with DOM manipulation:', e);
            }
            
            console.warn('[WriteSharp:ZendeskHelper] All insertion methods failed');
            return false;
        } catch (e) {
            console.error('[WriteSharp:ZendeskHelper] Fatal error during insertion:', e);
            return false;
        }
    }

    /**
     * Main observer function
     */
    function observeAndProcessDataElements() {
        // Define what to look for
        const targetNode = document.body;
        const config = { childList: true, subtree: true, attributes: false };
        
        // Callback function to execute when mutations are observed
        const callback = function(mutationsList) {
            for (const mutation of mutationsList) {
                // Only care about childList mutations (nodes added/removed)
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            node.hasAttribute && 
                            node.hasAttribute('data-writesharp-operation')) {
                            
                            // Don't process if already in progress
                            const operationId = node.id;
                            if (activeOperations.has(operationId) || processedOperationIds.has(operationId)) {
                                return;
                            }
                            
                            console.log('[WriteSharp:ZendeskHelper] Found new WriteSharp data element:', operationId);
                            
                            // Create and dispatch a custom event
                            const event = new CustomEvent('writesharp-operation', {
                                detail: { operationId }
                            });
                            
                            // Short delay to ensure readiness
                            setTimeout(() => {
                                document.dispatchEvent(event);
                            }, 50);
                        }
                    });
                }
            }
        };
        
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);
        
        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);
        
        console.log('[WriteSharp:ZendeskHelper] Observer started with ID:', helperId);
        
        // Clean up any existing tracking divs from previous sessions
        document.querySelectorAll('[data-writesharp-operation]').forEach(element => {
            console.log('[WriteSharp:ZendeskHelper] Cleaning up stale operation element:', element.id);
            element.remove();
        });
    }

    // Start observing when the script is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeAndProcessDataElements);
    } else {
        // Small delay to ensure the script is fully loaded
        setTimeout(observeAndProcessDataElements, 100);
    }

    console.log('[WriteSharp:ZendeskHelper] Helper script v2.0.0 loaded with ID:', helperId);
})(); 