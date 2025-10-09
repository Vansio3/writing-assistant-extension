// content.js (Intelligent Selection Logic)

(function() {
  const activeElement = document.activeElement;
  if (!activeElement) return;

  const selection = window.getSelection();
  let promptText = selection.toString().trim();
  const isTextareaOrInput = activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT";

  let processingMode;

  // If text is selected, use it. Otherwise, select the entire content of the input field.
  if (promptText) {
    processingMode = 'selection';
  } else if (isTextareaOrInput || activeElement.isContentEditable) {
    processingMode = 'full';
    const text = isTextareaOrInput ? activeElement.value : activeElement.textContent;
    if (!text.trim()) return; // Do nothing if the field is empty.
    activeElement.select(); // Select all text for visual feedback.
    promptText = text;
  } else {
    return; // Do nothing if no text is selected and it's not an editable field.
  }

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
      if (processingMode === 'full') {
        if (isTextareaOrInput) {
          activeElement.value = response.generatedText;
        } else if (activeElement.isContentEditable) {
          activeElement.textContent = response.generatedText;
        }
      } else {
        document.execCommand('insertText', false, response.generatedText);
      }

      const event = new Event('input', { bubbles: true, cancelable: true });
      activeElement.dispatchEvent(event);
    }
  });
})();