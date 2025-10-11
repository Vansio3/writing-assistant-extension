// content.js (Idempotent - safe to inject multiple times)

if (typeof window.geminiAssistantInitialized === 'undefined') {
  window.geminiAssistantInitialized = true;

  class GeminiContentAssistant {
    constructor() {
      // --- STATE MANAGEMENT ---
      this.recognition = null;
      this.finalTranscript = '';
      this.dictationTargetElement = null;
      this.originalInputText = '';
      this.dictationCancelled = false;
      this.cancellationReason = null;
      this.lastFocusedEditableElement = null;
      this.currentIconParent = null;
      this.originalParentPosition = '';
      this.currentDictationBypassesAi = false;
      this.isMouseDownOnMic = false;
      this.isOverSecondaryButton = false;
      this.isMouseDownOnFab = false;

      // --- TIMERS ---
      this.focusOutTimeout = null;
      this.micHoldTimeout = null;
      this.typingTimer = null;
      this.fabHoldTimeout = null;

      // --- UI ELEMENTS ---
      this.onFocusMicIcon = null;
      this.transcriptionOnlyButton = null;
      this.fab = null;
      this.fabStyleMenu = null;
      
      // --- HANDLERS & OBSERVERS ---
      this.stopDictationClickHandler = null;
      this.resizeObserver = null;
      
      this.fabOutputStyles = [
          { value: 'professional', name: 'Professional' },
          { value: 'friendly', name: 'Friendly' },
          { value: 'casual', name: 'Casual' },
          { value: 'technical', name: 'Technical' },
          { value: 'creative', name: 'Creative' }
      ];

      this.initialize();
    }

    // --- 1. INITIALIZATION ---

    initialize() {
      this._createUIElements();
      this._initializeSpeechRecognition();
      this._injectStyles();
      this._attachEventListeners();
      this._setupMessageListener();
      
      // Bind the update function once for the observer
      this._boundUpdateIconPositions = this._updateIconPositions.bind(this);
      this.resizeObserver = new ResizeObserver(this._boundUpdateIconPositions);
    }
    
    _createUIElements() {
      // On-Focus Microphone Icon
      const micSvg = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 19V23" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      this.onFocusMicIcon = this._createElement('div');
      Object.assign(this.onFocusMicIcon.style, {
        position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
        backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: '2147483646',
        transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease', opacity: '0', pointerEvents: 'auto'
      });
      this.onFocusMicIcon.innerHTML = micSvg;

      // Transcription-Only Button
      const transcriptionSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13.67 8H18a2 2 0 0 1 2 2v4.33"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M22 22 2 2"/>
          <path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586"/><path d="M9 13v2"/><path d="M9.67 4H12v2.33"/>
        </svg>`;
      this.transcriptionOnlyButton = this._createElement('div');
      Object.assign(this.transcriptionOnlyButton.style, {
        position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
        backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: '2147483648',
        transition: 'transform 0.2s ease-out, background-color 0.2s ease', transform: 'translateY(10px)'
      });
      this.transcriptionOnlyButton.innerHTML = transcriptionSvg;
      document.body.appendChild(this.transcriptionOnlyButton);

      // Floating Action Button (FAB)
      const fabSvg = `
        <svg width="10" height="10" viewBox="8 7 8 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.25 10.75L12 7.5L8.75 10.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15.25 16.75L12 13.5L8.75 16.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      this.fab = this._createElement('div');
      Object.assign(this.fab.style, {
        position: 'absolute', top: '0', left: '0', width: '24px', height: '24px', borderRadius: '50%',
        backgroundColor: '#FFBF00', display: 'none', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer', zIndex: '2147483647',
        transition: 'opacity 0.2s ease-in-out', opacity: '0', pointerEvents: 'auto'
      });
      this.fab.innerHTML = fabSvg;
    }

    _initializeSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      
      this.recognition.onresult = event => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) this.finalTranscript += event.results[i][0].transcript;
        }
      };
      
      this.recognition.onend = () => this._onRecognitionEnd();
      this.recognition.onerror = event => this._onRecognitionError(event);
    }
    
    _injectStyles() {
      const styleId = 'gemini-listening-style';
      if (document.getElementById(styleId)) return;
      
      const style = this._createElement('style', { id: styleId });
      style.innerHTML = `
        .gemini-mic-pulsing {
          animation: gemini-icon-pulse 1.5s infinite ease-in-out;
        }
        @keyframes gemini-icon-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 5px rgba(229, 62, 62, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
      }`;
      document.head.appendChild(style);
    }

    // --- 2. EVENT BINDING ---
    
    _attachEventListeners() {
      // Use .bind(this) to ensure correct context in event handlers
      document.addEventListener('focusin', this._onFocusIn.bind(this));
      document.addEventListener('focusout', this._onFocusOut.bind(this));
      document.addEventListener('keyup', this._onKeyUp.bind(this));
      document.addEventListener('selectionchange', this._onSelectionChange.bind(this));
      document.addEventListener('mouseup', this._onMouseUp.bind(this));
      document.addEventListener('mousemove', this._onMouseMove.bind(this));
      
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.dictationTargetElement) {
          this.dictationCancelled = true;
          this.cancellationReason = 'escape';
          if (this.recognition) this.recognition.stop();
        }
      });
      
      this.onFocusMicIcon.addEventListener('mouseenter', () => this._setMicHover(true));
      this.onFocusMicIcon.addEventListener('mouseleave', () => this._setMicHover(false));
      this.onFocusMicIcon.addEventListener('mousedown', this._onMicMouseDown.bind(this));
      
      this.fab.addEventListener('mousedown', this._onFabMouseDown.bind(this));
    }
    
    _setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.command === "process-text") {
                this.processSelectedText();
            } else if (request.command === "toggle-dictation") {
                const isRecording = !!this.dictationTargetElement;
                const shouldStart = typeof request.start !== 'undefined' ? request.start : !isRecording;
                this._handleToggleDictation({ ...request, start: shouldStart });
            }
            sendResponse(true); return true;
        });
    }

    // --- 3. CORE LOGIC ---

    processSelectedText(style = null) {
      let activeElement = this.lastFocusedEditableElement;
      if (!activeElement || !document.body.contains(activeElement)) {
        if (this.currentIconParent) {
            activeElement = this.currentIconParent.querySelector('rich-textarea, textarea, input:not([type="hidden"]), [contenteditable="true"]');
            this.lastFocusedEditableElement = activeElement;
        }
        if (!activeElement || !document.body.contains(activeElement)) {
             activeElement = document.activeElement;
        }
      }
      if (!this._isElementSuitable(activeElement)) return;

      const selection = window.getSelection();
      let promptText = selection.toString().trim();
      let processingMode = 'selection';

      if (!promptText) {
          processingMode = 'full';
          promptText = (typeof activeElement.value !== 'undefined') ? activeElement.value : activeElement.textContent;
          if (!promptText.trim()) return;

          if (typeof activeElement.select === 'function') {
              activeElement.select();
          } else if (activeElement.isContentEditable) {
              const range = document.createRange();
              range.selectNodeContents(activeElement);
              selection.removeAllRanges();
              selection.addRange(range);
          }
      }

      activeElement.style.opacity = '0.5';
      activeElement.style.cursor = 'wait';

      chrome.runtime.sendMessage({ prompt: promptText, style: style }, (response) => {
        activeElement.style.opacity = '1';
        activeElement.style.cursor = 'auto';
        if (chrome.runtime.lastError) return console.error(chrome.runtime.lastError.message);
        if (response && response.error) return alert(`Error: ${response.error}`);

        if (response && response.generatedText) {
          if (processingMode === 'full') {
            if (typeof activeElement.value !== 'undefined') {
              activeElement.value = response.generatedText;
            } else if (activeElement.isContentEditable) {
              activeElement.textContent = response.generatedText;
            }
          } else {
            document.execCommand('insertText', false, response.generatedText);
          }
          activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          setTimeout(() => this._updateIconPositions(), 200);
        }
      });
    }

    _handleToggleDictation({ start, bypassAi = false }) {
      const activeElement = this.lastFocusedEditableElement;
      if (!activeElement || !this._isElementSuitable(activeElement)) {
        this._hideListeningIndicator(); return;
      }

      if (start) {
        if (this.recognition) {
          this.dictationTargetElement = activeElement;
          this.currentDictationBypassesAi = bypassAi;
          chrome.storage.local.get('selectedLanguage', ({ selectedLanguage }) => {
            this.recognition.lang = selectedLanguage || 'en-US';
            this._playSound('assets/audio/start.mp3');
            this.originalInputText = this.dictationTargetElement.value || this.dictationTargetElement.textContent;
            
            // Handle focus loss during dictation
            this._boundHandleFocusLoss = this._handleFocusLoss.bind(this);
            this.dictationTargetElement.addEventListener('blur', this._boundHandleFocusLoss, { once: true });
            
            this._showListeningIndicator();
            this.recognition.start();
          });
        } else {
            alert("Speech recognition not available in this browser.");
        }
      } else {
        if (this.recognition) this.recognition.stop();
      }
    }

    _onRecognitionEnd() {
      this._playSound('assets/audio/end.mp3');
      this._hideListeningIndicator();
      
      const finishedTarget = this.dictationTargetElement;
      if (finishedTarget && this._boundHandleFocusLoss) {
        finishedTarget.removeEventListener('blur', this._boundHandleFocusLoss);
      }

      if (this.dictationCancelled) {
        if (finishedTarget) {
          finishedTarget.value = this.originalInputText;
          if (this.cancellationReason === 'escape') this._showOnFocusMicIcon(finishedTarget);
        }
      } else if (finishedTarget && this.finalTranscript.trim()) {
        finishedTarget.style.opacity = '0.5';
        finishedTarget.style.cursor = 'wait';
        
        chrome.runtime.sendMessage({ 
            prompt: this.finalTranscript.trim(), 
            bypassAi: this.currentDictationBypassesAi 
        }, (response) => {
          finishedTarget.style.opacity = '1';
          finishedTarget.style.cursor = 'auto';
          if (response && response.generatedText) {
            document.execCommand('insertText', false, response.generatedText);
            finishedTarget.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          }
          if (document.activeElement === finishedTarget) this._showOnFocusMicIcon(finishedTarget);
        });
      } else if (finishedTarget && document.activeElement === finishedTarget) {
        this._showOnFocusMicIcon(finishedTarget);
      }

      // Reset state
      this.dictationTargetElement = null;
      this.originalInputText = '';
      this.finalTranscript = '';
      this.dictationCancelled = false;
      this.cancellationReason = null;
    }

    _onRecognitionError(event) {
      if (event.error === 'no-speech') return;
      console.error("Speech recognition error:", event.error);
      this._hideListeningIndicator();
      if (this.dictationTargetElement) {
        if (this._boundHandleFocusLoss) {
            this.dictationTargetElement.removeEventListener('blur', this._boundHandleFocusLoss);
        }
        this.dictationTargetElement.value = this.originalInputText;
        this.dictationTargetElement = null;
        this.originalInputText = '';
      }
    }
    
    _handleFocusLoss() {
      if (this.recognition && this.dictationTargetElement) {
        this.dictationCancelled = true;
        this.cancellationReason = 'blur';
        this.recognition.stop();
      }
    }

    // --- 4. UI EVENT HANDLERS ---

    _onFocusIn(event) {
      const target = event.target;
      if (!target || target.disabled || target.readOnly) return;
      
      if (this.lastFocusedEditableElement && this.lastFocusedEditableElement !== target) {
        this._hideOnFocusMicIcon(true); 
      }

      if (this._isElementSuitable(target)) {
        this.lastFocusedEditableElement = target;
        this._showOnFocusMicIcon(target);
      } else {
        this._hideOnFocusMicIcon();
        this._hideFab();
        this.lastFocusedEditableElement = null;
      }
    }

    _onFocusOut(event) {
      if (event.target === this.lastFocusedEditableElement) {
        this._hideOnFocusMicIcon();
        this._hideFab();
        setTimeout(() => {
          if (document.activeElement !== this.lastFocusedEditableElement) {
            this.lastFocusedEditableElement = null;
          }
        }, 400); 
      }
    }

    _onKeyUp() {
      if (!this.lastFocusedEditableElement) return;
      
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      clearTimeout(this.typingTimer);
      this._hideFab();
      
      const text = this.lastFocusedEditableElement.value || this.lastFocusedEditableElement.textContent;
      if (text && text.trim().length > 0) {
        this.typingTimer = setTimeout(() => {
          if (document.activeElement === this.lastFocusedEditableElement && window.getSelection().toString().trim().length === 0) {
            this._showFab();
          }
        }, 1000);
      }
    }

    _onSelectionChange() {
      if (this.lastFocusedEditableElement && document.activeElement === this.lastFocusedEditableElement) {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          clearTimeout(this.typingTimer);
          this._showFab();
        } else {
          this._hideFab();
        }
      }
    }

    _onMicMouseDown(event) {
      event.preventDefault();
      event.stopPropagation();
      this.isMouseDownOnMic = true;

      this.micHoldTimeout = setTimeout(() => {
        if (!this.isMouseDownOnMic) return;
        const micRect = this.onFocusMicIcon.getBoundingClientRect();
        const x = micRect.left + window.scrollX;
        const y = micRect.top + window.scrollY - 34;
        this.transcriptionOnlyButton.style.transform = `translate(${x}px, ${y}px)`;
        this.transcriptionOnlyButton.style.display = 'flex';
      }, 200);
    }
    
    _onFabMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isMouseDownOnFab = true;
        this.fabHoldTimeout = setTimeout(() => {
            if (this.isMouseDownOnFab) this._showFabStyleMenu();
        }, 200);
    }

    _onMouseMove(event) {
      if (!this.isMouseDownOnMic || this.transcriptionOnlyButton.style.display !== 'flex') return;
      
      const { clientX, clientY } = event;
      const secondaryRect = this.transcriptionOnlyButton.getBoundingClientRect();

      if (clientX >= secondaryRect.left && clientX <= secondaryRect.right &&
          clientY >= secondaryRect.top && clientY <= secondaryRect.bottom) {
        this.isOverSecondaryButton = true;
        this.transcriptionOnlyButton.style.backgroundColor = '#d0d0d0';
      } else {
        this.isOverSecondaryButton = false;
        this.transcriptionOnlyButton.style.backgroundColor = '#f0f0f0';
      }
    }

    _onMouseUp(event) {
      // FAB logic
      if (this.isMouseDownOnFab) {
        this.isMouseDownOnFab = false;
        clearTimeout(this.fabHoldTimeout);
        if (this.fabStyleMenu && this.fabStyleMenu.style.display === 'flex') {
          const styleButton = event.target.closest('button');
          if (styleButton && styleButton.dataset.style) {
            this.processSelectedText(styleButton.dataset.style);
          }
          this._hideFabStyleMenu();
        } else {
          this.processSelectedText();
        }
      }
      
      // Mic logic
      if (!this.isMouseDownOnMic) return;
      clearTimeout(this.micHoldTimeout);
      this.isMouseDownOnMic = false;

      if (this.transcriptionOnlyButton.style.display === 'flex') {
        this._handleToggleDictation({ start: true, bypassAi: this.isOverSecondaryButton });
        this.transcriptionOnlyButton.style.display = 'none';
        this.transcriptionOnlyButton.style.transform = `translateY(10px)`;
      } else {
        if (!this.stopDictationClickHandler) {
          this._handleToggleDictation({ start: true, bypassAi: false });
        }
      }

      this.isOverSecondaryButton = false;
      this._setMicHover(false);
    }

    // --- 5. UI DOM MANIPULATION ---

    _showOnFocusMicIcon(targetElement) {
      if (!this.onFocusMicIcon) return;
      clearTimeout(this.focusOutTimeout);

      // Restored original logic for selecting the parent container
      const parent = targetElement.closest('.input-area') || targetElement.parentElement?.parentElement;
      if (!parent) return;

      this.currentIconParent = parent;
      this.originalParentPosition = window.getComputedStyle(parent).position;

      if (this.originalParentPosition === 'static') {
        parent.style.position = 'relative';
      }

      parent.appendChild(this.onFocusMicIcon);
      
      if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver.observe(parent);
      }
      
      this.onFocusMicIcon.style.display = 'flex';
      this._updateIconPositions();

      setTimeout(() => { 
        this.onFocusMicIcon.style.opacity = '1';
        this._updateIconPositions();
      }, 10);
    }
    
    _hideOnFocusMicIcon(immediately = false) {
      if (!this.onFocusMicIcon) return;
      
      const performHide = () => {
        if (this.onFocusMicIcon && this.onFocusMicIcon.parentElement) {
          this.onFocusMicIcon.style.opacity = '0';
        }
        setTimeout(() => { 
          if (this.onFocusMicIcon && this.onFocusMicIcon.parentElement) {
            this.onFocusMicIcon.remove();
          }
          if (this.currentIconParent) {
            this.currentIconParent.style.position = this.originalParentPosition;
            this.currentIconParent = null;
            this.originalParentPosition = '';
          }
          if (this.resizeObserver) {
            this.resizeObserver.disconnect();
          }
        }, 200);
      };

      clearTimeout(this.focusOutTimeout);
      if (immediately) {
        performHide();
      } else {
        this.focusOutTimeout = setTimeout(performHide, 200);
      }
    }
    
    _showFab() {
      if (!this.fab || !this.currentIconParent || !this.lastFocusedEditableElement) return;

      if (this.fab.parentElement !== this.currentIconParent) {
          this.currentIconParent.appendChild(this.fab);
      }
      
      this.fab.style.display = 'flex';
      this._updateIconPositions();

      setTimeout(() => { 
          this.fab.style.opacity = '1';
          this._updateIconPositions();
      }, 10);
    }
    
    _hideFab(immediately = false) {
      if (!this.fab || !this.fab.parentElement) return;

      clearTimeout(this.typingTimer);

      const performHide = () => {
        this.fab.style.opacity = '0';
        setTimeout(() => {
          if (this.fab.parentElement) { 
            this.fab.remove();
          }
        }, 200);
      };

      if (immediately) {
        this.fab.style.transition = 'none';
        performHide();
        setTimeout(() => { this.fab.style.transition = 'opacity 0.2s ease-in-out'; }, 50);
      } else {
        performHide();
      }
      
      this._hideFabStyleMenu();
    }
    
    _showFabStyleMenu() {
      if (!this.fabStyleMenu) {
        this.fabStyleMenu = this._createElement('div');
        Object.assign(this.fabStyleMenu.style, {
          position: 'absolute',
          zIndex: '2147483648',
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          padding: '6px',
          backgroundColor: 'rgba(44, 45, 48, 0.9)',
          borderRadius: '20px',
          backdropFilter: 'blur(5px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
        });
        document.body.appendChild(this.fabStyleMenu);

        this.fabOutputStyles.forEach(style => {
          const button = this._createElement('button');
          button.textContent = style.name;
          button.dataset.style = style.value;
          Object.assign(button.style, {
            backgroundColor: '#3c3d41',
            color: '#e1e1e6',
            border: 'none',
            borderRadius: '14px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'background-color 0.2s ease',
          });
          button.addEventListener('mouseenter', () => button.style.backgroundColor = '#4a4b50');
          button.addEventListener('mouseleave', () => button.style.backgroundColor = '#3c3d41');
          this.fabStyleMenu.appendChild(button);
        });
      }

      this.fabStyleMenu.style.visibility = 'hidden';
      this.fabStyleMenu.style.display = 'flex';

      const fabRect = this.fab.getBoundingClientRect();
      const menuRect = this.fabStyleMenu.getBoundingClientRect();

      const x = fabRect.left + window.scrollX - menuRect.width;
      const y = fabRect.top + window.scrollY + (fabRect.height / 2) - (menuRect.height / 2) - 50;

      this.fabStyleMenu.style.transform = `translate(${x}px, ${y}px)`;
      this.fabStyleMenu.style.visibility = 'visible';
    }

    _hideFabStyleMenu() {
      if (this.fabStyleMenu) {
        this.fabStyleMenu.style.display = 'none';
      }
    }
    
    // Restored original positioning logic
    _updateIconPositions() {
      if (!this.currentIconParent || !this.lastFocusedEditableElement) return;

      const parentRect = this.currentIconParent.getBoundingClientRect();
      const targetRect = this.lastFocusedEditableElement.getBoundingClientRect();

      const targetRelativeLeft = targetRect.left - parentRect.left;
      const targetWidth = targetRect.width;
      // Use the CONTAINER'S height for vertical centering, ignoring target scrollbars.
      const parentHeight = this.currentIconParent.offsetHeight;

      if (this.onFocusMicIcon && this.onFocusMicIcon.parentElement === this.currentIconParent) {
        const iconHeight = this.onFocusMicIcon.offsetHeight;
        const top = (parentHeight / 2) - (iconHeight / 2);
        const left = targetRelativeLeft + targetWidth - 34;

        this.onFocusMicIcon.style.top = `${top}px`;
        this.onFocusMicIcon.style.left = `${left}px`;
      }

      if (this.fab && this.fab.parentElement === this.currentIconParent) {
        const fabHeight = this.fab.offsetHeight;
        const top = (parentHeight / 2) - (fabHeight / 2);
        const left = targetRelativeLeft + targetWidth - 64;

        this.fab.style.top = `${top}px`;
        this.fab.style.left = `${left}px`;
      }
    }

    _showListeningIndicator() {
      if (!this.onFocusMicIcon) return;

      this.onFocusMicIcon.style.backgroundColor = '#E53E3E';
      this.onFocusMicIcon.classList.add('gemini-mic-pulsing');

      const paths = this.onFocusMicIcon.querySelectorAll('svg path');
      paths.forEach(p => p.setAttribute('stroke', '#FFFFFF'));

      this.stopDictationClickHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._handleToggleDictation({ start: false });
      };
      this.onFocusMicIcon.addEventListener('click', this.stopDictationClickHandler);
    }
    
    _hideListeningIndicator() {
       if (!this.onFocusMicIcon) return;

       this.onFocusMicIcon.style.backgroundColor = '#f0f0f0';
       this.onFocusMicIcon.classList.remove('gemini-mic-pulsing');

       const paths = this.onFocusMicIcon.querySelectorAll('svg path');
       paths.forEach(p => p.setAttribute('stroke', '#606367'));

       if (this.stopDictationClickHandler) {
         this.onFocusMicIcon.removeEventListener('click', this.stopDictationClickHandler);
         this.stopDictationClickHandler = null;
       }
    }

    _setMicHover(isHovering) {
        if (!this.isMouseDownOnMic && !this.stopDictationClickHandler) {
            this.onFocusMicIcon.style.backgroundColor = isHovering ? '#e0e0e0' : '#f0f0f0';
        }
    }

    // --- 6. UTILITIES ---

    _createElement(tag) {
      return document.createElement(tag);
    }

    _isElementSuitable(element) {
      if (!element) return false;
      const tagName = element.tagName.toUpperCase();
      let isSuitable = false;

      if (element.isContentEditable || tagName === 'RICH-TEXTAREA') {
        isSuitable = true;
      }
      else if (tagName === 'TEXTAREA') {
        isSuitable = true;
      }
      else if (tagName === 'INPUT') {
        const unsuitableTypes = [
          'button', 'checkbox', 'color', 'date', 'datetime-local', 'email',
          'file', 'hidden', 'image', 'month', 'number', 'password',
          'radio', 'range', 'reset', 'search', 'submit', 'tel', 'time',
          'url', 'week'
        ];
        if (!unsuitableTypes.includes(element.type.toLowerCase())) {
          isSuitable = true;
        }
      }
      return isSuitable;
    }
    
    _playSound(soundFile) {
      chrome.storage.local.get('soundEnabled', (result) => {
        if (result.soundEnabled !== false) {
          const audio = new Audio(chrome.runtime.getURL(soundFile));
          audio.play();
        }
      });
    }
  }

  new GeminiContentAssistant();
}