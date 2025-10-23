// welcome.js

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyButton = document.getElementById('saveApiKeyButton');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      // Obfuscate the API key before storing it
      const obfuscatedKey = btoa(apiKey);
      chrome.storage.local.set({ geminiApiKey: obfuscatedKey }, () => {
        apiKeyStatus.textContent = 'API Key saved successfully! You may now close this page.';
        apiKeyStatus.style.color = '#FFBF00';
      });
    } else {
      apiKeyStatus.textContent = 'Please enter a valid API key.';
      apiKeyStatus.style.color = '#f23f43';
    }
  });
});