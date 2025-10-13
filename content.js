// content.js (Idempotent - safe to inject multiple times)

(async () => {
  // --- START: MODIFIED CODE BLOCK ---
  // The logic is inverted. The extension is now disabled by default.
  // It will only run on sites that the user has explicitly enabled.
  const data = await chrome.storage.local.get('enabledDomains');
  const enabledDomains = data.enabledDomains || [];
  const currentHostname = window.location.hostname;

  // If the current hostname is NOT in the enabled list, stop executing the script.
  if (!enabledDomains.includes(currentHostname)) {
    return;
  }
  // --- END: MODIFIED CODE BLOCK ---

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
        this.detachedContainer = null;
        this.dragHandle = null;
        this.isDragging = false;
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
        
        this.initialize();
      }

      // --- 1. INITIALIZATION ---

      async initialize() {
        const settings = await chrome.storage.local.get('detachButtons');
        this.isDetachedMode = settings.detachButtons !== false;

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
        const micSvg = this._createSvgElement('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none' });
        micSvg.innerHTML = `<path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 19V23" stroke="${COLORS.MIC_ICON_DEFAULT}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        this.onFocusMicIcon = this._createElement('div');
        Object.assign(this.onFocusMicIcon.style, STYLES.MIC_ICON);
        this.onFocusMicIcon.appendChild(micSvg);

        const transcriptionSvg = this._createSvgElement('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: COLORS.MIC_ICON_DEFAULT, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        transcriptionSvg.innerHTML = `<path d="M13.67 8H18a2 2 0 0 1 2 2v4.33"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M22 22 2 2"/><path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586"/><path d="M9 13v2"/><path d="M9.67 4H12v2.33"/>`;
        this.transcriptionOnlyButton = this._createElement('div');
        Object.assign(this.transcriptionOnlyButton.style, STYLES.TRANSCRIPTION_BUTTON);
        this.transcriptionOnlyButton.appendChild(transcriptionSvg);
        document.body.appendChild(this.transcriptionOnlyButton);

        const fabSvg = this._createSvgElement('svg', STYLES.FAB_SVG);
        fabSvg.innerHTML = STYLES.FAB_SVG_PATH;
        this.fab = this._createElement('div');
        Object.assign(this.fab.style, STYLES.FAB);
        this.fab.appendChild(fabSvg);
        
        this.detachedContainer = this._createElement('div');
        this.dragHandle = this._createElement('div');
        this._createSelectorIcon();
      }

      _initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { console.warn("Gemini Assistant: Speech Recognition API not supported."); return; }
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.onresult = e => { for (let i = e.resultIndex; i < e.results.length; ++i) if (e.results[i].isFinal) this.finalTranscript += e.results[i][0].transcript; };
        this.recognition.onend = () => this._onRecognitionEnd();
        this.recognition.onerror = e => this._onRecognitionError(e);
      }
      
      _injectStyles() {
        const styleId = 'gemini-assistant-styles';
        if (document.getElementById(styleId)) return;
        const style = this._createElement('style', { id: styleId });
        style.innerHTML = `
          .gemini-mic-pulsing { animation: gemini-icon-pulse 1.5s infinite ease-in-out; }
          @keyframes gemini-icon-pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); } 50% { transform: scale(1.05); box-shadow: 0 0 0 5px rgba(229, 62, 62, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); } }
          .gemini-assistant-selectable-target { outline: 2px dashed #FFBF00 !important; outline-offset: 2px; box-shadow: 0 0 15px rgba(255, 191, 0, 0.7) !important; transition: outline 0.2s ease, box-shadow 0.2s ease; }
          .gemini-assistant-selectable-target:hover { outline: 2px solid #E53E3E !important; box-shadow: 0 0 15px rgba(229, 62, 62, 1) !important; }`;
        document.head.appendChild(style);
        this.resizeObserver = new ResizeObserver(() => this._updateIconPositions());
      }
      
      // --- DETACHED MODE & FIELD SELECTOR METHODS ---
      
      _initializeDetachedMode() {
        Object.assign(this.detachedContainer.style, {
            position: 'fixed', bottom: '200px', right: '20px', zIndex: Z_INDEX.FAB, display: 'flex',
            alignItems: 'center', backgroundColor: 'rgba(43, 45, 49, 0.85)', borderRadius: '25px',
            padding: '10px 5px 10px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(5px)'
        });

        const buttonColumn = this._createElement('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' } });

        const largerButtonStyle = { position: 'relative', top: 'auto', left: 'auto', width: '40px', height: '40px', opacity: '1', display: 'flex', transition: 'transform 0.1s ease', boxShadow: 'none' };
        
        Object.assign(this.onFocusMicIcon.style, largerButtonStyle);
        this.onFocusMicIcon.querySelector('svg').setAttribute('width', '22');
        this.onFocusMicIcon.querySelector('svg').setAttribute('height', '22');
        
        Object.assign(this.fab.style, largerButtonStyle);
        this.fab.querySelector('svg').setAttribute('width', '16');
        this.fab.querySelector('svg').setAttribute('height', '16');

        const detachedMicWidth = 40;
        const newTranscriptionButtonSize = 34; // Increased from 28px
        const newTranscriptionIconSize = 18;  // Increased from 16px
        const gapAboveMic = 10; // The space between the mic and the transcription button

        Object.assign(this.transcriptionOnlyButton.style, {
            position: 'absolute',
            width: `${newTranscriptionButtonSize}px`, // Apply new width
            height: `${newTranscriptionButtonSize}px`,// Apply new height
            top: `-${newTranscriptionButtonSize + gapAboveMic}px`, // Recalculate top position
            left: `${(detachedMicWidth - newTranscriptionButtonSize) / 2}px`, // Recalculate left to re-center
            transform: 'none',
            display: 'none'
        });

        const transcriptionSvg = this.transcriptionOnlyButton.querySelector('svg');
        transcriptionSvg.setAttribute('width', newTranscriptionIconSize);
        transcriptionSvg.setAttribute('height', newTranscriptionIconSize);
        
        Object.assign(this.dragHandle.style, { width: '15px', alignSelf: 'stretch', marginLeft: '8px', borderRadius: '10px', backgroundColor: COLORS.DETACHED_DRAG_HANDLE, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' });
        for (let i = 0; i < 3; i++) {
            this.dragHandle.appendChild(this._createElement('div', { style: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: COLORS.DETACHED_DRAG_HANDLE_DOT } }));
        }

        const addPressEffect = (el) => { el.addEventListener('mousedown', () => el.style.transform = 'scale(0.9)'); el.addEventListener('mouseup', () => el.style.transform = 'scale(1)'); el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)'); };
        [this.onFocusMicIcon, this.fab].forEach(addPressEffect);
        
        buttonColumn.appendChild(this.transcriptionOnlyButton);
        buttonColumn.appendChild(this.onFocusMicIcon);
        buttonColumn.appendChild(this.fab);
        this.detachedContainer.appendChild(buttonColumn);
        this.detachedContainer.appendChild(this.dragHandle);
        document.body.appendChild(this.detachedContainer);
        this.dragHandle.addEventListener('mousedown', e => this._onDragStart(e));
      }
      
      _createSelectorIcon() {
        const selectorSvg = this._createSvgElement('svg', STYLES.SELECTOR_SVG);
        selectorSvg.innerHTML = '<path d="M12 2L12 5"/><path d="M12 19L12 22"/><path d="M22 12L19 12"/><path d="M5 12L2 12"/><circle cx="12" cy="12" r="7"/>';
        
        const selectorIconContainer = this._createElement('div');
        Object.assign(selectorIconContainer.style, STYLES.SELECTOR_ICON);
        
        selectorIconContainer.appendChild(selectorSvg);
        this.selectorIcon = selectorIconContainer;
      }

      _toggleSelectionMode() {
        this.isSelectionMode = !this.isSelectionMode;
        document.body.style.cursor = this.isSelectionMode ? 'crosshair' : 'default';
        this._highlightSelectableFields(this.isSelectionMode);

        if (this.isSelectionMode) {
          document.addEventListener('click', this._handleSelectionClick, true);
          document.addEventListener('keydown', this._handleSelectionKeydown, true);
        } else {
          document.removeEventListener('click', this._handleSelectionClick, true);
          document.removeEventListener('keydown', this._handleSelectionKeydown, true);
        }
      }

      _highlightSelectableFields(enable) {
        document.querySelectorAll('textarea, input:not([type="button"],[type="checkbox"],[type="radio"],[type="submit"],[type="reset"],[type="file"]), [contenteditable="true"]').forEach(field => {
            if (this._isElementSuitable(field)) field.classList.toggle('gemini-assistant-selectable-target', enable);
        });
      }

      _handleSelectionClick = (e) => {
        e.preventDefault(); 
        e.stopPropagation();

        if (this._isElementSuitable(e.target)) {
            this.mappedTargetElement = e.target;
            this._toggleSelectionMode();
        }
      }

      _handleSelectionKeydown = (e) => { 
        if (e.key === 'Escape') { 
          e.preventDefault(); 
          this._toggleSelectionMode(); 
        } 
      }
      
      _getTargetElement() {
        if (this.mappedTargetElement && document.body.contains(this.mappedTargetElement)) return this.mappedTargetElement;
        if (this.lastFocusedEditableElement && document.body.contains(this.lastFocusedEditableElement)) return this.lastFocusedEditableElement;
        if (this._isElementSuitable(document.activeElement)) return document.activeElement;
        return null;
      }

      // --- 2. EVENT BINDING & MESSAGE HANDLING ---
      
      _attachEventListeners() {
        document.addEventListener('focusin', e => this._onFocusIn(e));
        document.addEventListener('focusout', e => this._onFocusOut(e));
        document.addEventListener('keyup', e => this._onKeyUp(e));
        document.addEventListener('selectionchange', () => this._onSelectionChange());
        document.addEventListener('mousemove', e => this._onMouseMove(e));
        document.addEventListener('mousemove', e => this._onDrag(e));
        document.addEventListener('mouseup', e => this._onGlobalMouseUp(e));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.dictationTargetElement) { this.dictationCancelled = true; this.cancellationReason = 'escape'; if (this.recognition) this.recognition.stop(); } });
        this.onFocusMicIcon.addEventListener('mouseenter', () => this._setMicHover(true));
        this.onFocusMicIcon.addEventListener('mouseleave', () => this._setMicHover(false));
        this.onFocusMicIcon.addEventListener('mousedown', e => this._onMicMouseDown(e));
        this.fab.addEventListener('mousedown', e => this._onFabMouseDown(e));
        this.fab.addEventListener('mouseenter', () => this._setFabHover(true));
        this.fab.addEventListener('mouseleave', () => this._setFabHover(false));
      }
      
      _setupMessageListener() {
          chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
              if (request.command === "process-text") this.processSelectedText();
              else if (request.command === "toggle-dictation") this._handleToggleDictation({ ...request, start: !this.dictationTargetElement });
              else if (request.command === "enter-selection-mode") this._toggleSelectionMode();
              sendResponse(true); return true;
          });
      }

      // --- 3. CORE LOGIC & EVENT HANDLERS ---

      processSelectedText(style = null) {
        const activeElement = this._getTargetElement();
        if (!activeElement) { alert("Please select an editable text field, or use the target icon to map the buttons to a field."); return; }
        activeElement.focus();
        chrome.runtime.sendMessage({ command: 'check-api-key' }, (response) => {
          if (!response.apiKeyExists) { alert("Please set your Gemini API key in the extension's popup first."); return; }
          const selection = window.getSelection();
          let promptText = selection.toString().trim();
          let processingMode = 'selection';
          if (!promptText) {
              processingMode = 'full';
              promptText = this._getElementText(activeElement);
              if (!promptText.trim()) return;
              if (typeof activeElement.select === 'function') activeElement.select();
              else if (activeElement.isContentEditable) { const range = document.createRange(); range.selectNodeContents(activeElement); selection.removeAllRanges(); selection.addRange(range); }
          }
          activeElement.style.opacity = '0.5'; activeElement.style.cursor = 'wait';
          chrome.runtime.sendMessage({ prompt: promptText, style: style }, (response) => {
            activeElement.style.opacity = '1'; activeElement.style.cursor = 'auto';
            if (chrome.runtime.lastError || !response || response.error) { return alert(`Error: ${response?.error || 'Unknown error'}`); }
            if (response.generatedText) {
              if (processingMode === 'full') {
                if (typeof activeElement.value !== 'undefined') activeElement.value = response.generatedText;
                else activeElement.textContent = response.generatedText;
              } else {
                if (typeof activeElement.selectionStart === 'number') {
                  const start = activeElement.selectionStart; const end = activeElement.selectionEnd;
                  activeElement.value = activeElement.value.slice(0, start) + response.generatedText + activeElement.value.slice(end);
                  activeElement.selectionStart = activeElement.selectionEnd = start + response.generatedText.length;
                } else {
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0); range.deleteContents();
                    const textNode = document.createTextNode(response.generatedText);
                    range.insertNode(textNode); selection.collapseToEnd();
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
            if (!response.apiKeyExists) { alert("Please set your Gemini API key in the extension's popup first."); return; }
            this.dictationTargetElement = activeElement; this.currentDictationBypassesAi = bypassAi;
            chrome.storage.local.get('selectedLanguage', ({ selectedLanguage }) => {
              this.recognition.lang = selectedLanguage || 'en-US'; this._playSound('assets/audio/start.mp3');
              this.originalInputText = this._getElementText(this.dictationTargetElement);
              this.dictationTargetElement.addEventListener('blur', this._handleFocusLoss, { once: true });
              this._showListeningIndicator(); this.recognition.start();
            });
          });
        } else if (!start && this.recognition) { this.dictationCancelled = true; this.cancellationReason = 'user_action'; this.recognition.stop(); }
        else if (!this.recognition) { alert("Speech recognition is not available in this browser."); }
      }

      _onRecognitionEnd() {
        if (this.dictationTargetElement && !this.dictationCancelled) { this.recognition.start(); return; }
        this._playSound('assets/audio/end.mp3'); this._hideListeningIndicator();
        const finishedTarget = this.dictationTargetElement;
        if (finishedTarget) finishedTarget.removeEventListener('blur', this._handleFocusLoss);
        if (this.dictationCancelled && (this.cancellationReason === 'escape' || this.cancellationReason === 'blur')) {
            if (finishedTarget) {
                if (typeof finishedTarget.value !== 'undefined') finishedTarget.value = this.originalInputText; else finishedTarget.textContent = this.originalInputText;
                if (this.cancellationReason === 'escape' && !this.isDetachedMode) this._showOnFocusMicIcon(finishedTarget);
            }
        } else if (finishedTarget && this.finalTranscript.trim()) {
            finishedTarget.style.opacity = '0.5'; finishedTarget.style.cursor = 'wait';
            chrome.runtime.sendMessage({ prompt: this.finalTranscript.trim(), bypassAi: this.currentDictationBypassesAi }, response => {
                finishedTarget.style.opacity = '1'; finishedTarget.style.cursor = 'auto';
                if (chrome.runtime.lastError || !response) return; 
                if (response.error) { this._insertTextAtCursor(finishedTarget, this.finalTranscript.trim() + ' '); alert(`Error: ${response.error}`); }
                else if (response.generatedText) { this._insertTextAtCursor(finishedTarget, response.generatedText); finishedTarget.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); }
                if (document.activeElement === finishedTarget && !this.isDetachedMode) this._showOnFocusMicIcon(finishedTarget);
            });
        } else if (finishedTarget && document.activeElement === finishedTarget && !this.isDetachedMode) { this._showOnFocusMicIcon(finishedTarget); }
        this.dictationTargetElement = null; this.originalInputText = ''; this.finalTranscript = ''; this.dictationCancelled = false; this.cancellationReason = null;
      }

      _onRecognitionError(e) { if (e.error !== 'no-speech') { console.error("Speech recognition error:", e.error); this._hideListeningIndicator(); if (this.dictationTargetElement) { this.dictationTargetElement.removeEventListener('blur', this._handleFocusLoss); this.dictationTargetElement.value = this.originalInputText; } this.dictationTargetElement = null; this.originalInputText = ''; } }
      _handleFocusLoss = () => { if (this.recognition && this.dictationTargetElement) { this.dictationCancelled = true; this.cancellationReason = 'blur'; this.recognition.stop(); } }

      // --- 4. UI EVENT HANDLERS (FOCUS, MOUSE, KEYBOARD) ---

      _onFocusIn(e) {
        const target = e.target;
        if (!target || target.disabled || target.readOnly) return;
        if (this._isElementSuitable(target)) {
          this.lastFocusedEditableElement = target;
          if (!this.isDetachedMode) { if (this.lastFocusedEditableElement && this.lastFocusedEditableElement !== target) this._hideOnFocusMicIcon(true); this._showOnFocusMicIcon(target); }
        } else if (!this.isDetachedMode) { this._hideOnFocusMicIcon(); this._hideFab(); this.lastFocusedEditableElement = null; }
      }

      _onFocusOut(e) { if (!this.isDetachedMode && e.target === this.lastFocusedEditableElement) { this.focusOutTimeout = setTimeout(() => { if (document.activeElement !== this.lastFocusedEditableElement) { this._hideOnFocusMicIcon(); this._hideFab(); this.lastFocusedEditableElement = null; } }, TIMING.FOCUS_OUT_DELAY); } }
      _onKeyUp() { if (this.isDetachedMode || !this.lastFocusedEditableElement || window.getSelection().toString().trim().length > 0) return; clearTimeout(this.typingTimer); this._hideFab(); if (this._getElementText(this.lastFocusedEditableElement).trim().length > 0) this.typingTimer = setTimeout(() => { if (document.activeElement === this.lastFocusedEditableElement && window.getSelection().toString().trim().length === 0) this._showFab(); }, TIMING.TYPING_DELAY); }
      _onSelectionChange() { if (!this.isDetachedMode && this.lastFocusedEditableElement && document.activeElement === this.lastFocusedEditableElement) { if (window.getSelection().toString().trim().length > 0) { clearTimeout(this.typingTimer); this._showFab(); } else this._hideFab(); } }
      
      _onDragStart(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = true;
        this.dragHandle.style.cursor = 'grabbing';

        const rect = this.detachedContainer.getBoundingClientRect();

        this.detachedContainer.style.right = 'auto';
        this.detachedContainer.style.bottom = 'auto';
        this.detachedContainer.style.top = `${rect.top}px`;
        this.detachedContainer.style.left = `${rect.left}px`;

        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;
      }
      
      _onDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const el = this.detachedContainer;
        el.style.left = `${Math.max(0, Math.min(e.clientX - this.dragOffsetX, window.innerWidth - el.offsetWidth))}px`;
        el.style.top = `${Math.max(0, Math.min(e.clientY - this.dragOffsetY, window.innerHeight - el.offsetHeight))}px`;
      }

      _onMicMouseDown(e) { e.preventDefault(); e.stopPropagation(); this.isMouseDownOnMic = true; this.micHoldTimeout = setTimeout(() => { if (!this.isMouseDownOnMic || this.isDragging) return; if (this.isDetachedMode) { this.transcriptionOnlyButton.style.display = 'flex'; } else { const micRect = this.onFocusMicIcon.getBoundingClientRect(); this.transcriptionOnlyButton.style.transform = `translate(${micRect.left + window.scrollX}px, ${micRect.top + window.scrollY - 34}px)`; this.transcriptionOnlyButton.style.display = 'flex'; }}, TIMING.HOLD_DURATION);}
      _onFabMouseDown(e) { e.preventDefault(); e.stopPropagation(); this.isMouseDownOnFab = true; this.fabHoldTimeout = setTimeout(() => { if (this.isMouseDownOnFab && !this.isDragging) this._showFabStyleMenu(); }, TIMING.HOLD_DURATION); }
      _onMouseMove(e) { if (!this.isMouseDownOnMic || this.transcriptionOnlyButton.style.display !== 'flex') return; const sR = this.transcriptionOnlyButton.getBoundingClientRect(); this.isOverSecondaryButton = (e.clientX >= sR.left && e.clientX <= sR.right && e.clientY >= sR.top && e.clientY <= sR.bottom); this.transcriptionOnlyButton.style.backgroundColor = this.isOverSecondaryButton ? COLORS.TRANSCRIPTION_HOVER_BG : COLORS.TRANSCRIPTION_BG; }

      _onGlobalMouseUp(e) {
        const wasDrag = this.isDragging;
        if (this.isDragging) {
            this.dragHandle.style.cursor = 'grab';
            this.isDragging = false;
        }
        if (this.isMouseDownOnFab) {
          this.isMouseDownOnFab = false; clearTimeout(this.fabHoldTimeout);
          if (!wasDrag) {
            if (this.fabStyleMenu && this.fabStyleMenu.style.display === 'flex') {
              const styleButton = e.target.closest('button[data-style]');
              if (styleButton) this.processSelectedText(styleButton.dataset.style);
              this._hideFabStyleMenu();
            } else this.processSelectedText();
          } else this._hideFabStyleMenu();
          this._setFabHover(false);
        }
        if (this.isMouseDownOnMic) {
          this.isMouseDownOnMic = false; clearTimeout(this.micHoldTimeout);
          if (!wasDrag) {
              if (this.transcriptionOnlyButton.style.display === 'flex') {
                this._handleToggleDictation({ start: true, bypassAi: this.isOverSecondaryButton });
                this.transcriptionOnlyButton.style.display = 'none';
                if (!this.isDetachedMode) {
                    this.transcriptionOnlyButton.style.transform = `translateY(10px)`;
                }
              } else if (!this.stopDictationClickHandler) this._handleToggleDictation({ start: true, bypassAi: false });
          } else if(this.transcriptionOnlyButton.style.display === 'flex') {
              this.transcriptionOnlyButton.style.display = 'none';
          }
          this.isOverSecondaryButton = false; this._setMicHover(false);
        }
      }

      // --- 5. UI DISPLAY & MANIPULATION ---

      _toggleUIElement(el, show, parent = null) { if (show && parent && el) { parent.appendChild(el); el.style.display = 'flex'; setTimeout(() => { el.style.opacity = '1'; }, 10); } else if (!show && el?.parentElement) { el.style.opacity = '0'; setTimeout(() => el.remove(), TIMING.ICON_FADE_DURATION); } }
      _showOnFocusMicIcon(target) { if (this.isDetachedMode) return; clearTimeout(this.focusOutTimeout); const parent = target.closest('.input-area') || target.parentElement?.parentElement; if (!parent) return; this.currentIconParent = parent; this.originalParentPosition = window.getComputedStyle(parent).position; if (this.originalParentPosition === 'static') parent.style.position = 'relative'; this._toggleUIElement(this.onFocusMicIcon, true, parent); if(this.resizeObserver) this.resizeObserver.observe(parent); this._updateIconPositions(); }
      _hideOnFocusMicIcon(immediately = false) { if (this.isDetachedMode) return; const hide = () => { if (this.onFocusMicIcon?.parentElement) { this._toggleUIElement(this.onFocusMicIcon, false); setTimeout(() => { if (this.currentIconParent) { this.currentIconParent.style.position = this.originalParentPosition; this.currentIconParent = null; } if(this.resizeObserver) this.resizeObserver.disconnect(); }, TIMING.ICON_FADE_DURATION); } }; clearTimeout(this.focusOutTimeout); if (immediately) hide(); else this.focusOutTimeout = setTimeout(hide, TIMING.ICON_FADE_DURATION); }
      _showFab() { if (this.isDetachedMode || !this.fab || !this.currentIconParent) return; this._toggleUIElement(this.fab, true, this.currentIconParent); this._updateIconPositions(); }
      _hideFab(immediately = false) { if (this.isDetachedMode || !this.fab) return; clearTimeout(this.typingTimer); const action = () => this._toggleUIElement(this.fab, false); if (immediately) { this.fab.style.transition = 'none'; action(); setTimeout(() => { this.fab.style.transition = 'opacity 0.2s ease-in-out'; }, 50); } else action(); this._hideFabStyleMenu(); }
      
      _showFabStyleMenu() {
        if (!this.fabStyleMenu) {
          this.fabStyleMenu = this._createElement('div');
          Object.assign(this.fabStyleMenu.style, STYLES.FAB_MENU);
          FAB_OUTPUT_STYLES.forEach(style => {
            const button = this._createElement('button', { textContent: style.name, dataset: { style: style.value }});
            Object.assign(button.style, STYLES.FAB_MENU_BUTTON);
            button.addEventListener('mouseenter', () => button.style.backgroundColor = COLORS.FAB_MENU_BUTTON_HOVER_BG);
            button.addEventListener('mouseleave', () => button.style.backgroundColor = COLORS.FAB_MENU_BUTTON_BG);
            this.fabStyleMenu.appendChild(button);
          });
          document.body.appendChild(this.fabStyleMenu);
        }
        this.fabStyleMenu.style.visibility = 'hidden';
        this.fabStyleMenu.style.display = 'flex';
        const fabRect = this.fab.getBoundingClientRect();
        if (this.isDetachedMode) {
          this.fabStyleMenu.style.flexDirection = 'column';
          this.fabStyleMenu.style.width = '140px'; 
          const menuRect = this.fabStyleMenu.getBoundingClientRect();
          const left = fabRect.left + window.scrollX + (fabRect.width / 2) - (menuRect.width / 2);
          const top = fabRect.top + window.scrollY - menuRect.height - 10;
          this.fabStyleMenu.style.transform = `translate(${left}px, ${top}px)`;
        } else {
          this.fabStyleMenu.style.flexDirection = 'row';
          this.fabStyleMenu.style.width = 'auto'; 
          const menuRect = this.fabStyleMenu.getBoundingClientRect();
          const left = fabRect.left + window.scrollX - menuRect.width - 10;
          const top = fabRect.top + window.scrollY + (fabRect.height / 2) - (menuRect.height / 2);
          this.fabStyleMenu.style.transform = `translate(${left}px, ${top}px)`;
        }

        this.fabStyleMenu.style.visibility = 'visible';
      }

      _hideFabStyleMenu() { if (this.fabStyleMenu) this.fabStyleMenu.style.display = 'none'; }
      _updateIconPositions() { if (this.isDetachedMode || !this.currentIconParent || !this.lastFocusedEditableElement) return; const parentRect = this.currentIconParent.getBoundingClientRect(); const targetRect = this.lastFocusedEditableElement.getBoundingClientRect(); const targetRelativeLeft = targetRect.left - parentRect.left; const parentHeight = this.currentIconParent.offsetHeight; if (this.onFocusMicIcon.parentElement === this.currentIconParent) { this.onFocusMicIcon.style.top = `${(parentHeight / 2) - (this.onFocusMicIcon.offsetHeight / 2)}px`; this.onFocusMicIcon.style.left = `${targetRelativeLeft + targetRect.width - 34}px`; } if (this.fab.parentElement === this.currentIconParent) { this.fab.style.top = `${(parentHeight / 2) - (this.fab.offsetHeight / 2)}px`; this.fab.style.left = `${targetRelativeLeft + targetRect.width - 64}px`; } }
      _showListeningIndicator() { if (!this.onFocusMicIcon) return; this.onFocusMicIcon.style.backgroundColor = COLORS.MIC_ACTIVE_BG; this.onFocusMicIcon.classList.add('gemini-mic-pulsing'); this.onFocusMicIcon.querySelectorAll('svg path').forEach(p => p.setAttribute('stroke', COLORS.MIC_ICON_ACTIVE)); this.stopDictationClickHandler = e => { e.preventDefault(); e.stopPropagation(); this._handleToggleDictation({ start: false }); }; this.onFocusMicIcon.addEventListener('click', this.stopDictationClickHandler); }
      _hideListeningIndicator() { if (!this.onFocusMicIcon) return; this.onFocusMicIcon.style.backgroundColor = COLORS.MIC_DEFAULT_BG; this.onFocusMicIcon.classList.remove('gemini-mic-pulsing'); this.onFocusMicIcon.querySelectorAll('svg path').forEach(p => p.setAttribute('stroke', COLORS.MIC_ICON_DEFAULT)); if (this.stopDictationClickHandler) { this.onFocusMicIcon.removeEventListener('click', this.stopDictationClickHandler); this.stopDictationClickHandler = null; } }
      _setMicHover(isHovering) { if (!this.isMouseDownOnMic && !this.stopDictationClickHandler) this.onFocusMicIcon.style.backgroundColor = isHovering ? COLORS.MIC_HOVER_BG : COLORS.MIC_DEFAULT_BG; }
      _setFabHover(isHovering) { if (!this.isMouseDownOnFab) this.fab.style.backgroundColor = isHovering ? COLORS.FAB_HOVER_BG : COLORS.FAB_BG; }
      
      // --- 6. UTILITY METHODS ---

      _createSvgElement(tag, attr) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const key in attr) el.setAttribute(key, attr[key]); return el; }
      _createElement(tag, prop = {}) { const el = document.createElement(tag); Object.entries(prop).forEach(([key, val]) => { if (key === 'style') Object.assign(el.style, val); else if (key === 'dataset') Object.assign(el.dataset, val); else el[key] = val; }); return el; }
      _insertTextAtCursor(el, text) { el.focus(); if (typeof el.selectionStart === 'number') { const start = el.selectionStart; el.value = el.value.slice(0, start) + text + el.value.slice(el.selectionEnd); el.selectionStart = el.selectionEnd = start + text.length; } else if (el.isContentEditable) { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) { const range = sel.getRangeAt(0); range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); } } }
      _getElementText(el) { return !el ? '' : (typeof el.value !== 'undefined' ? el.value : el.textContent); }
      _isElementSuitable(el) { if (!el) return false; const tag = el.tagName.toUpperCase(); if (el.isContentEditable || ['TEXTAREA'].includes(tag)) return true; if (tag === 'INPUT') return !['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'time', 'url', 'week'].includes(el.type.toLowerCase()); return false; }
      _playSound(file) { chrome.storage.local.get('soundEnabled', ({ soundEnabled }) => { if (soundEnabled !== false) (new Audio(chrome.runtime.getURL(file))).play(); }); }
    }

    new GeminiContentAssistant();
  }
})();