// WriteSharp Popup Script

const DEBUG = false;  // Set to true to enable debug logging

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp] ${message}`, ...args);
    }
}

log('Popup script loaded');

document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded event fired');

    // DOM element references
    const originalTextArea = document.getElementById('original-text');
    const rephrasedTextArea = document.getElementById('rephrased-text');
    const applyButton = document.getElementById('apply-button');
    const editButton = document.getElementById('edit-button');
    const rephraseAgainButton = document.getElementById('rephrase-again-button');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const tryAgainButton = document.getElementById('try-again-button');
    const settingsLink = document.getElementById('settings-link');
    const settingsContainer = document.getElementById('settings-container');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const customPromptTextarea = document.getElementById('custom-prompt');
    const saveCustomPromptButton = document.getElementById('save-custom-prompt');
    const useCustomPromptToggle = document.getElementById('use-custom-prompt');

    const MAX_CHARS = 750;

    // Ensure settings container starts hidden
    settingsContainer.classList.add('hidden');
    settingsContainer.style.display = 'none';
    
    log('Initial DOM state:', {
        settingsLink,
        settingsContainer,
        settingsContainerDisplay: settingsContainer.style.display,
        settingsContainerClassList: settingsContainer.classList
    });

    if (!settingsLink) {
        console.warn('[WriteSharp] Settings link not found in the DOM');
    }

    if (!settingsContainer) {
        console.warn('[WriteSharp] Settings container not found in the DOM');
    }

    /**
     * Loads the selected text from storage and initializes the rephrasing process
     */
    function loadSelectedText() {
        chrome.storage.local.get(['selectedText'], (result) => {
            if (result.selectedText) {
                originalTextArea.value = result.selectedText;
                updateCharCount(originalTextArea);
                rephrase(result.selectedText);
            }
        });
    }

    loadSelectedText();

    // Load API key from storage
    chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    });

    // Load custom prompt and toggle state
    chrome.storage.sync.get(['customPrompt', 'useCustomPrompt'], (result) => {
        if (result.customPrompt) {
            customPromptTextarea.value = result.customPrompt;
            updateCharCount(customPromptTextarea);
        }
        if (result.useCustomPrompt !== undefined) {
            useCustomPromptToggle.checked = result.useCustomPrompt;
        }
    });

    // Event listeners for settings
    saveCustomPromptButton.addEventListener('click', () => {
        const customPrompt = customPromptTextarea.value.trim();
        chrome.storage.sync.set({customPrompt}, () => {
            if (chrome.runtime.lastError) {
                console.warn('[WriteSharp] Error saving custom prompt:', chrome.runtime.lastError);
                showMessage('Error saving custom prompt. Please try again.', 'error');
            } else {
                showMessage('Custom prompt saved successfully!', 'success');
            }
        });
    });

    useCustomPromptToggle.addEventListener('change', () => {
        const useCustomPrompt = useCustomPromptToggle.checked;
        chrome.storage.sync.set({useCustomPrompt}, () => {
            if (chrome.runtime.lastError) {
                console.warn('[WriteSharp] Error saving custom prompt toggle state:', chrome.runtime.lastError);
                showMessage('Error saving settings. Please try again.', 'error');
            } else {
                showMessage(useCustomPrompt ? 'Using custom prompt' : 'Using default prompt', 'success');
            }
        });
    });
    
    customPromptTextarea.addEventListener('input', () => updateCharCount(customPromptTextarea));

    /**
     * Shows the loading state and hides the error state
     */
    function showLoading() {
        log('Showing loading state');
        if (loadingState) {
            loadingState.classList.remove('hidden');
        } else {
            console.warn('[WriteSharp] Loading state element not found');
        }
        if (errorState) {
            errorState.classList.add('hidden');
        }
    }

    /**
     * Hides the loading state
     */
    function hideLoading() {
        log('Hiding loading state');
        if (loadingState) {
            loadingState.classList.add('hidden');
        } else {
            console.warn('[WriteSharp] Loading state element not found');
        }
    }

    /**
     * Sends a request to rephrase the given text
     * @param {string} text - The text to rephrase
     */
    async function rephrase(text) {
        showLoading();
        let retries = 3;
        while (retries > 0) {
            try {
                log('Sending rephrase request for text:', text);
                const [customPrompt, useCustomPrompt] = await Promise.all([
                    new Promise(resolve => chrome.storage.sync.get(['customPrompt'], result => resolve(result.customPrompt))),
                    new Promise(resolve => chrome.storage.sync.get(['useCustomPrompt'], result => resolve(result.useCustomPrompt)))
                ]);
                const response = await chrome.runtime.sendMessage({
                    action: 'rephrase',
                    text: text,
                    customPrompt: useCustomPrompt ? customPrompt : null
                });
                log('Received response:', response);
                if (response.error) {
                    throw new Error(response.error);
                }
                rephrasedTextArea.value = response.rephrasedText;
                updateCharCount(rephrasedTextArea);
                hideLoading();
                return;
            } catch (error) {
                console.warn('[WriteSharp] Error during rephrasing:', error);
                retries--;
                if (retries === 0) {
                    showError(error.message);
                    hideLoading();
                } else {
                    log(`Retrying... ${retries} attempts left`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                }
            }
        }
    }

    /**
     * Shows an error message
     * @param {string} message - The error message to display
     */
    function showError(message) {
        errorState.classList.remove('hidden');
        errorMessage.textContent = message;
        console.warn('[WriteSharp] Error:', message);
    }

    /**
     * Updates the character count for a textarea
     * @param {HTMLTextAreaElement} textarea - The textarea to update the character count for
     */
    function updateCharCount(textarea) {
        const charCount = textarea.value.length;
        const charCountEl = textarea.nextElementSibling;
        charCountEl.textContent = `${charCount}/${MAX_CHARS}`;

        if (charCount > MAX_CHARS) {
            textarea.value = textarea.value.slice(0, MAX_CHARS);
            charCountEl.style.color = 'red';
        } else {
            charCountEl.style.color = '';
        }
    }

    /**
     * Sends a message to the content script to apply the rephrased text
     * @param {number} tabId - The ID of the tab to send the message to
     * @param {string} text - The rephrased text to apply
     */
    function sendMessageToContentScript(tabId, text) {
        chrome.tabs.sendMessage(tabId, {
            action: 'applyRephrasedText',
            text: text
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[WriteSharp] Error sending message:', chrome.runtime.lastError);
                showError('Failed to apply text. Please refresh the page and try again.');
            } else if (response && response.error) {
                console.warn('[WriteSharp] Error from content script:', response.error);
                showError(response.error);
            } else {
                log('Message sent successfully, response:', response);
                window.close(); 
            }
        });
    }

    // Event listeners for buttons
    applyButton.addEventListener('click', () => {
        log('Apply button clicked');
        if (rephrasedTextArea.value.trim() === '') {
            showError('Cannot apply empty text. Please rephrase first.');
            return;
        }
        
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (chrome.runtime.lastError) {
                console.warn('[WriteSharp] Error querying tabs:', chrome.runtime.lastError);
                showError('An error occurred. Please try again.');
                return;
            }
            if (tabs.length === 0) {
                console.warn('[WriteSharp] No active tab found');
                showError('No active tab found. Please try again.');
                return;
            }
            const tabId = tabs[0].id;
            sendMessageToContentScript(tabId, rephrasedTextArea.value);
        });
    });
    
    editButton.addEventListener('click', () => {
        const isEditing = rephrasedTextArea.readOnly;
        rephrasedTextArea.readOnly = !isEditing;
        editButton.textContent = isEditing ? 'Save' : 'Edit';

        if (!isEditing) {
            rephrasedTextArea.focus();
        }
        log('Edit button clicked, isEditing:', !isEditing);
    });

    rephraseAgainButton.addEventListener('click', () => {
        log('Rephrase Again button clicked');
        rephrase(originalTextArea.value);
    });

    tryAgainButton.addEventListener('click', () => {
        console.log('Try Again button clicked');
        rephrase(originalTextArea.value);
    });

    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        log('Settings link clicked');
        log('Settings container display before:', settingsContainer.style.display);
        log('Settings container classList before:', settingsContainer.classList);

        if (settingsContainer.classList.contains('hidden')) {
            settingsContainer.classList.remove('hidden');
            settingsContainer.style.display = 'block';
        } else {
            settingsContainer.classList.add('hidden');
            settingsContainer.style.display = 'none';
        }

        log('Settings container display after:', settingsContainer.style.display);
        log('Settings container classList after:', settingsContainer.classList);
    });

    saveApiKeyButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (validateApiKey(apiKey)) {
            saveApiKeyButton.disabled = true;
            chrome.storage.sync.set({apiKey}, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[WriteSharp] Error saving API key:', chrome.runtime.lastError);
                    showMessage('Error saving API key. Please try again.', 'error');
                } else {
                    showMessage('API key saved successfully!', 'success');
                    setTimeout(() => {
                        settingsContainer.classList.add('hidden');
                        settingsContainer.style.display = 'none';
                    }, 2000);
                }
                saveApiKeyButton.disabled = false;
            });
        } else {
            showMessage('Invalid API key format. Please check and try again.', 'error');
        }
    });

    /**
     * Validates the format of the API key
     * @param {string} apiKey - The API key to validate
     * @returns {boolean} True if the API key is valid, false otherwise
     */
    function validateApiKey(apiKey) {
        return /^sk-[A-Za-z0-9_-]{48,98}$/.test(apiKey);
    }

    /**
     * Shows a message in the settings container
     * @param {string} message - The message to display
     * @param {string} type - The type of message ('error' or 'success')
     */
    function showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        settingsContainer.appendChild(messageElement);
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }

    // Event listeners for character count updates
    originalTextArea.addEventListener('input', () => updateCharCount(originalTextArea));
    rephrasedTextArea.addEventListener('input', () => updateCharCount(rephrasedTextArea));

    // Event listeners for closing the popup
    document.addEventListener('click', (e) => {
        if (e.target.closest('body') === null) {
            window.close();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.close();
        }
    });

    log('All event listeners and functions set up');
});