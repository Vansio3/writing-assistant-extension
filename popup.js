// popup.js

// A comprehensive and alphabetized list of languages supported by the Web Speech API
const supportedLanguages = [
    // ... same as original file
];
const outputStyles = [
    // ... same as original file
];
const outputLengths = [
    // ... same as original file
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