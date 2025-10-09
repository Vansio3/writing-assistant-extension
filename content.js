// content.js (Final, Robust Version)

(function() {
  const activeElement = document.activeElement;
  let promptText = window.getSelection().toString().trim();
  let mode = 'selection'; // 'selection' or 'full'

  // If no text is selected, try to get the whole value of the input field
  if (!promptText && activeElement && (activeElement.isContentEditable || activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT")) {
      promptText = activeElement.value || activeElement.textContent;
      mode = 'full';
  }

  // Only proceed if we actually have a prompt
  if (promptText) {
    activeElement.style.opacity = '0.5';
    activeElement.style.cursor = 'wait';

    chrome.runtime.sendMessage({ prompt: promptText }, (response) => {
      activeElement.style.opacity = '1';
      activeElement.style.cursor = 'auto';

      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }

      if (response.generatedText) {
        // === THE FIX IS HERE ===
        // This new logic works for both simple inputs and complex framework-based inputs.

        // Step 1: Set the element's value directly.
        if (activeElement.isContentEditable) {
          activeElement.textContent = response.generatedText;
        } else {
          activeElement.value = response.generatedText;
        }

        // Step 2: Dispatch an 'input' event to notify the web app's framework (React, etc.).
        // This is the key to making the change "stick."
        const event = new Event('input', {
          bubbles: true,
          cancelable: true,
        });
        activeElement.dispatchEvent(event);

      } else if (response.error) {
        alert(`Error: ${response.error}`);
      }
    });
  }
})();