// WriteSharp Background Script

const DEBUG = false;  // Set to true to enable debug logging
const BACKEND_URL = 'http://localhost:4000/api/rephrase';

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp] ${message}`, ...args);
    }
}

log('Background script loaded');

/**
 * Listener for extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  log('WriteSharp extension installed');
});

/**
 * Handles messages from content script and popup
 * Implements the 'rephrase' action for selected texts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Message received in background:', request);

  if (request.action === 'rephrase') {
    log('Rephrasing text:', request.text);
    chrome.storage.sync.get(['apiKey', 'customPrompt', 'useCustomPrompt'], async (result) => {
      if (!result.apiKey) {
        console.warn('[WriteSharp] API key not set');
        sendResponse({ error: 'API key not set. Please set your OpenAI API key in the extension settings.' });
        return;
      }

      try {
        log('Sending request to:', BACKEND_URL);
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': result.apiKey,
            'Origin': chrome.runtime.getURL(''),
          },
          body: JSON.stringify({ 
            text: request.text,
            customPrompt: result.useCustomPrompt ? result.customPrompt : null
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.warn('[WriteSharp] Error response:', data);
          sendResponse({ error: data.error || 'An unknown error occurred' });
          return;
        }

        log('Rephrased text:', data.rephrasedText);
        sendResponse({ rephrasedText: data.rephrasedText, status: 'Text rephrased' });
      } catch (error) {
        console.error('[WriteSharp] Error:', error);
        sendResponse({ error: error.message || 'An unknown error occurred' });
      }
    });

    return true; // Indicates that the response is sent asynchronously
  } 
});

/**
 * Tests the connection to the backend server
 * @returns {Promise<boolean>} True if the connection is successful, false otherwise
 */
async function testServerConnection() {
  try {
      const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
          log('Server connection test successful');
          return true;
      } else {
          console.warn('[WriteSharp] Server connection test failed:', response.statusText);
          return false;
      }
  } catch (error) {
      console.warn('[WriteSharp] Server connection test failed:', error);
      return false;
  }
}

// We can call this function when needed, for example:
// chrome.runtime.onInstalled.addListener(async () => {
//     log('WriteSharp extension installed');
//     await testServerConnection();
// });