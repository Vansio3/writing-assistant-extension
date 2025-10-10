// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Main content elements
  const dailyCountEl = document.getElementById('dailyCount');
  const totalCountEl = document.getElementById('totalCount');
  const lastOriginalTextEl = document.getElementById('lastOriginalText');
  const copyButton = document.getElementById('copyButton');
  const mainContent = document.getElementById('mainContent');

  // API Key elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyButton = document.getElementById('saveApiKeyButton');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  // Function to check for API key and update UI accordingly
  function checkApiKeyAndLoadContent() {
    chrome.storage.local.get(['geminiApiKey', 'totalCount', 'dailyCount', 'lastOriginalText'], (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        mainContent.style.display = 'block';
        
        // Populate stats and last text
        dailyCountEl.textContent = result.dailyCount ?? 0;
        totalCountEl.textContent = result.totalCount ?? 0;
        lastOriginalTextEl.value = result.lastOriginalText ?? '';
      } else {
        mainContent.style.display = 'none';
      }
    });
  }

  // Event listener to save the API key
  saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        apiKeyStatus.textContent = 'API Key saved!';
        setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
        checkApiKeyAndLoadContent(); // Re-check to show main content
      });
    } else {
      apiKeyStatus.textContent = 'Please enter a valid key.';
      setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
    }
  });

  // Event listener for the copy button
  copyButton.addEventListener('click', () => {
    const textToCopy = lastOriginalTextEl.value;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
      });
    }
  });

  // Initial load
  checkApiKeyAndLoadContent();
});