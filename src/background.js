chrome.runtime.onInstalled.addListener(() => {
    console.log('Text Rephraser extension installed');
  });
  
  const BACKEND_URL = 'https://your-backend-url.com/api/rephrase';
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
      chrome.storage.local.set({ selectedText: request.text }, () => {
        chrome.action.openPopup();
      });
      sendResponse({status: 'Popup opened'});
    } else if (request.action === 'showRephraseButton') {
      console.log('Show rephrase button:', request.text);
      chrome.storage.local.set({ selectedText: request.text });
      chrome.action.setIcon({ path: "icons/icon-active.png" });
      sendResponse({status: 'Rephrase button shown'});
    } else if (request.action === 'rephrase') {
      chrome.storage.sync.get(['apiKey'], async (result) => {
        if (!result.apiKey) {
          sendResponse({error: 'API key not set. Please set your OpenAI API key in the extension settings.'});
          return;
        }
  
        try {
          const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': result.apiKey
            },
            body: JSON.stringify({ text: request.text }),
          });
  
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
  
          const data = await response.json();
          sendResponse({rephrasedText: data.rephrasedText, status: 'Text rephrased'});
        } catch (error) {
          console.error('Error:', error);
          sendResponse({error: 'Failed to rephrase text. Please try again.'});
        }
      });
  
      return true; // Indicates that the response is sent asynchronously
    }
    return true; // Keeps the message channel open for asynchronous responses
  });
  