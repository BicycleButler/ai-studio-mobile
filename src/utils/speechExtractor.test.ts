// Unit test for speech extraction omitting code blocks and formatting
import { extractSpokenText } from "./speechExtractor";

export function testSpeechExtractor(): boolean {
  // Test 1: Omitting fenced code blocks
  const sampleWithCode = `
Here is how to create a Jetpack Compose button:

\`\`\`kotlin
@Composable
fun CustomButton(onClick: () -> Unit) {
    Button(onClick = onClick) {
        Text("Click Me")
    }
}
\`\`\`

Remember to test it on an Android device.
`;

  const spoken1 = extractSpokenText(sampleWithCode);
  if (spoken1.includes("@Composable") || spoken1.includes("CustomButton") || spoken1.includes("Click Me")) {
    throw new Error(`Code was not omitted: ${spoken1}`);
  }
  if (!spoken1.includes("Here is how to create a Jetpack Compose button") || !spoken1.includes("Remember to test it on an Android device")) {
    throw new Error(`Explanatory text was missing: ${spoken1}`);
  }

  // Test 2: Omitting inline code snippets
  const sampleWithInlineCode = "Use the `fetch()` API or the `axios` library to request data.";
  const spoken2 = extractSpokenText(sampleWithInlineCode);
  if (spoken2.includes("fetch()") || spoken2.includes("axios")) {
    throw new Error(`Inline code was not omitted: ${spoken2}`);
  }
  if (!spoken2.includes("Use the") || !spoken2.includes("library to request data")) {
    throw new Error(`Surrounding text missing: ${spoken2}`);
  }

  // Test 3: Markdown link parsing and stripping raw URLs
  const sampleWithLinks = "Check out [Google AI Studio](https://aistudio.google.com) or visit https://gemini.google.com directly.";
  const spoken3 = extractSpokenText(sampleWithLinks);
  if (!spoken3.includes("Google AI Studio")) {
    throw new Error(`Link label was not preserved: ${spoken3}`);
  }
  if (spoken3.includes("https://aistudio.google.com") || spoken3.includes("https://gemini.google.com")) {
    throw new Error(`Raw URL was not omitted: ${spoken3}`);
  }

  // Test 4: Code-only response
  const codeOnly = `\`\`\`python
print("Hello World")
\`\`\``;
  const spoken4 = extractSpokenText(codeOnly);
  if (spoken4 !== "") {
    throw new Error(`Expected empty spoken text for code-only response, got: "${spoken4}"`);
  }

  return true;
}
