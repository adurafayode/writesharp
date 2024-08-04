console.log('[TextRephraser] Selection script loaded');

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
    console.log('[TextRephraser] Text selection event triggered');
    const selectedText = window.getSelection().toString().trim();
    console.log('[TextRephraser] Selected text:', selectedText);
    if (selectedText) {
        showRephraseButton(selectedText);
    } else {
        hideRephraseButton();
    }
}

function createRephraseButton() {
    console.log('[TextRephraser] Creating rephrase button');
    const button = document.createElement('button');
    button.textContent = 'Rephrase';
    button.id = 'rephrase-button';
    button.className = 'rephrase-button';
    button.style.position = 'fixed';
    button.style.zIndex = '9999999';
    button.style.padding = '5px 10px';
    button.style.backgroundColor = '#4285f4';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.fontFamily = 'Arial, sans-serif';
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    document.body.appendChild(button);
    return button;
}

function showRephraseButton(selectedText) {
    console.log('[TextRephraser] Showing rephrase button');
    const button = document.getElementById('rephrase-button') || createRephraseButton();
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    button.style.top = `${rect.bottom + window.scrollY + 5}px`; // Added 5px offset
    button.style.left = `${rect.left + window.scrollX}px`;
    button.style.display = 'block';

    button.onclick = () => {
        console.log('[TextRephraser] Rephrase button clicked');
        copyToClipboard(selectedText);
        openPopup(selectedText);
    };
}

function hideRephraseButton() {
    console.log('[TextRephraser] Hiding rephrase button');
    const button = document.getElementById('rephrase-button');
    if (button) {
        button.style.display = 'none';
    }
}

function copyToClipboard(text) {
    console.log('[TextRephraser] Copying text to clipboard');
    navigator.clipboard.writeText(text).then(() => {
        console.log('[TextRephraser] Text copied to clipboard');
    }).catch(err => {
        console.error('[TextRephraser] Failed to copy text: ', err);
    });
}

function openPopup(selectedText) {
    console.log('[TextRephraser] Opening popup with text');
    chrome.runtime.sendMessage({
        action: 'openPopup',
        text: selectedText
    }, response => {
        console.log('[TextRephraser] Response from background:', response);
    });
}

const debouncedHandleTextSelection = debounce(handleTextSelection, 300);

document.addEventListener('selectionchange', debouncedHandleTextSelection);

// Observer for dynamic content
const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
        if (mutation.type === 'childList') {
            const addedNodes = mutation.addedNodes;
            for (let node of addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    node.addEventListener('mouseup', debouncedHandleTextSelection);
                }
            }
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });