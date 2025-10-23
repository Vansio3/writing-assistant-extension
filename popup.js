// popup.js

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

const outputStyles = [
    { value: 'default', name: 'Default' },
    { value: 'grammar', name: 'Grammar' },
    { value: 'professional', name: 'Professional' },
    { value: 'friendly', name: 'Friendly' },
    // { value: 'casual', name: 'Casual' },
    // { value: 'technical', name: 'Technical' },
    // { value: 'creative', name: 'Creative' },
    { value: 'custom', name: 'Custom' }
];

const outputLengths = [
    { value: 'default', name: 'Default' },
    { value: 'shorter', name: 'Shorter' },
    { value: 'longer', name: 'Longer' }
];


document.addEventListener('DOMContentLoaded', () => {
  const App = {
    ui: {
      dailyCount: document.getElementById('dailyCount'),
      totalCount: document.getElementById('totalCount'),
      mainContent: document.getElementById('mainContent'),
      historyContent: document.getElementById('historyContent'),
      inputHistoryContainer: document.getElementById('inputHistoryContainer'),
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
      playgroundInput: document.getElementById('playgroundInput'),
      playgroundProcessButton: document.getElementById('playgroundProcessButton'),
      playgroundStatus: document.getElementById('playgroundStatus'),
      playgroundContainer: document.querySelector('.playground-container'),
      scrollToPlaygroundButton: document.getElementById('scrollToPlaygroundButton'),
      toggleDomainButton: document.getElementById('toggleDomainButton'),
      domainStatus: document.getElementById('domainStatus'),
      selectTargetButton: document.getElementById('selectTargetButton'),
      detachButtonsToggle: document.getElementById('detachButtonsToggle'),
      detachButtonsStatus: document.getElementById('detachButtonsStatus'),
    },

    currentDomain: null,
    enabledDomains: [],

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
        'geminiApiKey', 'totalCount', 'dailyCount', 'originalInputsHistory',
        'selectedLanguage', 'outputStyle', 'outputLength', 'aiProcessingEnabled',
        'soundEnabled', 'customOutputStyle', 'enabledDomains', 'detachButtons'
      ];
      const settings = await chrome.storage.local.get(keys);

      this.enabledDomains = settings.enabledDomains || [];
      await this._updateDomainButtonState();

      if (settings.geminiApiKey) {
        this.ui.apiKeyInput.value = atob(settings.geminiApiKey); // Decode for display
        this.ui.mainContent.classList.remove('hidden');
        this.ui.historyContent.classList.remove('hidden');
        this.ui.apiUsageSection.classList.remove('hidden');
        this.ui.playgroundContainer.classList.remove('hidden');

        this.ui.dailyCount.textContent = settings.dailyCount ?? 0;
        this.ui.totalCount.textContent = settings.totalCount ?? 0;
        
        this._populateInputHistory(settings.originalInputsHistory || []);
        
        this.ui.languageSelect.value = settings.selectedLanguage || 'en-US';
        this.ui.outputStyleSelect.value = settings.outputStyle || 'default';
        this.ui.outputLengthSelect.value = settings.outputLength || 'default';
        this.ui.aiProcessingToggle.checked = settings.aiProcessingEnabled !== false;
        this.ui.soundToggle.checked = settings.soundEnabled !== false;
        this.ui.customStyleInput.value = settings.customOutputStyle || '';
        
        // If 'detachButtons' is not explicitly set to false, it defaults to true.
        this.ui.detachButtonsToggle.checked = settings.detachButtons !== false;

        this._updateCustomStyleVisibility();
      } else {
        [this.ui.mainContent, this.ui.historyContent, this.ui.apiUsageSection, this.ui.playgroundContainer]
          .forEach(el => el.classList.add('hidden'));
      }
    },

    _populateInputHistory(history = []) {
        this.ui.inputHistoryContainer.innerHTML = ''; // Clear existing items
        if (history.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.textContent = 'Your processed inputs will appear here.';
            placeholder.style.textAlign = 'center';
            placeholder.style.color = 'var(--text-secondary)';
            this.ui.inputHistoryContainer.appendChild(placeholder);
            return;
        }

        history.forEach(text => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = text;
            item.title = 'Click to copy text';

            item.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = item.textContent;
                    item.textContent = 'Copied!';
                    item.classList.add('copied');
                    
                    setTimeout(() => {
                        item.textContent = originalText;
                        item.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    const originalText = item.textContent;
                    item.textContent = 'Copy failed!';
                    setTimeout(() => {
                        item.textContent = originalText;
                    }, 2000);
                });
            });
            
            this.ui.inputHistoryContainer.appendChild(item);
        });
    },

    _bindEvents() {
      this.ui.saveApiKeyButton.addEventListener('click', () => this._handleSaveApiKey());
      this.ui.outputStyleSelect.addEventListener('change', () => this._handleStyleChange());
      this.ui.playgroundProcessButton.addEventListener('click', () => this._handlePlaygroundProcess());
      this.ui.scrollToPlaygroundButton.addEventListener('click', () => this._handleScrollToPlayground());
      this.ui.toggleDomainButton.addEventListener('click', () => this._handleToggleDomain());
      this.ui.selectTargetButton.addEventListener('click', () => this._handleSelectTarget());

      this._bindSetting(this.ui.languageSelect, 'selectedLanguage');
      this._bindSetting(this.ui.outputLengthSelect, 'outputLength');
      this._bindSetting(this.ui.aiProcessingToggle, 'aiProcessingEnabled', 'checked');
      this._bindSetting(this.ui.soundToggle, 'soundEnabled', 'checked');
      this._bindSetting(this.ui.customStyleInput, 'customOutputStyle', 'value', 'input');
      this._bindSetting(this.ui.detachButtonsToggle, 'detachButtons', 'checked');

      // START: MODIFIED CODE BLOCK
      // Add a separate listener to show the status message for the detach toggle.
      // This listener now ONLY handles making the existing message visible.
      this.ui.detachButtonsToggle.addEventListener('change', () => {
        this.ui.detachButtonsStatus.classList.remove('hidden');
        setTimeout(() => {
          this.ui.detachButtonsStatus.classList.add('hidden');
        }, 4000);
      });
      // END: MODIFIED CODE BLOCK
    },

    async _updateDomainButtonState() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        try {
          const url = new URL(tab.url);
          if (url.protocol.startsWith('http')) {
            this.currentDomain = url.hostname;
            const isEnabled = this.enabledDomains.includes(this.currentDomain);
            this.ui.toggleDomainButton.textContent = isEnabled ? `Disable for this site` : `Enable for this site`;
            this.ui.toggleDomainButton.dataset.enabled = isEnabled;
            this.ui.toggleDomainButton.classList.remove('hidden');
          } else {
            this.ui.toggleDomainButton.classList.add('hidden');
          }
        } catch (e) {
          this.ui.toggleDomainButton.classList.add('hidden');
        }
      }
    },

    async _handleToggleDomain() {
        if (!this.currentDomain) return;
        const isCurrentlyEnabled = this.ui.toggleDomainButton.dataset.enabled === 'true';

        if (isCurrentlyEnabled) {
            this.enabledDomains = this.enabledDomains.filter(d => d !== this.currentDomain);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, { command: "teardown-content-script" });
            }
        } else {
            this.enabledDomains.push(this.currentDomain);
        }
        
        this.enabledDomains = [...new Set(this.enabledDomains)];
        await chrome.storage.local.set({ enabledDomains: this.enabledDomains });
        await this._updateDomainButtonState();
        
        this._showStatusMessage('Please reload the page for changes to take effect.', 4000, this.ui.domainStatus);
    },

    async _handleSelectTarget() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        // Send a message to the content script in the active tab
        chrome.tabs.sendMessage(tab.id, { command: "enter-selection-mode" });
        // Close the popup so the user can see the page
        window.close();
      }
    },

    _handleSaveApiKey() {
      const apiKey = this.ui.apiKeyInput.value.trim();
      if (apiKey) {
        const obfuscatedKey = btoa(apiKey);
        chrome.storage.local.set({ geminiApiKey: obfuscatedKey }, () => {
          this._showStatusMessage('API Key saved!', 3000, this.ui.apiKeyStatus);
          this._loadSettings();
        });
      } else {
        this._showStatusMessage('Please enter a valid key.', 3000, this.ui.apiKeyStatus);
      }
    },

    _handleStyleChange() {
      const selectedStyle = this.ui.outputStyleSelect.value;
      chrome.storage.local.set({ outputStyle: selectedStyle });
      this._updateCustomStyleVisibility();
    },
    
    _handlePlaygroundProcess() {
        const inputText = this.ui.playgroundInput.value.trim();
        if (!inputText) {
            this._showStatusMessage('Please enter text to process.', 3000, this.ui.playgroundStatus);
            return;
        }

        this.ui.playgroundProcessButton.disabled = true;
        this.ui.playgroundProcessButton.textContent = 'Processing...';
        this._showStatusMessage('', 0, this.ui.playgroundStatus);

        const selectedStyle = this.ui.outputStyleSelect.value;
        
        chrome.runtime.sendMessage({ prompt: inputText, style: selectedStyle }, (response) => {
            this.ui.playgroundProcessButton.disabled = false;
            this.ui.playgroundProcessButton.textContent = 'Process';

            if (chrome.runtime.lastError || !response) {
                const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No response from the extension.';
                this._showStatusMessage(`Error: ${errorMsg}`, 5000, this.ui.playgroundStatus);
                return;
            }

            if (response.error) {
                this._showStatusMessage(`Error: ${response.error}`, 5000, this.ui.playgroundStatus);
            } else if (response.generatedText) {
                this.ui.playgroundInput.value = response.generatedText;
                this._loadSettings();
            }
        });
    },

    _handleScrollToPlayground() {
      this.ui.playgroundContainer.scrollIntoView({ behavior: 'smooth' });
    },

    _updateCustomStyleVisibility() {
      const isCustom = this.ui.outputStyleSelect.value === 'custom';
      this.ui.customStyleRow.classList.toggle('hidden', !isCustom);
    },

    _showStatusMessage(message, duration = 3000, element = this.ui.apiKeyStatus) {
        element.textContent = message;
        if (duration > 0) {
            setTimeout(() => { element.textContent = ''; }, duration);
        }
    },

    _bindSetting(element, key, valueProp = 'value', eventType = 'change') {
      element.addEventListener(eventType, () => {
        chrome.storage.local.set({ [key]: element[valueProp] });
      });
    }
  };

  App.init();
});