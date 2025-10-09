# Gemini Writing Assistant (Chrome Extension)

This Chrome extension provides a powerful writing assistant powered by the Gemini API. It allows you to rewrite and improve text directly within your browser, using either a keyboard shortcut or a context menu option.

## Features

*   **Rewrite Text On-the-Go**: Improve your writing in any text field or editable area on a webpage.
*   **Two Ways to Activate**:
    *   **Keyboard Shortcut**: Press `Alt+R` to process the selected text or the entire content of a text field.
    *   **Context Menu**: Right-click on selected text and choose "Process with Gemini" to rewrite it.
*   **Smart Selection**: If you haven't selected any text in an editable field, the extension will automatically process the entire content.
*   **API Usage Tracking**: The extension's popup keeps track of your daily and total API calls.
*   **Preserves Your Original Text**: The popup also displays the last original text you processed, so you can easily copy it if needed.
*   **Dark-Themed Popup**: A sleek and modern user interface for a comfortable experience.

## Installation

1.  **Download the ZIP file**: Click on the "Code" button and then "Download ZIP".
2.  **Unzip the file**: Extract the contents of the ZIP file to a permanent folder on your computer.
3.  **Enable Developer Mode in Chrome**:
    *   Open Google Chrome and navigate to `chrome://extensions`.
    *   At the top right, toggle on "Developer mode".
4.  **Load the extension**:
    *   Click on the "Load unpacked" button.
    *   Select the folder where you extracted the extension files.

## Configuration

To use the extension, you need to add your Gemini API key.

1.  **Get your Gemini API Key**: If you don't have one, you can get it from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  **Add the key to the `config.js` file**:
    *   Rename `config.js.example` to `config.js`.
    *   Open the `config.js` file in a text editor.
    *   Replace `"YOUR_GEMINI_API_KEY_HERE"` with your actual API key.
    *   Save the file.
3.  **Reload the extension**:
    *   Go back to `chrome://extensions`.
    *   Click the reload icon for the Gemini Writing Assistant extension.

## How to Use

*   **Using the Keyboard Shortcut**:
    1.  Select the text you want to rewrite in any editable text field.
    2.  Press `Alt+R`.
    3.  The selected text will be replaced with the improved version from Gemini.

*   **Using the Context Menu**:
    1.  Highlight the text you want to process.
    2.  Right-click on the selected text.
    3.  Choose "Process with Gemini" from the context menu.
    4.  The rewritten text will be inserted.

## Project Files

*   `manifest.json`: The manifest file that defines the extension's properties and permissions.
*   `background.js`: The service worker that handles API calls, context menu creation, and keyboard shortcuts.
*   `content.js`: The script that is injected into the active tab to interact with the webpage content.
*   `popup.html`: The HTML structure for the extension's popup.
*   `popup.js`: The JavaScript that powers the popup, displaying API usage and the last original text.
*   `popup.css`: The CSS for styling the popup with a dark theme.
*   `prompt.js`: A module that constructs the prompt sent to the Gemini API for text rewriting.
*   `config.js`: The configuration file where you need to add your Gemini API key.
*   `icon.png`: The extension's icon.