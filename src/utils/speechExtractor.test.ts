// Unit test for speech extraction omitting code blocks and formatting
import { extractSpokenText } from "./speechExtractor";

import { describe, test, expect } from 'vitest';

describe('speechExtractor', () => {
  test('testSpeechExtractor', () => {
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
    expect(spoken1).not.toContain("@Composable");
    expect(spoken1).not.toContain("CustomButton");
    expect(spoken1).not.toContain("Click Me");
    expect(spoken1).toContain("Here is how to create a Jetpack Compose button");
    expect(spoken1).toContain("Remember to test it on an Android device");

    // Test 2: Omitting inline code snippets
    const sampleWithInlineCode = "Use the `fetch()` API or the `axios` library to request data.";
    const spoken2 = extractSpokenText(sampleWithInlineCode);
    expect(spoken2).not.toContain("fetch()");
    expect(spoken2).not.toContain("axios");
    expect(spoken2).toContain("Use the");
    expect(spoken2).toContain("library to request data");

    // Test 3: Markdown link parsing and stripping raw URLs
    const sampleWithLinks = "Check out [Google AI Studio](https://aistudio.google.com) or visit https://gemini.google.com directly.";
    const spoken3 = extractSpokenText(sampleWithLinks);
    expect(spoken3).toContain("Google AI Studio");
    expect(spoken3).not.toContain("https://aistudio.google.com");
    expect(spoken3).not.toContain("https://gemini.google.com");

    // Test 4: Code-only response
    const codeOnly = `\`\`\`python
print("Hello World")
\`\`\``;
    const spoken4 = extractSpokenText(codeOnly);
    expect(spoken4).toBe("");
  });
});
