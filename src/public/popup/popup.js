document.addEventListener('DOMContentLoaded', () => {
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
  
    chrome.storage.local.get(['selectedText'], (result) => {
      if (result.selectedText) {
        originalTextArea.value = result.selectedText;
        updateCharCount(originalTextArea);
        rephrase(result.selectedText);
      }
    });
  
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    });
  
    async function rephrase(text) {
      showLoading();
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'rephrase',
          text: text
        });
        if (response.error) {
          throw new Error(response.error);
        }
        rephrasedTextArea.value = response.rephrasedText;
        updateCharCount(rephrasedTextArea);
        hideLoading();
      } catch (error) {
        console.error('Error:', error);
        showError(error.message, determineErrorType(error));
      }
    }
  
    function showLoading() {
      loadingState.classList.remove('hidden');
      errorState.classList.add('hidden');
    }
  
    function hideLoading() {
      loadingState.classList.add('hidden');
    }
  
    function showError(message, type = 'generic') {
      errorState.classList.remove('hidden');
      loadingState.classList.add('hidden');
      
      switch (type) {
        case 'network':
          errorMessage.textContent = 'Network error: Please check your internet connection and try again.';
          break;
        case 'api':
          errorMessage.textContent = 'Server error: Our rephrasing service is currently unavailable. Please try again later.';
          break;
        case 'input':
          errorMessage.textContent = 'Input error: Please provide valid text to rephrase.';
          break;
        default:
          errorMessage.textContent = message || 'An unexpected error occurred. Please try again.';
      }
    }
  
    function determineErrorType(error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return 'network';
      } else if (error.status === 500) {
        return 'api';
      } else {
        return 'generic';
      }
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
    });
  
    rephraseAgainButton.addEventListener('click', () => {
      rephrase(originalTextArea.value);
    });
  
    tryAgainButton.addEventListener('click', () => {
      rephrase(originalTextArea.value);
    });
  
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      settingsContainer.classList.toggle('hidden');
    });
  
    saveApiKeyButton.addEventListener('click', () => {
      const apiKey = apiKeyInput.value;
      chrome.storage.sync.set({apiKey}, () => {
        alert('API key saved');
        settingsContainer.classList.add('hidden');
      });
    });
  
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
  });
  