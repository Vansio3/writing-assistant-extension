// popup.js

// A comprehensive and alphabetized list of languages supported by the Web Speech API
const supportedLanguages = [
    { code: 'af-ZA', name: 'Afrikaans' },
    { code: 'ar-AE', name: 'العربية (الإمارات)' },
    { code: 'ar-SA', name: 'العربية (السعودية)' },
    { code: 'bg-BG', name: 'Български' },
    { code: 'ca-ES', name: 'Català' },
    { code: 'cs-CZ', name: 'Čeština' },
    { code: 'da-DK', name: 'Dansk' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'el-GR', name: 'Ελληνικά' },
    { code: 'en-AU', name: 'English (Australia)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'en-IN', name: 'English (India)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'es-ES', name: 'Español (España)' },
    { code: 'es-MX', name: 'Español (México)' },
    { code: 'fi-FI', name: 'Suomi' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'he-IL', name: 'עברית' },
    { code: 'hi-IN', name: 'हिन्दी' },
    { code: 'hu-HU', name: 'Magyar' },
    { code: 'id-ID', name: 'Bahasa Indonesia' },
    { code: 'is-IS', name: 'Íslenska' },
    { code: 'it-IT', name: 'Italiano' },
    { code: 'ja-JP', name: '日本語' },
    { code: 'ko-KR', name: '한국어' },
    { code: 'ms-MY', name: 'Bahasa Melayu' },
    { code: 'nb-NO', name: 'Norsk bokmål' },
    { code: 'nl-NL', name: 'Nederlands' },
    { code: 'pl-PL', name: 'Polski' },
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'pt-PT', name: 'Português (Portugal)' },
    { code: 'ro-RO', name: 'Română' },
    { code: 'ru-RU', name: 'Русский' },
    { code: 'sk-SK', name: 'Slovenčina' },
    { code: 'sr-RS', name: 'Српски' },
    { code: 'sv-SE', name: 'Svenska' },
    { code: 'th-TH', name: 'ไทย' },
    { code: 'tr-TR', name: 'Türkçe' },
    { code: 'uk-UA', name: 'Українська' },
    { code: 'vi-VN', name: 'Tiếng Việt' },
    { code: 'zh-CN', name: '中文 (简体)' },
    { code: 'zh-TW', name: '中文 (繁體)' }
];

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

  // Language selection element
  const languageSelect = document.getElementById('languageSelect');

  // Populate the language dropdown
  supportedLanguages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
  });

  // Function to check for API key and load content
  function checkApiKeyAndLoadContent() {
    chrome.storage.local.get(['geminiApiKey', 'totalCount', 'dailyCount', 'lastOriginalText', 'selectedLanguage'], (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        mainContent.style.display = 'block';
        
        dailyCountEl.textContent = result.dailyCount ?? 0;
        totalCountEl.textContent = result.totalCount ?? 0;
        lastOriginalTextEl.value = result.lastOriginalText ?? '';
        
        // Set the dropdown to the saved language, or default to 'en-US' if none is saved
        languageSelect.value = result.selectedLanguage || 'en-US';
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
        checkApiKeyAndLoadContent();
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

  // Event listener for language selection change
  languageSelect.addEventListener('change', () => {
    const selectedLanguage = languageSelect.value;
    chrome.storage.local.set({ selectedLanguage: selectedLanguage });
  });

  // Initial load
  checkApiKeyAndLoadContent();
});