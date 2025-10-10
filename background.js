// background.js

import { GEMINI_MODEL } from './config.js';
import { createPrompt } from './prompt.js';

// --- CONTEXT MENU IMPLEMENTATION ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gemini-rewrite",
    title: "Process with Gemini",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gemini-rewrite") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, { command: "process-text" });
    }).catch(err => console.error(err));
  }
});

let isRecording = false;

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com/")))) {
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      if (command === "generate-text") {
        chrome.tabs.sendMessage(tab.id, { command: "process-text" });
      } else if (command === "dictate-and-process") {
        isRecording = !isRecording;
        chrome.tabs.sendMessage(tab.id, { command: "toggle-dictation", start: isRecording });
      }
    }).catch(err => console.error("Script injection or messaging failed:", err));
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "reset-recording-state") {
    isRecording = false;
    sendResponse({ success: true });
    return;
  }
  
  if (request.prompt) {
    chrome.storage.local.get('geminiApiKey', (result) => {
      const GEMINI_API_KEY = result.geminiApiKey;

      if (!GEMINI_API_KEY) {
        sendResponse({ error: "API key not set. Please set it in the extension's popup." });
        return;
      }

      chrome.storage.local.set({ lastOriginalText: request.prompt });
      const finalPrompt = createPrompt(request.prompt);

      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates || !data.candidates[0].content.parts[0].text) throw new Error("Invalid response from API.");
        
        updateApiCallCount(); 
        const generatedText = data.candidates[0].content.parts[0].text;
        sendResponse({ generatedText: generatedText });
      })
      .catch(error => {
        console.error("Error with Gemini API:", error);
        let friendlyError = error.message.includes('API key not valid') 
          ? 'The saved API key is invalid. Please update it in the popup.'
          : `Failed to generate text: ${error.message}`;
        sendResponse({ error: friendlyError });
      });
    });
  }
  return true; // Indicates asynchronous response
});

function updateApiCallCount() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['totalCount', 'dailyCount', 'lastCallDate'], (result) => {
    let { totalCount = 0, dailyCount = 0, lastCallDate } = result;
    totalCount++;
    if (lastCallDate === today) {
      dailyCount++;
    } else {
      dailyCount = 1;
    }
    chrome.storage.local.set({ totalCount, dailyCount, lastCallDate: today });
  });
}