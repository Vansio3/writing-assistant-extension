# Gemini Writing Assistant README

## Overview

The Gemini Writing Assistant is a Chrome extension that enhances your writing process. It allows you to leverage the power of Google's Gemini model to rewrite, translate, and improve your text directly within your browser. Additionally, it features a dictation mode for hands-free text input and processing.

## Features

*   **Process with Gemini:** Rewrite selected text or the entire content of a text field using the Gemini language model.
*   **Dictation:** Use your voice to dictate text directly into input fields.
*   **On-Focus Mic Icon:** A convenient microphone icon appears next to any focused text field, allowing for quick one-click activation of dictation.
*   **Customizable Output:** Tailor the generated text to your needs by selecting the desired language, style (e.g., professional, casual), and length (e.g., shorter, longer).
*   **Transcription-Only Mode:** Disable AI processing to use the dictation feature for simple voice-to-text transcription.
*   **Context Menu Integration:** Right-click on selected text to quickly process it with Gemini.
*   **Keyboard Shortcuts:**
    *   `Alt+R`: Process the selected text or the text in the current input field.
    *   `Alt+L`: Start or stop dictation.

## Getting Started

### Installation

1.  Clone this repository or download the source code as a ZIP file.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click on "Load unpacked" and select the directory where you saved the extension's files.

### API Key Setup

1.  Obtain a Gemini API key from Google AI Studio.
2.  Click on the Gemini Writing Assistant extension icon in your Chrome toolbar.
3.  Paste your API key into the designated field and click "Save Key."

## Usage

### Text Processing

1.  **Using the Keyboard Shortcut:**
    *   Select the text you want to process.
    *   Press `Alt+R`.
    *   The selected text will be replaced with the output from the Gemini model based on your configured settings.
    *   If no text is selected, the entire content of the currently focused text area or input field will be processed.
2.  **Using the Context Menu:**
    *   Select the text you want to process.
    *   Right-click on the selection.
    *   Choose "Process with Gemini" from the context menu.

### Dictation

You can start dictation in multiple ways:

1.  **Using the Keyboard Shortcut:**
    *   Click on a text field or text area where you want to input text.
    *   Press `Alt+L` to start dictation. You will hear a sound indicating that recording has begun.
    *   Press `Alt+L` again to stop dictation. A sound will indicate the end of the recording, and the dictated text will be processed by Gemini and inserted into the text field.
2.  **Using the On-Focus Microphone Icon:**
    *   When you click into any editable text field, a small microphone icon will appear next to it.
    *   Click this icon to start dictation.
    *   While recording, a red, pulsing microphone icon will be displayed. Click this red icon to stop the dictation.

## Configuration

You can customize the extension's behavior through the popup menu:

*   **Language:** Choose the output language for the processed text.
*   **Style:** Select the desired writing style for the generated content.
*   **Length:** Specify whether the output should be shorter, longer, or a default length.
*   **AI Processing:** Enable or disable Gemini processing for dictation. When disabled, the extension will only perform transcription.
*   **Sounds:** Enable or disable the start and end sounds for dictation.