// content.js (Idempotent - safe to inject multiple times)

// Check if the script has already been initialized on this page
if (typeof window.geminiAssistantInitialized === 'undefined') {
  window.geminiAssistantInitialized = true;

  let recognition;
  let finalTranscript = '';

  let dictationTargetElement = null;
  let originalInputText = '';
  let dictationCancelled = false;

  // --- NEW: A variable to hold our visual indicator overlay ---
  let listeningOverlay = null;

  /**
   * --- NEW: Creates and displays a visual overlay on top of the target element ---
   * This avoids modifying the element directly, bypassing issues with CSPs and
   * dynamic UI frameworks that might revert style or class changes.
   * @param {HTMLElement} targetElement The element to position the overlay over.
   */
  function showListeningIndicator(targetElement) {
    // Remove any existing overlay first
    if (listeningOverlay) {
      listeningOverlay.remove();
    }

    // Create the overlay element
    listeningOverlay = document.createElement('div');
    const rect = targetElement.getBoundingClientRect();

    // Style the overlay
    Object.assign(listeningOverlay.style, {
      position: 'absolute',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: '2px solid #E53E3E', // A clear red border
      borderRadius: getComputedStyle(targetElement).borderRadius, // Match the target's border-radius
      boxSizing: 'border-box', // Ensures border is included in width/height
      pointerEvents: 'none', // Allows clicks to pass through to the element underneath
      zIndex: '2147483647', // Max z-index to ensure it's on top
      transition: 'opacity 0.2s ease-in-out', // Fade out smoothly
      opacity: '1'
    });

    document.body.appendChild(listeningOverlay);
  }

  /**
   * --- NEW: Hides and removes the listening overlay from the DOM ---
   */
  function hideListeningIndicator() {
    if (listeningOverlay) {
      // Fade out before removing for a smoother experience
      listeningOverlay.style.opacity = '0';
      setTimeout(() => {
        if (listeningOverlay) {
          listeningOverlay.remove();
          listeningOverlay = null;
        }
      }, 200); // Wait for fade-out transition
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

  // --- Function to play sound effects ---
  function playSound(soundFile) {
    const audioUrl = chrome.runtime.getURL(soundFile);
    const audio = new Audio(audioUrl);
    audio.play();
  }

  // --- Function to process selected text ---
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

  // --- Function to initialize speech recognition ---
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
      hideListeningIndicator(); // Hide the overlay

      if (dictationCancelled) {
        // Restore original text on cancellation
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
      hideListeningIndicator(); // Hide the overlay on error

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

  // --- Main message listener that waits for commands ---
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
        hideListeningIndicator(); // Hide indicator if no editable element is focused
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

            // --- AMENDED BEHAVIOR ---
            // Show the non-intrusive overlay indicator
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