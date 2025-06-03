export function separateTextAndJson(inputText: string): {
  textBefore: string;
  jsonBlock: string | null;
  textAfter: string;
  originalInput: string; // To demonstrate it's unchanged
} {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = inputText.match(jsonRegex);

  let textBefore = inputText;
  let jsonBlock: string | null = null;
  let textAfter = "";

  if (match && match[1] && typeof match.index === 'number') {
    // match[0] is the full match, e.g., ```json\n{...}\n```
    // match[1] is the content inside the ```json ... ```, i.e., the JSON string itself
    // match.index is the starting position of the full match

    textBefore = inputText.substring(0, match.index);
    jsonBlock = match[1].trim();
    textAfter = inputText.substring(match.index + match[0].length);
  } else {
    // No JSON block found, so textBefore is the whole string
    // jsonBlock remains null, textAfter remains empty
  }

  return {
    textBefore: textBefore.trim(), // Trim spaces that might result from slicing
    jsonBlock,
    textAfter: textAfter.trim(),   // Trim spaces that might result from slicing
    originalInput: inputText       // Return the original for verification
  };
}