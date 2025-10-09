// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const dailyCountEl = document.getElementById('dailyCount');
  const totalCountEl = document.getElementById('totalCount');
  const lastOriginalTextEl = document.getElementById('lastOriginalText');
  const copyButton = document.getElementById('copyButton');

  // Retrieve data from storage and display it
  chrome.storage.local.get(['totalCount', 'dailyCount', 'lastOriginalText'], (result) => {
    dailyCountEl.textContent = result.dailyCount ?? 0;
    totalCountEl.textContent = result.totalCount ?? 0;
    lastOriginalTextEl.value = result.lastOriginalText ?? '';
  });

  // Add click listener for the copy button
  copyButton.addEventListener('click', () => {
    const textToCopy = lastOriginalTextEl.value;
    
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    }
  });
});