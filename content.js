// content.js (Final, Robust Version with Selection Fix)

(function() {
  const activeElement = document.activeElement;
  if (!activeElement) return;

  // Store selection details BEFORE making the async API call.
  const selection = window.getSelection();
  const promptText = selection.toString().trim();
  const isTextareaOrInput = activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT";

  let mode;
  let fullText, selectionStart, selectionEnd;

  if (promptText) {
    // --- MODE 1: A portion of text was selected ---
    mode = 'selection';
    if (isTextareaOrInput) {
      // For input fields and textareas, we record the start and end positions.
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
    }
    // For contentEditable elements, the live `selection` object is sufficient.
  } else if (isTextareaOrInput || activeElement.isContentEditable) {
    // --- MODE 2: No text was selected, so process the entire field ---
    mode = 'full';
    const text = isTextareaOrInput ? activeElement.value : activeElement.textContent;
    if (!text.trim()) return; // Don't proceed if the field is empty.
    activeElement.select(); // Select all text to provide visual feedback.
    promptText = text;
  } else {
    // If there's no prompt text and it's not a valid element, do nothing.
    return;
  }

  // --- Send the request to the background script ---
  activeElement.style.opacity = '0.5';
  activeElement.style.cursor = 'wait';

  chrome.runtime.sendMessage({ prompt: promptText }, (response) => {
    activeElement.style.opacity = '1';
    activeElement.style.cursor = 'auto';

    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }

    if (response.error) {
      alert(`Error: ${response.error}`);
    } else if (response.generatedText) {
      // === THE FIX IS HERE ===
      // This new logic correctly replaces either the full content or just the selection.

      if (mode === 'full') {
        // If we were in 'full' mode, replace the entire content.
        if (isTextareaOrInput) {
          activeElement.value = response.generatedText;
        } else if (activeElement.isContentEditable) {
          activeElement.textContent = response.generatedText;
        }
      } else {
        // If we were in 'selection' mode, replace only the selected text.
        // This is the most robust method and works for both simple inputs and complex framework-based editors.
        // It's technically deprecated but is the only universally reliable way to perform this action.
        document.execCommand('insertText', false, response.generatedText);
      }

      // Dispatch an 'input' event to ensure web app frameworks (like React or Vue)
      // recognize the change. This is critical for the change to "stick".
      const event = new Event('input', { bubbles: true, cancelable: true });
      activeElement.dispatchEvent(event);
    }
  });
})();