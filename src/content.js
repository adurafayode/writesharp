function addSelectionListener(element) {
    element.addEventListener('mouseup', handleTextSelection);
  }
  
  function handleTextSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        action: 'showRephraseButton',
        text: selectedText
      });
    }
  }
  
  addSelectionListener(document);
  
  function addListenersToIframes() {
    const iframes = document.getElementsByTagName('iframe');
    for (let iframe of iframes) {
      try {
        addSelectionListener(iframe.contentDocument);
      } catch (e) {
        console.log('Cannot access iframe:', e);
      }
    }
  }
  
  addListenersToIframes();
  
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        addListenersToIframes();
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applyRephrasedText') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(request.text));
      }
      sendResponse({status: 'Rephrased text applied'});
    }
    return true; // Keeps the message channel open for asynchronous responses
  });
  