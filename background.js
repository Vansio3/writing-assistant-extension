// background.js

import { GEMINI_MODEL } from './config.js';
import { createPrompt } from './prompt.js';

// --- CONTEXT MENU ---
const setupContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "gemini-rewrite",
      title: "Process with Gemini",
      contexts: ["selection"]
    });
  });
};

chrome.runtime.onInstalled.addListener((details) => {
  // On first install, open a welcome page
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome.html' });
  }
  setupContextMenu();
});
chrome.runtime.onStartup.addListener(setupContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gemini-rewrite") {
    chrome.tabs.sendMessage(tab.id, { command: "process-text" });
  }
});

// --- KEYBOARD SHORTCUTS ---
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab || (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com/")))) {
    return; // Ignore invalid tabs
  }
  
  // Content script is already injected via manifest.json, so we just send the message.
  if (command === "generate-text") {
    chrome.tabs.sendMessage(tab.id, { command: "process-text" });
  } else if (command === "dictate-and-process") {
    chrome.tabs.sendMessage(tab.id, { command: "toggle-dictation" });
  }
});

// --- MAIN API LOGIC ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.prompt) {
    handlePromptRequest(request).then(sendResponse);
  } else if (request.command === 'check-api-key') {
    chrome.storage.local.get('geminiApiKey', (result) => {
      sendResponse({ apiKeyExists: !!result.geminiApiKey });
    });
  }
  return true;
});

async function handlePromptRequest(request) {
  try {
    const storageKeys = [
      'geminiApiKey', 'selectedLanguage', 'outputStyle', 
      'outputLength', 'aiProcessingEnabled', 'customOutputStyle',
      'originalInputsHistory'
    ];
    const settings = await chrome.storage.local.get(storageKeys);

    if (!settings.geminiApiKey) {
      return { error: "API key not set. Please set it in the extension's popup." };
    }
    
    const apiKey = atob(settings.geminiApiKey);

    const history = settings.originalInputsHistory || [];
    history.unshift(request.prompt);
    const updatedHistory = history.slice(0, 20); 
    await chrome.storage.local.set({ originalInputsHistory: updatedHistory });

    if (request.bypassAi === true || settings.aiProcessingEnabled === false) {
      return { generatedText: request.prompt.trim() + ' ' };
    }
    
    const finalPrompt = createPrompt(
      request.prompt,
      settings.selectedLanguage || 'en-US',
      request.style || settings.outputStyle || 'default',
      settings.outputLength || 'default',
      settings.customOutputStyle
    );

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey 
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        const errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
        return { error: errorMessage };
    }
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      return { error: "Invalid response structure from API." };
    }

    const sanitizedText = generatedText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const finalText = sanitizedText.trim() + ' ';

    await updateApiCallCount();
    return { generatedText: finalText };

  } catch (error) {
    console.error("Error in handlePromptRequest:", error);
    let errorMessage = `Failed to generate text: ${error.message}`;
    if (error.message.includes('API key not valid')) {
      errorMessage = 'The saved API key is invalid. Please update it in the popup.';
    }
    return { error: errorMessage };
  }
}

async function updateApiCallCount() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(['totalCount', 'dailyCount', 'lastCallDate']);
  
  let { totalCount = 0, dailyCount = 0, lastCallDate } = result;
  totalCount++;
  dailyCount = (lastCallDate === today) ? dailyCount + 1 : 1;
  
  await chrome.storage.local.set({ totalCount, dailyCount, lastCallDate: today });
}