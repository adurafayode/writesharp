console.log('[TextRephraser] Background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TextRephraser] Text Rephraser extension installed');
});

const BACKEND_URL = 'http://localhost:4000/api/rephrase';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[TextRephraser] Message received in background:', request);

  if (request.action === 'rephrase') {
    console.log('[TextRephraser] Rephrasing text:', request.text);
    chrome.storage.sync.get(['apiKey'], async (result) => {
      if (!result.apiKey) {
        console.error('[TextRephraser] API key not set');
        sendResponse({ error: 'API key not set. Please set your OpenAI API key in the extension settings.' });
        return;
      }

      try {
        console.log('[TextRephraser] Sending request to:', BACKEND_URL);
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': result.apiKey,
            'Origin': chrome.runtime.getURL(''),
          },
          body: JSON.stringify({ text: request.text }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('[TextRephraser] Error response:', data);
          sendResponse({ error: data.error || 'An unknown error occurred' });
          return;
        }

        console.log('[TextRephraser] Rephrased text:', data.rephrasedText);
        sendResponse({ rephrasedText: data.rephrasedText, status: 'Text rephrased' });
      } catch (error) {
        console.error('[TextRephraser] Error:', error);
        sendResponse({ error: error.message || 'An unknown error occurred' });
      }
    });

    return true; // Indicates that the response is sent asynchronously
  }
  // ... (rest of the listener code)
});

// Test server connection
fetch('http://localhost:4000/api/rephrase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Test' }),
})
  .then(response => response.json())
  .then(data => console.log('[TextRephraser] Server test:', data))
  .catch(error => console.error('[TextRephraser] Server test failed:', error));
