// src/popup.js

console.log('popup.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');

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

    const MAX_CHARS = 500;

    // Ensure settings container starts hidden
    settingsContainer.classList.add('hidden');
    settingsContainer.style.display = 'none';

    console.log('Initial DOM state:');
    console.log('Settings link:', settingsLink);
    console.log('Settings container:', settingsContainer);
    console.log('Settings container display:', settingsContainer.style.display);
    console.log('Settings container classList:', settingsContainer.classList);

    if (!settingsLink) {
        console.error('Settings link not found in the DOM');
    }

    if (!settingsContainer) {
        console.error('Settings container not found in the DOM');
    }

    // Load selected text and API key
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

    chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    });

    // Add listener for updateSelectedText message
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Message received in popup:', request);
        if (request.action === 'updateSelectedText') {
            console.log('Updating selected text in popup:', request.text);
            originalTextArea.value = request.text;
            updateCharCount(originalTextArea);
            sendResponse({status: 'Text updated in popup'});
        }
        return true; // Keeps the message channel open for asynchronous responses
    });

    function showLoading() {
        console.log('Showing loading state');
        if (loadingState) {
            loadingState.classList.remove('hidden');
        } else {
            console.error('Loading state element not found');
        }
        if (errorState) {
            errorState.classList.add('hidden');
        }
    }

    function hideLoading() {
        console.log('Hiding loading state');
        if (loadingState) {
            loadingState.classList.add('hidden');
        } else {
            console.error('Loading state element not found');
        }
    }

    async function rephrase(text) {
        showLoading();
        let retries = 3;
        while (retries > 0) {
            try {
                console.log('Sending rephrase request for text:', text);
                const response = await chrome.runtime.sendMessage({
                    action: 'rephrase',
                    text: text
                });
                console.log('Received response:', response);
                if (response.error) {
                    throw new Error(response.error);
                }
                rephrasedTextArea.value = response.rephrasedText;
                updateCharCount(rephrasedTextArea);
                hideLoading();
                return;
            } catch (error) {
                console.error('Error during rephrasing:', error);
                retries--;
                if (retries === 0) {
                    showError(error.message);
                    hideLoading();
                } else {
                    console.log(`Retrying... ${retries} attempts left`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                }
            }
        }
    }

    function showError(message) {
        errorState.classList.remove('hidden');
        errorMessage.textContent = message;
        console.error('Showing error:', message);
    }

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

    applyButton.addEventListener('click', () => {
        console.log('Apply button clicked');
        if (rephrasedTextArea.value.trim() === '') {
            showError('Cannot apply empty text. Please rephrase first.');
            return;
        }
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'applyRephrasedText',
                text: rephrasedTextArea.value
            });
        });
        window.close();
    });

    editButton.addEventListener('click', () => {
        const isEditing = rephrasedTextArea.readOnly;
        rephrasedTextArea.readOnly = !isEditing;
        editButton.textContent = isEditing ? 'Save' : 'Edit';

        if (!isEditing) {
            rephrasedTextArea.focus();
        }
        console.log('Edit button clicked, isEditing:', !isEditing);
    });

    rephraseAgainButton.addEventListener('click', () => {
        console.log('Rephrase Again button clicked');
        rephrase(originalTextArea.value);
    });

    tryAgainButton.addEventListener('click', () => {
        console.log('Try Again button clicked');
        rephrase(originalTextArea.value);
    });

    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Settings link clicked');
        console.log('Settings container display before:', settingsContainer.style.display);
        console.log('Settings container classList before:', settingsContainer.classList);

        if (settingsContainer.classList.contains('hidden')) {
            settingsContainer.classList.remove('hidden');
            settingsContainer.style.display = 'block';
        } else {
            settingsContainer.classList.add('hidden');
            settingsContainer.style.display = 'none';
        }

        console.log('Settings container display after:', settingsContainer.style.display);
        console.log('Settings container classList after:', settingsContainer.classList);
    });

    saveApiKeyButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (validateApiKey(apiKey)) {
            saveApiKeyButton.disabled = true;
            chrome.storage.sync.set({apiKey}, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving API key:', chrome.runtime.lastError);
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

    function validateApiKey(apiKey) {
        return /^sk-[A-Za-z0-9_-]{48,98}$/.test(apiKey);
    }

    function showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        settingsContainer.appendChild(messageElement);
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }

    originalTextArea.addEventListener('input', () => updateCharCount(originalTextArea));
    rephrasedTextArea.addEventListener('input', () => updateCharCount(rephrasedTextArea));

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

    window.toggleSettings = () => {
        console.log('Manual toggle triggered');
        if (settingsContainer.classList.contains('hidden')) {
            settingsContainer.classList.remove('hidden');
            settingsContainer.style.display = 'block';
        } else {
            settingsContainer.classList.add('hidden');
            settingsContainer.style.display = 'none';
        }
        console.log('Settings container display after manual toggle:', settingsContainer.style.display);
        console.log('Settings container classList after manual toggle:', settingsContainer.classList);
    };

    console.log('All event listeners and functions set up');
});