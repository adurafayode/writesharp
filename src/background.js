// WriteSharp Background Script

// Debug logging function
const DEBUG = false; // Set to true for debugging selection issues
function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp:BG] ${message}`, ...args);
    }
}

log('Background script loaded');

// OpenAI API endpoint - public default (configurable via storage in future)
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Rate limiting configuration
const MAX_REQUESTS_PER_MINUTE = 60;
const REQUEST_INTERVAL = 60 * 1000; // 1 minute in milliseconds
let requestCount = 0;
let lastResetTime = Date.now();

// Maximum text length allowed for rephrasing
const MAX_TEXT_LENGTH = 2000;

/**
 * Listener for extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  log('WriteSharp extension installed');
  
  // Inject content scripts into all existing tabs where our extension has permission
  injectContentScriptsInExistingTabs();
});

/**
 * Injects content scripts into all existing tabs to avoid page refresh requirements
 */
function injectContentScriptsInExistingTabs() {
  log('Injecting content scripts into existing tabs');
  
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      // Skip invalid tabs or ones that don't have proper URL
      if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) {
        continue;
      }
      
      // Check for permissions before injection
      try {
        log('Injecting scripts into tab:', tab.id, tab.url);
        
        // Inject content.js first
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content.js']
        }).then(() => {
          // Then inject zendesk-handler.js
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/zendesk-handler.js']
          }).catch(error => {
            log('Error injecting zendesk-handler.js into existing tab:', error);
          });
        }).catch(error => {
          log('Error injecting content.js into existing tab:', error);
        });
      } catch (error) {
        log('Error during script injection:', error);
      }
    }
  });
}

/**
 * Message listener for handling requests from content scripts or popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Message received in background:', request);

  // Handle rephrase requests
  if (request.action === 'rephrase') {
    console.log("=== BACKGROUND REPHRASE REQUEST ===");
    console.log("Text to rephrase:", request.text ? request.text.substring(0, 50) + "..." : "none");
    console.log("HTML provided:", request.html ? "yes" : "no");
    console.log("Formatting info provided:", request.formatting ? "yes" : "no");
    console.log("Model requested:", request.model || "default");
    
    // This is critically important - need to return true to keep message port open
    (async () => {
      try {
        // Get the API key from storage
        const data = await getStoredSettings();
        
        if (!data.apiKey) {
          sendResponse({error: 'API key not found. Please set your API key in the settings.'});
          return;
        }
        
        const customPrompt = data.useCustomPrompt ? data.customPrompt : null;
        
        // Use the model specified in the request, or use the stored model, or default to 'gpt-4o'
        const model = request.model || data.model || 'gpt-4o';
        
        // Call the OpenAI API to rephrase the text
        const rephrasedText = await callOpenAIAPI(
          data.apiKey, 
          request.text, 
          request.html, 
          request.formatting, 
          customPrompt,
          model
        );
        
        // Send the rephrased text back to the popup
        sendResponse({rephrasedText: rephrasedText, status: 'Text rephrased'});
      } catch (error) {
        console.error('Error rephrasing text:', error);
        sendResponse({error: error.message || 'An error occurred while rephrasing'});
      }
    })();
    
    return true; // Keep the message channel open for the async response
  }

  // Handle Zendesk related messages and applyRephrasedText forwarding
  if (request.action === 'zendeskHandleSelection' || 
      request.action === 'zendeskInsertText' ||
      request.action === 'applyRephrasedText') {
      
    log('Handling message action:', request.action);
    
    // For Zendesk-specific actions, we need to route to the appropriate tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        
        // Keep track of the original sender to route the response back
        const originalSender = sender.tab ? sender.tab.id : null;
        const originalSendResponse = sendResponse;
        
        log('Forwarding message to tab:', tabId, 'Message:', request);
        
        // Special case for selection notification which doesn't need a response
        if (request.action === 'zendeskHandleSelection') {
          // Simply forward the message without expecting a response
          chrome.tabs.sendMessage(tabId, request);
          return;
        }
        
        // For other actions, wait for a response
        chrome.tabs.sendMessage(tabId, request, (response) => {
          log('Got response from content script:', response);
          
          // Send the response back to the original caller
          if (originalSendResponse) {
            originalSendResponse(response);
          }
        });
      } else {
        log('No active tab found to forward message');
        sendResponse({ error: 'No active tab found' });
      }
    });
    
    // For zendeskHandleSelection, we don't need to keep the channel open
    if (request.action === 'zendeskHandleSelection') {
      return false;
    }
    
    return true; // Keep the message channel open for other async responses
  }
});

/**
 * Gets the stored settings from Chrome storage
 * @returns {Promise<Object>} Object containing stored settings
 */
function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'customPrompt', 'useCustomPrompt', 'model'], (result) => {
      resolve(result);
    });
  });
}

/**
 * Checks if the current request is within the rate limit
 * @returns {boolean} True if within rate limit, false otherwise
 */
function checkRateLimit() {
  const now = Date.now();
  if (now - lastResetTime > REQUEST_INTERVAL) {
    requestCount = 0;
    lastResetTime = now;
  }
  
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  requestCount++;
  return true;
}

// System prompt for the OpenAI API (neutral, public-friendly)
const systemPrompt = `You are WriteSharp, an AI assistant that improves clarity and tone while preserving meaning.

GUIDELINES:
- Maintain a personable, professional tone.
- Prefer clear, direct, action-oriented language.
- Keep the original meaning and factual details intact.

PROCESSING RULES (take precedence over any custom prompt):
- Do NOT add new information or remove essential details.
- Preserve technical references, identifiers, and numbers exactly.
- Maintain list and paragraph structure where present.
- Fix grammar and spelling while keeping language simple and accessible.`;

// Default user prompt for the OpenAI API
const defaultUserPrompt = `Improve this text while:

- Maintaining the EXACT same content and meaning
- Keeping the EXACT same paragraphs and structure
- Focusing ONLY on improving clarity and tone
- NEVER adding greetings, signatures, or content not in the original

Input text:
`;

/**
 * Calls the OpenAI API to rephrase the given text
 * @param {string} apiKey - The API key
 * @param {string} text - The text to rephrase
 * @param {string|null} html - The HTML version of the text (if available)
 * @param {Object|null} formatting - Formatting information from content script
 * @param {string|null} customPrompt - Custom prompt to use for rephrasing, if any
 * @param {string|null} model - Model to use for rephrasing, defaults to gpt-4o
 * @returns {Promise<string>} The rephrased text
 */
async function callOpenAIAPI(apiKey, text, html, formatting, customPrompt, model = 'gpt-4o') {
  console.log("=== LLM INPUT STAGE ===");
  console.log("Original Text:", text);
  console.log("Original HTML:", html);
  console.log("Formatting info:", formatting);
  console.log("Selected model:", model);

  // Use the basic system prompt - our tests showed explicit formatting isn't necessary
  let enhancedSystemPrompt = systemPrompt;
  
  /* Commenting out enhanced formatting as our tests showed basic prompt is sufficient
  // Add formatting details to the system prompt instead of user message
  if (formatting) {
    // Add bold elements if available
    if (formatting.boldElements && formatting.boldElements.length > 0) {
      enhancedSystemPrompt += "\n\nThe following elements should be kept bold in your response:\n" + 
        formatting.boldElements.map(el => `- "${el}"`).join("\n");
    }
    
    // Add italic elements if available
    if (formatting.italicElements && formatting.italicElements.length > 0) {
      enhancedSystemPrompt += "\n\nThe following elements should be kept italicized in your response:\n" + 
        formatting.italicElements.map(el => `- "${el}"`).join("\n");
    }
    
    // Add information about bulleted lists if they exist
    if (formatting.hasBulletedList && formatting.listItems && formatting.listItems.length > 0) {
      enhancedSystemPrompt += "\n\nThe original text contains a bulleted list - preserve this structure.";
    }
    
    // Add information about numbered lists if they exist
    if (formatting.hasNumberedList && formatting.listItems && formatting.listItems.length > 0) {
      enhancedSystemPrompt += "\n\nThe original text contains a numbered list - preserve this structure.";
    }
    
    // Add information about term-definition pairs if they exist
    if (formatting.termDefinitions && formatting.termDefinitions.length > 0) {
      enhancedSystemPrompt += "\n\nThe original text contains term-definition pairs - preserve this format.";
    }
  }
  */

  // Create the system message with all formatting guidance
  const systemMessage = {
    role: "system",
    content: enhancedSystemPrompt
  };

  // Keep the user message clean and simple - no formatting instructions
  const userMessage = customPrompt
    ? `${customPrompt}\n\nInput text:\n\n${text}`
    : `${defaultUserPrompt}\n\n${text}`;

  // Debug: Log what's being sent to the LLM
  console.log("Complete prompt to LLM:", userMessage);
  console.log("System prompt includes formatting guidance:", systemMessage.content.length > systemPrompt.length);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        systemMessage,
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || JSON.stringify(error)}`);
  }

  const data = await response.json();
  
  // Debug: Log what we got back from the LLM
  console.log("=== LLM OUTPUT STAGE ===");
  console.log("Raw LLM response:", data.choices[0].message.content);

  return data.choices[0].message.content;
}