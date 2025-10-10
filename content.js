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

  // This new variable will track why a dictation was cancelled.
  let cancellationReason = null;

  let resizeObserver = null;

  const repositionIcon = () => {
    if (onFocusMicIcon && lastFocusedEditableElement && onFocusMicIcon.style.display === 'flex') {
      const rect = lastFocusedEditableElement.getBoundingClientRect();
      onFocusMicIcon.style.top = `${rect.top + window.scrollY + (rect.height / 2) - 14}px`;
      onFocusMicIcon.style.left = `${rect.right + window.scrollX - 34}px`;
    }
  };

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
    onFocusMicIcon.addEventListener('mouseenter', () => { onFocusMicIcon.style.backgroundColor = '#e0e0e0'; });
    onFocusMicIcon.addEventListener('mouseleave', () => { onFocusMicIcon.style.backgroundColor = '#f0f0f0'; });
    onFocusMicIcon.addEventListener('mousedown', (event) => {
      event.preventDefault();
      handleToggleDictation({ start: true });
    });
    document.body.appendChild(onFocusMicIcon);
  }

  function showOnFocusMicIcon(targetElement) {
    if (!onFocusMicIcon) return;
    clearTimeout(focusOutTimeout);
    onFocusMicIcon.style.display = 'flex';
    onFocusMicIcon.style.opacity = '1';
    repositionIcon();
    if (resizeObserver) {
      resizeObserver.observe(targetElement);
    }
  }

  function hideOnFocusMicIcon(immediately = false) {
    if (!onFocusMicIcon) return;
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    const delay = immediately ? 0 : 200;
    focusOutTimeout = setTimeout(() => {
      onFocusMicIcon.style.opacity = '0';
      setTimeout(() => { if(onFocusMicIcon) onFocusMicIcon.style.display = 'none'; }, 200);
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
      // Set the cancellation reason to 'blur'
      cancellationReason = 'blur';
      recognition.stop();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dictationTargetElement) {
      dictationCancelled = true;
      // Set the cancellation reason to 'escape'
      cancellationReason = 'escape';
      if (recognition) recognition.stop();
    }
  });

  function playSound(soundFile) {
    const audio = new Audio(chrome.runtime.getURL(soundFile));
    audio.play();
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
          // Only show the icon again if cancellation was via Escape key,
          // as the element is still focused.
          if (cancellationReason === 'escape') {
            showOnFocusMicIcon(finishedTargetElement);
          }
        }
        // Reset state for the next session
        dictationTargetElement = null;
        originalInputText = '';
        finalTranscript = '';
        dictationCancelled = false;
        cancellationReason = null; // Important: Reset the reason
        return;
      }
      
      if (finishedTargetElement && finalTranscript.trim()) {
        finishedTargetElement.style.opacity = '0.5';
        finishedTargetElement.style.cursor = 'wait';
        chrome.runtime.sendMessage({ prompt: finalTranscript.trim() }, (response) => {
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
        if (dictationTargetElement) {
          try {
            chrome.runtime.sendMessage({ command: "update-recording-state", isRecording: true });
          } catch(e) { console.warn("Could not update background state. Context may be invalidated."); }
          playSound('assets/audio/start.mp3');
          originalInputText = dictationTargetElement.value || dictationTargetElement.textContent;
          dictationTargetElement.addEventListener('blur', handleFocusLoss, { once: true });
          showListeningIndicator(dictationTargetElement);
          recognition.start();
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
        handleToggleDictation(request);
      }
      sendResponse(true); return true;
    });

    document.addEventListener('focusin', (event) => {
      const target = event.target;
      const isEditable = target && (
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'color'].includes(target.type)) ||
        target.isContentEditable
      );
      if (isEditable) {
        lastFocusedEditableElement = target;
        showOnFocusMicIcon(target);
      }
    });

    document.addEventListener('focusout', (event) => {
      const target = event.target;
      if (target === lastFocusedEditableElement) {
        hideOnFocusMicIcon();
        lastFocusedEditableElement = null;
      }
    });

    createOnFocusMicIcon();
    initializeSpeechRecognition();
  }
  
  initializeExtension();
}