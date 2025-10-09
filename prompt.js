// prompt.js

/**
 * Creates a highly constrained prompt to ensure the Gemini API returns only the rewritten text.
 * @param {string} inputText - The text selected or entered by the user.
 * @returns {string} The formatted prompt.
 */
export function createPrompt(inputText) {
  /*
    This is a "few-shot" prompt. We give the model a direct example of what we want.
    This is far more effective than just telling it what to do.

    - The Role: "You are a text rewriting model..." sets a clear context.
    - The Rules: "...must not provide any explanation, preamble, or alternative options." sets strict negative constraints.
    - The Example: The "User Input" and "Your Output" pair demonstrates the exact expected behavior.
    - The Final Line: "Your Output:" primes the model to provide its response in the same format.
  */
  const promptTemplate = `You are a text rewriting model. Your sole purpose is to take input text and return a single, improved version. You must not provide any explanation, preamble, or alternative options. Your output must be only the rewritten text and nothing else.

Here is an example:
User Input: "i want to have a popup to choose the way to process the text"
Your Output: I need a popup that allows the user to select their preferred text processing method.

---

User Input: "${inputText}"
Your Output:`;

  return promptTemplate;
}