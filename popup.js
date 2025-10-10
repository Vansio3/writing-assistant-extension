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

// New: Options for style and length
const outputStyles = [
    { value: 'default', name: 'Default' },
    { value: 'professional', name: 'Professional' },
    { value: 'friendly', name: 'Friendly' },
    { value: 'casual', name: 'Casual' },
    { value: 'technical', name: 'Technical' },
    { value: 'creative', name: 'Creative' }
];

const outputLengths = [
    { value: 'default', name: 'Default' },
    { value: 'shorter', name: 'Shorter' },
    { value: 'longer', name: 'Longer' }
];

document.addEventListener('DOMContentLoaded', () => {
  // Main content elements
  const dailyCountEl = document.getElementById('dailyCount');
  const totalCountEl = document.getElementById('totalCount');
  const lastOriginalTextEl = document.getElementById('lastOriginalText');
  const copyButton = document.getElementById('copyButton');
  const mainContent = document.getElementById('mainContent'); // Right column
  const middleColumn = document.getElementById('middleColumn'); // Middle column
  const apiUsageSection = document.getElementById('apiUsageSection');

  // API Key elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyButton = document.getElementById('saveApiKeyButton');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  // Setting elements
  const languageSelect = document.getElementById('languageSelect');
  const outputStyleSelect = document.getElementById('outputStyleSelect');
  const outputLengthSelect = document.getElementById('outputLengthSelect');
  const aiProcessingToggle = document.getElementById('aiProcessingToggle');
  const soundToggle = document.getElementById('soundToggle');

  // Function to populate select dropdowns
  function populateSelect(element, options) {
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value || opt.code;
      option.textContent = opt.name;
      element.appendChild(option);
    });
  }
  
  // Populate the dropdowns
  populateSelect(languageSelect, supportedLanguages);
  populateSelect(outputStyleSelect, outputStyles);
  populateSelect(outputLengthSelect, outputLengths);

  // MODIFIED Function to check for API key and load content
  function checkApiKeyAndLoadContent() {
    const storageKeys = [
      'geminiApiKey', 'totalCount', 'dailyCount', 'lastOriginalText', 
      'selectedLanguage', 'outputStyle', 'outputLength', 'aiProcessingEnabled',
      'soundEnabled'
    ];

    chrome.storage.local.get(storageKeys, (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        mainContent.style.display = 'flex'; // Show right column
        middleColumn.style.display = 'flex'; // Show middle column
        apiUsageSection.style.display = 'block';
        
        dailyCountEl.textContent = result.dailyCount ?? 0;
        totalCountEl.textContent = result.totalCount ?? 0;
        lastOriginalTextEl.value = result.lastOriginalText ?? '';
        
        // Set controls to saved values or defaults
        languageSelect.value = result.selectedLanguage || 'en-US';
        outputStyleSelect.value = result.outputStyle || 'default';
        outputLengthSelect.value = result.outputLength || 'default';
        aiProcessingToggle.checked = result.aiProcessingEnabled !== false; // Default to true
        soundToggle.checked = result.soundEnabled !== false; // Default to true
      } else {
        mainContent.style.display = 'none';
        middleColumn.style.display = 'none'; // Hide middle column
        apiUsageSection.style.display = 'none';
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
        setTimeout(() => { copyButton.textContent = 'Copy Text'; }, 2000);
      });
    }
  });

  // Generic event listener for settings changes
  function addSettingChangeListener(element, key) {
    const eventType = element.type === 'checkbox' ? 'change' : 'change';
    const valueProperty = element.type === 'checkbox' ? 'checked' : 'value';

    element.addEventListener(eventType, () => {
      chrome.storage.local.set({ [key]: element[valueProperty] });
    });
  }

  addSettingChangeListener(languageSelect, 'selectedLanguage');
  addSettingChangeListener(outputStyleSelect, 'outputStyle');
  addSettingChangeListener(outputLengthSelect, 'outputLength');
  addSettingChangeListener(aiProcessingToggle, 'aiProcessingEnabled');
  addSettingChangeListener(soundToggle, 'soundEnabled');

  // Initial load
  checkApiKeyAndLoadContent();
});