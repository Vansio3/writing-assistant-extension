// prompt.js

/**
 * A map to provide clearer language names to the AI model.
 * This helps the model understand the context better than a simple language code.
 */
const languageNameMap = {
    'af-ZA': 'Afrikaans',
    'ar-AE': 'Arabic (UAE)',
    'ar-SA': 'Arabic (Saudi Arabia)',
    'bg-BG': 'Bulgarian',
    'ca-ES': 'Catalan',
    'cs-CZ': 'Czech',
    'da-DK': 'Danish',
    'de-DE': 'German',
    'el-GR': 'Greek',
    'en-AU': 'English (Australia)',
    'en-GB': 'English (UK)',
    'en-IN': 'English (India)',
    'en-US': 'English (US)',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'fi-FI': 'Finnish',
    'fr-FR': 'French',
    'he-IL': 'Hebrew',
    'hi-IN': 'Hindi',
    'hu-HU': 'Hungarian',
    'id-ID': 'Indonesian',
    'is-IS': 'Icelandic',
    'it-IT': 'Italian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'ms-MY': 'Malay',
    'nb-NO': 'Norwegian Bokmål',
    'nl-NL': 'Dutch',
    'pl-PL': 'Polish',
    'pt-BR': 'Portuguese (Brazil)',
    'pt-PT': 'Portuguese (Portugal)',
    'ro-RO': 'Romanian',
    'ru-RU': 'Russian',
    'sk-SK': 'Slovak',
    'sr-RS': 'Serbian',
    'sv-SE': 'Swedish',
    'th-TH': 'Thai',
    'tr-TR': 'Turkish',
    'uk-UA': 'Ukrainian',
    'vi-VN': 'Vietnamese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)'
};

/**
 * Creates a highly constrained prompt that is aware of the desired output language.
 * @param {string} inputText - The text selected or dictated by the user.
 * @param {string} languageCode - The language code for the output (e.g., 'es-ES').
 * @returns {string} The formatted prompt.
 */
export function createPrompt(inputText, languageCode = 'en-US') {
  // Find the full language name from the map, or use the code as a fallback.
  const targetLanguage = languageNameMap[languageCode] || languageCode;

  /*
    This new prompt template is much more robust:
    - It explicitly states the required output language.
    - It re-frames the task as "rewriting and translation," which helps the model
      understand when the input language differs from the target language.
    - It provides a clear, cross-language example to reinforce the instruction.
  */
  const promptTemplate = `You are an expert text rewriting and translation model. Your sole purpose is to take the user's input text and return a single, improved version written strictly in the specified target language.

**Critical Rules:**
1. Your output language MUST be: **${targetLanguage}**.
2. You must not provide any explanation, preamble, or alternative options.
3. Your output must be ONLY the rewritten text and nothing else.

Here is an example:
User Input: "i want to have a popup to choose the way to process the text"
Your Output: I need a popup that allows the user to select their preferred text processing method.

---

User Input: "${inputText}"
Your Output:`;

  return promptTemplate;
}