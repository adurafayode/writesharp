function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  function handleTextSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      showRephraseButton(selectedText);
    } else {
      hideRephraseButton();
    }
  }
  
  function createRephraseButton() {
    const button = document.createElement('button');
    button.textContent = 'Rephrase';
    button.id = 'rephrase-button';
    button.className = 'rephrase-button';
    document.body.appendChild(button);
    return button;
  }
  
  function showRephraseButton(selectedText) {
    const button = document.getElementById('rephrase-button') || createRephraseButton();
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    button.style.top = `${window.scrollY + rect.bottom}px`;
    button.style.left = `${window.scrollX + rect.left}px`;
    button.style.display = 'block';
    
    button.onclick = () => {
      copyToClipboard(selectedText);
      openPopup(selectedText);
    };
  }
  
  function hideRephraseButton() {
    const button = document.getElementById('rephrase-button');
    if (button) {
      button.style.display = 'none';
    }
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Text copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }
  
  function openPopup(selectedText) {
    chrome.runtime.sendMessage({
      action: 'openPopup',
      text: selectedText
    });
  }
  
  const debouncedHandleTextSelection = debounce(handleTextSelection, 300);
  
  document.addEventListener('selectionchange', debouncedHandleTextSelection);
  window.addEventListener('load', addListenersToIframes);
  
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        addListenersToIframes();
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  function addListenersToIframes() {
    const iframes = document.getElementsByTagName('iframe');
    for (let iframe of iframes) {
      try {
        iframe.contentDocument.addEventListener('selectionchange', debouncedHandleTextSelection);
      } catch (e) {
        console.log('Cannot access iframe:', e);
      }
    }
  }
  