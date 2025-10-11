// content.js (Idempotent - safe to inject multiple times) 

if (typeof window.geminiAssistantInitialized === 'undefined') {
  window.geminiAssistantInitialized = true;

  let recognition;
  let finalTranscript = '';
  let dictationTargetElement = null;
  let originalInputText = '';
  let dictationCancelled = false;
  let onFocusMicIcon = null;
  let focusOutTimeout = null;
  let lastFocusedEditableElement = null;
  let cancellationReason = null;
  let resizeObserver = null;
  let stopDictationClickHandler = null; // --- NEW VARIABLE ---
  
  // --- NEW: Variables for parent-injection logic ---
  let currentIconParent = null;
  let originalParentPosition = '';
  
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
  let fabStyleMenu = null;
  let fabHoldTimeout = null;
  let isMouseDownOnFab = false;

  // --- NEW: Array of output styles for the FAB menu ---
  const fabOutputStyles = [
      { value: 'professional', name: 'Professional' },
      { value: 'friendly', name: 'Friendly' },
      { value: 'casual', name: 'Casual' },
      { value: 'technical', name: 'Technical' },
      { value: 'creative', name: 'Creative' }
  ];

  // --- MODIFIED: The FAB is no longer appended to the body on creation. ---
  function createFab() {
    if (fab) return;
    fab = document.createElement('div');
    const svg = `
      <svg width="10" height="10" viewBox="8 7 8 11" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.25 10.75L12 7.5L8.75 10.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.25 16.75L12 13.5L8.75 16.75" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    Object.assign(fab.style, {
      position: 'absolute', top: '0', left: '0', width: '24px', height: '24px', borderRadius: '50%',
      backgroundColor: '#007aff', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer',
      zIndex: '2147483647', transition: 'opacity 0.2s ease-in-out',
      opacity: '0', pointerEvents: 'auto'
    });
    fab.innerHTML = svg;

    fab.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      isMouseDownOnFab = true;
      fabHoldTimeout = setTimeout(() => {
        if (isMouseDownOnFab) {
          showFabStyleMenu();
        }
      }, 200);
    });
  }

  // --- NEW: Function to create and show the FAB style menu ---
  function showFabStyleMenu() {
    if (!fabStyleMenu) {
      fabStyleMenu = document.createElement('div');
      Object.assign(fabStyleMenu.style, {
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
      document.body.appendChild(fabStyleMenu);

      fabOutputStyles.forEach(style => {
        const button = document.createElement('button');
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
        fabStyleMenu.appendChild(button);
      });
    }

    fabStyleMenu.style.visibility = 'hidden';
    fabStyleMenu.style.display = 'flex';

    const fabRect = fab.getBoundingClientRect();
    const menuRect = fabStyleMenu.getBoundingClientRect();

    const x = fabRect.right + window.scrollX - 30;
    const y = fabRect.top + window.scrollY + (fabRect.height / 2) - (menuRect.height / 2) - 50;

    fabStyleMenu.style.transform = `translate(${x}px, ${y}px)`;
    fabStyleMenu.style.visibility = 'visible';
  }

  // --- NEW: Function to hide the FAB style menu ---
  function hideFabStyleMenu() {
    if (fabStyleMenu) {
      fabStyleMenu.style.display = 'none';
    }
  }

  // --- REPLACED: This function now injects and positions the FAB relative to the parent. ---
  function showFab() {
    if (!fab || !currentIconParent || !lastFocusedEditableElement) return;

    currentIconParent.appendChild(fab);

    const parentHeight = currentIconParent.offsetHeight;
    const fabHeight = fab.offsetHeight;
    const top = (parentHeight / 2) - (fabHeight / 2);

    const left = lastFocusedEditableElement.offsetLeft - 30;

    fab.style.top = `${top}px`;
    fab.style.left = `${left}px`;
    fab.style.display = 'flex';
    setTimeout(() => { 
        fab.style.opacity = '1';
    }, 10);
  }

  // --- MODIFIED: This function now removes the FAB from its parent element. ---
  function hideFab(immediately = false) {
    if (!fab || !fab.parentElement) return;

    clearTimeout(typingTimer);

    const performHide = () => {
      fab.style.opacity = '0';
      setTimeout(() => {
        if (fab.parentElement) { 
          fab.remove();
        }
      }, 200);
    };

    if (immediately) {
      fab.style.transition = 'none';
      performHide();
      setTimeout(() => { fab.style.transition = 'opacity 0.2s ease-in-out'; }, 50);
    } else {
      performHide();
    }
    
    hideFabStyleMenu();
  }

  // --- REPLACED: This function now vertically centers the icon within the parent element. ---
  const repositionIcon = () => {
    if (onFocusMicIcon && lastFocusedEditableElement && currentIconParent) {
      const parentHeight = currentIconParent.offsetHeight;
      const iconHeight = onFocusMicIcon.offsetHeight;
      const top = (parentHeight / 2) - (iconHeight / 2);
      const left = lastFocusedEditableElement.offsetLeft + lastFocusedEditableElement.offsetWidth - 34;

      onFocusMicIcon.style.top = `${top}px`;
      onFocusMicIcon.style.left = `${left}px`;
    }
  };
  
  // --- NEW: Function to create the transcription-only button ---
  function createTranscriptionOnlyButton() {
    if (transcriptionOnlyButton) return;
    transcriptionOnlyButton = document.createElement('div');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#606367" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13.67 8H18a2 2 0 0 1 2 2v4.33"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M22 22 2 2"/>
        <path d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586"/><path d="M9 13v2"/><path d="M9.67 4H12v2.33"/>
      </svg>`;
    Object.assign(transcriptionOnlyButton.style, {
      position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
      backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
      zIndex: '2147483648', transition: 'transform 0.2s ease-out, background-color 0.2s ease',
      transform: 'translateY(10px)'
    });
    transcriptionOnlyButton.innerHTML = svg;
    document.body.appendChild(transcriptionOnlyButton);
  }

  // --- MODIFIED: The icon is created but not appended to the body. ---
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
      position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
      backgroundColor: '#f0f0f0', display: 'none', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
      zIndex: '2147483646', transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease',
      opacity: '0', pointerEvents: 'auto'
    });
    onFocusMicIcon.innerHTML = svg;
    onFocusMicIcon.addEventListener('mouseenter', () => { 
      // Only apply hover effect if NOT in active listening mode
      if(!isMouseDownOnMic && !stopDictationClickHandler) {
        onFocusMicIcon.style.backgroundColor = '#e0e0e0'; 
      }
    });
    onFocusMicIcon.addEventListener('mouseleave', () => { 
      // Only apply hover effect if NOT in active listening mode 
      if(!isMouseDownOnMic && !stopDictationClickHandler) {
        onFocusMicIcon.style.backgroundColor = '#f0f0f0'; 
      }
    });
    onFocusMicIcon.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      isMouseDownOnMic = true;

      micHoldTimeout = setTimeout(() => {
        if (!isMouseDownOnMic || !transcriptionOnlyButton) return;
        const micRect = onFocusMicIcon.getBoundingClientRect();
        const x = micRect.left + window.scrollX;
        const y = micRect.top + window.scrollY - 34;
        transcriptionOnlyButton.style.transform = `translate(${x}px, ${y}px)`;
        transcriptionOnlyButton.style.display = 'flex';
      }, 200);
    });
  }

  // --- REPLACED: This function now injects the icon into the parent element. ---
  function showOnFocusMicIcon(targetElement) {
    if (!onFocusMicIcon) return;
    clearTimeout(focusOutTimeout);

    const parent = targetElement.parentElement?.parentElement;
    if (!parent) return;

    currentIconParent = parent;
    originalParentPosition = window.getComputedStyle(parent).position;

    if (originalParentPosition === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(onFocusMicIcon);

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(parent);
    }
    
    repositionIcon();
    onFocusMicIcon.style.display = 'flex';
    setTimeout(() => { onFocusMicIcon.style.opacity = '1' }, 10);
  }

  // --- REPLACED: This function now removes the icon and restores parent styles. ---
  function hideOnFocusMicIcon(immediately = false) {
    if (!onFocusMicIcon) return;
    
    const hide = () => {
      if (onFocusMicIcon && onFocusMicIcon.parentElement) {
        onFocusMicIcon.style.opacity = '0';
      }
      setTimeout(() => { 
        if (onFocusMicIcon && onFocusMicIcon.parentElement) {
          onFocusMicIcon.remove();
        }
        if (currentIconParent) {
          currentIconParent.style.position = originalParentPosition;
          currentIconParent = null;
          originalParentPosition = '';
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      }, 200);
    };

    clearTimeout(focusOutTimeout);
    if (immediately) {
      hide();
    } else {
      focusOutTimeout = setTimeout(hide, 200);
    }
  }

  // --- REPLACED: This function now modifies the existing mic icon to show the listening state. ---
  function showListeningIndicator() {
    if (!onFocusMicIcon) return;

    onFocusMicIcon.style.backgroundColor = '#E53E3E'; // Red background
    onFocusMicIcon.classList.add('gemini-mic-pulsing');

    const paths = onFocusMicIcon.querySelectorAll('svg path');
    paths.forEach(p => p.setAttribute('stroke', '#FFFFFF'));

    stopDictationClickHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleToggleDictation({ start: false });
    };
    onFocusMicIcon.addEventListener('click', stopDictationClickHandler);
  }

  // --- REPLACED: This function reverts the mic icon back to its inactive state. ---
  function hideListeningIndicator() {
    if (!onFocusMicIcon) return;

    onFocusMicIcon.style.backgroundColor = '#f0f0f0'; // Default grey background
    onFocusMicIcon.classList.remove('gemini-mic-pulsing');

    const paths = onFocusMicIcon.querySelectorAll('svg path');
    paths.forEach(p => p.setAttribute('stroke', '#606367'));

    if (stopDictationClickHandler) {
      onFocusMicIcon.removeEventListener('click', stopDictationClickHandler);
      stopDictationClickHandler = null;
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

  function processSelectedText(style = null) {
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
    chrome.runtime.sendMessage({ prompt: promptText, style: style }, (response) => {
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
        
        setTimeout(repositionIcon, 200);
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
            showListeningIndicator(); // --- CHANGED: No longer passes an argument ---
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
    // --- NEW: Inject CSS for the pulsing animation class ---
    const styleId = 'gemini-listening-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
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

    resizeObserver = new ResizeObserver(repositionIcon);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.command === "process-text") {
        processSelectedText();
      } else if (request.command === "toggle-dictation") {
        handleToggleDictation(request);
      }
      sendResponse(true); return true;
    });

    document.addEventListener('selectionchange', () => {
      if (lastFocusedEditableElement && document.activeElement === lastFocusedEditableElement) {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          clearTimeout(typingTimer);
          showFab();
        } else {
          hideFab();
        }
      }
    });

    document.addEventListener('keyup', (event) => {
      if (lastFocusedEditableElement) {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          return;
        }

        clearTimeout(typingTimer);
        hideFab();
        const text = lastFocusedEditableElement.value || lastFocusedEditableElement.textContent;
        if (text && text.trim().length > 0) {
          typingTimer = setTimeout(() => {
            if (document.activeElement === lastFocusedEditableElement && window.getSelection().toString().trim().length === 0) {
              showFab();
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
      
      if (lastFocusedEditableElement && lastFocusedEditableElement !== target) {
          hideOnFocusMicIcon(true); 
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
    
    document.addEventListener('mousemove', (event) => {
      if (!isMouseDownOnMic || !transcriptionOnlyButton || transcriptionOnlyButton.style.display !== 'flex') return;
      const { clientX, clientY } = event;
      const secondaryRect = transcriptionOnlyButton.getBoundingClientRect();

      if (clientX >= secondaryRect.left && clientX <= secondaryRect.right &&
          clientY >= secondaryRect.top && clientY <= secondaryRect.bottom) {
        isOverSecondaryButton = true;
        transcriptionOnlyButton.style.backgroundColor = '#d0d0d0';
      } else {
        isOverSecondaryButton = false;
        transcriptionOnlyButton.style.backgroundColor = '#f0f0f0';
      }
    });
    
    document.addEventListener('mouseup', (event) => {
      if (isMouseDownOnFab) {
        isMouseDownOnFab = false;
        clearTimeout(fabHoldTimeout);
        if (fabStyleMenu && fabStyleMenu.style.display === 'flex') {
          const styleButton = event.target.closest('button');
          if (styleButton && styleButton.dataset.style) {
            processSelectedText(styleButton.dataset.style);
          }
          hideFabStyleMenu();
        } else {
          processSelectedText();
        }
      }

      if (!isMouseDownOnMic) return;
      clearTimeout(micHoldTimeout);
      isMouseDownOnMic = false;

      if (transcriptionOnlyButton && transcriptionOnlyButton.style.display === 'flex') {
        if (isOverSecondaryButton) {
          handleToggleDictation({ start: true, bypassAi: true });
        } else {
          handleToggleDictation({ start: true, bypassAi: false });
        }
        transcriptionOnlyButton.style.display = 'none';
        transcriptionOnlyButton.style.transform = `translateY(10px)`;
      } else {
        // Only trigger dictation if the temporary "stop" handler isn't active
        if(!stopDictationClickHandler) {
          handleToggleDictation({ start: true, bypassAi: false });
        }
      }

      isOverSecondaryButton = false;
      if (onFocusMicIcon) onFocusMicIcon.style.backgroundColor = '#f0f0f0';
    });

    createOnFocusMicIcon();
    createTranscriptionOnlyButton();
    initializeSpeechRecognition();
    createFab();
  }
  
  initializeExtension();
}