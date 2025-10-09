// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const dailyCountEl = document.getElementById('dailyCount');
  const totalCountEl = document.getElementById('totalCount');

  // Retrieve the counts from storage and display them
  chrome.storage.local.get(['totalCount', 'dailyCount'], (result) => {
    // Use the nullish coalescing operator (??) to default to 0 if a value doesn't exist yet
    dailyCountEl.textContent = result.dailyCount ?? 0;
    totalCountEl.textContent = result.totalCount ?? 0;
  });
});