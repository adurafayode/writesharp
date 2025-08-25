// WriteSharp Popup JavaScript

// Debug logging
const DEBUG = false; // Set to true to enable debug logs
function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp:Popup] ${message}`, ...args);
    }
}

log('Popup script loaded');

// DOM Elements
const originalTextArea = document.getElementById('originalText');
const rephrasedTextArea = document.getElementById('rephrasedText');
const rephraseButton = document.getElementById('rephraseBtn');
const insertButton = document.getElementById('insertBtn');
const copyButton = document.getElementById('copyBtn');
const errorText = document.getElementById('errorText');
const loadingSpinner = document.getElementById('loadingSpinner');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyButton = document.getElementById('saveKeyBtn');
const customPromptTextarea = document.getElementById('customPrompt');
const useCustomPromptCheckbox = document.getElementById('useCustomPrompt');
const clearSelectionButton = document.getElementById('clearSelectionBtn');
const charactersCounter = document.getElementById('charactersCounter');
const textLengthContainer = document.getElementById('textLengthContainer');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const modelSelect = document.getElementById('modelSelect');
const saveModelButton = document.getElementById('saveModelBtn');
let customPromptStatus; // Will be initialized on DOM load
let customPromptDebounceTimer; // For debouncing auto-save

// Global variables
let isZendeskContext = false;
let currentSelection = null;
const MAX_TEXT_LENGTH = 2000;

// Settings toggle
document.getElementById('settingsToggle').addEventListener('click', () => {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.classList.toggle('hidden');
});

// Replace the isZendeskContext detection with a more reliable universal approach
let useUniversalRenderer = true; // Always use the most compatible renderer

/**
 * Formats text to HTML - enhanced version with better markdown conversion
 * 
 * Note: Our testing has shown that GPT-4o naturally formats text appropriately
 * without requiring explicit formatting instructions. The LLM will automatically:
 * - Create bullet points and numbered lists where appropriate
 * - Add proper paragraph breaks and spacing
 * - Structure content logically
 * 
 * This function processes the text returned from the LLM, converting any
 * markdown or formatting to proper HTML for display.
 */
function formatTextToHtml(text, originalFormatting) {
    console.log("=== HTML CONVERSION STAGE ===");
    console.log("Text to convert:", text);
    
    if (!text) return '';
    
    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n\n');
    
    // Process markdown BEFORE splitting paragraphs
    let processedText = text
        // Bold text (must come before italic)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic text 
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert markdown bullet points for consistency
        .replace(/^[*-]\s+(.*)$/gm, '• $1');
    
    // Split into paragraphs
    const paragraphs = processedText.split('\n\n');
    
    // Process each paragraph
    const htmlParts = paragraphs.map(paragraph => {
        if (!paragraph.trim()) return '';
        
        // Check for bullet points
        if (paragraph.match(/^\s*[•-]\s/m)) {
            const lines = paragraph.split('\n');
            let listItems = '';
            
            // Process each line to properly handle bullets
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                    // Extract content after bullet and trim
                    const content = trimmed.substring(1).trim()
                        // Make sure any internal HTML tags are preserved
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        // But restore already converted HTML tags
                        .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>')
                        .replace(/&lt;(\/?)em&gt;/g, '<$1em>')
                        .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
                        .replace(/&lt;(\/?)i&gt;/g, '<$1i>');
                        
                    listItems += `<li>${content}</li>`;
                } else if (trimmed) {
                    // Non-bullet line within a bullet paragraph - add as separate paragraph
                    listItems += `<p>${trimmed}</p>`;
                }
            });
            
            if (listItems) {
                return `<ul>${listItems}</ul>`;
            }
            return '';
        }
        
        // Check for term definitions (key: value format)
        if (paragraph.match(/^([^:]+):\s(.+)$/)) {
            const matches = paragraph.match(/^([^:]+):\s(.+)$/);
            if (matches && matches.length >= 3) {
                const term = matches[1].trim();
                const definition = matches[2].trim();
                return `<p><strong>${term}:</strong> ${definition}</p>`;
            }
        }
        
        // Handle line breaks within a paragraph
        let html = paragraph.split('\n').map(line => line.trim()).join('<br>');
        
        // Make sure any remaining HTML is properly escaped
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // But restore already converted HTML tags
            .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>')
            .replace(/&lt;(\/?)em&gt;/g, '<$1em>')
            .replace(/&lt;(\/?)br&gt;/g, '<$1br>')
            .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
            .replace(/&lt;(\/?)i&gt;/g, '<$1i>');
        
        return `<p>${html}</p>`;
    });
    
    return htmlParts.join('');
}

/**
 * Sets HTML content in the rich text editor - universal approach that works everywhere
 * @param {string} html - HTML content to set
 */
function setRichTextContent(html) {
    console.log("=== SETTING RICH TEXT CONTENT ===");
    console.log("Original HTML:", html);
    
    // Pre-process the HTML to make sure all markdown is converted first
    // This ensures we don't try to render markdown directly
    if (html.includes('**') || html.includes('*') || html.includes('- ') || html.includes('• ')) {
        console.log("Detected markdown in HTML - converting first");
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        html = formatTextToHtml(textContent, null);
        console.log("Converted markdown to HTML:", html);
    }
    
    // Clear the content first to prevent artifacts
    while (rephrasedTextArea.firstChild) {
        rephrasedTextArea.removeChild(rephrasedTextArea.firstChild);
    }
    
    // Extract clean text for fallback and analysis
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    try {
        // If the HTML is properly formatted with paragraphs and lists, try direct injection first
        if (html.includes('<p>') || html.includes('<ul>') || html.includes('<li>')) {
            console.log("Using direct HTML rendering");
            rephrasedTextArea.innerHTML = html;
            
            // Quick verification in case direct HTML fails
            setTimeout(() => {
                // Check if content rendered as expected
                const hasFormatting = 
                    rephrasedTextArea.querySelectorAll('p, ul, li, strong, em').length > 0;
                
                // If formatting is missing, rebuild using the DOM approach
                if (!hasFormatting) {
                    console.log("Direct HTML rendering failed, using DOM manipulation");
                    rebuildWithDomManipulation(html, plainText);
                }
            }, 50);
            return;
        }
        
        // Otherwise use the safer DOM manipulation approach for all content
        rebuildWithDomManipulation(html, plainText);
    } catch (error) {
        console.error("Error rendering content:", error);
        // Absolute fallback - just use text with preserved line breaks
        universalTextFallback(plainText);
    }

    // At the end of the function, after all content is set, update button states
    const hasContent = (html && html.trim() !== '');
    insertButton.disabled = !hasContent;
    copyButton.disabled = !hasContent;
}

/**
 * Rebuild content using safer DOM manipulation methods
 */
function rebuildWithDomManipulation(html, plainText) {
    try {
        // Parse the HTML into a document fragment
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract elements and add them to the output
        Array.from(doc.body.childNodes).forEach(node => {
            // Handle specific elements
            if (node.nodeType === Node.ELEMENT_NODE) {
                // For paragraphs, lists, etc
                const clone = document.importNode(node, true);
                rephrasedTextArea.appendChild(clone);
            } 
            // Handle text nodes (should be rare at this level)
            else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                const p = document.createElement('p');
                p.textContent = node.textContent;
                rephrasedTextArea.appendChild(p);
            }
        });
        
        // If nothing was added (perhaps due to security restrictions), use fallback
        if (!rephrasedTextArea.childNodes.length) {
            console.log("DOM manipulation approach failed, falling back to text-based parsing");
            processTextDirectly(plainText);
        }
    } catch (e) {
        console.error("Error during DOM manipulation:", e);
        processTextDirectly(plainText);
    }
}

/**
 * Process text directly when HTML and DOM manipulation approaches fail
 */
function processTextDirectly(text) {
    // Preprocess the text to identify structure
    const lines = text.split('\n');
    const paragraphs = [];
    let currentParagraph = [];
    
    // Group lines into paragraphs
    lines.forEach(line => {
        if (line.trim() === '') {
            if (currentParagraph.length > 0) {
                paragraphs.push(currentParagraph);
                currentParagraph = [];
            }
            } else {
            currentParagraph.push(line);
        }
    });
    
    // Add the last paragraph if it exists
    if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
    }
    
    console.log(`Processing ${paragraphs.length} paragraphs directly`);
    
    // Process each paragraph
    paragraphs.forEach(paragraphLines => {
        // Detect paragraph type
        const firstLine = paragraphLines[0].trim();
        
        // Check if this is a bullet list
        const isBulletList = paragraphLines.some(line => 
            line.trim().startsWith('•') || 
            line.trim().startsWith('-')
        );
        
        if (isBulletList) {
            // Create a list container
            const ulElement = document.createElement('ul');
            
            // Process each line
            paragraphLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
                    // Remove any markdown remaining in the line content
                    let content = trimmedLine.substring(1).trim()
                        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                        .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                        
                    // This is a bullet point
                    const liElement = document.createElement('li');
                    liElement.textContent = content;
                    ulElement.appendChild(liElement);
                } else if (trimmedLine) {
                    // Regular line within a list context - add as paragraph
                    const pElement = document.createElement('p');
                    pElement.textContent = trimmedLine;
                    rephrasedTextArea.appendChild(pElement);
                }
            });
            
            // Add the list if it has items
            if (ulElement.childNodes.length > 0) {
                rephrasedTextArea.appendChild(ulElement);
            }
        }
        // Check if this is a term definition
        else if (firstLine.includes(':') && firstLine.split(':')[0].trim().length > 0) {
            const parts = firstLine.split(':');
            const term = parts[0].trim();
            const definition = parts.slice(1).join(':').trim();
            
            // Create term definition paragraph
            const pElement = document.createElement('p');
            
            // Create the term element (bold)
            const strongElement = document.createElement('strong');
            strongElement.textContent = term + ': ';
            pElement.appendChild(strongElement);
            
            // Add the definition as text, removing any markdown
            const cleanDefinition = definition
                .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                
            const textNode = document.createTextNode(cleanDefinition);
            pElement.appendChild(textNode);
            
            // Add additional lines if any
            if (paragraphLines.length > 1) {
                for (let i = 1; i < paragraphLines.length; i++) {
                    if (paragraphLines[i].trim()) {
                        pElement.appendChild(document.createElement('br'));
                        
                        // Clean any markdown in additional lines
                        const cleanLine = paragraphLines[i].trim()
                            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                            .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                            
                        pElement.appendChild(document.createTextNode(cleanLine));
                    }
                }
            }
            
            rephrasedTextArea.appendChild(pElement);
        }
        // Regular paragraph
        else {
            const pElement = document.createElement('p');
            
            // Clean the text of any markdown
            if (paragraphLines.length === 1) {
                const cleanText = paragraphLines[0]
                    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                    .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                    
                pElement.textContent = cleanText;
            } else {
                // First line doesn't need a break before it
                const cleanFirstLine = paragraphLines[0]
                    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                    .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                    
                pElement.textContent = cleanFirstLine;
                
                // Add remaining lines with breaks
                for (let i = 1; i < paragraphLines.length; i++) {
                    if (paragraphLines[i].trim()) {
                        pElement.appendChild(document.createElement('br'));
                        
                        // Clean the text
                        const cleanLine = paragraphLines[i].trim()
                            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                            .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
                            
                        pElement.appendChild(document.createTextNode(cleanLine));
                    }
                }
            }
            
            rephrasedTextArea.appendChild(pElement);
        }
    });
}

// Replace the universal fallback with an improved version that handles markdown
function universalTextFallback(text) {
    console.log("Using universal text fallback");
    
    // Remove any markdown formatting first
    text = text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1');     // Remove italic markdown
    
    // Clear everything
    while (rephrasedTextArea.firstChild) {
        rephrasedTextArea.removeChild(rephrasedTextArea.firstChild);
    }
    
    // Format the text to preserve structure as much as possible
    const formattedText = text
        .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
        .split('\n\n')                 // Split into paragraphs
        .map(paragraph => {
            // Format bullet points
            if (paragraph.match(/^\s*[-•]/m)) {
                return paragraph.split('\n')
                    .map(line => {
                        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                            return '• ' + line.trim().substring(1).trim();
                        }
                        return line;
                    })
                    .join('\n');
            }
            
            // Format term definitions
            if (paragraph.match(/^([^:]+):\s/)) {
                const parts = paragraph.split(':');
                const term = parts[0].trim();
                const definition = parts.slice(1).join(':').trim();
                return term.toUpperCase() + ': ' + definition;
            }
            
            return paragraph;
        })
        .join('\n\n');
    
    // Use pre-element to preserve formatting
    const preElement = document.createElement('pre');
    preElement.style.whiteSpace = 'pre-wrap';
    preElement.style.fontFamily = 'inherit';
    preElement.style.margin = '0';
    preElement.textContent = formattedText;
    
    rephrasedTextArea.appendChild(preElement);
}

/**
 * Gets the HTML content from the original text editor
 * @returns {string} HTML content
 */
function getOriginalTextContent() {
    return originalTextArea.innerHTML;
}

/**
 * Sets HTML content in the original text editor
 * @param {string} html - HTML content to set
 */
function setOriginalTextContent(html) {
    originalTextArea.innerHTML = html;
}

/**
 * Gets plain text from the original text editor
 * @returns {string} Plain text content
 */
function getOriginalTextPlainContent() {
    return originalTextArea.innerText;
}

/**
 * Gets the HTML content from the rich text editor
 * @returns {string} HTML content
 */
function getRichTextContent() {
    return rephrasedTextArea.innerHTML;
}

/**
 * Verifies rich text is rendering correctly and attempts fixes if needed
 */
function verifyRichTextRendering() {
    // Check if lists are rendering properly
    const lists = rephrasedTextArea.querySelectorAll('ul, ol');
    const listItems = rephrasedTextArea.querySelectorAll('li');
    
    // Log for debugging
    console.log(`Rich text verification - Lists: ${lists.length}, List items: ${listItems.length}`);
    
    // If there are list items but no lists, something went wrong with rendering
    if (listItems.length > 0 && lists.length === 0) {
        console.log("List rendering issue detected, applying fix");
        
        // Try to fix by wrapping orphaned list items
        let listContent = rephrasedTextArea.innerHTML;
        
        // Wrap sequences of <li> elements in <ul> tags
        listContent = listContent.replace(/(<li>.*?<\/li>)(?:\s*)(<li>.*?<\/li>)/g, '<ul>$1$2</ul>');
        
        // Fix any remaining orphaned list items
        listContent = listContent.replace(/(<li>.*?<\/li>)(?![^<]*<\/ul>)/g, '<ul>$1</ul>');
        
        // Apply the fixed content
        rephrasedTextArea.innerHTML = listContent;
    }
    
    // Check if bold and italic elements are rendering properly
    const boldElements = rephrasedTextArea.querySelectorAll('strong, b');
    const italicElements = rephrasedTextArea.querySelectorAll('em, i');
    
    // If we have markdown-style formatting that wasn't converted
    if (rephrasedTextArea.innerHTML.includes('**') || 
        rephrasedTextArea.innerHTML.includes('__') ||
        rephrasedTextArea.innerHTML.includes('*') ||
        rephrasedTextArea.innerHTML.includes('_')) {
        
        console.log("Text formatting issue detected, applying fix");
        
        // Get the text and reformat
        const text = rephrasedTextArea.textContent;
        const reformatted = formatTextToHtml(text, null);
        rephrasedTextArea.innerHTML = reformatted;
    }
    
    // Final check for line breaks that should be paragraphs
    if (!rephrasedTextArea.innerHTML.includes('<p>') && 
        rephrasedTextArea.innerHTML.includes('<br><br>')) {
        
        console.log("Paragraph formatting issue detected, applying fix");
        
        // Split by double breaks and wrap in paragraphs
        const parts = rephrasedTextArea.innerHTML.split(/<br\s*\/?><br\s*\/?>/);
        const fixed = parts.map(p => p.trim() ? `<p>${p}</p>` : '').join('');
        rephrasedTextArea.innerHTML = fixed;
        }
    }

    /**
 * Gets plain text from the rich text editor
 * @returns {string} Plain text content
 */
function getRichTextPlainContent() {
    return rephrasedTextArea.innerText;
}

/**
 * Gets the current selection from the active tab
 */
function getCurrentSelection() {
    console.log("=== POPUP REQUEST STAGE ===");
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            log('Error querying tabs:', chrome.runtime.lastError);
            setErrorMessage('Could not find active tab');
                return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab) {
            log('No active tab found');
            setErrorMessage('No active tab found');
            return;
        }
        
        // First ping to see if content script is loaded
        chrome.tabs.sendMessage(activeTab.id, { action: 'ping' }, function(response) {
            if (chrome.runtime.lastError) {
                log('Error pinging content script:', chrome.runtime.lastError);
                setErrorMessage('Content script not loaded in this page');
                
                // Enable manual input in the original text area
                originalTextArea.contentEditable = true;
                originalTextArea.innerHTML = '';
                originalTextArea.focus();
                return;
            }
            
            // If we get here, content script is available, now get the selection
            chrome.tabs.sendMessage(activeTab.id, {
                action: 'getCurrentSelection'
            }, function(response) {
                console.log("=== POPUP RECEIVE STAGE ===");
                console.log("Received from content script:", response);
                
                if (chrome.runtime.lastError) {
                    log('Error getting selection:', chrome.runtime.lastError);
                    setErrorMessage('Could not get selection: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.text) {
                    console.log("HTML received:", response.html);
                    console.log("Formatting received:", response.formatting);
                    
                    // Set the HTML content if available, otherwise use plain text
                    if (response.html) {
                        console.log("Setting original text as HTML");
                        setOriginalTextContent(response.html);
                } else {
                        console.log("Setting original text as plain text");
                        setOriginalTextContent(response.text);
                    }
                    console.log("Original text area content:", getOriginalTextContent());
                    
                    updateCharacterCount();
                    // Auto-rephrase if text is present and not too long
                    if (response.text.length > 0 && response.text.length <= MAX_TEXT_LENGTH) {
                        rephrase(response.text, response.html, response.formatting);
                    }
                } else {
                    log('No valid selection found');
                    setErrorMessage('No text selected. Please select text in the page first.');
                    
                    // Enable manual input if no selection is found
                    originalTextArea.contentEditable = true;
                    originalTextArea.innerHTML = '';
                    originalTextArea.focus();
                }
            });
        });
    });
}

/**
 * Shows the error message
 * @param {string} message - Error message to display
 */
function setErrorMessage(message) {
    errorText.textContent = message;
    errorText.classList.remove('hidden');
    loadingSpinner.classList.add('hidden');
}

/**
 * Clears the error message
 */
function clearErrorMessage() {
    errorText.textContent = '';
    errorText.classList.add('hidden');
}

/**
 * Updates the character count of the original text
 */
function updateCharacterCount() {
    const text = getOriginalTextPlainContent();
    const textLength = text.length;
    charactersCounter.textContent = `${textLength}/${MAX_TEXT_LENGTH}`;
    
    // Progressive color scheme based on character count
    const percentage = textLength / MAX_TEXT_LENGTH;
    
    if (percentage > 0.9) { // Over 90% - red
        charactersCounter.classList.add('text-red-500');
        charactersCounter.classList.remove('text-yellow-500', 'text-gray-500');
    } else if (percentage > 0.7) { // Over 70% - yellow
        charactersCounter.classList.add('text-yellow-500');
        charactersCounter.classList.remove('text-red-500', 'text-gray-500');
    } else { // Under 70% - gray
        charactersCounter.classList.add('text-gray-500');
        charactersCounter.classList.remove('text-red-500', 'text-yellow-500');
    }
    
    // Add expanded view class if text is long
    const container = document.querySelector('main');
    if (textLength > 500) {
        container.classList.add('expanded-text-view');
        } else {
        container.classList.remove('expanded-text-view');
        }
    }

    /**
 * Sends the text to be rephrased
 * 
 * Note: While we still collect and pass formatting information from the original text,
 * our testing has shown that the LLM (GPT-4o) can intelligently apply appropriate
 * formatting without explicit instructions. We continue to pass this information
 * for backward compatibility and potential future enhancements.
 * 
 * @param {string} text - Text to rephrase
 * @param {string} html - HTML version of the text (if available)
 * @param {Object} formatting - Formatting information from the content script
 */
function rephrase(text, html, formatting) {
    console.log("=== REPHRASE REQUEST STAGE ===");
    console.log("Text being sent for rephrasing:", text);
    console.log("HTML being sent:", html);
    console.log("Formatting being sent:", formatting);
    
    // If no text is provided, use the text from the original text area
    if (!text) {
        text = getOriginalTextPlainContent();
        html = getOriginalTextContent();
        // No formatting info available for manual input
        formatting = null;
    }
    
    if (!text || text.trim() === '') {
        setErrorMessage('Please enter or select text to rephrase.');
        return;
    }
    
    if (text.length > MAX_TEXT_LENGTH) {
        setErrorMessage(`Text is too long. Maximum ${MAX_TEXT_LENGTH} characters allowed. Currently: ${text.length} characters.`);
        return;
    }
    
    clearErrorMessage();
    loadingSpinner.classList.remove('hidden');
    rephraseButton.disabled = true;
    
    // Get the current model
    chrome.storage.sync.get(['model'], function(result) {
        const selectedModel = result.model || 'gpt-4o'; // Default to gpt-4o if not set
        
        // Adjust main container for potentially longer text
        const container = document.querySelector('main');
        if (text.length > 500) {
            container.classList.add('expanded-text-view');
        }
        
        // Send the message to background script with the selected model
        chrome.runtime.sendMessage({
                    action: 'rephrase',
                    text: text,
            html: html,
            formatting: formatting,
            model: selectedModel
        }, function(response) {
            loadingSpinner.classList.add('hidden');
            rephraseButton.disabled = false;
            
            console.log("=== REPHRASE RESPONSE STAGE ===");
            console.log("Response from API:", response);
            
            // Check for runtime.lastError
            if (chrome.runtime.lastError) {
                console.error("Runtime error:", chrome.runtime.lastError);
                setErrorMessage("Error: " + (chrome.runtime.lastError.message || "Unknown error occurred"));
                return;
            }
            
            // Check for null response
            if (!response) {
                setErrorMessage("No response received. Please try again.");
                return;
            }
            
                if (response.error) {
                setErrorMessage(response.error);
                return;
            }
            
            try {
                // Check for markdown patterns - special check for LLM replies that use markdown formatting
                const hasMarkdown = 
                    response.rephrasedText.includes('**') || 
                    response.rephrasedText.includes('*') ||
                    response.rephrasedText.includes('- ');
                    
                if (hasMarkdown) {
                    console.log("Detected markdown in API response - handling with enhanced markdown conversion");
                }
                
                // Format the response text to HTML
                const formattedHtml = formatTextToHtml(response.rephrasedText, formatting);
                console.log("Formatted HTML:", formattedHtml);
                
                // Set the content in the rich text editor using universal method
                setRichTextContent(formattedHtml);
                
                // Triple-check for visible markdown that wasn't converted
                setTimeout(() => {
                    const content = rephrasedTextArea.textContent || '';
                    const hasVisibleMarkdown = 
                        content.includes('**') || 
                        content.includes('*') || 
                        (content.includes('- ') && !content.includes('• '));
                        
                    if (hasVisibleMarkdown) {
                        console.log("WARNING: Markdown still visible after processing - applying final cleanup");
                        
                        // Full cleanup - remove all markdown from the rendered content
                        const finalCleanup = content
                            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
                            .replace(/\*(.*?)\*/g, '$1')      // Remove italic markdown
                            .replace(/^- /gm, '• ');          // Convert dash bullets to bullets
                            
                        universalTextFallback(finalCleanup);
                    }
                }, 100);
                
                insertButton.disabled = false;
            } catch (e) {
                console.error("Error formatting response:", e);
                // Use universal fallback
                universalTextFallback(response.rephrasedText);
                insertButton.disabled = !response.rephrasedText.trim();
            }
        });
    });
}

/**
 * Inserts the rephrased text back into the page
 */
function insertRephrasedText() {
    const rephrasedText = getRichTextPlainContent();
    const rephrasedHtml = getRichTextContent();
    
    console.log("=== INSERT REQUEST STAGE ===");
    console.log("Plain text to insert:", rephrasedText);
    console.log("HTML to insert:", rephrasedHtml);
    
    if (!rephrasedText) {
        setErrorMessage('No rephrased text to insert.');
        return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            setErrorMessage('Could not find active tab');
            return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'applyRephrasedText',
            text: rephrasedText,
            html: rephrasedHtml
        }, function(response) {
            log('Insert response:', response);
            
            if (chrome.runtime.lastError) {
                setErrorMessage('Error inserting text: ' + chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.error) {
                setErrorMessage(response.error);
            } else if (response && response.status) {
                window.close(); // Close the popup after successful insertion
            } else {
                setErrorMessage('Unknown error occurred while inserting text.');
            }
        });
    });
}

/**
 * Clears the current selection state
 */
function clearSelection() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            setErrorMessage('Could not find active tab');
            return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'clearSelection'
        }, function(response) {
            log('Clear selection response:', response);
            
            if (chrome.runtime.lastError) {
                setErrorMessage('Error clearing selection: ' + chrome.runtime.lastError.message);
                return;
            }
            
            setOriginalTextContent('');
            setRichTextContent('');
            insertButton.disabled = true;
            copyButton.disabled = true;
            updateCharacterCount();
        });
    });
}

/**
 * Saves the API key to storage
 */
function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        setErrorMessage('Please enter an API key.');
                return;
            }
    
    chrome.storage.sync.set({apiKey: apiKey}, function() {
        saveKeyButton.textContent = 'Saved!';
        setTimeout(() => {
            saveKeyButton.textContent = 'Save Key';
        }, 2000);
    });
}

/**
 * Auto-saves the custom prompt settings with debouncing
 */
function autoSaveCustomPrompt() {
    // Clear any existing timer
    if (customPromptDebounceTimer) {
        clearTimeout(customPromptDebounceTimer);
    }
    
    // Set a new timer to save after 500ms of inactivity
    customPromptDebounceTimer = setTimeout(() => {
        const customPrompt = customPromptTextarea.value.trim();
        const useCustomPrompt = useCustomPromptCheckbox.checked;
        
        chrome.storage.sync.set({
            customPrompt: customPrompt,
            useCustomPrompt: useCustomPrompt
        }, function() {
            // Show brief saved notification
            if (customPromptStatus) {
                const previousText = customPromptStatus.textContent;
                customPromptStatus.textContent = 'Changes saved!';
                customPromptStatus.classList.remove('hidden');
                
                // Revert back to the state indicator after 1.5 seconds
                setTimeout(() => {
                    if (useCustomPrompt) {
                        customPromptStatus.textContent = 'Custom prompt active';
                    } else {
                        customPromptStatus.textContent = 'Default prompt active';
                    }
                }, 1500);
            }
        });
    }, 500);
}

/**
 * Updates the prompt status display
 */
function updatePromptStatus(useCustomPrompt) {
    if (customPromptStatus) {
        if (useCustomPrompt) {
            customPromptStatus.textContent = 'Custom prompt active';
        } else {
            customPromptStatus.textContent = 'Default prompt active';
        }
        customPromptStatus.classList.remove('hidden');
    }
}

/**
 * Saves the selected model to storage
 */
function saveModel() {
    const selectedModel = modelSelect.value;
    
    chrome.storage.sync.set({ model: selectedModel }, function() {
        saveModelButton.textContent = 'Saved!';
        setTimeout(() => {
            saveModelButton.textContent = 'Save Model';
        }, 2000);
    });
}

/**
 * Loads the saved settings from storage
 */
function loadSavedSettings() {
    chrome.storage.sync.get(['apiKey', 'customPrompt', 'useCustomPrompt', 'model'], function(result) {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        
        if (result.customPrompt) {
            customPromptTextarea.value = result.customPrompt;
        }
        
        if (result.useCustomPrompt !== undefined) {
            useCustomPromptCheckbox.checked = result.useCustomPrompt;
            
            // Update status text to show which prompt is active
            updatePromptStatus(result.useCustomPrompt);
        }
        
        if (result.model) {
            modelSelect.value = result.model;
        }
    });
}

/**
 * Monitors rich text area changes and updates UI accordingly
 */
function setupRichTextMonitoring() {
    // Use MutationObserver to watch for changes to the rich text area
    const observer = new MutationObserver(() => {
        const content = getRichTextPlainContent().trim();
        insertButton.disabled = !content;
        copyButton.disabled = !content;
    });
    
    observer.observe(rephrasedTextArea, { 
        childList: true, 
        subtree: true, 
        characterData: true 
    });
    
    // Input event handler
    rephrasedTextArea.addEventListener('input', () => {
        const content = getRichTextPlainContent().trim();
        insertButton.disabled = !content;
        copyButton.disabled = !content;
    });
    
    // Handle paste events to clean up formatting
    rephrasedTextArea.addEventListener('paste', function(e) {
        // Prevent the default paste behavior
        e.preventDefault();
        
        // Get the plain text from clipboard
        let text = '';
        if (e.clipboardData || e.originalEvent.clipboardData) {
            text = (e.clipboardData || e.originalEvent.clipboardData).getData('text/plain');
        } else if (window.clipboardData) {
            text = window.clipboardData.getData('Text');
        }
        
        // Convert to HTML and insert at cursor position
        const formattedHtml = formatTextToHtml(text, null);
        document.execCommand('insertHTML', false, formattedHtml);
        
        // Update button states
        const hasContent = getRichTextPlainContent().trim().length > 0;
        insertButton.disabled = !hasContent;
        copyButton.disabled = !hasContent;
    });
}

// Update event listeners for the original text area
function setupOriginalTextEditing() {
    originalTextArea.addEventListener('input', function() {
        updateCharacterCount();
    });

    originalTextArea.addEventListener('focus', function() {
        if (originalTextArea.contentEditable === "false") {
            originalTextArea.contentEditable = true;
        }
    });
}

/**
 * Detect if we're in a Zendesk context
 * @returns {Promise<boolean>} True if we're in a Zendesk context
 */
async function detectZendeskContext() {
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                resolve(false);
                return;
            }
            
            const url = tabs[0].url || '';
            const isZendesk = url.includes('zendesk.com') || url.includes('zendesk.');
            
            if (isZendesk) {
                console.log("Zendesk context detected:", url);
            }
            
            resolve(isZendesk);
        });
    });
}

/**
 * Copy text to clipboard with formatting preserved
 * @param {string} text - Plain text to copy
 * @param {string} html - HTML version of the text with formatting
 * @returns {Promise<boolean>} True if copied successfully
 */
async function copyToClipboard(text, html) {
    try {
        // Get the HTML directly from the rich text editor to preserve all formatting
        const richHtml = getRichTextContent();
        
        // Create properly formatted HTML that preserves all formatting but ensures proper spacing
        // We'll keep all existing tags but make sure paragraphs have the right styling
        let formattedHtml = richHtml
            // Make sure paragraphs have the correct styling
            .replace(/<p(?:\s[^>]*)?>/g, '<p class="mb-2 whitespace-pre-wrap" style="margin: 1.25em 0px; white-space-collapse: preserve;">')
            // Make sure list items are properly styled
            .replace(/<li(?:\s[^>]*)?>/g, '<li style="margin-bottom: 0.5em;">');
        
        console.log("Zendesk-optimized HTML with preserved formatting:", formattedHtml);

        // If clipboard API is available, use it
        if (navigator.clipboard && navigator.clipboard.write) {
            const clipboardItem = new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([formattedHtml], { type: 'text/html' })
            });
            
            await navigator.clipboard.write([clipboardItem]);
            return true;
        } else {
            // Fallback to text-only method
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        console.error('Failed to copy using Clipboard API:', error);
        
        // Fallback method using execCommand
        try {
            const tempElement = document.createElement('div');
            tempElement.setAttribute('contenteditable', 'true');
            
            // Use the existing rich HTML with adjusted styling
            const richHtml = getRichTextContent();
            let formattedHtml = richHtml
                // Make sure paragraphs have the correct styling
                .replace(/<p(?:\s[^>]*)?>/g, '<p class="mb-2 whitespace-pre-wrap" style="margin: 1.25em 0px; white-space-collapse: preserve;">')
                // Make sure list items are properly styled
                .replace(/<li(?:\s[^>]*)?>/g, '<li style="margin-bottom: 0.5em;">');
            
            tempElement.innerHTML = formattedHtml;
            tempElement.style.position = 'fixed';
            tempElement.style.left = '-9999px';
            document.body.appendChild(tempElement);
            
            // Select the content
            const range = document.createRange();
            range.selectNodeContents(tempElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Execute copy command
            const successful = document.execCommand('copy');
            
            // Clean up
            selection.removeAllRanges();
            document.body.removeChild(tempElement);
            return successful;
        } catch (err) {
            console.error('Failed to copy text (fallback):', err);
            
            // Last resort - basic text copy
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                return successful;
            } catch (finalError) {
                console.error('All copy methods failed:', finalError);
                document.body.removeChild(textarea);
                return false;
            }
        }
    }
}

/**
 * Update UI based on context
 */
async function updateContextUI() {
    isZendeskContext = await detectZendeskContext();
    
    if (isZendeskContext) {
        // Show copy button, hide insert button in Zendesk context
        insertButton.classList.add('hidden');
        copyButton.classList.remove('hidden');
    } else {
        // Show insert button, hide copy button in other contexts
        insertButton.classList.remove('hidden');
        copyButton.classList.add('hidden');
    }
}

/**
 * Sets up synchronized scrolling between text areas
 */
function setupSynchronizedScrolling() {
    const originalTextArea = document.getElementById('originalText');
    const rephrasedTextArea = document.getElementById('rephrasedText');
    
    // When original text is scrolled, sync the rephrased text
    originalTextArea.addEventListener('scroll', function() {
        const scrollPercentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
        const targetScrollTop = scrollPercentage * (rephrasedTextArea.scrollHeight - rephrasedTextArea.clientHeight);
        
        // Only sync scroll if there's something to scroll
        if (!isNaN(targetScrollTop) && isFinite(targetScrollTop)) {
            rephrasedTextArea.scrollTop = targetScrollTop;
        }
    });
    
    // When rephrased text is scrolled, sync the original text
    rephrasedTextArea.addEventListener('scroll', function() {
        const scrollPercentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
        const targetScrollTop = scrollPercentage * (originalTextArea.scrollHeight - originalTextArea.clientHeight);
        
        // Only sync scroll if there's something to scroll
        if (!isNaN(targetScrollTop) && isFinite(targetScrollTop)) {
            originalTextArea.scrollTop = targetScrollTop;
        }
    });
}

// Initialize when the popup is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log("=== POPUP INITIALIZATION STARTED ===");
    
    // Add status element for prompt selection
    customPromptStatus = document.createElement('div');
    customPromptStatus.id = 'customPromptStatus';
    customPromptStatus.classList.add('prompt-status', 'hidden');
    
    // Insert it after the toggle container
    const toggleContainer = document.querySelector('.toggle-container');
    toggleContainer.parentNode.insertBefore(customPromptStatus, toggleContainer.nextSibling);
    
    // Auto-save when checkbox is toggled
    useCustomPromptCheckbox.addEventListener('change', function() {
        updatePromptStatus(useCustomPromptCheckbox.checked);
        autoSaveCustomPrompt();
    });
    
    // Auto-save when custom prompt text changes
    customPromptTextarea.addEventListener('input', autoSaveCustomPrompt);
    
    // Check if we're in a Zendesk context and update the UI accordingly
    await updateContextUI();
    
    // Load the current selection
    getCurrentSelection();
    
    // Load saved settings
    loadSavedSettings();
    
    // Set up rich text editing
    setupRichTextMonitoring();
    
    // Set up synchronized scrolling
    setupSynchronizedScrolling();
    
    // Set up original text editing
    setupOriginalTextEditing();
    
    // Update character count for original text
    originalTextArea.addEventListener('input', updateCharacterCount);
    
    // Manual input support - make the field editable on focus
    originalTextArea.addEventListener('focus', function() {
        // Make editable on focus if it's readonly
        if (originalTextArea.readOnly) {
            originalTextArea.readOnly = false;
        }
    });
    
    // Manual rephrase button
    rephraseButton.addEventListener('click', function() {
        console.log("Rephrase button clicked");
        rephrase(getOriginalTextPlainContent(), getOriginalTextContent(), null);
    });
    
    // Insert button
    insertButton.addEventListener('click', function() {
        console.log("Insert button clicked");
        insertRephrasedText();
    });
    
    // Copy button (for Zendesk)
    copyButton.addEventListener('click', async function() {
        console.log("Copy button clicked");
        const textToCopy = getRichTextPlainContent();
        const htmlToCopy = getRichTextContent();
        
        if (!textToCopy) {
            setErrorMessage('No text to copy.');
            return;
        }
        
        const success = await copyToClipboard(textToCopy, htmlToCopy);
        
        if (success) {
            // Show temporary success message
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            
            setTimeout(() => {
                copyButton.textContent = originalText;
            }, 2000);
            
            // Log success
            console.log("Text successfully copied to clipboard with formatting");
            
            // Optional: close the popup
            // window.close();
        } else {
            setErrorMessage('Failed to copy text to clipboard.');
        }
    });
    
    // Clear selection button
    clearSelectionButton.addEventListener('click', function() {
        clearSelection();
        // Also clear the text areas
        setOriginalTextContent('');
        setRichTextContent('');
        // Make the original text area editable for manual input
        originalTextArea.contentEditable = true;
        clearErrorMessage();
        insertButton.disabled = true;
        copyButton.disabled = true;
        updateCharacterCount();
    });
    
    // Save API key button
    saveKeyButton.addEventListener('click', saveApiKey);
    
    // Save model selection
    saveModelButton.addEventListener('click', saveModel);
    
    console.log("=== POPUP INITIALIZATION COMPLETED ===");
});