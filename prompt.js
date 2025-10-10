// prompt.js

/**
 * Creates a highly constrained prompt to ensure the Gemini API returns only the rewritten text.
 * @param {string} inputText - The text selected or entered by the user.
 * @returns {string} The formatted prompt.
 */
export function createPrompt(inputText) {
  const promptTemplate = `You are a text rewriting model. Your sole purpose is to take input text and return a single, improved version in the same language as the input. You must not provide any explanation, preamble, or alternative options. Your output must be only the rewritten text and nothing else.

Here is an example:
User Input: "i want to have a popup to choose the way to process the text"
Your Output: I need a popup that allows the user to select their preferred text processing method.

---

User Input: "${inputText}"
Your Output:`;

  return promptTemplate;
}