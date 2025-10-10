// content.js (Idempotent - safe to inject multiple times)

// Check if the script has already been initialized on this page
if (typeof window.geminiAssistantInitialized === 'undefined') {
  window.geminiAssistantInitialized = true;

  let recognition;
  let finalTranscript = '';

  let dictationTargetElement = null;
  let originalInputText = '';
  let dictationCancelled = false;

  let listeningOverlay = null;

  function showListeningIndicator(targetElement) {
    if (listeningOverlay) {
      listeningOverlay.remove();
    }

    listeningOverlay = document.createElement('div');
    const rect = targetElement.getBoundingClientRect();

    const microphoneIconSVG = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19V23" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    const iconContainer = document.createElement('div');
    Object.assign(iconContainer.style, {
      position: 'absolute',
      top: '50%',
      right: '6px',
      transform: 'translateY(-50%)',
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      backgroundColor: '#E53E3E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      animation: 'gemini-icon-pulse 1.5s infinite ease-in-out',
      cursor: 'pointer',
      pointerEvents: 'auto'
    });
    iconContainer.innerHTML = microphoneIconSVG;

    // --- KEY CHANGE ---
    // Use 'mousedown' and 'preventDefault' to stop the input field from losing focus.
    iconContainer.addEventListener('mousedown', (event) => {
      // This is the crucial step. It prevents the blur event on the input.
      event.preventDefault();

      if (recognition) {
        // Now, stopping the recognition will lead to processing, not cancellation.
        recognition.stop();
      }
    });

    Object.assign(listeningOverlay.style, {
      position: 'absolute',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: getComputedStyle(targetElement).borderRadius,
      pointerEvents: 'none',
      zIndex: '214783647',
      opacity: '0',
    });

    const styleId = 'gemini-listening-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @keyframes gemini-icon-pulse {
            0% { transform: scale(1) translateY(-50%); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
            50% { transform: scale(1.05) translateY(-50%); box-shadow: 0 0 0 5px rgba(229, 62, 62, 0); }
            100% { transform: scale(1) translateY(-50%); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
          }
        `;
        document.head.appendChild(style);
    }

    listeningOverlay.appendChild(iconContainer);
    document.body.appendChild(listeningOverlay);

    listeningOverlay.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out', fill: 'forwards' }
    );
  }

  function hideListeningIndicator() {
    if (listeningOverlay) {
      const fadeOutAnimation = listeningOverlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 150, easing: 'ease-in' }
      );
      
      fadeOutAnimation.onfinish = () => {
        if (listeningOverlay) {
          listeningOverlay.remove();
          listeningOverlay = null;
        }
      };
    }
  }

  function handleFocusLoss() {
    if (recognition && dictationTargetElement) {
      dictationCancelled = true;
      recognition.stop();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dictationTargetElement) {
      dictationCancelled = true;
      if (recognition) {
        recognition.stop();
      }
      chrome.runtime.sendMessage({ command: "reset-recording-state" });
    }
  });

  function playSound(soundFile) {
    const audioUrl = chrome.runtime.getURL(soundFile);
    const audio = new Audio(audioUrl);
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
    } else {
      return;
    }

    activeElement.style.opacity = '0.5';
    activeElement.style.cursor = 'wait';

    chrome.runtime.sendMessage({ prompt: promptText }, (response) => {
      activeElement.style.opacity = '1';
      activeElement.style.cursor = 'auto';

      if (chrome.runtime.lastError) return console.error(chrome.runtime.lastError.message);
      if (response.error) return alert(`Error: ${response.error}`);

      if (response.generatedText) {
        if (processingMode === 'full') {
          if (isTextareaOrInput) activeElement.value = response.generatedText;
          else if (activeElement.isContentEditable) activeElement.textContent = response.generatedText;
        } else {
          document.execCommand('insertText', false, response.generatedText);
        }
        const event = new Event('input', { bubbles: true, cancelable: true });
        activeElement.dispatchEvent(event);
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
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.onend = () => {
      playSound('assets/audio/end.mp3');
      hideListeningIndicator();

      if (dictationTargetElement) {
        dictationTargetElement.removeEventListener('blur', handleFocusLoss);
      }

      if (dictationCancelled) {
        if (dictationTargetElement) {
          if (dictationTargetElement.tagName === "TEXTAREA" || dictationTargetElement.tagName === "INPUT") {
            dictationTargetElement.value = originalInputText;
          } else {
            dictationTargetElement.textContent = originalInputText;
          }
        }
        dictationTargetElement = null;
        originalInputText = '';
        finalTranscript = '';
        dictationCancelled = false;
        chrome.runtime.sendMessage({ command: "reset-recording-state" });
        return;
      }

      if (dictationTargetElement && finalTranscript.trim()) {
        dictationTargetElement.style.opacity = '0.5';
        dictationTargetElement.style.cursor = 'wait';

        chrome.runtime.sendMessage({ prompt: finalTranscript.trim() }, (response) => {
          dictationTargetElement.style.opacity = '1';
          dictationTargetElement.style.cursor = 'auto';

          if (response.generatedText) {
            document.execCommand('insertText', false, response.generatedText);
            const event = new Event('input', { bubbles: true, cancelable: true });
            dictationTargetElement.dispatchEvent(event);
          }
          dictationTargetElement = null;
          originalInputText = '';
        });
      }
      finalTranscript = '';
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      console.error("Speech recognition error:", event.error);
      hideListeningIndicator();

      if (dictationTargetElement) {
        dictationTargetElement.removeEventListener('blur', handleFocusLoss);
        if (dictationTargetElement.tagName === "TEXTAREA" || dictationTargetElement.tagName === "INPUT") {
            dictationTargetElement.value = originalInputText;
        } else {
            dictationTargetElement.textContent = originalInputText;
        }
        dictationTargetElement = null;
        originalInputText = '';
      }
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "process-text") {
      processSelectedText();
    } else if (request.command === "toggle-dictation") {
      const activeElement = document.activeElement;
      const isEditable = activeElement && (
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'INPUT' ||
        activeElement.isContentEditable
      );

      if (!isEditable) {
        hideListeningIndicator();
        return;
      }

      initializeSpeechRecognition();
      if (request.start) {
        if (recognition) {
          dictationTargetElement = activeElement;
          if (dictationTargetElement) {
            playSound('assets/audio/start.mp3');
            const isTextElement = dictationTargetElement.tagName === "TEXTAREA" || dictationTargetElement.tagName === "INPUT";
            originalInputText = isTextElement ? dictationTargetElement.value : dictationTargetElement.textContent;
            
            dictationTargetElement.addEventListener('blur', handleFocusLoss, { once: true });
            
            showListeningIndicator(dictationTargetElement);
            recognition.start();
          }
        } else {
          alert("Speech recognition not available in this browser.");
        }
      } else {
        if (recognition) recognition.stop();
      }
    }
    sendResponse(true);
    return true;
  });
}