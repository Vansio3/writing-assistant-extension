// content.js (Idempotent - safe to inject multiple times) 

if (typeof window.geminiAssistantInitialized === 'undefined') {
  window.geminiAssistantInitialized = true;

  let recognition;
  let finalTranscript = '';
  let dictationTargetElement = null;
  let originalInputText = '';
  let dictationCancelled = false;
  let listeningOverlay = null;
  let onFocusMicIcon = null;
  let focusOutTimeout = null;
  let lastFocusedEditableElement = null;
  let cancellationReason = null;
  let resizeObserver = null;
  
  // --- NEW: Variables for click-and-hold feature ---
  let transcriptionOnlyButton = null; 
  let currentDictationBypassesAi = false;
  let isMouseDownOnMic = false;
  let isOverSecondaryButton = false;
  let micHoldTimeout = null;

  // --- NEW: Floating Action Button (FAB) variables ---
  let fab = null; // Holds the FAB element
  let typingTimer = null; // setTimeout reference for detecting typing pause
  const TYPING_DELAY = 1000; // 1 second delay

  // --- NEW: Function to create the Floating Action Button ---
  function createFab() {
    if (fab) return;
    fab = document.createElement('div');
    const svg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.25 10.75L12 7.5L8.75 10.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.25 16.75L12 13.5L8.75 16.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    Object.assign(fab.style, {
      position: 'absolute', width: '32px', height: '32px', borderRadius: '50%',
      backgroundColor: '#007aff', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer',
      zIndex: '2147483647', transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-out',
      opacity: '0', transform: 'scale(0.8)', pointerEvents: 'auto'
    });
    fab.innerHTML = svg;
    fab.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (lastFocusedEditableElement) {
        processSelectedText(); // Reuse existing function to process text
      }
      hideFab(true);
    });
    document.body.appendChild(fab);
  }

  // --- NEW: Function to position and show the FAB ---
  function showFab(targetElement) {
    if (!fab) return;
    const rect = targetElement.getBoundingClientRect();
    fab.style.top = `${rect.top + window.scrollY + (rect.height / 2) - 16}px`; 
    fab.style.left = `${rect.left + window.scrollX - 35}px`; 
    fab.style.display = 'flex';
    setTimeout(() => { 
        fab.style.opacity = '1';
        fab.style.transform = 'scale(1)';
    }, 10);
  }

  // --- NEW: Function to hide the FAB ---
  function hideFab(immediately = false) {
    if (!fab) return;
    clearTimeout(typingTimer);
    if (immediately) {
      fab.style.display = 'none';
      fab.style.opacity = '0';
    } else {
      fab.style.opacity = '0';
      fab.style.transform = 'scale(0.8)';
      setTimeout(() => {
        if (fab.style.opacity === '0') { 
          fab.style.display = 'none';
        }
      }, 200); 
    }
  }

  const repositionIcon = () => {
    if (onFocusMicIcon && lastFocusedEditableElement && onFocusMicIcon.style.display === 'flex') {
      const rect = lastFocusedEditableElement.getBoundingClientRect();
      onFocusMicIcon.style.top = `${rect.top + window.scrollY + (rect.height / 2) - 14}px`;
      onFocusMicIcon.style.left = `${rect.right + window.scrollX - 34}px`;
    }
  };
  
  // --- NEW: Function to create the transcription-only button ---
  function createTranscriptionOnlyButton() {
    if (transcriptionOnlyButton) return;
    transcriptionOnlyButton = document.createElement('div');
    const svg = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 7V5H20V7L13 14V21H11V14L4 7Z" fill="#606367"/>
        <path d="M4 7V5H20V7L13 14V21H11V14L4 7Z" stroke="#606367" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`; // A filter icon to represent "no processing"
    Object.assign(transcriptionOnlyButton.style, {
      position: 'absolute', width: '28px', height: '28px', borderRadius: '50%',
      backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
      zIndex: '2147483648', transition: 'transform 0.2s ease-out, background-color 0.2s ease',
      transform: 'translateY(10px)'
    });
    transcriptionOnlyButton.innerHTML = svg;
    document.body.appendChild(transcriptionOnlyButton);
  }

  function createOnFocusMicIcon() {
    if (onFocusMicIcon) return;
    onFocusMicIcon = document.createElement('div');
    const svg = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19V23" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    Object.assign(onFocusMicIcon.style, {
      position: 'absolute', width: '28px', height: '28px', borderRadius: '50%',
      backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
      zIndex: '2147483646', transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease',
      opacity: '0', pointerEvents: 'auto'
    });
    onFocusMicIcon.innerHTML = svg;
    onFocusMicIcon.addEventListener('mouseenter', () => { if(!isMouseDownOnMic) onFocusMicIcon.style.backgroundColor = '#e0e0e0'; });
    onFocusMicIcon.addEventListener('mouseleave', () => { if(!isMouseDownOnMic) onFocusMicIcon.style.backgroundColor = '#f0f0f0'; });
    
    // --- MODIFICATION: Reworked mousedown to handle click-and-hold ---
    onFocusMicIcon.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      isMouseDownOnMic = true;

      // After a short delay, show the secondary button
      micHoldTimeout = setTimeout(() => {
        if (!isMouseDownOnMic || !transcriptionOnlyButton) return;
        const micRect = onFocusMicIcon.getBoundingClientRect();
        transcriptionOnlyButton.style.top = `${micRect.top + window.scrollY - 34}px`; // Position above
        transcriptionOnlyButton.style.left = `${micRect.left + window.scrollX}px`;
        transcriptionOnlyButton.style.display = 'flex';
        setTimeout(() => transcriptionOnlyButton.style.transform = 'translateY(0px)', 10);
      }, 200);
    });

    document.body.appendChild(onFocusMicIcon);
  }

  function showOnFocusMicIcon(targetElement) {
    if (!onFocusMicIcon) return;
    clearTimeout(focusOutTimeout);
    
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(targetElement);
    }

    onFocusMicIcon.style.display = 'flex';
    onFocusMicIcon.style.opacity = '1';
    repositionIcon();
  }

  function hideOnFocusMicIcon(immediately = false) {
    if (!onFocusMicIcon) return;
    
    const delay = immediately ? 0 : 200;
    
    focusOutTimeout = setTimeout(() => {
      onFocusMicIcon.style.opacity = '0';
      setTimeout(() => { 
        if(onFocusMicIcon) onFocusMicIcon.style.display = 'none'; 
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      }, 200);
    }, delay);
  }

  function showListeningIndicator(targetElement) {
    hideOnFocusMicIcon(true);
    if (listeningOverlay) listeningOverlay.remove();
    listeningOverlay = document.createElement('div');
    const rect = targetElement.getBoundingClientRect();
    const microphoneIconSVG = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19V23" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    const iconContainer = document.createElement('div');
    Object.assign(iconContainer.style, {
      position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)',
      width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#E53E3E',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.2)', animation: 'gemini-icon-pulse 1.5s infinite ease-in-out',
      cursor: 'pointer', pointerEvents: 'auto'
    });
    iconContainer.innerHTML = microphoneIconSVG;
    iconContainer.addEventListener('mousedown', (event) => {
      event.preventDefault();
      handleToggleDictation({ start: false });
    });
    Object.assign(listeningOverlay.style, {
      position: 'absolute', top: `${rect.top + window.scrollY}px`, left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(targetElement).borderRadius,
      pointerEvents: 'none', zIndex: '2147483647', opacity: '0',
    });
    const styleId = 'gemini-listening-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style'); style.id = styleId;
        style.innerHTML = `@keyframes gemini-icon-pulse {
            0% { transform: scale(1) translateY(-50%); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
            50% { transform: scale(1.05) translateY(-50%); box-shadow: 0 0 0 5px rgba(229, 62, 62, 0); }
            100% { transform: scale(1) translateY(-50%); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }}`;
        document.head.appendChild(style);
    }
    listeningOverlay.appendChild(iconContainer); document.body.appendChild(listeningOverlay);
    listeningOverlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
  }

  function hideListeningIndicator() {
    if (listeningOverlay) {
      const fadeOutAnimation = listeningOverlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-in' });
      fadeOutAnimation.onfinish = () => { if (listeningOverlay) { listeningOverlay.remove(); listeningOverlay = null; } };
    }
  }
  
  function handleFocusLoss() {
    if (recognition && dictationTargetElement) {
      dictationCancelled = true;
      cancellationReason = 'blur';
      recognition.stop();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dictationTargetElement) {
      dictationCancelled = true;
      cancellationReason = 'escape';
      if (recognition) recognition.stop();
    }
  });

  function playSound(soundFile) {
    chrome.storage.local.get('soundEnabled', (result) => {
      if (result.soundEnabled !== false) {
        const audio = new Audio(chrome.runtime.getURL(soundFile));
        audio.play();
      }
    });
  }

  function processSelectedText() {
    const activeElement = document.activeElement;
    if (!activeElement) return;
    const selection = window.getSelection();
    let promptText = selection.toString().trim();
    const isTextareaOrInput = activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT";
    let processingMode;
    if (promptText) {
      processingMode = 'selection';
    } else if (isTextareaOrInput || activeElement.isContentEditable) {
      processingMode = 'full';
      const text = isTextareaOrInput ? activeElement.value : activeElement.textContent;
      if (!text.trim()) return;
      activeElement.select();
      promptText = text;
    } else { return; }
    activeElement.style.opacity = '0.5';
    activeElement.style.cursor = 'wait';
    chrome.runtime.sendMessage({ prompt: promptText }, (response) => {
      activeElement.style.opacity = '1';
      activeElement.style.cursor = 'auto';
      if (chrome.runtime.lastError) return console.error(chrome.runtime.lastError.message);
      if (response && response.error) return alert(`Error: ${response.error}`);
      if (response && response.generatedText) {
        if (processingMode === 'full') {
          if (isTextareaOrInput) activeElement.value = response.generatedText;
          else if (activeElement.isContentEditable) activeElement.textContent = response.generatedText;
        } else {
          document.execCommand('insertText', false, response.generatedText);
        }
        activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
    });
  }
  
  function initializeSpeechRecognition() {
    if (recognition) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    chrome.storage.local.get('selectedLanguage', (result) => {
      recognition.lang = result.selectedLanguage || 'en-US';
    });
    
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
    };

    recognition.onend = () => {
      playSound('assets/audio/end.mp3');
      hideListeningIndicator();
      const finishedTargetElement = dictationTargetElement;
      if (finishedTargetElement) {
        finishedTargetElement.removeEventListener('blur', handleFocusLoss);
      }
      try {
        chrome.runtime.sendMessage({ command: "update-recording-state", isRecording: false });
      } catch(e) { console.warn("Could not update background state. Context may be invalidated."); }
      
      if (dictationCancelled) {
        if (finishedTargetElement) {
          finishedTargetElement.value = originalInputText;
          if (cancellationReason === 'escape') {
            showOnFocusMicIcon(finishedTargetElement);
          }
        }
        dictationTargetElement = null;
        originalInputText = '';
        finalTranscript = '';
        dictationCancelled = false;
        cancellationReason = null;
        return;
      }
      
      if (finishedTargetElement && finalTranscript.trim()) {
        finishedTargetElement.style.opacity = '0.5';
        finishedTargetElement.style.cursor = 'wait';
        
        // --- MODIFICATION: Send the bypassAi flag with the prompt ---
        chrome.runtime.sendMessage({ 
          prompt: finalTranscript.trim(),
          bypassAi: currentDictationBypassesAi 
        }, (response) => {
          finishedTargetElement.style.opacity = '1';
          finishedTargetElement.style.cursor = 'auto';
          if (response && response.generatedText) {
            document.execCommand('insertText', false, response.generatedText);
            finishedTargetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          }
          if (document.activeElement === finishedTargetElement) {
            showOnFocusMicIcon(finishedTargetElement);
          }
        });
      } else if (finishedTargetElement) {
        if (document.activeElement === finishedTargetElement) {
          showOnFocusMicIcon(finishedTargetElement);
        }
      }
      
      dictationTargetElement = null;
      originalInputText = '';
      finalTranscript = '';
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      console.error("Speech recognition error:", event.error);
      hideListeningIndicator();
      if (dictationTargetElement) {
        dictationTargetElement.removeEventListener('blur', handleFocusLoss);
        dictationTargetElement.value = originalInputText;
        dictationTargetElement = null;
        originalInputText = '';
      }
    };
  }

  function handleToggleDictation(request) {
    const activeElement = lastFocusedEditableElement;
    if (!activeElement || !(activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT' || activeElement.isContentEditable)) {
      hideListeningIndicator(); return;
    }
    if (request.start) {
      if (recognition) {
        dictationTargetElement = activeElement;
        // --- MODIFICATION: Store the bypass choice for this session ---
        currentDictationBypassesAi = request.bypassAi || false;

        if (dictationTargetElement) {
          chrome.storage.local.get('selectedLanguage', (result) => {
            recognition.lang = result.selectedLanguage || 'en-US';
            try {
              chrome.runtime.sendMessage({ command: "update-recording-state", isRecording: true });
            } catch(e) { console.warn("Could not update background state. Context may be invalidated."); }
            playSound('assets/audio/start.mp3');
            originalInputText = dictationTargetElement.value || dictationTargetElement.textContent;
            dictationTargetElement.addEventListener('blur', handleFocusLoss, { once: true });
            showListeningIndicator(dictationTargetElement);
            recognition.start();
          });
        }
      } else {
        alert("Speech recognition not available in this browser.");
      }
    } else {
      if (recognition) {
        recognition.stop();
      }
    }
  }

  function initializeExtension() {
    resizeObserver = new ResizeObserver(repositionIcon);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.command === "process-text") {
        processSelectedText();
      } else if (request.command === "toggle-dictation") {
        // This path is used by the keyboard shortcut
        handleToggleDictation(request);
      }
      sendResponse(true); return true;
    });

    // --- NEW: Event listener for typing detection ---
    document.addEventListener('keyup', (event) => {
        if (lastFocusedEditableElement) {
            clearTimeout(typingTimer);
            hideFab(); 
            const text = lastFocusedEditableElement.value || lastFocusedEditableElement.textContent;
            if (text && text.trim().length > 0) {
              typingTimer = setTimeout(() => {
                if (document.activeElement === lastFocusedEditableElement) {
                  showFab(lastFocusedEditableElement);
                }
              }, TYPING_DELAY);
            }
        }
    });

    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (!target || target.disabled || target.readOnly) {
        return;
      }

      const tagName = target.tagName.toUpperCase();
      let isSuitable = false;

      if (target.isContentEditable) {
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
        if (!unsuitableTypes.includes(target.type.toLowerCase())) {
          isSuitable = true;
        }
      }

      if (isSuitable) {
        lastFocusedEditableElement = target;
        showOnFocusMicIcon(target);
      } else {
        hideOnFocusMicIcon();
        hideFab();
        lastFocusedEditableElement = null;
      }
    });

    document.addEventListener('focusout', (event) => {
      const target = event.target;
      if (target === lastFocusedEditableElement) {
        hideOnFocusMicIcon();
        hideFab();
        setTimeout(() => {
          if (document.activeElement !== lastFocusedEditableElement) {
            lastFocusedEditableElement = null;
          }
        }, 400); 
      }
    });
    
    // --- NEW: Global mouse listeners for the click-and-hold feature ---
    document.addEventListener('mousemove', (event) => {
      if (!isMouseDownOnMic || !transcriptionOnlyButton || transcriptionOnlyButton.style.display !== 'flex') return;
      const { clientX, clientY } = event;
      const secondaryRect = transcriptionOnlyButton.getBoundingClientRect();

      if (clientX >= secondaryRect.left && clientX <= secondaryRect.right &&
          clientY >= secondaryRect.top && clientY <= secondaryRect.bottom) {
        isOverSecondaryButton = true;
        transcriptionOnlyButton.style.backgroundColor = '#d0d0d0'; // Highlight
      } else {
        isOverSecondaryButton = false;
        transcriptionOnlyButton.style.backgroundColor = '#f0f0f0'; // Default
      }
    });
    
    document.addEventListener('mouseup', (event) => {
      if (!isMouseDownOnMic) return;
      clearTimeout(micHoldTimeout);
      isMouseDownOnMic = false;

      // If the secondary button was visible when mouse was released
      if (transcriptionOnlyButton && transcriptionOnlyButton.style.display === 'flex') {
        if (isOverSecondaryButton) {
          handleToggleDictation({ start: true, bypassAi: true });
        } else {
          // If mouse wasn't over the secondary button, treat as regular click
          handleToggleDictation({ start: true, bypassAi: false });
        }
        // Hide the secondary button
        transcriptionOnlyButton.style.display = 'none';
        transcriptionOnlyButton.style.transform = 'translateY(10px)';
      } else {
        // If it was just a quick click (secondary button never appeared)
        handleToggleDictation({ start: true, bypassAi: false });
      }

      isOverSecondaryButton = false;
      if (onFocusMicIcon) onFocusMicIcon.style.backgroundColor = '#f0f0f0';
    });

    createOnFocusMicIcon();
    createTranscriptionOnlyButton(); // NEW
    initializeSpeechRecognition();
    createFab();
  }
  
  initializeExtension();
}