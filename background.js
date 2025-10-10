// background.js

import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';
import { createPrompt } from './prompt.js';

// --- START: CONTEXT MENU IMPLEMENTATION ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gemini-rewrite",
    title: "Process with Gemini",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gemini-rewrite") {
    // Inject script, then send a message to process the text
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, { command: "process-text" });
    }).catch(err => console.error(err));
  }
});
// --- END: CONTEXT MENU IMPLEMENTATION ---

let isRecording = false;

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    
    // Prevent injection on special Chrome pages
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com/"))) {
      return;
    }

    // Always inject the script first to ensure it's ready to receive messages
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      // After injection, send the appropriate command
      if (command === "generate-text") {
        chrome.tabs.sendMessage(tab.id, { command: "process-text" });
      } else if (command === "dictate-and-process") {
        isRecording = !isRecording;
        chrome.tabs.sendMessage(tab.id, {
          command: "toggle-dictation",
          start: isRecording
        });
      }
    }).catch(err => console.error("Script injection or messaging failed:", err));
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.prompt) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      sendResponse({ error: "API key not set. Please update config.js" });
      return true;
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
      sendResponse({ error: `Failed to generate text: ${error.message}` });
    });
  }
  return true;
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
    chrome.storage.local.set({
      totalCount: totalCount,
      dailyCount: dailyCount,
      lastCallDate: today
    });
  });
}