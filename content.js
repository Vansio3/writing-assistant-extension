// content.js (Idempotent - safe to inject multiple times)

(async () => {
  const data = await chrome.storage.local.get('disabledDomains');
  const disabledDomains = data.disabledDomains || [];
  const currentHostname = window.location.hostname;

  if (disabledDomains.includes(currentHostname)) {
    return;
  }

  if (typeof window.geminiAssistantInitialized === 'undefined') {
    window.geminiAssistantInitialized = true;

    /**
     * GeminiContentAssistant class manages all the front-end logic for the extension.
     * It handles UI creation, event listening, state management, and communication
     * with the background script.
     */
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

        // --- NEW STATE FOR DETACHED/SELECTOR MODE ---
        this.isDetachedMode = false;
        this.isDragging = null;
        this.isSelectionMode = false;
        this.mappedTargetElement = null;
        this.selectorIcon = null;

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
        
        // Kick off the initialization process
        this.initialize();
      }

      // --- 1. INITIALIZATION ---

      async initialize() {
        const settings = await chrome.storage.local.get('detachButtons');
        this.isDetachedMode = settings.detachButtons || false;

        this._createUIElements();
        this._initializeSpeechRecognition();
        this._injectStyles();
        this._attachEventListeners();
        this._setupMessageListener();

        if (this.isDetachedMode) {
            this._initializeDetachedMode();
        }
      }
      
      _createUIElements() {
        // --- On-Focus Microphone Icon ---
        const micSvg = this._createSvgElement('svg', {
          width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none'
        });
        micSvg.innerHTML = `
            <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 19V23" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        `;
        this.onFocusMicIcon = this._createElement('div');
        Object.assign(this.onFocusMicIcon.style, STYLES.MIC_ICON);
        this.onFocusMicIcon.appendChild(micSvg);

        // --- Transcription-Only Button ---
        const transcriptionSvg = this._createSvgElement('svg', {
          width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none',
          stroke: COLORS.MIC_ICON_DEFAULT, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        transcriptionSvg.innerHTML = `
            <path d="M13.67 8H18a2 2 0 0 1 2 2v4.33"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M22 22 2 2"/><path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586"/><path d="M9 13v2"/><path d="M9.67 4H12v2.33"/>
        `;
        this.transcriptionOnlyButton = this._createElement('div');
        Object.assign(this.transcriptionOnlyButton.style, STYLES.TRANSCRIPTION_BUTTON);
        this.transcriptionOnlyButton.appendChild(transcriptionSvg);
        document.body.appendChild(this.transcriptionOnlyButton);

        // --- Floating Action Button (FAB) ---
        const fabSvg = this._createSvgElement('svg', {
          width: '10', height: '10', viewBox: '8 7 8 11', fill: 'none'
        });
        fabSvg.innerHTML = `
            <path d="M15.25 10.75L12 7.5L8.75 10.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.25 16.75L12 13.5L8.75 16.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
        this.fab = this._createElement('div');
        Object.assign(this.fab.style, STYLES.FAB);
        this.fab.appendChild(fabSvg);
        
        // --- NEW: Create Selector Icon ---
        this._createSelectorIcon();
      }

      _initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          console.warn("Gemini Assistant: Speech Recognition API not supported in this browser.");
          return;
        }

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
        const styleId = 'gemini-assistant-styles';
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
          }
          .gemini-assistant-selectable-target {
            outline: 2px dashed #FFBF00 !important;
            outline-offset: 2px;
            box-shadow: 0 0 15px rgba(255, 191, 0, 0.7) !important;
            transition: outline 0.2s ease, box-shadow 0.2s ease;
          }
          .gemini-assistant-selectable-target:hover {
            outline: 2px solid #E53E3E !important;
            box-shadow: 0 0 15px rgba(229, 62, 62, 1) !important;
          }
        `;
        document.head.appendChild(style);
        this.resizeObserver = new ResizeObserver(() => this._updateIconPositions());
      }
      
      // --- NEW DETACHED MODE & FIELD SELECTOR METHODS ---
      
      _initializeDetachedMode() {
        document.body.appendChild(this.onFocusMicIcon);
        document.body.appendChild(this.fab);
        this.fab.appendChild(this.selectorIcon);

        Object.assign(this.onFocusMicIcon.style, {
            position: 'fixed', top: '20px', left: '20px', zIndex: Z_INDEX.MIC_ICON, opacity: 1, display: 'flex'
        });
        Object.assign(this.fab.style, {
            position: 'fixed', top: '20px', left: '60px', zIndex: Z_INDEX.FAB, opacity: 1, display: 'flex'
        });

        // Make them draggable
        this.onFocusMicIcon.addEventListener('mousedown', e => this._onDragStart(e, 'mic'));
        this.fab.addEventListener('mousedown', e => this._onDragStart(e, 'fab'));
        document.addEventListener('mousemove', e => this._onDrag(e));
        document.addEventListener('mouseup', e => this._onDragEnd(e));
      }
      
      _createSelectorIcon() {
        const selectorSvg = this._createSvgElement('svg', {
            width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none',
            stroke: '#FFFFFF', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        selectorSvg.innerHTML = '<path d="M12 2L12 5"/><path d="M12 19L12 22"/><path d="M22 12L19 12"/><path d="M5 12L2 12"/><circle cx="12" cy="12" r="7"/>';
        
        const selectorIconContainer = this._createElement('div');
        Object.assign(selectorIconContainer.style, {
            position: 'absolute', top: '-5px', right: '-5px', width: '22px', height: '22px',
            borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            zIndex: '2147483648', transition: 'background-color 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)', border: '1px solid #FFF'
        });
        selectorIconContainer.appendChild(selectorSvg);

        selectorIconContainer.addEventListener('mouseenter', () => selectorIconContainer.style.backgroundColor = 'rgba(88, 101, 242, 1)');
        selectorIconContainer.addEventListener('mouseleave', () => selectorIconContainer.style.backgroundColor = 'rgba(0,0,0,0.7)');
        selectorIconContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleSelectionMode();
        });
        this.selectorIcon = selectorIconContainer;
      }

      _toggleSelectionMode() {
        this.isSelectionMode = !this.isSelectionMode;
        if (this.isSelectionMode) {
            document.body.style.cursor = 'crosshair';
            this._highlightSelectableFields(true);
            document.addEventListener('click', this._handleSelectionClick, true);
            document.addEventListener('keydown', this._handleSelectionKeydown, true);
        } else {
            document.body.style.cursor = 'default';
            this._highlightSelectableFields(false);
            document.removeEventListener('click', this._handleSelectionClick, true);
            document.removeEventListener('keydown', this._handleSelectionKeydown, true);
        }
      }

      _highlightSelectableFields(enable) {
        const fields = document.querySelectorAll('textarea, input:not([type="button"],[type="checkbox"],[type="radio"],[type="submit"],[type="reset"],[type="file"]), [contenteditable="true"]');
        fields.forEach(field => {
            if (this._isElementSuitable(field)) {
                field.classList.toggle('gemini-assistant-selectable-target', enable);
            }
        });
      }

      _handleSelectionClick = (event) => {
        if (!this.isSelectionMode) return;
        event.preventDefault();
        event.stopPropagation();
        if (this._isElementSuitable(event.target)) {
            this.mappedTargetElement = event.target;
            this.selectorIcon.style.backgroundColor = '#FFBF00';
            this.selectorIcon.querySelector('svg').setAttribute('stroke', '#000000');
        } else {
            this.mappedTargetElement = null;
            this.selectorIcon.style.backgroundColor = 'rgba(0,0,0,0.7)';
            this.selectorIcon.querySelector('svg').setAttribute('stroke', '#FFFFFF');
        }
        this._toggleSelectionMode();
      }

      _handleSelectionKeydown = (event) => {
        if (this.isSelectionMode && event.key === 'Escape') {
            event.preventDefault();
            this._toggleSelectionMode();
        }
      }
      
      _getTargetElement() {
        if (this.mappedTargetElement && document.body.contains(this.mappedTargetElement)) {
            return this.mappedTargetElement;
        }
        if (this.lastFocusedEditableElement && document.body.contains(this.lastFocusedEditableElement)) {
            return this.lastFocusedEditableElement;
        }
        if (this._isElementSuitable(document.activeElement)) {
            return document.activeElement;
        }
        return null;
      }

      // --- 2. EVENT BINDING & MESSAGE HANDLING ---
      
      _attachEventListeners() {
        document.addEventListener('focusin', e => this._onFocusIn(e));
        document.addEventListener('focusout', e => this._onFocusOut(e));
        document.addEventListener('keyup', e => this._onKeyUp(e));
        document.addEventListener('selectionchange', () => this._onSelectionChange());
        document.addEventListener('mouseup', e => this._onMouseUp(e));
        document.addEventListener('mousemove', e => this._onMouseMove(e));
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && this.dictationTargetElement) {
            this.dictationCancelled = true;
            this.cancellationReason = 'escape';
            if (this.recognition) this.recognition.stop();
          }
        });
        
        this.onFocusMicIcon.addEventListener('mouseenter', () => this._setMicHover(true));
        this.onFocusMicIcon.addEventListener('mouseleave', () => this._setMicHover(false));
        this.onFocusMicIcon.addEventListener('mousedown', e => this._onMicMouseDown(e));
        this.fab.addEventListener('mousedown', e => this._onFabMouseDown(e));
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

      // --- 3. CORE LOGIC & EVENT HANDLERS ---

      processSelectedText(style = null) {
        const activeElement = this._getTargetElement();
        if (!activeElement) {
            alert("Please select an editable text field, or use the target icon to map the buttons to a field.");
            return;
        }
        activeElement.focus();

        chrome.runtime.sendMessage({ command: 'check-api-key' }, (response) => {
          if (!response.apiKeyExists) {
            alert("Please set your Gemini API key in the extension's popup first.");
            return;
          }

          const selection = window.getSelection();
          let promptText = selection.toString().trim();
          let processingMode = 'selection';

          if (!promptText) {
              processingMode = 'full';
              promptText = this._getElementText(activeElement);
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
            if (chrome.runtime.lastError || !response) return;
            if (response.error) return alert(`Error: ${response.error}`);

            if (response.generatedText) {
              if (processingMode === 'full') {
                if (typeof activeElement.value !== 'undefined') {
                  activeElement.value = response.generatedText;
                } else {
                  activeElement.textContent = response.generatedText;
                }
              } else {
                if (typeof activeElement.selectionStart === 'number') {
                  const start = activeElement.selectionStart;
                  const end = activeElement.selectionEnd;
                  activeElement.value = activeElement.value.slice(0, start) + response.generatedText + activeElement.value.slice(end);
                  const newCursorPos = start + response.generatedText.length;
                  activeElement.selectionStart = activeElement.selectionEnd = newCursorPos;
                } else {
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    const textNode = document.createTextNode(response.generatedText);
                    range.insertNode(textNode);
                    selection.collapseToEnd();
                  }
                }
              }
              activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              if(!this.isDetachedMode) setTimeout(() => this._updateIconPositions(), 200);
            }
          });
        });
      }

      _handleToggleDictation({ start, bypassAi = false }) {
        const activeElement = this._getTargetElement();
        if (!activeElement || !this._isElementSuitable(activeElement)) {
          this._hideListeningIndicator();
          if (this.isDetachedMode) alert("Please select a text field to dictate into, or use the target icon to map one.");
          return;
        }
        activeElement.focus();

        if (start && this.recognition) {
          chrome.runtime.sendMessage({ command: 'check-api-key' }, (response) => {
            if (!response.apiKeyExists) {
              alert("Please set your Gemini API key in the extension's popup first.");
              return;
            }
            this.dictationTargetElement = activeElement;
            this.currentDictationBypassesAi = bypassAi;
            chrome.storage.local.get('selectedLanguage', ({ selectedLanguage }) => {
              this.recognition.lang = selectedLanguage || 'en-US';
              this._playSound('assets/audio/start.mp3');
              this.originalInputText = this._getElementText(this.dictationTargetElement);
              this.dictationTargetElement.addEventListener('blur', () => this._handleFocusLoss(), { once: true });
              this._showListeningIndicator();
              this.recognition.start();
            });
          });
        } else if (!start && this.recognition) {
          this.dictationCancelled = true;
          this.cancellationReason = 'user_action';
          this.recognition.stop();
        } else if (!this.recognition) {
          alert("Speech recognition is not available in this browser.");
        }
      }

      _onRecognitionEnd() {
        if (this.dictationTargetElement && !this.dictationCancelled) {
            this.recognition.start();
            return;
        }
        this._playSound('assets/audio/end.mp3');
        this._hideListeningIndicator();
        const finishedTarget = this.dictationTargetElement;
        if (finishedTarget) {
            finishedTarget.removeEventListener('blur', () => this._handleFocusLoss());
        }

        const shouldRevertText = this.dictationCancelled && (this.cancellationReason === 'escape' || this.cancellationReason === 'blur');

        if (shouldRevertText) {
            if (finishedTarget) {
                if (typeof finishedTarget.value !== 'undefined') finishedTarget.value = this.originalInputText;
                else finishedTarget.textContent = this.originalInputText;
                if (this.cancellationReason === 'escape' && !this.isDetachedMode) this._showOnFocusMicIcon(finishedTarget);
            }
        } else if (finishedTarget && this.finalTranscript.trim()) {
            finishedTarget.style.opacity = '0.5';
            finishedTarget.style.cursor = 'wait';
            chrome.runtime.sendMessage({ prompt: this.finalTranscript.trim(), bypassAi: this.currentDictationBypassesAi }, response => {
                finishedTarget.style.opacity = '1';
                finishedTarget.style.cursor = 'auto';
                if (chrome.runtime.lastError || !response) return; 
                if (response.error) {
                  this._insertTextAtCursor(finishedTarget, this.finalTranscript.trim() + ' ');
                  alert(`Error: ${response.error}`);
                } else if (response.generatedText) {
                  this._insertTextAtCursor(finishedTarget, response.generatedText);
                  finishedTarget.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                }
                if (document.activeElement === finishedTarget && !this.isDetachedMode) this._showOnFocusMicIcon(finishedTarget);
            });
        } else if (finishedTarget && document.activeElement === finishedTarget && !this.isDetachedMode) {
            this._showOnFocusMicIcon(finishedTarget);
        }

        this.dictationTargetElement = null;
        this.originalInputText = '';
        this.finalTranscript = '';
        this.dictationCancelled = false;
        this.cancellationReason = null;
      }

      _onRecognitionError(event) {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
          this._hideListeningIndicator();
          if (this.dictationTargetElement) {
            this.dictationTargetElement.removeEventListener('blur', () => this._handleFocusLoss());
            this.dictationTargetElement.value = this.originalInputText;
          }
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

      // --- 4. UI EVENT HANDLERS (FOCUS, MOUSE, KEYBOARD) ---

      _onFocusIn(event) {
        const target = event.target;
        if (!target || target.disabled || target.readOnly) return;
        
        if (this._isElementSuitable(target)) {
          this.lastFocusedEditableElement = target;
          if (!this.isDetachedMode) {
             if (this.lastFocusedEditableElement && this.lastFocusedEditableElement !== target) this._hideOnFocusMicIcon(true); 
             this._showOnFocusMicIcon(target);
          }
        } else if (!this.isDetachedMode) {
          this._hideOnFocusMicIcon();
          this._hideFab();
          this.lastFocusedEditableElement = null;
        }
      }

      _onFocusOut(event) {
        if (this.isDetachedMode) return;
        if (event.target === this.lastFocusedEditableElement) {
          this.focusOutTimeout = setTimeout(() => {
              if (document.activeElement !== this.lastFocusedEditableElement) {
                  this._hideOnFocusMicIcon();
                  this._hideFab();
                  this.lastFocusedEditableElement = null;
              }
          }, TIMING.FOCUS_OUT_DELAY);
        }
      }

      _onKeyUp() {
        if (this.isDetachedMode || !this.lastFocusedEditableElement || window.getSelection().toString().trim().length > 0) return;
        clearTimeout(this.typingTimer);
        this._hideFab();
        if (this._getElementText(this.lastFocusedEditableElement).trim().length > 0) {
          this.typingTimer = setTimeout(() => {
            if (document.activeElement === this.lastFocusedEditableElement && window.getSelection().toString().trim().length === 0) {
              this._showFab();
            }
          }, TIMING.TYPING_DELAY);
        }
      }

      _onSelectionChange() {
        if (!this.isDetachedMode && this.lastFocusedEditableElement && document.activeElement === this.lastFocusedEditableElement) {
          if (window.getSelection().toString().trim().length > 0) {
            clearTimeout(this.typingTimer);
            this._showFab();
          } else {
            this._hideFab();
          }
        }
      }
      
      _onDragStart(event, elementName) {
        if (this.isMouseDownOnMic || this.isMouseDownOnFab) return;
        this.isDragging = elementName;
        const element = elementName === 'mic' ? this.onFocusMicIcon : this.fab;
        element.style.cursor = 'grabbing';
        this.dragOffsetX = event.clientX - element.getBoundingClientRect().left;
        this.dragOffsetY = event.clientY - element.getBoundingClientRect().top;
      }

      _onDrag(event) {
        if (!this.isDragging) return;
        event.preventDefault();
        const element = this.isDragging === 'mic' ? this.onFocusMicIcon : this.fab;
        let x = Math.max(0, Math.min(event.clientX - this.dragOffsetX, window.innerWidth - element.offsetWidth));
        let y = Math.max(0, Math.min(event.clientY - this.dragOffsetY, window.innerHeight - element.offsetHeight));
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      }

      _onDragEnd(event) {
        if (!this.isDragging) return;
        const element = this.isDragging === 'mic' ? this.onFocusMicIcon : this.fab;
        element.style.cursor = 'pointer';
        setTimeout(() => { this.isDragging = null; }, 50);
      }

      _onMicMouseDown(event) {
        event.preventDefault(); event.stopPropagation();
        setTimeout(() => {
            if (this.isDragging) return;
            this.isMouseDownOnMic = true;
            this.micHoldTimeout = setTimeout(() => {
              if (!this.isMouseDownOnMic) return;
              const micRect = this.onFocusMicIcon.getBoundingClientRect();
              const x = micRect.left + window.scrollX;
              const y = micRect.top + window.scrollY - 34;
              this.transcriptionOnlyButton.style.transform = `translate(${x}px, ${y}px)`;
              this.transcriptionOnlyButton.style.display = 'flex';
            }, TIMING.HOLD_DURATION);
        }, 150);
      }
      
      _onFabMouseDown(event) {
          event.preventDefault(); event.stopPropagation();
          setTimeout(() => {
              if (this.isDragging) return;
              this.isMouseDownOnFab = true;
              this.fabHoldTimeout = setTimeout(() => {
                  if (this.isMouseDownOnFab) this._showFabStyleMenu();
              }, TIMING.HOLD_DURATION);
          }, 150);
      }

      _onMouseMove(event) {
        if (!this.isMouseDownOnMic || this.transcriptionOnlyButton.style.display !== 'flex') return;
        const { clientX, clientY } = event;
        const secondaryRect = this.transcriptionOnlyButton.getBoundingClientRect();
        this.isOverSecondaryButton = (clientX >= secondaryRect.left && clientX <= secondaryRect.right &&
                                       clientY >= secondaryRect.top && clientY <= secondaryRect.bottom);
        this.transcriptionOnlyButton.style.backgroundColor = this.isOverSecondaryButton ? COLORS.TRANSCRIPTION_HOVER_BG : COLORS.TRANSCRIPTION_BG;
      }

      _onMouseUp(event) {
        if (this.isMouseDownOnFab) {
          this.isMouseDownOnFab = false;
          clearTimeout(this.fabHoldTimeout);
          if (this.fabStyleMenu && this.fabStyleMenu.style.display === 'flex') {
            const styleButton = event.target.closest('button[data-style]');
            if (styleButton) this.processSelectedText(styleButton.dataset.style);
            this._hideFabStyleMenu();
          } else {
            this.processSelectedText();
          }
        }
        
        if (!this.isMouseDownOnMic) return;
        this.isMouseDownOnMic = false;
        clearTimeout(this.micHoldTimeout);
        if (this.transcriptionOnlyButton.style.display === 'flex') {
          this._handleToggleDictation({ start: true, bypassAi: this.isOverSecondaryButton });
          this.transcriptionOnlyButton.style.display = 'none';
          this.transcriptionOnlyButton.style.transform = `translateY(10px)`;
        } else {
          if (!this.stopDictationClickHandler) this._handleToggleDictation({ start: true, bypassAi: false });
        }
        this.isOverSecondaryButton = false;
        this._setMicHover(false);
      }

      // --- 5. UI DISPLAY & MANIPULATION ---

      _toggleUIElement(element, show, parent = null) {
          if (show && parent && element) {
              parent.appendChild(element);
              element.style.display = 'flex';
              setTimeout(() => { element.style.opacity = '1'; }, 10);
          } else if (!show && element?.parentElement) {
              element.style.opacity = '0';
              setTimeout(() => element.remove(), TIMING.ICON_FADE_DURATION);
          }
      }
      
      _showOnFocusMicIcon(targetElement) {
        if (this.isDetachedMode) return;
        clearTimeout(this.focusOutTimeout);
        const parent = targetElement.closest('.input-area') || targetElement.parentElement?.parentElement;
        if (!parent) return;
        this.currentIconParent = parent;
        this.originalParentPosition = window.getComputedStyle(parent).position;
        if (this.originalParentPosition === 'static') parent.style.position = 'relative';
        this._toggleUIElement(this.onFocusMicIcon, true, parent);
        if(this.resizeObserver) this.resizeObserver.observe(parent);
        this._updateIconPositions();
      }
      
      _hideOnFocusMicIcon(immediately = false) {
        if (this.isDetachedMode) return;
        const hideAction = () => {
          if (this.onFocusMicIcon?.parentElement) {
            this._toggleUIElement(this.onFocusMicIcon, false);
            setTimeout(() => { 
              if (this.currentIconParent) {
                this.currentIconParent.style.position = this.originalParentPosition;
                this.currentIconParent = null;
              }
              if(this.resizeObserver) this.resizeObserver.disconnect();
            }, TIMING.ICON_FADE_DURATION);
          }
        };
        clearTimeout(this.focusOutTimeout);
        if (immediately) hideAction();
        else this.focusOutTimeout = setTimeout(hideAction, TIMING.ICON_FADE_DURATION);
      }
      
      _showFab() {
        if (this.isDetachedMode || !this.fab || !this.currentIconParent) return;
        this._toggleUIElement(this.fab, true, this.currentIconParent);
        this._updateIconPositions();
      }
      
      _hideFab(immediately = false) {
        if (this.isDetachedMode || !this.fab) return;
        clearTimeout(this.typingTimer);
        const action = () => this._toggleUIElement(this.fab, false);
        if (immediately) {
          this.fab.style.transition = 'none';
          action();
          setTimeout(() => { this.fab.style.transition = 'opacity 0.2s ease-in-out'; }, 50);
        } else {
          action();
        }
        this._hideFabStyleMenu();
      }
      
      _showFabStyleMenu() {
        if (!this.fabStyleMenu) {
          this.fabStyleMenu = this._createElement('div');
          Object.assign(this.fabStyleMenu.style, {
            position: 'absolute', zIndex: Z_INDEX.FAB_MENU, display: 'flex', flexDirection: 'row', gap: '6px',
            padding: '6px', backgroundColor: 'rgba(44, 45, 48, 0.9)', borderRadius: '20px',
            backdropFilter: 'blur(5px)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
          });
          FAB_OUTPUT_STYLES.forEach(style => {
            const button = this._createElement('button', { textContent: style.name, dataset: { style: style.value }});
            Object.assign(button.style, {
              backgroundColor: '#3c3d41', color: '#e1e1e6', border: 'none', borderRadius: '14px',
              padding: '6px 12px', cursor: 'pointer', fontSize: '13px', transition: 'background-color 0.2s ease',
            });
            button.addEventListener('mouseenter', () => button.style.backgroundColor = '#4a4b50');
            button.addEventListener('mouseleave', () => button.style.backgroundColor = '#3c3d41');
            this.fabStyleMenu.appendChild(button);
          });
          document.body.appendChild(this.fabStyleMenu);
        }

        this.fabStyleMenu.style.visibility = 'hidden';
        this.fabStyleMenu.style.display = 'flex';
        const fabRect = this.fab.getBoundingClientRect();
        const menuRect = this.fabStyleMenu.getBoundingClientRect();
        const x = fabRect.left + window.scrollX - menuRect.width;
        const y = fabRect.top + window.scrollY + (fabRect.height / 2) - (menuRect.height / 2);
        this.fabStyleMenu.style.transform = `translate(${x}px, ${y}px)`;
        this.fabStyleMenu.style.visibility = 'visible';
      }

      _hideFabStyleMenu() {
        if (this.fabStyleMenu) this.fabStyleMenu.style.display = 'none';
      }
      
      _updateIconPositions() {
        if (this.isDetachedMode || !this.currentIconParent || !this.lastFocusedEditableElement) return;

        const parentRect = this.currentIconParent.getBoundingClientRect();
        const targetRect = this.lastFocusedEditableElement.getBoundingClientRect();
        const targetRelativeLeft = targetRect.left - parentRect.left;
        const parentHeight = this.currentIconParent.offsetHeight;

        if (this.onFocusMicIcon.parentElement === this.currentIconParent) {
          this.onFocusMicIcon.style.top = `${(parentHeight / 2) - (this.onFocusMicIcon.offsetHeight / 2)}px`;
          this.onFocusMicIcon.style.left = `${targetRelativeLeft + targetRect.width - 34}px`;
        }

        if (this.fab.parentElement === this.currentIconParent) {
          this.fab.style.top = `${(parentHeight / 2) - (this.fab.offsetHeight / 2)}px`;
          this.fab.style.left = `${targetRelativeLeft + targetRect.width - 64}px`;
        }
      }

      _showListeningIndicator() {
        if (!this.onFocusMicIcon) return;
        this.onFocusMicIcon.style.backgroundColor = COLORS.MIC_ACTIVE_BG;
        this.onFocusMicIcon.classList.add('gemini-mic-pulsing');
        this.onFocusMicIcon.querySelectorAll('svg path').forEach(p => p.setAttribute('stroke', COLORS.MIC_ICON_ACTIVE));
        this.stopDictationClickHandler = e => {
          e.preventDefault(); e.stopPropagation();
          this._handleToggleDictation({ start: false });
        };
        this.onFocusMicIcon.addEventListener('click', this.stopDictationClickHandler);
      }
      
      _hideListeningIndicator() {
         if (!this.onFocusMicIcon) return;
         this.onFocusMicIcon.style.backgroundColor = COLORS.MIC_DEFAULT_BG;
         this.onFocusMicIcon.classList.remove('gemini-mic-pulsing');
         this.onFocusMicIcon.querySelectorAll('svg path').forEach(p => p.setAttribute('stroke', COLORS.MIC_ICON_DEFAULT));
         if (this.stopDictationClickHandler) {
           this.onFocusMicIcon.removeEventListener('click', this.stopDictationClickHandler);
           this.stopDictationClickHandler = null;
         }
      }

      _setMicHover(isHovering) {
          if (!this.isMouseDownOnMic && !this.stopDictationClickHandler) {
              this.onFocusMicIcon.style.backgroundColor = isHovering ? COLORS.MIC_HOVER_BG : COLORS.MIC_DEFAULT_BG;
          }
      }

      // --- 6. UTILITY METHODS ---

      _createSvgElement(tag, attributes) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const key in attributes) el.setAttribute(key, attributes[key]);
        return el;
      }

      _createElement(tag, properties = {}) {
        const el = document.createElement(tag);
        Object.entries(properties).forEach(([key, value]) => {
          if (key === 'style') Object.assign(el.style, value);
          else if (key === 'dataset') Object.assign(el.dataset, value);
          else el[key] = value;
        });
        return el;
      }

      _insertTextAtCursor(element, text) {
        element.focus();
        if (typeof element.selectionStart === 'number') {
          const start = element.selectionStart;
          element.value = element.value.slice(0, start) + text + element.value.slice(element.selectionEnd);
          element.selectionStart = element.selectionEnd = start + text.length;
        } else if (element.isContentEditable) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
      
      _getElementText(element) {
          return !element ? '' : (typeof element.value !== 'undefined' ? element.value : element.textContent);
      }

      _isElementSuitable(element) {
        if (!element) return false;
        const tagName = element.tagName.toUpperCase();
        if (element.isContentEditable || ['TEXTAREA'].includes(tagName)) return true;
        if (tagName === 'INPUT') {
          const unsuitable = ['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'time', 'url', 'week'];
          return !unsuitable.includes(element.type.toLowerCase());
        }
        return false;
      }
      
      _playSound(soundFile) {
        chrome.storage.local.get('soundEnabled', ({ soundEnabled }) => {
          if (soundEnabled !== false) (new Audio(chrome.runtime.getURL(soundFile))).play();
        });
      }
    }

    new GeminiContentAssistant();
  }
})();