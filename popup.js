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
    { value: 'creative', name: 'Creative' },
    { value: 'custom', name: 'Custom' }
];

const outputLengths = [
    { value: 'default', name: 'Default' },
    { value: 'shorter', name: 'Shorter' },
    { value: 'longer', name: 'Longer' }
];

document.addEventListener('DOMContentLoaded', () => {
  const App = {
    // Cache all DOM elements for performance and cleaner code
    ui: {
      dailyCount: document.getElementById('dailyCount'),
      totalCount: document.getElementById('totalCount'),
      lastOriginalText: document.getElementById('lastOriginalText'),
      copyButton: document.getElementById('copyButton'),
      mainContent: document.getElementById('mainContent'),
      middleColumn: document.getElementById('middleColumn'),
      apiUsageSection: document.getElementById('apiUsageSection'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      saveApiKeyButton: document.getElementById('saveApiKeyButton'),
      apiKeyStatus: document.getElementById('apiKeyStatus'),
      languageSelect: document.getElementById('languageSelect'),
      outputStyleSelect: document.getElementById('outputStyleSelect'),
      outputLengthSelect: document.getElementById('outputLengthSelect'),
      aiProcessingToggle: document.getElementById('aiProcessingToggle'),
      soundToggle: document.getElementById('soundToggle'),
      customStyleRow: document.getElementById('customStyleRow'),
      customStyleInput: document.getElementById('customStyleInput'),
    },

    init() {
      this._populateSelects();
      this._loadSettings();
      this._bindEvents();
    },

    _populateSelects() {
      const populate = (element, options) => {
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value || opt.code;
          option.textContent = opt.name;
          element.appendChild(option);
        });
      };
      populate(this.ui.languageSelect, supportedLanguages);
      populate(this.ui.outputStyleSelect, outputStyles);
      populate(this.ui.outputLengthSelect, outputLengths);
    },
    
    async _loadSettings() {
      const keys = [
        'geminiApiKey', 'totalCount', 'dailyCount', 'lastOriginalText', 
        'selectedLanguage', 'outputStyle', 'outputLength', 'aiProcessingEnabled',
        'soundEnabled', 'customOutputStyle'
      ];
      const settings = await chrome.storage.local.get(keys);

      if (settings.geminiApiKey) {
        this.ui.apiKeyInput.value = settings.geminiApiKey;
        [this.ui.mainContent, this.ui.middleColumn].forEach(el => el.style.display = 'flex');
        this.ui.apiUsageSection.style.display = 'block';

        this.ui.dailyCount.textContent = settings.dailyCount ?? 0;
        this.ui.totalCount.textContent = settings.totalCount ?? 0;
        this.ui.lastOriginalText.value = settings.lastOriginalText ?? '';
        
        this.ui.languageSelect.value = settings.selectedLanguage || 'en-US';
        this.ui.outputStyleSelect.value = settings.outputStyle || 'default';
        this.ui.outputLengthSelect.value = settings.outputLength || 'default';
        this.ui.aiProcessingToggle.checked = settings.aiProcessingEnabled !== false;
        this.ui.soundToggle.checked = settings.soundEnabled !== false;
        this.ui.customStyleInput.value = settings.customOutputStyle || '';

        this._updateCustomStyleVisibility();
      } else {
        [this.ui.mainContent, this.ui.middleColumn, this.ui.apiUsageSection]
          .forEach(el => el.style.display = 'none');
      }
    },

    _bindEvents() {
      this.ui.saveApiKeyButton.addEventListener('click', () => this._handleSaveApiKey());
      this.ui.copyButton.addEventListener('click', () => this._handleCopyText());
      this.ui.outputStyleSelect.addEventListener('change', () => this._handleStyleChange());

      this._bindSetting(this.ui.languageSelect, 'selectedLanguage');
      this._bindSetting(this.ui.outputLengthSelect, 'outputLength');
      this._bindSetting(this.ui.aiProcessingToggle, 'aiProcessingEnabled', 'checked');
      this._bindSetting(this.ui.soundToggle, 'soundEnabled', 'checked');
      this._bindSetting(this.ui.customStyleInput, 'customOutputStyle', 'value', 'input');
    },

    _handleSaveApiKey() {
      const apiKey = this.ui.apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
          this._showStatusMessage('API Key saved!');
          this._loadSettings();
        });
      } else {
        this._showStatusMessage('Please enter a valid key.');
      }
    },

    _handleCopyText() {
      const textToCopy = this.ui.lastOriginalText.value;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          this.ui.copyButton.textContent = 'Copied!';
          setTimeout(() => { this.ui.copyButton.textContent = 'Copy Text'; }, 2000);
        });
      }
    },

    _handleStyleChange() {
      const selectedStyle = this.ui.outputStyleSelect.value;
      chrome.storage.local.set({ outputStyle: selectedStyle });
      this._updateCustomStyleVisibility();
    },

    _updateCustomStyleVisibility() {
      const isCustom = this.ui.outputStyleSelect.value === 'custom';
      this.ui.customStyleRow.style.display = isCustom ? 'flex' : 'none';
    },

    _showStatusMessage(message, duration = 3000) {
      this.ui.apiKeyStatus.textContent = message;
      setTimeout(() => { this.ui.apiKeyStatus.textContent = ''; }, duration);
    },

    // Utility for reducing boilerplate when binding settings to storage
    _bindSetting(element, key, valueProp = 'value', eventType = 'change') {
      element.addEventListener(eventType, () => {
        chrome.storage.local.set({ [key]: element[valueProp] });
      });
    }
  };

  App.init();
});