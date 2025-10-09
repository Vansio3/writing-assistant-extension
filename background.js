// background.js

import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';
import { createPrompt } from './prompt.js';

chrome.commands.onCommand.addListener((command) => {
  if (command === "generate-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const activeTab = tabs[0];
      if (activeTab.url && (activeTab.url.startsWith("chrome://") || activeTab.url.startsWith("https://chrome.google.com/"))) {
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"]
      }).catch(err => console.error("Failed to inject content script:", err));
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.prompt) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      sendResponse({ error: "API key not set. Please update config.js" });
      return true;
    }

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
      
      // ---- START: NEW COUNTING LOGIC ----
      updateApiCallCount(); 
      // ---- END: NEW COUNTING LOGIC ----

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

// ---- START: NEW COUNTING FUNCTION ----
function updateApiCallCount() {
  const today = new Date().toISOString().split('T')[0]; // Get date in YYYY-MM-DD format

  chrome.storage.local.get(['totalCount', 'dailyCount', 'lastCallDate'], (result) => {
    let { totalCount = 0, dailyCount = 0, lastCallDate } = result;

    // Increment total count
    totalCount++;

    // Check if it's a new day to reset the daily count
    if (lastCallDate === today) {
      dailyCount++;
    } else {
      dailyCount = 1; // Reset for the new day
    }
    
    // Save the updated values
    chrome.storage.local.set({
      totalCount: totalCount,
      dailyCount: dailyCount,
      lastCallDate: today
    });
  });
}
// ---- END: NEW COUNTING FUNCTION ----