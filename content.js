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
  let pulseAnimation = null;

  /**
   * --- REVISED: Creates and displays a focused visual indicator ---
   * This version features a pulsing red left border and a microphone icon
   * with a distinct red background for improved visibility.
   * @param {HTMLElement} targetElement The element to position the overlay over.
   */
  function showListeningIndicator(targetElement) {
    if (listeningOverlay) {
      listeningOverlay.remove();
    }

    listeningOverlay = document.createElement('div');
    const rect = targetElement.getBoundingClientRect();

    // A smaller, white SVG icon to fit inside the new circular background.
    const microphoneIconSVG = `
      <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
      </svg>
    `;

    // Create a dedicated container for the icon.
    const iconContainer = document.createElement('div');
    Object.assign(iconContainer.style, {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      backgroundColor: '#E53E3E', // The requested red background
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
    });
    iconContainer.innerHTML = microphoneIconSVG;

    // Style the main overlay container.
    Object.assign(listeningOverlay.style, {
      position: 'absolute',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: getComputedStyle(targetElement).borderRadius,
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '2147483647',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: '0 8px', // Only horizontal padding for the icon
      opacity: '0',
      borderLeft: '3px solid #E53E3E', // The requested left border
    });

    listeningOverlay.appendChild(iconContainer);
    document.body.appendChild(listeningOverlay);

    // --- Animations ---
    // 1. Fade-in animation (no scale)
    listeningOverlay.animate(
      [{ opacity: 0 }, { opacity: 1 }], 
      { duration: 200, easing: 'ease-out', fill: 'forwards' }
    );

    // 2. Pulse animation for the left border's color
    pulseAnimation = listeningOverlay.animate([
      { borderLeftColor: 'rgba(229, 62, 62, 0.4)' },
      { borderLeftColor: 'rgba(229, 62, 62, 1)' },
      { borderLeftColor: 'rgba(229, 62, 62, 0.4)' }
    ], {
      duration: 1500,
      iterations: Infinity,
      easing: 'ease-in-out'
    });
  }

  /**
   * Hides and removes the overlay with a smooth fade-out animation.
   */
  function hideListeningIndicator() {
    if (listeningOverlay) {
      if (pulseAnimation) {
        pulseAnimation.cancel();
      }

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